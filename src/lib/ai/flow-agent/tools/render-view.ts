import { randomUUID } from "crypto";
import type { FlowAgentTool } from "../registry";
import { normalizeViewSpec } from "@/lib/agent-views/spec";

/**
 * render_view — draw a rich, INTERACTIVE view inline in the chat from a safe,
 * declarative spec (a tree of typed UI blocks — never code). The user reads,
 * fills, taps, and rates WITHOUT leaving the chat; every interaction comes back
 * to you as their next message so you can act on it.
 *
 * This is the agent's "UI builder": compose a spec from the block vocabulary
 * below whenever a plain paragraph would be worse than a real UI — a build in
 * progress, a results table to pick from, a small form to collect inputs, a
 * choice grid, a preview with actions, a summary dashboard, a booking grid.
 *
 * The spec is VALIDATED + sanitized on the server (unknown blocks dropped) and
 * rendered by a fixed switch (no eval), so it is always safe.
 */
export const renderView: FlowAgentTool = {
  name: "render_view",
  description:
    "Render a rich INTERACTIVE view inline in the chat (a mini-app the user operates without leaving the conversation). Use this instead of a long text answer whenever a real UI is clearer: a live build/progress panel, a results table to pick from, a small input form, a choice grid, a preview-with-actions, a KPI summary, a booking/slot grid, a rating request. You pass a `spec` = { title?, subtitle?, icon?, badge?, body:[blocks], footer?:[blocks] }. Interactive blocks (button/buttonRow/input/select/chips/toggle/rating/slotGrid, table rowAction, image/mediaStrip action) carry an `action:{event, tool?, payload?, confirm?, href?}` — when the user interacts, their intent arrives as your next message (event name + value), so continue from there. Available block types: layout — stack/row/grid/card/section/divider/spacer; content — heading, text{tone,size,strong}, badge, stat{label,value,delta}, kpis{items[]}, progress{value,label}, status{text,state,progress}, checklist{items:[{text,state:done|active|pending,sub}]}, timeline{items[]}, image{url,action?}, video{url,poster?}, mediaStrip{items:[{url,label,status:ready|busy|pending}],aspect,action?}, table{columns:[{key,label,align?,kind:text|score|badge|thumb}],rows[],rowAction?,rowActionLabel?}, code{code,lang}, note{text,tone,icon}; interactive — button{label,variant:primary|default|ghost|danger,icon,action}, buttonRow{buttons[]}, chips{name,options:[{value,label,hint}],value,multi,action?}, input{name,placeholder,multiline,submitLabel,action?}, select{name,options[],value,action?}, toggle{name,label,value,action?}, rating{name,max,value,action?}, slotGrid{days[],slots,value,action?}. Tones: default|brand|muted|success|warn|danger|info. Keep views compact (a chat card, ~1-3 sections). Prefer this over ask_choice when you need more than a simple list (e.g. a form, a table, or a preview).",
  input_schema: {
    type: "object",
    properties: {
      spec: {
        type: "object",
        description:
          "The view spec. { title?, subtitle?, icon? (one emoji), badge?:{text,tone}, body: ViewBlock[] (required), footer?: ViewBlock[] }. Each block is { type, ...fields } per the block vocabulary in the tool description. Give interactive controls an `action` with a short `event` name so the user's interaction routes back to you.",
      },
      title: { type: "string", description: "Optional shorthand title (used only if spec.title is absent)." },
    },
    required: ["spec"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: false,
  handler: async (input, ctx) => {
    const raw = (input.spec ?? {}) as Record<string, unknown>;
    if (typeof input.title === "string" && !raw.title) raw.title = input.title;
    const spec = normalizeViewSpec(raw);
    if (!spec) {
      return {
        ok: false,
        error_code: "validation_failed",
        message: "The view spec needs a `body` array with at least one valid block (or a title). See the block vocabulary in the tool description.",
      };
    }
    spec.source = "generated";

    const requestId = randomUUID();
    ctx.emit({ type: "agent_view", requestId, spec });

    const interactive = countInteractive(spec.body) + countInteractive(spec.footer || []);
    return {
      ok: true,
      data: {
        requestId,
        blocks: spec.body.length,
        interactive,
        userMessage:
          interactive > 0
            ? `Rendered an interactive view "${spec.title || spec.name || "view"}" in the chat. STOP and wait — the user's interaction (a tap/input/rating) arrives as the next message with the event name + value; then act on it. Do NOT restate the view as text.`
            : `Rendered a view "${spec.title || spec.name || "view"}" in the chat. Continue.`,
      },
    };
  },
};

function countInteractive(blocks: unknown[]): number {
  let n = 0;
  const walk = (b: unknown) => {
    if (!b || typeof b !== "object") return;
    const block = b as { type?: string; action?: unknown; rowAction?: unknown; children?: unknown[]; buttons?: unknown[] };
    if (
      block.type === "button" ||
      block.type === "input" ||
      block.type === "select" ||
      block.type === "chips" ||
      block.type === "toggle" ||
      block.type === "rating" ||
      block.type === "slotGrid" ||
      block.type === "buttonRow" ||
      block.action ||
      block.rowAction
    ) n++;
    if (Array.isArray(block.children)) block.children.forEach(walk);
  };
  blocks.forEach(walk);
  return n;
}
