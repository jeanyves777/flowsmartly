import { randomUUID } from "crypto";
import type { FlowAgentTool } from "../registry";

/**
 * ask_choice — ask the user a clarifying question as a CLICKABLE option card
 * (numbered choices + "Type something else" + Skip) instead of a plain-text
 * question they'd have to type an answer to. The chat renders the card; the
 * user's click arrives as their next message. Use this for ANY quick question
 * (e.g. "Standard or Premium?", "Which platform?", "What's the vibe?").
 */
export const askChoice: FlowAgentTool = {
  name: "ask_choice",
  description:
    "Ask the user a quick clarifying question as a CLICKABLE choice card (not plain text). ALWAYS prefer this over typing a question with a bulleted list — the user just taps an option. Use it for tier ('Standard or Premium?'), platform pick, vibe/topic, format, etc. Provide 2-5 concise options (label + optional sublabel). The user's tap arrives as their next message; then proceed. Do NOT also write the same question as text. Ask only ONE question card at a time.",
  input_schema: {
    type: "object",
    properties: {
      question: { type: "string", description: "The question header, e.g. 'Standard or Premium?'" },
      options: {
        type: "array",
        description: "2-5 clickable answers.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "The choice text the user taps, e.g. 'Standard'." },
            sublabel: { type: "string", description: "Optional one-line detail, e.g. 'Fast & affordable — 15 credits'." },
          },
          required: ["label"],
        },
      },
      allowOther: { type: "boolean", description: "Show a 'Type something else…' row so the user can answer freely. Default true." },
    },
    required: ["question", "options"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: false,
  handler: async (input, ctx) => {
    const question = typeof input.question === "string" ? input.question.trim() : "";
    const rawOptions = Array.isArray(input.options) ? input.options : [];
    const options = rawOptions
      .map((o) => {
        const obj = (o ?? {}) as { label?: unknown; sublabel?: unknown };
        return {
          label: typeof obj.label === "string" ? obj.label.trim() : "",
          sublabel: typeof obj.sublabel === "string" && obj.sublabel.trim() ? obj.sublabel.trim() : null,
        };
      })
      .filter((o) => o.label.length > 0)
      .slice(0, 6);

    if (!question || options.length === 0) {
      return { ok: false, error_code: "missing_input", message: "question + at least one option are required." };
    }

    const requestId = randomUUID();
    ctx.emit({
      type: "question_options",
      requestId,
      question,
      options,
      allowOther: input.allowOther !== false,
    });

    return {
      ok: true,
      data: {
        shown: options.length,
        requestId,
        userMessage: `Asked the user "${question}" as a clickable card with ${options.length} options. STOP and wait — their tap arrives as the next message; then continue. Do NOT repeat the question as text.`,
      },
    };
  },
};
