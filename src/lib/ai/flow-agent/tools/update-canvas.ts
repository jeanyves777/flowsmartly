import type { FlowAgentTool } from "../registry";

const ELEMENT_KEYS = ["eyebrow", "headline", "sub", "cta"] as const;
type ElementKey = (typeof ELEMENT_KEYS)[number];
const STYLES = new Set(["modern", "photorealistic", "minimalist", "bold", "elegant", "playful"]);
const SIZES = new Set(["1080×1080", "1080×1350", "1080×1920", "1200×628"]);
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const isElementKey = (k: string): k is ElementKey => (ELEMENT_KEYS as readonly string[]).includes(k);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * update_canvas — apply an edit to the design canvas open in the focused view.
 *
 * Only offered to the model when a canvas is active (see the canvasContext gate
 * in agent-loop.ts). The handler validates the patch and emits a `canvas_update`
 * event the client applies live to the poster — the two-way binding that lets
 * "make it gold" in chat change the on-screen design. Free + non-mutating: it is
 * an instant UI edit, not server work, so no plan/confirm gate.
 *
 * It edits the FULL editable surface the canvas renders: the four text elements
 * (eyebrow/headline/sub/cta), the brand accent (ANY hex — match the user's real
 * brand color, not just a preset), the visual `style` theme, the canvas `size`,
 * each element's POSITION (`pos`, for a balanced layout) and per-element text
 * STYLING (`styles` — color/size/bold/align so the type reads cleanly on the
 * background and matches the palette). For a "make it better / redesign / improve
 * the whole thing" request, send ONE patch that sets several of these together —
 * that is how an editable rebuild becomes a real, coordinated redesign instead of
 * a one-line tweak.
 */
export const updateCanvas: FlowAgentTool = {
  name: "update_canvas",
  description:
    "Edit the design canvas currently open on the right (focused view) — it is fully editable, so you can restyle it like a designer without baking a flat image. Pass ONLY the fields that change (a patch). For a TARGETED ask ('punchier headline', 'make the button gold') send just that one field and leave the rest. For an IMPROVE / REDESIGN / 'make it look better' ask, send a SINGLE coordinated patch that rewrites the copy (eyebrow + headline + sub + cta), sets the accent to one of the user's REAL brand colors, picks the best `style` theme, and uses `pos` + `styles` to balance the layout and give the text on-brand, readable colors that match the background — that is what turns 'editable' into an actual redesign, not just a word swap. accent is ANY hex (e.g. the brand color from the canvas context). After it runs, confirm in ONE short sentence — don't restate every field.",
  input_schema: {
    type: "object",
    properties: {
      eyebrow: { type: "string", description: "New eyebrow / tagline (the small label above the headline). Use \\n for a line break." },
      headline: { type: "string", description: "New headline. Use \\n for a line break." },
      sub: { type: "string", description: "New subtext / supporting line." },
      cta: { type: "string", description: "New button label, e.g. 'Shop now →'." },
      accent: { type: "string", description: "Brand accent as a hex color (e.g. '#0ea5e9'). Drives the CTA button + glow — use one of the user's REAL brand colors from the canvas context, not a random color." },
      style: { type: "string", description: "Visual theme — one of: modern, photorealistic, minimalist, bold, elegant, playful. Changes the whole canvas look (background, default text colors, fonts) instantly. Pick the one that best fits the brand + message." },
      size: { type: "string", description: "Canvas size — one of: 1080×1080, 1080×1350, 1080×1920, 1200×628." },
      pos: {
        type: "object",
        description: "Reposition core elements for a balanced, polished layout. Map of element → {x, y} as fractions 0..1 of the canvas (top-left origin; x≈0.05 = left margin). Keys: eyebrow, headline, sub, cta. Include ONLY the elements you move. Example: {\"headline\":{\"x\":0.06,\"y\":0.1},\"sub\":{\"x\":0.06,\"y\":0.3}}.",
        properties: {
          eyebrow: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
          headline: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
          sub: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
          cta: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
        },
      },
      styles: {
        type: "object",
        description: "Per-element text styling so the type reads cleanly and matches the palette. Map of element → { size (px), bold (true/false), color (hex), align ('left'|'center'|'right') }. Keys: eyebrow, headline, sub, cta. Use this to give the text on-brand, high-contrast colors against the background (e.g. white headline on a dark/branded bg) and sensible sizes. Include ONLY the elements you restyle.",
      },
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
    const patch: Record<string, unknown> = {};

    if (text(input.eyebrow)) patch.eyebrow = text(input.eyebrow);
    if (text(input.headline)) patch.headline = text(input.headline);
    if (text(input.sub)) patch.sub = text(input.sub);
    if (text(input.cta)) patch.cta = text(input.cta);

    const accent = str(input.accent).toLowerCase();
    if (accent) {
      if (!HEX.test(accent)) {
        return { ok: false, error_code: "validation_failed", message: `accent must be a hex color like #0ea5e9 (3 or 6 digits). Use one of the user's real brand colors from the canvas context.` };
      }
      patch.accent = accent;
    }

    const style = str(input.style).toLowerCase();
    if (style) {
      if (!STYLES.has(style)) {
        return { ok: false, error_code: "validation_failed", message: `style must be one of: ${[...STYLES].join(", ")}.` };
      }
      patch.style = style;
    }

    const size = str(input.size).replace(/x/i, "×");
    if (size) {
      if (!SIZES.has(size)) {
        return { ok: false, error_code: "validation_failed", message: `size must be one of: ${[...SIZES].join(", ")}.` };
      }
      patch.size = size;
    }

    // Layout: per-element {x,y} fractions. Clamp into the canvas (same bounds the
    // drag handler uses) so the agent can rebalance the layout without pushing an
    // element off-canvas.
    if (input.pos && typeof input.pos === "object" && !Array.isArray(input.pos)) {
      const pos: Record<string, { x: number; y: number }> = {};
      for (const [k, v] of Object.entries(input.pos as Record<string, unknown>)) {
        if (!isElementKey(k) || !v || typeof v !== "object") continue;
        const { x, y } = v as { x?: unknown; y?: unknown };
        if (typeof x !== "number" || typeof y !== "number" || !isFinite(x) || !isFinite(y)) continue;
        pos[k] = { x: clamp(x, 0, 0.96), y: clamp(y, 0, 0.96) };
      }
      if (Object.keys(pos).length) patch.pos = pos;
    }

    // Per-element text styling (size / bold / color / align). Validated to the
    // shape the canvas renders; bad fields are dropped, not rejected.
    if (input.styles && typeof input.styles === "object" && !Array.isArray(input.styles)) {
      const styles: Record<string, Record<string, unknown>> = {};
      for (const [k, v] of Object.entries(input.styles as Record<string, unknown>)) {
        if (!isElementKey(k) || !v || typeof v !== "object") continue;
        const s = v as { size?: unknown; bold?: unknown; color?: unknown; align?: unknown };
        const clean: Record<string, unknown> = {};
        if (typeof s.size === "number" && isFinite(s.size)) clean.size = clamp(Math.round(s.size), 6, 160);
        if (typeof s.bold === "boolean") clean.bold = s.bold;
        if (typeof s.color === "string" && HEX.test(s.color.trim())) clean.color = s.color.trim().toLowerCase();
        if (s.align === "left" || s.align === "center" || s.align === "right") clean.align = s.align;
        if (Object.keys(clean).length) styles[k] = clean;
      }
      if (Object.keys(styles).length) patch.styles = styles;
    }

    if (Object.keys(patch).length === 0) {
      return { ok: false, error_code: "missing_input", message: "Provide at least one field to change: eyebrow, headline, sub, cta, accent, style, size, pos, or styles." };
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
