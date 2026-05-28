import { entriesForPlan } from "../feature-catalog";
import type { FlowAgentTool } from "../registry";

/**
 * list_my_features — enumerate every platform feature available on the
 * user's plan. The agent should call this BEFORE saying "I can't do that"
 * so it has the full map. Read-only, free.
 */
export const listMyFeatures: FlowAgentTool = {
  name: "list_my_features",
  description:
    "List every FlowSmartly feature available on the current user's plan. Categories include content (scheduling, posts), media (image/video/movie generation, design studio), campaigns (email/SMS), automations, contacts, leads, ecommerce, websites, analytics, account. Call this BEFORE telling the user something is out of scope — the catalog is the source of truth for what the platform can do.",
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
      return {
        ok: true,
        data: {
          plan: ctx.plan,
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
