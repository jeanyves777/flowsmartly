import { searchUserMemories } from "@/lib/ai-memory";
import type { FlowAgentTool } from "../registry";

/**
 * recall — the agent's READ side of its data-awareness ("thinking") layer.
 * The system prompt already injects the user's pinned facts + most-recent
 * memories every turn, but older or topic-specific details fall outside that
 * window. `recall` lets the agent actively SEARCH its whole memory log by
 * keyword before asking the user something it may already know, or to pull
 * back details from earlier work / prior conversations.
 *
 * Free + read-only — call it freely. This is "checking what I already know"
 * rather than calling any external thinking/provider feature.
 */
export const recall: FlowAgentTool = {
  name: "recall",
  description:
    "Search YOUR memory of this user for past facts, preferences, patterns, and work — by keyword. Use it BEFORE asking the user something you might already know, or to retrieve specifics from earlier in this conversation or a previous one (a name, a decision, a recurring promo, prior brief details) that aren't in your current context. Returns matching memory entries (summary + detail + any linked media/record). Free and read-only — check here first instead of re-asking. If nothing comes back, then ask the user.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "REQUIRED — keywords describing what you're trying to recall (e.g. 'logo placement decision', \"Daniel\", 'Friday promo', 'preferred tier').",
      },
      limit: {
        type: "number",
        description: "Max entries to return (default 8, max 25).",
      },
    },
    required: ["query"],
  },
  plans: null,
  costKey: "AGENT_LIST_FEATURES", // free — introspection must never be gated
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const query = typeof input.query === "string" ? input.query.trim() : "";
      if (!query) {
        return { ok: false, error_code: "missing_input", message: "query is required — keywords for what you want to recall." };
      }
      const limit = typeof input.limit === "number" && input.limit > 0 ? input.limit : 8;
      const matches = await searchUserMemories(ctx.userId, query, limit);

      if (matches.length === 0) {
        return {
          ok: true,
          data: {
            matches: [],
            guidance: "No memory of that yet. It's safe to ask the user now — and once you learn it, call `remember` so you don't have to ask again.",
          },
        };
      }

      return {
        ok: true,
        data: {
          matches: matches.map((m) => {
            let detail: string | undefined;
            try {
              const parsed = JSON.parse(m.content) as { detail?: string };
              if (parsed && typeof parsed.detail === "string") detail = parsed.detail;
            } catch {
              /* content may be a non-detail blob */
            }
            return {
              kind: m.kind,
              summary: m.summary,
              detail,
              mediaUrl: m.mediaUrl ?? undefined,
              referenceType: m.referenceType ?? undefined,
              referenceId: m.referenceId ?? undefined,
              pinned: m.pinned,
              when: m.createdAt,
            };
          }),
          guidance: "Use these to avoid re-asking. Don't paste raw media URLs into chat — pass them to tools if you need to reuse an asset.",
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to recall" };
    }
  },
};
