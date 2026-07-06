import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getStoreDir } from "@/lib/store-builder/store-site-builder";
import {
  applyStoreDataUpdate, applyStoreSectionRedesign, rebuildAndDeployStore, detectStoreSections,
} from "@/lib/store-builder/store-editor";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";

/**
 * edit_store — the agent edits the user's EXISTING storefront end to end, then
 * rebuilds it. Two modes, one shared backend (the store-editor engine the Store
 * Studio uses):
 *   • content  — a structured patch (store info, CTA, hero, categories, nav/
 *     footer links, FAQ). Free.
 *   • redesign — AI-rewrite a section's code (layout/design) — costs the
 *     section-update price.
 * Heavy (a build takes minutes) → background task, notifies when live at
 * /home/sell. One store per account. For products/orders use the product/order
 * tools; to build a NEW store use build_store. [[agent-operates-account-full-crud]]
 */

const DEFAULT_SECTION_COST = 50;
async function sectionCost(): Promise<number> {
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: "section_update_credit_cost" } });
    if (s?.value) return parseInt(s.value, 10) || DEFAULT_SECTION_COST;
  } catch { /* ignore */ }
  return DEFAULT_SECTION_COST;
}

export const editStore: FlowAgentTool = {
  name: "edit_store",
  description:
    "Edit the user's EXISTING storefront design/content and rebuild it. mode:'content' applies a structured patch — storeInfo (name, tagline, description, about, mission, address, ctaText, ctaUrl, logoUrl, bannerUrl, currency), heroConfig (headline, subheadline, ctaText, ctaUrl, style, slides), navLinks, footerLinks, faq, categories. Pass a PARTIAL `content` object — only what changes; but LISTS (navLinks/footerLinks/faq/categories) are replaced wholesale, so call get_store_content first and send the full new list. mode:'redesign' AI-rewrites ONE section's design/layout — pass `section` (from get_store_content's editableSections, e.g. 'hero','homepage','products','contact','footer') + `instructions`. The store rebuilds automatically (a few minutes) and you're notified when live at /home/sell. content is free; redesign costs the section-update price. One store per account. Pass `planId` from a confirmed propose_plan. For adding/editing PRODUCTS use add_product/update_product; to build a NEW store use build_store.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      mode: { type: "string", enum: ["content", "redesign"], description: "'content' = structured data patch; 'redesign' = AI code rewrite of a section." },
      content: {
        type: "object",
        description: "For mode:'content'. A PARTIAL storefront patch — include only what changes. Lists replace the whole list (send existing + new).",
        properties: {
          storeInfo: {
            type: "object",
            properties: {
              name: { type: "string" }, tagline: { type: "string" }, description: { type: "string" },
              about: { type: "string" }, mission: { type: "string" }, address: { type: "string" },
              ctaText: { type: "string" }, ctaUrl: { type: "string" }, logoUrl: { type: "string" },
              bannerUrl: { type: "string" }, currency: { type: "string" },
              phones: { type: "array", items: { type: "string" } },
              emails: { type: "array", items: { type: "string" } },
            },
          },
          heroConfig: {
            type: "object",
            properties: {
              headline: { type: "string" }, subheadline: { type: "string" }, ctaText: { type: "string" }, ctaUrl: { type: "string" },
              style: { type: "string", enum: ["slideshow", "image", "gradient"] },
              slides: { type: "array", items: { type: "string" } },
            },
          },
          navLinks: { type: "array", items: { type: "object", properties: { label: { type: "string" }, href: { type: "string" } } } },
          footerLinks: { type: "array", items: { type: "object", properties: { label: { type: "string" }, href: { type: "string" } } } },
          faq: { type: "array", items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } } } },
          categories: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, description: { type: "string" }, image: { type: "string" } } } },
        },
      },
      section: { type: "string", description: "For mode:'redesign'. The section id to rewrite (from get_store_content.editableSections), e.g. 'hero', 'homepage', 'products', 'contact', 'footer'." },
      instructions: { type: "string", description: "For mode:'redesign'. Natural-language description of the design/layout change." },
    },
    required: ["planId", "mode"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  autoPlanCost: async (input) => {
    if (input.mode === "redesign") {
      const cost = await sectionCost().catch(() => DEFAULT_SECTION_COST);
      const section = typeof input.section === "string" ? input.section : "section";
      return { credits: cost, label: `Redesign the ${section} section`, detail: "AI rewrites the section, then rebuilds your store" };
    }
    return { credits: 0, label: "Update your store", detail: "Applies your changes and rebuilds — free" };
  },
  handler: async (input, ctx) => {
    try {
      const mode = input.mode === "redesign" ? "redesign" : input.mode === "content" ? "content" : null;
      if (!mode) return { ok: false, error_code: "missing_input", message: "Set mode to 'content' (a data patch) or 'redesign' (AI section rewrite)." };

      const store = await prisma.store.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, slug: true, generatedPath: true, siteData: true },
      });
      if (!store) {
        return { ok: false, error_code: "validation_failed", message: "The user has no store yet. Offer to build one with build_store." };
      }
      const ref = { id: store.id, slug: store.slug, generatedPath: store.generatedPath, siteData: store.siteData };

      // ── Redesign mode ──
      if (mode === "redesign") {
        const section = typeof input.section === "string" ? input.section.trim() : "";
        const instructions = typeof input.instructions === "string" ? input.instructions.trim() : "";
        if (!section || !instructions) return { ok: false, error_code: "missing_input", message: "For a redesign, pass both `section` and `instructions`." };

        const sections = detectStoreSections(store.generatedPath || getStoreDir(store.id));
        if (!sections.some((s) => s.id === section)) {
          return { ok: false, error_code: "validation_failed", message: `"${section}" isn't an editable section here. Available: ${sections.map((s) => s.id).join(", ")}. Call get_store_content to confirm.` };
        }

        const cost = await sectionCost();
        const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
        if (!ctx.isAdmin && (user?.aiCredits ?? 0) < cost) {
          return { ok: false, error_code: "insufficient_credits", message: `Redesigning a section costs ${cost} credits. User has ${user?.aiCredits ?? 0}.`, meta: { need: cost, have: user?.aiCredits ?? 0 } };
        }

        const taskId = await spawnBackgroundTask({
          userId: ctx.userId, conversationId: ctx.conversationId, messageId: ctx.messageId,
          kind: "edit_store", input: { mode, section }, creditCost: cost,
          worker: async (taskId) => {
            publishTaskEvent({ type: "progress", taskId, progress: 15, message: `Redesigning the ${section} section…` });
            const res = await applyStoreSectionRedesign({ store: ref, section, prompt: instructions });
            if (!res.ok) {
              await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_store", ok: false, summary: "Your store redesign hit a snag", detail: res.error, deepLink: "/home/sell" });
              throw new Error(res.error || "Section redesign failed");
            }
            if (!ctx.isAdmin && cost > 0) {
              await creditService.deductCredits({ userId: ctx.userId, type: TRANSACTION_TYPES.USAGE, amount: cost, referenceType: "ai_store_section", referenceId: store.id, description: `Store section redesign (${section}): ${store.name}` });
            }
            publishTaskEvent({ type: "progress", taskId, progress: 60, message: "Updating your store…" });
            const build = await rebuildAndDeployStore({ id: store.id, slug: store.slug });
            if (!build.success) {
              await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_store", ok: false, summary: "Your store update hit a snag", detail: build.error, deepLink: "/home/sell" });
              throw new Error(build.error || "Store update failed");
            }
            await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_store", ok: true, summary: `Your ${section} section is redesigned`, detail: "Open your store to review it.", deepLink: "/home/sell" });
            return { output: { storeId: store.id, section, link: "/home/sell" }, resultRefType: "Store", resultRefId: store.id };
          },
        });
        ctx.emit({ type: "task_started", taskId, kind: "edit_store", summary: `Redesigning your ${section} section and updating your store — I'll notify you when it's live at /home/sell.` });
        return { ok: true, data: { taskId, creditCostQuoted: cost, userMessage: `Started the ${section} redesign. It updates in the background and lands at /home/sell — tell the user you'll notify them when it's ready.` } };
      }

      // ── Content mode ──
      const content = input.content && typeof input.content === "object" ? input.content as Record<string, unknown> : null;
      if (!content || Object.keys(content).length === 0) {
        return { ok: false, error_code: "missing_input", message: "For mode:'content', pass a `content` patch (e.g. { storeInfo: { tagline: '…' } }). Call get_store_content first if you're changing a list." };
      }

      const taskId = await spawnBackgroundTask({
        userId: ctx.userId, conversationId: ctx.conversationId, messageId: ctx.messageId,
        kind: "edit_store", input: { mode, fields: Object.keys(content) }, creditCost: 0,
        worker: async (taskId) => {
          publishTaskEvent({ type: "progress", taskId, progress: 25, message: "Applying your changes…" });
          const applied = await applyStoreDataUpdate({ store: ref, patch: content });
          if (!applied.ok) {
            await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_store", ok: false, summary: "Your store update hit a snag", detail: applied.error, deepLink: "/home/sell" });
            throw new Error(applied.error || "Store update failed");
          }
          publishTaskEvent({ type: "progress", taskId, progress: 60, message: "Updating your store…" });
          const build = await rebuildAndDeployStore({ id: store.id, slug: store.slug });
          if (!build.success) {
            await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_store", ok: false, summary: "Your store update hit a snag", detail: build.error, deepLink: "/home/sell" });
            throw new Error(build.error || "Store update failed");
          }
          await notifyAgentTaskComplete({ userId: ctx.userId, taskId, kind: "edit_store", ok: true, summary: `Your store "${store.name}" is updated`, detail: "Open it to review the changes.", deepLink: "/home/sell" });
          return { output: { storeId: store.id, updated: Object.keys(content), link: "/home/sell" }, resultRefType: "Store", resultRefId: store.id };
        },
      });
      ctx.emit({ type: "task_started", taskId, kind: "edit_store", summary: `Updating your store (${Object.keys(content).join(", ")}) and rebuilding — I'll notify you when it's live at /home/sell.` });
      return { ok: true, data: { taskId, creditCostQuoted: 0, userMessage: `Started updating the store (${Object.keys(content).join(", ")}). It rebuilds in the background and lands at /home/sell — tell the user you'll notify them when it's ready.` } };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to edit the store." };
    }
  },
};
