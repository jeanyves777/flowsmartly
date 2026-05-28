import { prisma } from "@/lib/db/client";
import { entriesForPlan } from "../feature-catalog";
import { getDynamicCreditCost, type CreditCostKey } from "@/lib/credits/costs";
import type { FlowAgentTool } from "../registry";

/**
 * list_my_features — the agent's full capability + cost map.
 *
 * Returns: every feature available on the user's plan, the user's CURRENT
 * credit balance, AND the real credit cost of each heavy/paid action so
 * the agent can (a) never say "out of scope" without checking, and (b)
 * verify the user can afford an action and quote the exact cost in
 * propose_plan BEFORE running it. Read-only, free.
 */

// Heavy/paid actions the agent can take → their credit cost key. Lookups
// + plain text are free and omitted. Costs resolved live from DB pricing.
const ACTION_COSTS: Array<{ action: string; tool: string; key: CreditCostKey }> = [
  { action: "Schedule a social post", tool: "schedule_social_post", key: "AGENT_SCHEDULE_POST" },
  { action: "Generate image (Standard)", tool: "generate_image", key: "AGENT_GENERATE_IMAGE_STANDARD" },
  { action: "Generate image (Premium)", tool: "generate_image", key: "AGENT_GENERATE_IMAGE_PREMIUM" },
  { action: "Generate video (Standard)", tool: "generate_video", key: "AGENT_GENERATE_VIDEO_STANDARD" },
  { action: "Generate video (Premium)", tool: "generate_video", key: "AGENT_GENERATE_VIDEO_PREMIUM" },
  { action: "Service proposal (Pitch Board)", tool: "create_proposal", key: "AI_SERVICE_PROPOSAL" },
  { action: "Create email/SMS campaign", tool: "create_email_campaign", key: "AGENT_CREATE_CAMPAIGN" },
  { action: "Create automation", tool: "create_automation", key: "AGENT_CREATE_AUTOMATION" },
  { action: "Business plan", tool: "(open /business-plan)", key: "AI_BUSINESS_PLAN" },
  { action: "Voiceover script", tool: "(open /voice-studio)", key: "AI_VOICE_SCRIPT" },
  { action: "Logo generation", tool: "(open /logo-generator)", key: "AI_LOGO_GENERATION" },
];

export const listMyFeatures: FlowAgentTool = {
  name: "list_my_features",
  description:
    "List every FlowSmartly capability available on the user's plan, PLUS their current credit balance and the credit cost of each paid action. ALWAYS call this before telling the user something is out of scope, and use the costs + balance to quote an accurate price in propose_plan and to warn if they can't afford an action. Categories: content, media, campaigns, automations, contacts, leads (proposals/pitches), branding, ai (business plan, web analysis), ecommerce, analytics, account.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "Optional category filter: 'content' | 'media' | 'campaigns' | 'automations' | 'contacts' | 'leads' | 'ecommerce' | 'designs' | 'analytics' | 'branding' | 'ai' | 'account'.",
      },
    },
  },
  plans: null,
  costKey: "AGENT_LIST_FEATURES",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const all = entriesForPlan(ctx.plan);
      const cat = typeof input.category === "string" ? input.category : null;
      const filtered = cat ? all.filter((e) => e.category === cat) : all;

      const [user, ...costs] = await Promise.all([
        prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } }),
        ...ACTION_COSTS.map((a) => getDynamicCreditCost(a.key)),
      ]);
      const actionCosts = ACTION_COSTS.map((a, i) => ({
        action: a.action,
        tool: a.tool,
        credits: costs[i] as number,
      }));
      const balance = user?.aiCredits ?? 0;

      return {
        ok: true,
        data: {
          plan: ctx.plan,
          currentCredits: balance,
          count: filtered.length,
          features: filtered.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            route: e.route,
            tools: e.tools,
            category: e.category,
            requiresPlanUpgrade: e.plans && !e.plans.includes(ctx.plan.toUpperCase() as never),
          })),
          actionCosts,
          note: "Use currentCredits + actionCosts to quote exact cost in propose_plan and to warn the user before they run something they can't afford. Lookups + text answers are free.",
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to list features",
      };
    }
  },
};
