import type { FlowAgentTool } from "../registry";

/**
 * add_design_page — add a new blank PAGE/slide to the open design canvas and
 * switch to it, for building MULTI-PAGE / MULTI-SLIDE designs (presentation
 * decks, Instagram carousels, multi-page flyers). It emits a `canvas_update`
 * carrying a `__page` marker the client routes to the canvas's page controls
 * (instead of applyDesignPatch). Only exposed when a design canvas is open
 * (gated in agent-loop), free + non-mutating — an instant UI action.
 * [[agent-operates-account-full-crud]]
 */
export const addDesignPage: FlowAgentTool = {
  name: "add_design_page",
  description:
    "Add a new blank PAGE/slide to the design canvas open on the right and switch to it — for MULTI-PAGE or MULTI-SLIDE designs (a presentation deck, an Instagram carousel, a multi-page flyer). Workflow for a deck: design the current page with update_canvas (and add_canvas_object for visuals), then call add_design_page to start the next slide, fill that one, and repeat for every page the user asked for. The new page inherits the current canvas size — set the size with update_canvas first if needed (e.g. 1080×1080 for a square carousel). Only works while a design canvas is open. Free.",
  input_schema: { type: "object", properties: {} },
  plans: null,
  costKey: "AGENT_CANVAS_UPDATE",
  mutating: false,
  handler: async (_input, ctx) => {
    ctx.emit({ type: "canvas_update", patch: { __page: "add" } });
    return {
      ok: true,
      data: {
        userMessage:
          "Added a new page and switched to it. Now fill this page with update_canvas (and add_canvas_object for visuals). When the whole set is done, tell the user how many pages/slides you built in ONE short sentence.",
      },
    };
  },
};
