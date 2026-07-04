import type { FlowAgentTool } from "../registry";

/**
 * start_print_project — open the Print Studio canvas at a specific PRINT format
 * (flyer/poster, business card, table tent, bi-fold/tri-fold brochure, postcard).
 * It emits a `canvas_update` carrying a `__print` marker the client routes to the
 * Print Studio's format picker — which sets the canvas to that format's print
 * size + style and turns on its bleed/safe/fold guides. After it opens, design
 * the print with the SAME canvas tools (update_canvas for copy/accent/size,
 * add_design_page for multi-page/panel pieces like card front/back or brochure
 * panels, add_canvas_object for visuals). Only exposed when the Print Studio is
 * open (gated in agent-loop), free + non-mutating — an instant UI action.
 * [[agent-operates-account-full-crud]]
 */
export const startPrintProject: FlowAgentTool = {
  name: "start_print_project",
  description:
    "Open the Print Studio canvas at a specific PRINT format so you can design something to print. Call this FIRST when the user wants a flyer, poster, business card, table tent, brochure, or postcard and no print canvas is open yet — it sets the right print size + style and shows the bleed/safe/fold guides. `format` is one of: flyer (flyers & posters), card (business cards, double-sided — use add_design_page for the back), tent (table tents — has a fold line), bifold (bi-fold brochure, fold line), trifold (tri-fold brochure, 2 fold lines), postcard (mailers/invites, front + address back). After it opens, build the design with update_canvas (copy, accent, print size) and add_design_page for extra pages/panels, keeping important content inside the safe area. Only works while the Print Studio is open. Free.",
  input_schema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["flyer", "card", "tent", "bifold", "trifold", "postcard"],
        description: "Which print format to open the canvas at.",
      },
    },
    required: ["format"],
  },
  plans: null,
  costKey: "AGENT_CANVAS_UPDATE",
  mutating: false,
  handler: async (input, ctx) => {
    const allowed = ["flyer", "card", "tent", "bifold", "trifold", "postcard"];
    const format = typeof input.format === "string" && allowed.includes(input.format) ? input.format : "flyer";
    ctx.emit({ type: "canvas_update", patch: { __print: { format } } });
    const followUp =
      format === "card"
        ? "Opened a business-card canvas. Design the FRONT with update_canvas, then call add_design_page for the BACK."
        : format === "bifold" || format === "trifold"
          ? `Opened a ${format === "bifold" ? "bi-fold" : "tri-fold"} brochure canvas (fold lines are shown). Design the outside panels, then add_design_page for the inside.`
          : format === "tent"
            ? "Opened a table-tent canvas (fold line shown). Design the top panel, then add_design_page for the bottom."
            : format === "postcard"
              ? "Opened a postcard canvas. Design the FRONT, then add_design_page for the address back."
              : "Opened a flyer/poster canvas.";
    return {
      ok: true,
      data: {
        format,
        userMessage:
          `${followUp} Now fill it with update_canvas (copy, accent, and a fitting print size) and add_canvas_object for visuals — keep important content inside the safe area. Tell the user what you set up in ONE short sentence.`,
      },
    };
  },
};
