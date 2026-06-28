import type { FlowAgentTool } from "../registry";

const ACCENTS = new Set(["#0ea5e9", "#8b5cf6", "#eccb93", "#10b981", "#ef4444"]);
const SIZES = new Set(["1080×1080", "1080×1350", "1080×1920", "1200×628"]);

/**
 * update_canvas — apply an edit to the design canvas open in the focused view.
 *
 * Only offered to the model when a canvas is active (see the canvasContext gate
 * in agent-loop.ts). The handler validates the patch and emits a `canvas_update`
 * event the client applies live to the poster — the two-way binding that lets
 * "make it gold" in chat change the on-screen design. Free + non-mutating: it is
 * an instant UI edit, not server work, so no plan/confirm gate.
 */
export const updateCanvas: FlowAgentTool = {
  name: "update_canvas",
  description:
    "Edit the design canvas currently open on the right (focused view). Pass ONLY the fields that change (a patch). Use it when the user asks to change the on-screen design's wording, accent color, size, or button. Keep edits minimal and on-brand. After it runs, confirm the change in ONE short sentence — don't restate everything.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "New headline. Use \\n for a line break." },
      sub: { type: "string", description: "New subtext / supporting line." },
      cta: { type: "string", description: "New button label, e.g. 'Shop now →'." },
      accent: { type: "string", description: "Brand accent hex — one of: #0ea5e9 (blue), #8b5cf6 (violet), #eccb93 (gold), #10b981 (green), #ef4444 (red)." },
      size: { type: "string", description: "Canvas size — one of: 1080×1080, 1080×1350, 1080×1920, 1200×628." },
    },
  },
  plans: null,
  costKey: "AGENT_CANVAS_UPDATE",
  mutating: false,
  handler: async (input, ctx) => {
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    // Models often emit a literal backslash-n (it survives JSON escaping) instead
    // of a real newline — normalize so the canvas shows a line break, not "\n".
    const text = (v: unknown) => str(v).replace(/\\n/g, "\n");
    const patch: Record<string, string> = {};

    if (text(input.headline)) patch.headline = text(input.headline);
    if (text(input.sub)) patch.sub = text(input.sub);
    if (text(input.cta)) patch.cta = text(input.cta);

    const accent = str(input.accent).toLowerCase();
    if (accent) {
      if (!ACCENTS.has(accent)) {
        return { ok: false, error_code: "validation_failed", message: `accent must be one of: ${[...ACCENTS].join(", ")}.` };
      }
      patch.accent = accent;
    }

    const size = str(input.size).replace(/x/i, "×");
    if (size) {
      if (!SIZES.has(size)) {
        return { ok: false, error_code: "validation_failed", message: `size must be one of: ${[...SIZES].join(", ")}.` };
      }
      patch.size = size;
    }

    if (Object.keys(patch).length === 0) {
      return { ok: false, error_code: "missing_input", message: "Provide at least one field to change: headline, sub, cta, accent, or size." };
    }

    ctx.emit({ type: "canvas_update", patch });
    return {
      ok: true,
      data: {
        applied: Object.keys(patch),
        userMessage: `Updated the canvas (${Object.keys(patch).join(", ")}). Confirm to the user in one short sentence; do not call update_canvas again unless they ask for another change.`,
      },
    };
  },
};
