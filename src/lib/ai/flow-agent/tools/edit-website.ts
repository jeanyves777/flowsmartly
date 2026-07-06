import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getSiteDir } from "@/lib/website/site-builder";
import {
  applySiteDataUpdate, applySectionRedesign, rebuildAndDeploy, detectSiteSections,
} from "@/lib/website/site-editor";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";

/**
 * edit_website — the agent edits the user's EXISTING website end to end, then
 * rebuilds it. Two modes, one shared backend (the site-editor engine the studio
 * uses):
 *   • content  — apply a structured patch (company info, CTA, services, FAQ,
 *     testimonials, stats, nav/footer links, contact/map, Google Reviews). Free.
 *   • redesign — AI-rewrite a section's code (layout/design/new section) — costs
 *     the section-update price.
 * Heavy (a build takes minutes) → runs as a background task and notifies when
 * live at /home/web. One website per account, so no id is needed.
 * [[agent-operates-account-full-crud]]
 */

const DEFAULT_SECTION_COST = 50;
async function sectionCost(): Promise<number> {
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: "section_update_credit_cost" } });
    if (s?.value) return parseInt(s.value, 10) || DEFAULT_SECTION_COST;
  } catch { /* ignore */ }
  return DEFAULT_SECTION_COST;
}

export const editWebsite: FlowAgentTool = {
  name: "edit_website",
  description:
    "Edit the user's EXISTING website and rebuild it. mode:'content' applies a structured patch — company info, tagline/description, phone/email/address, the CTA button, services, team, FAQ, testimonials + layout, stats, nav/footer links, contact info + Google map, Google Reviews (pass a PARTIAL `content` object — only what changes; but LISTS like services/faq/testimonials/links are replaced wholesale, so call get_website_content first and send the full new list). mode:'redesign' AI-rewrites ONE section's design/layout or adds a section — pass `section` (from get_website_content's editableSections, e.g. 'hero','homepage','services','contact') + `instructions`. The site rebuilds automatically (a few minutes) and you're notified when it's live at /home/web. content is free; redesign costs the section-update price. One website per account. Pass `planId` from a confirmed propose_plan. For publish/unpublish/rename/SEO use update_website instead; to build a NEW site use build_website.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      mode: { type: "string", enum: ["content", "redesign"], description: "'content' = structured data patch; 'redesign' = AI code rewrite of a section." },
      content: {
        type: "object",
        description: "For mode:'content'. A PARTIAL site patch — include only what changes. Lists replace the whole list (send existing + new).",
        properties: {
          company: {
            type: "object",
            properties: {
              name: { type: "string" }, shortName: { type: "string" }, tagline: { type: "string" },
              description: { type: "string" }, about: { type: "string" }, mission: { type: "string" },
              address: { type: "string" }, city: { type: "string" }, state: { type: "string" }, country: { type: "string" },
              website: { type: "string" }, ctaText: { type: "string" }, ctaUrl: { type: "string" },
              phones: { type: "array", items: { type: "string" } },
              emails: { type: "array", items: { type: "string" } },
            },
          },
          stats: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" } } } },
          services: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, shortDescription: { type: "string" }, description: { type: "string" }, icon: { type: "string" }, image: { type: "string" }, link: { type: "string" } } } },
          team: { type: "array", items: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, bio: { type: "string" }, image: { type: "string" } } } },
          faq: { type: "array", items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } } } },
          testimonials: { type: "array", items: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, text: { type: "string" }, rating: { type: "number" }, image: { type: "string" }, video: { type: "string" } } } },
          testimonialsLayout: { type: "string", enum: ["cards", "carousel", "list", "masonry"] },
          navLinks: { type: "array", items: { type: "object", properties: { label: { type: "string" }, href: { type: "string" } } } },
          footerLinks: { type: "array", items: { type: "object", properties: { label: { type: "string" }, href: { type: "string" } } } },
          contactInfo: { type: "object", properties: { mapEmbedUrl: { type: "string" }, mapAddress: { type: "string" } } },
          googleReviews: { type: "object", properties: { enabled: { type: "boolean" }, businessName: { type: "string" }, rating: { type: "number" }, totalReviews: { type: "number" }, googleUrl: { type: "string" }, reviews: { type: "array", items: { type: "object", properties: { name: { type: "string" }, date: { type: "string" }, rating: { type: "number" }, text: { type: "string" } } } } } },
        },
      },
      section: { type: "string", description: "For mode:'redesign'. The section id to rewrite (from get_website_content.editableSections), e.g. 'hero', 'homepage', 'services', 'contact', 'footer'." },
      instructions: { type: "string", description: "For mode:'redesign'. Natural-language description of the design/layout change." },
    },
    required: ["planId", "mode"],
  },
  plans: null,
  costKey: "AGENT_UPDATE_WEBSITE",
  mutating: true,
  autoPlanCost: async (input) => {
    if (input.mode === "redesign") {
      const cost = await sectionCost().catch(() => DEFAULT_SECTION_COST);
      const section = typeof input.section === "string" ? input.section : "section";
      return { credits: cost, label: `Redesign the ${section} section`, detail: "AI rewrites the section, then rebuilds your site" };
    }
    return { credits: 0, label: "Update your website", detail: "Applies your changes and rebuilds — free" };
  },
  handler: async (input, ctx) => {
    try {
      const mode = input.mode === "redesign" ? "redesign" : input.mode === "content" ? "content" : null;
      if (!mode) return { ok: false, error_code: "missing_input", message: "Set mode to 'content' (a data patch) or 'redesign' (AI section rewrite)." };

      const site = await prisma.website.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, slug: true, generatedPath: true, siteData: true, generatorVersion: true },
      });
      if (!site) {
        return { ok: false, error_code: "validation_failed", message: "The user has no website yet. Offer to build one with build_website." };
      }
      const ref = { id: site.id, slug: site.slug, generatedPath: site.generatedPath, siteData: site.siteData };

      // ── Redesign mode ──
      if (mode === "redesign") {
        const section = typeof input.section === "string" ? input.section.trim() : "";
        const instructions = typeof input.instructions === "string" ? input.instructions.trim() : "";
        if (!section || !instructions) return { ok: false, error_code: "missing_input", message: "For a redesign, pass both `section` and `instructions`." };

        const sections = detectSiteSections(site.generatedPath || getSiteDir(site.id));
        if (!sections.some((s) => s.id === section)) {
          return { ok: false, error_code: "validation_failed", message: `"${section}" isn't an editable section here. Available: ${sections.map((s) => s.id).join(", ")}. Call get_website_content to confirm.` };
        }

        const cost = await sectionCost();
        const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
        if (!ctx.isAdmin && (user?.aiCredits ?? 0) < cost) {
          return { ok: false, error_code: "insufficient_credits", message: `Redesigning a section costs ${cost} credits. User has ${user?.aiCredits ?? 0}.`, meta: { need: cost, have: user?.aiCredits ?? 0 } };
        }

        const taskId = await spawnBackgroundTask({
          userId: ctx.userId, conversationId: ctx.conversationId, messageId: ctx.messageId,
          kind: "edit_website", input: { mode, section }, creditCost: cost,
          worker: async (taskId) => {
            publishTaskEvent({ type: "progress", taskId, progress: 15, message: `Redesigning the ${section} section…` });
            const res = await applySectionRedesign({ website: ref, section, prompt: instructions });
            if (!res.ok) {
              await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_website", ok: false, summary: "Your website redesign hit a snag", detail: res.error, deepLink: "/home/web" });
              throw new Error(res.error || "Section redesign failed");
            }
            if (!ctx.isAdmin && cost > 0) {
              await creditService.deductCredits({ userId: ctx.userId, type: TRANSACTION_TYPES.USAGE, amount: cost, referenceType: "ai_website_section", referenceId: site.id, description: `Website section redesign (${section}): ${site.name}` });
            }
            publishTaskEvent({ type: "progress", taskId, progress: 60, message: "Rebuilding your site…" });
            const build = await rebuildAndDeploy({ id: site.id, slug: site.slug, generatedPath: site.generatedPath, generatorVersion: site.generatorVersion });
            if (!build.success) {
              await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_website", ok: false, summary: "Your site rebuild hit a snag", detail: build.error, deepLink: "/home/web" });
              throw new Error(build.error || "Rebuild failed");
            }
            await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_website", ok: true, summary: `Your ${section} section is redesigned`, detail: "Open your site to review it.", deepLink: "/home/web" });
            return { output: { websiteId: site.id, section, link: "/home/web" }, resultRefType: "Website", resultRefId: site.id };
          },
        });
        ctx.emit({ type: "task_started", taskId, kind: "edit_website", summary: `Redesigning your ${section} section and rebuilding — I'll notify you when it's live at /home/web.` });
        return { ok: true, data: { taskId, creditCostQuoted: cost, userMessage: `Started the ${section} redesign. It rebuilds in the background and lands at /home/web — tell the user you'll notify them when it's ready.` } };
      }

      // ── Content mode ──
      const content = input.content && typeof input.content === "object" ? input.content as Record<string, unknown> : null;
      if (!content || Object.keys(content).length === 0) {
        return { ok: false, error_code: "missing_input", message: "For mode:'content', pass a `content` patch (e.g. { company: { tagline: '…' } }). Call get_website_content first if you're changing a list." };
      }

      const taskId = await spawnBackgroundTask({
        userId: ctx.userId, conversationId: ctx.conversationId, messageId: ctx.messageId,
        kind: "edit_website", input: { mode, fields: Object.keys(content) }, creditCost: 0,
        worker: async (taskId) => {
          publishTaskEvent({ type: "progress", taskId, progress: 25, message: "Applying your changes…" });
          await applySiteDataUpdate({ website: ref, data: content });
          publishTaskEvent({ type: "progress", taskId, progress: 60, message: "Rebuilding your site…" });
          const build = await rebuildAndDeploy({ id: site.id, slug: site.slug, generatedPath: site.generatedPath, generatorVersion: site.generatorVersion });
          if (!build.success) {
            await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_website", ok: false, summary: "Your site rebuild hit a snag", detail: build.error, deepLink: "/home/web" });
            throw new Error(build.error || "Rebuild failed");
          }
          await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_website", ok: true, summary: `Your website "${site.name}" is updated`, detail: "Open it to review the changes.", deepLink: "/home/web" });
          return { output: { websiteId: site.id, updated: Object.keys(content), link: "/home/web" }, resultRefType: "Website", resultRefId: site.id };
        },
      });
      ctx.emit({ type: "task_started", taskId, kind: "edit_website", summary: `Updating your website (${Object.keys(content).join(", ")}) and rebuilding — I'll notify you when it's live at /home/web.` });
      return { ok: true, data: { taskId, creditCostQuoted: 0, userMessage: `Started updating the website (${Object.keys(content).join(", ")}). It rebuilds in the background and lands at /home/web — tell the user you'll notify them when it's ready.` } };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to edit the website." };
    }
  },
};
