import type { FlowAgentTool } from "../registry";

const MODES = new Set(["single", "multi", "segment"]);

interface IncomingStep { channel?: unknown; subject?: unknown; message?: unknown; waitDays?: unknown; personalize?: unknown; }

/**
 * update_followup_canvas — fill the OPEN Follow-ups flow canvas live as the
 * agent writes the sequence.
 *
 * Only exposed when the Follow-ups canvas is open (gated by the `[FOLLOWUP]`
 * canvasContext in agent-loop.ts). Emits a `canvas_update` event with a
 * `__followup` marker the client routes to the flow-builder state — so the
 * campaign name, audience mode, and the personalized message STEPS appear in the
 * canvas instantly. Free + non-mutating (a live UI fill); the actual scheduling
 * still goes through propose_plan → the user confirms.
 */
export const updateFollowupCanvas: FlowAgentTool = {
  name: "update_followup_canvas",
  description:
    "Fill the OPEN Follow-ups flow canvas live — write the sequence INTO the on-screen builder as you work, so the user watches it appear. Pass ONLY the fields you're setting. Use it to: name the campaign; set the audience mode ('single', 'multi' selected contacts, or 'segment'); and write the ordered message STEPS — each step is { channel: 'EMAIL'|'SMS', subject (email only), message, waitDays (days to wait before this step; 0 = immediately/start), personalize (true to tailor per contact) }. Write genuinely good, PERSONALIZED copy using {{first_name}} / {{company}} merge fields — never leave a step empty. Call this whenever the user asks you to build/generate/write the follow-up flow. After filling it, confirm in ONE short sentence; when they want it live, go through propose_plan. FREE and instant — fill the canvas first, talk second.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Campaign name." },
      audienceMode: { type: "string", description: "'single' (one contact), 'multi' (several selected contacts), or 'segment' (a list/segment)." },
      steps: {
        type: "array",
        description: "The ordered message steps. Each: { channel: 'EMAIL'|'SMS', subject (email only), message, waitDays (0 = start/immediately, else days to wait before this step), personalize (true/false) }.",
        items: {
          type: "object",
          properties: {
            channel: { type: "string" },
            subject: { type: "string" },
            message: { type: "string" },
            waitDays: { type: "number" },
            personalize: { type: "boolean" },
          },
        },
      },
    },
  },
  plans: null,
  costKey: "AGENT_CANVAS_UPDATE",
  mutating: false,
  handler: async (input, ctx) => {
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const patch: Record<string, unknown> = {};

    if (str(input.name)) patch.name = str(input.name);
    const mode = str(input.audienceMode).toLowerCase();
    if (mode && MODES.has(mode)) patch.audienceMode = mode;

    if (Array.isArray(input.steps)) {
      const steps = (input.steps as IncomingStep[])
        .map((s) => {
          const channel = str(s.channel).toUpperCase() === "SMS" ? "SMS" : "EMAIL";
          const message = str(s.message);
          if (!message) return null;
          const waitDays = typeof s.waitDays === "number" && isFinite(s.waitDays) ? Math.max(0, Math.min(60, Math.round(s.waitDays))) : 0;
          return {
            channel,
            subject: channel === "EMAIL" ? str(s.subject) : "",
            msg: message,
            wait: waitDays,
            personalize: s.personalize !== false,
          };
        })
        .filter(Boolean)
        .slice(0, 8);
      if (steps.length) patch.steps = steps;
    }

    if (Object.keys(patch).length === 0) {
      return { ok: false, error_code: "missing_input", message: "Provide at least one field to fill: name, audienceMode, or steps (each with a non-empty message)." };
    }

    ctx.emit({ type: "canvas_update", patch: { __followup: patch } });
    return {
      ok: true,
      data: {
        applied: Object.keys(patch),
        userMessage: `Filled the follow-up canvas (${Object.keys(patch).join(", ")}). Confirm in one short sentence; when the user wants it live, propose_plan. Do not repeat the steps back.`,
      },
    };
  },
};
