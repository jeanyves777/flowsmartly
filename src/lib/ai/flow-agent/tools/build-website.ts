import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { runWebsiteAgentV3 } from "@/lib/website/website-agent";
import type { SiteQuestionnaire } from "@/types/website-builder";
import { getUserPreferredLanguage } from "@/lib/ai/user-language";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";

/**
 * build_website — orchestrate the EXISTING website builder agent
 * (runWebsiteAgentV3) from chat: collect the brief, create the Website
 * row, run the real builder (writes files + builds + deploys), then
 * report back with a link to /websites/[id]/edit. Does NOT reimplement
 * site building — it drives the same agent the Website Builder page uses.
 *
 * Heavy (npm install + next build + deploy, several minutes) → background
 * task; the worker AWAITS runWebsiteAgentV3 which resolves when the build
 * finishes. Mutating, confirmed-plan. Cost: AI_WEBSITE_GENERATE (500).
 *
 * Constraints mirrored from POST /api/websites: 1 site per account, paid
 * plan or purchased credits required.
 */
export const buildWebsite: FlowAgentTool = {
  name: "build_website",
  description:
    "Build a real, hosted multi-page website by driving the platform's Website Builder agent. Collect: business name, what it does, industry, audience, which pages, and a style. The services/brand come from the user's Brand Kit. Runs the full build in the background (several minutes) and lands at /home/web to edit. EXPENSIVE — 500 credits — so confirm cost via propose_plan. One website per account (tell the user to edit/delete their existing one if they already have a site). Pass `planId` from a confirmed propose_plan.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      businessName: { type: "string", description: "The site's business name. Required." },
      description: { type: "string", description: "What the business does. Required — drives the copy." },
      industry: { type: "string", description: "Industry/category. Defaults from Brand Kit if omitted." },
      targetAudience: { type: "string", description: "Who it's for. Defaults from Brand Kit." },
      pages: { type: "array", items: { type: "string" }, description: "Pages to include (e.g. ['Home','About','Services','Contact']). Default: Home/About/Services/Contact." },
      stylePreference: { type: "string", description: "'modern' (default) | 'classic' | 'bold' | 'minimal' | 'playful' | 'elegant'." },
      contentTone: { type: "string", description: "'professional' (default) | 'casual' | 'friendly' | 'luxury' | 'playful'." },
      features: { type: "array", items: { type: "string" }, description: "Optional features (e.g. ['contact form','gallery','testimonials'])." },
      goals: { type: "array", items: { type: "string" }, description: "Optional site goals (e.g. ['generate leads','showcase work'])." },
    },
    required: ["planId", "businessName", "description"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const businessName = clean(input.businessName, 120);
      const description = clean(input.description, 2000);
      if (!businessName || !description) {
        return { ok: false, error_code: "missing_input", message: "businessName and description are required." };
      }

      // Plan/credit gate (mirror POST /api/websites).
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { plan: true, aiCredits: true, freeCredits: true },
      });
      const isFreePlan = user?.plan === "STARTER" || user?.plan === "FREE";
      const hasPurchasedCredits = (user?.aiCredits ?? 0) > (user?.freeCredits ?? 0);
      if (!ctx.isAdmin && isFreePlan && !hasPurchasedCredits) {
        return {
          ok: false,
          error_code: "plan_required",
          message: "Website hosting needs a paid plan or purchased credits. Suggest upgrading or buying credits at /home/billing.",
        };
      }

      // One website per account.
      const existingCount = await prisma.website.count({
        where: { userId: ctx.userId, deletedAt: null },
      });
      if (existingCount >= 1) {
        const existing = await prisma.website.findFirst({
          where: { userId: ctx.userId, deletedAt: null },
          select: { id: true, name: true },
        });
        return {
          ok: false,
          error_code: "validation_failed",
          message: `The account already has a website ("${existing?.name ?? "site"}"). Only one is allowed — offer to edit it at /home/web, or have them delete it first.`,
          meta: { existingWebsiteId: existing?.id },
        };
      }

      const cost = await getDynamicCreditCost("AI_WEBSITE_GENERATE");
      if (!ctx.isAdmin && (user?.aiCredits ?? 0) < cost) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `A full website build costs ${cost} credits. User has ${user?.aiCredits ?? 0}.`,
          meta: { need: cost, have: user?.aiCredits ?? 0 },
        };
      }

      const [brandKit, language] = await Promise.all([
        prisma.brandKit.findFirst({
          where: { userId: ctx.userId },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          select: { id: true, industry: true, targetAudience: true },
        }),
        getUserPreferredLanguage(ctx.userId),
      ]);

      const questionnaire: SiteQuestionnaire = {
        businessName,
        industry: clean(input.industry, 100) || brandKit?.industry || "General",
        description,
        targetAudience: clean(input.targetAudience, 300) || brandKit?.targetAudience || "General audience",
        goals: strArray(input.goals, ["generate leads", "build credibility"]),
        pages: strArray(input.pages, ["Home", "About", "Services", "Contact"]),
        stylePreference: pick(input.stylePreference, ["modern", "classic", "bold", "minimal", "playful", "elegant"], "modern") as SiteQuestionnaire["stylePreference"],
        contentTone: pick(input.contentTone, ["professional", "casual", "friendly", "luxury", "playful"], "professional") as SiteQuestionnaire["contentTone"],
        features: strArray(input.features, []),
        brandKitId: brandKit?.id,
        languages: [language],
      };

      const taskId = await spawnBackgroundTask({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        kind: "build_website",
        input: { businessName, pages: questionnaire.pages, style: questionnaire.stylePreference },
        creditCost: cost,
        worker: async (taskId) => {
          const slug = await uniqueWebsiteSlug(businessName);
          const website = await prisma.website.create({
            data: {
              userId: ctx.userId,
              name: businessName,
              slug,
              brandKitId: brandKit?.id || null,
              buildStatus: "building",
            },
            select: { id: true, slug: true },
          });

          // Charge upfront (matches the /generate route).
          if (!ctx.isAdmin && cost > 0) {
            await creditService.deductCredits({
              userId: ctx.userId,
              type: TRANSACTION_TYPES.USAGE,
              amount: cost,
              referenceType: "ai_website_generate",
              referenceId: website.id,
              description: `Flow-AI website build: ${businessName}`,
            });
          }

          publishTaskEvent({ type: "progress", taskId, progress: 10, message: "Designing + writing your site…" });

          // Drive the EXISTING builder agent. It writes files, builds, and
          // deploys, updating Website.buildStatus, and resolves when done.
          const result = await runWebsiteAgentV3(website.id, website.slug, ctx.userId, questionnaire, (p) => {
            publishTaskEvent({
              type: "progress",
              taskId,
              progress: Math.min(95, 15 + (p.toolCalls ?? 0) * 2),
              message: p.detail || p.step || "Building…",
            });
          });

          if (!result.success) {
            await notifyAgentTaskComplete({
              userId: ctx.userId,
              taskId,
              kind: "build_website",
              ok: false,
              summary: `Your website build hit a snag`,
              detail: result.error,
              deepLink: `/home/web`,
            });
            throw new Error(result.error || "Website build failed");
          }

          await notifyAgentTaskComplete({
            userId: ctx.userId,
            taskId,
            kind: "build_website",
            ok: true,
            summary: `Your website "${businessName}" is built`,
            detail: "Open it to review, edit, and publish.",
            deepLink: `/home/web`,
          });

          return {
            output: { websiteId: website.id, slug: website.slug, link: `/home/web` },
            resultRefType: "Website",
            resultRefId: website.id,
          };
        },
      });

      ctx.emit({
        type: "task_started",
        taskId,
        kind: "build_website",
        summary: `Building your website (${questionnaire.pages.length} pages) — this takes a few minutes. I'll notify you when it's ready to edit at /home/web.`,
      });

      return {
        ok: true,
        data: {
          taskId,
          creditCostQuoted: cost,
          userMessage: `Started building the website for ${businessName} via the Website Builder. It runs in the background and lands at /home/web. Tell the user you'll notify them when it's ready.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to start website build" };
    }
  },
};

function clean(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
function strArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = v.map((x) => clean(x, 60)).filter(Boolean).slice(0, 12);
  return out.length > 0 ? out : fallback;
}
function pick(v: unknown, allowed: string[], dflt: string): string {
  const s = clean(v, 40).toLowerCase();
  return allowed.includes(s) ? s : dflt;
}
function slugify(t: string): string {
  return t.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
async function uniqueWebsiteSlug(name: string): Promise<string> {
  const base = slugify(name).substring(0, 50) || "my-website";
  const suffix = Math.random().toString(36).substring(2, 8);
  const slug = `${base}-${suffix}`;
  const existing = await prisma.website.findUnique({ where: { slug }, select: { id: true } });
  return existing ? `${base}-${suffix}${Math.random().toString(36).substring(2, 5)}` : slug;
}
