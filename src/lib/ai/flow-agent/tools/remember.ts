import { saveUserMemory, type AiMemoryKind } from "@/lib/ai-memory";
import type { FlowAgentTool } from "../registry";

/**
 * remember — the agent's WRITE side of its own data-awareness ("thinking")
 * layer. When the agent identifies a durable fact, preference, or pattern
 * about the user or their brand — something worth knowing on a LATER turn or
 * in a FUTURE conversation — it logs it here so the next loadUserContext()
 * surfaces it automatically. This is how the agent gets quicker over time and
 * stops re-asking things it already learned.
 *
 * Examples worth remembering:
 *  - "User always wants the Premium image tier" (preference)
 *  - "Brand targets Caribbean-food lovers in the NYC area" (pattern)
 *  - "User's recurring promo is 'Taste of the Islands' every Friday" (pattern)
 *  - "Daniel = the user's business partner, not a customer" (fact)
 *
 * NOT for: transient one-turn details, anything already in the Brand Kit, or
 * secrets. Free + non-mutating (internal memory, not user-facing data), so it
 * needs NO propose_plan and never costs credits — the agent should use it
 * naturally whenever it learns something load-bearing.
 */
const VALID_KINDS = new Set<AiMemoryKind>(["agent-note", "user-preference", "chat-highlight", "brand-snapshot"]);

export const remember: FlowAgentTool = {
  name: "remember",
  description:
    "Log a durable fact, preference, or pattern you identified about THIS user or their brand so you (and every future AI generation) recall it later — your own long-term memory. Use it the moment you learn something load-bearing: a standing preference ('always Premium tier'), a recurring pattern ('Friday promo'), a relationship ('Daniel is the partner'), a confirmed brand detail. Pass a concise `summary` (one line — this is what future context lookups read) and optional `detail`. Set `pinned: true` for facts that should ALWAYS surface first (core preferences/identity). Free, instant, no confirmation needed. Do NOT log transient one-off details, anything already in the Brand Kit, or sensitive data. Before re-asking the user something, check whether you already remembered it.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "REQUIRED — the one-line fact/preference/pattern to remember (max ~240 chars). This is what future lookups search.",
      },
      detail: {
        type: "string",
        description: "Optional longer context/explanation stored alongside the summary.",
      },
      kind: {
        type: "string",
        description:
          "Optional category: 'agent-note' (default — a fact/pattern you noticed), 'user-preference' (a standing choice), 'chat-highlight' (notable thing done), 'brand-snapshot' (a confirmed brand detail, auto-pinned).",
      },
      pinned: {
        type: "boolean",
        description: "Set true for load-bearing facts that should always surface first (core preferences/identity). Default false.",
      },
    },
    required: ["summary"],
  },
  plans: null,
  costKey: "AGENT_LIST_FEATURES", // free — internal memory, never gated
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const summary = typeof input.summary === "string" ? input.summary.trim() : "";
      if (!summary) {
        return { ok: false, error_code: "missing_input", message: "summary is required — the one-line fact to remember." };
      }
      const rawKind = typeof input.kind === "string" ? (input.kind.trim() as AiMemoryKind) : "agent-note";
      const kind: AiMemoryKind = VALID_KINDS.has(rawKind) ? rawKind : "agent-note";
      const detail = typeof input.detail === "string" ? input.detail.trim() : "";
      const pinned = input.pinned === true;

      const saved = await saveUserMemory({
        userId: ctx.userId,
        kind,
        summary,
        content: detail ? { detail } : {},
        pinned,
      });

      if (!saved) {
        return { ok: false, error_code: "internal", message: "Could not save the memory. It's non-critical — continue without it." };
      }

      return {
        ok: true,
        data: {
          remembered: summary,
          pinned,
          guidance: "Saved. You'll see this in your context on future turns and conversations — don't re-ask what you've now remembered.",
        },
        resultRefType: "UserAiMemory",
        resultRefId: saved.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to remember" };
    }
  },
};
