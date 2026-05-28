import { searchCatalog } from "../feature-catalog";
import type { FlowAgentTool } from "../registry";

/**
 * search_features — fuzzy search the feature catalog by query string.
 * Read-only, free. The agent should reach for this whenever the user
 * mentions something it doesn't immediately recognize (e.g. "lead magnet",
 * "auto-post for father's day", "movie about my product") — the catalog
 * almost certainly has a match.
 */
export const searchFeatures: FlowAgentTool = {
  name: "search_features",
  description:
    "Fuzzy-search the FlowSmartly feature catalog for anything matching the query. Returns the best-matching features with their routes and the agent tools that operate on them. Use this whenever you're unsure whether the platform supports something — it almost certainly does. NEVER tell the user 'I can't do that' without searching first.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Free-text query — words from the user's request work well. e.g. 'movie', 'schedule father's day post', 'remove background', 'send email blast'.",
      },
      limit: {
        type: "number",
        description: "Max results (default 8).",
      },
    },
    required: ["query"],
  },
  plans: null,
  costKey: "AGENT_SEARCH_FEATURES",
  mutating: false,
  handler: async (input, _ctx) => {
    try {
      const query = typeof input.query === "string" ? input.query : "";
      const limit = typeof input.limit === "number" ? Math.min(20, Math.max(1, input.limit)) : 8;
      if (!query.trim()) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "query is required",
        };
      }
      const matches = searchCatalog(query, limit);
      return {
        ok: true,
        data: {
          query,
          count: matches.length,
          matches: matches.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            route: m.route,
            tools: m.tools,
            category: m.category,
            plans: m.plans,
          })),
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to search features",
      };
    }
  },
};
