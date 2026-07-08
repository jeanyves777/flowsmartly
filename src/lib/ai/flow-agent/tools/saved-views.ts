import { randomUUID } from "crypto";
import type { FlowAgentTool } from "../registry";
import { normalizeViewSpec } from "@/lib/agent-views/spec";
import { getView, listViews } from "@/lib/agent-views/registry";

/**
 * list_saved_views — discover the views the user has in their library (saved via
 * render_view's `saveAs`). Returns each view's name + title + full spec so you
 * can REUSE it: refresh its data and re-render with render_view, instead of
 * rebuilding the structure from scratch.
 */
export const listSavedViews: FlowAgentTool = {
  name: "list_saved_views",
  description:
    "List the interactive views saved in the user's library (reusable UI you built earlier with render_view + saveAs). Returns each view's name, title, and full spec. Use it to REUSE a view: take a saved spec, update its data/values, and re-render it with render_view — don't rebuild a view you already have. Optionally filter by skill.",
  input_schema: {
    type: "object",
    properties: {
      skill: { type: "string", description: "Optional — only views tagged to this skill." },
    },
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: false,
  handler: async (input, ctx) => {
    const skill = typeof input.skill === "string" && input.skill.trim() ? input.skill.trim() : undefined;
    const views = await listViews(ctx.userId, { skill, limit: 40 });
    return {
      ok: true,
      data: {
        count: views.length,
        views: views.map((v) => ({ name: v.name, title: v.spec.title ?? null, skill: v.skill ?? null, updatedAt: v.updatedAt, spec: v.spec })),
        userMessage: views.length
          ? `The user has ${views.length} saved view(s). To reuse one, take its spec, refresh the data, and re-render with render_view.`
          : "No saved views yet. Build one with render_view and pass saveAs to keep it for reuse.",
      },
    };
  },
};

/**
 * use_saved_view — re-render a view previously saved to the library, optionally
 * overriding its header (title/subtitle/badge). For reuse where the STRUCTURE is
 * the same; when the DATA changes, prefer list_saved_views then render_view.
 */
export const useSavedView: FlowAgentTool = {
  name: "use_saved_view",
  description:
    "Re-render a view the user saved earlier (by its library name) inline in the chat, optionally overriding the title/subtitle/badge. Best when the view's STRUCTURE is unchanged. If the underlying DATA changed, instead call list_saved_views to get the spec, refresh the values, and render_view. Its interactions route back to you like any rendered view.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The saved view's library name (e.g. 'weekly-kpis')." },
      title: { type: "string", description: "Optional new title." },
      subtitle: { type: "string", description: "Optional new subtitle." },
      badge: { type: "string", description: "Optional new badge text." },
    },
    required: ["name"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: false,
  handler: async (input, ctx) => {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) return { ok: false, error_code: "missing_input", message: "A saved view `name` is required." };
    const saved = await getView(ctx.userId, name);
    if (!saved) return { ok: false, error_code: "not_found", message: `No saved view named "${name}". Call list_saved_views to see what exists.` };

    const spec = normalizeViewSpec(saved.spec);
    if (!spec) return { ok: false, error_code: "internal", message: "The saved view is corrupted." };
    if (typeof input.title === "string" && input.title.trim()) spec.title = input.title.trim();
    if (typeof input.subtitle === "string" && input.subtitle.trim()) spec.subtitle = input.subtitle.trim();
    if (typeof input.badge === "string" && input.badge.trim()) spec.badge = { text: input.badge.trim(), tone: spec.badge?.tone };
    spec.source = "library";

    const requestId = randomUUID();
    ctx.emit({ type: "agent_view", requestId, spec });
    return {
      ok: true,
      data: { requestId, name: saved.name, userMessage: `Re-rendered the saved view "${saved.name}". Act on any interaction that comes back.` },
    };
  },
};
