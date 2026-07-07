import { applyClipUpdate } from "@/lib/reel/reel-editor";
import type { ClipPatch } from "@/lib/reel/reel-editor";
import type { ReelAspect } from "@/lib/reel/highlights";
import type { FlowAgentTool } from "../registry";

/**
 * edit_clip — change one reel clip (title, hook, hashtags, aspect, order). Get
 * the clip id from get_reel_content first. A partial patch — only the fields you
 * send change. (Trimming/caption-restyle that require a re-render are applied by
 * the render worker; this tool updates the clip's metadata.)
 */
export const editClip: FlowAgentTool = {
  name: "edit_clip",
  description:
    "Edit one reel clip's metadata — title, hook line, hashtags, aspect ratio, or display order. Get the clip id from get_reel_content first. Send only the fields you want to change (partial patch). For example rename a clip, tighten its hook, or swap it to 1:1. Returns the updated clip.",
  input_schema: {
    type: "object",
    properties: {
      clipId: { type: "string", description: "The clip id (from get_reel_content)." },
      title: { type: "string" },
      hook: { type: "string", description: "The opening hook line." },
      hashtags: { type: "array", items: { type: "string" }, description: "Full replacement hashtag list." },
      aspect: { type: "string", enum: ["9:16", "1:1", "16:9"] },
      order: { type: "number", description: "Display order on the canvas." },
    },
    required: ["clipId"],
  },
  plans: null,
  costKey: "AGENT_EDIT_CLIP",
  mutating: true,
  autoPlanCost: async () => ({ credits: 2, label: "Edit this reel clip" }),
  handler: async (input, ctx) => {
    try {
      const clipId = typeof input.clipId === "string" ? input.clipId : "";
      if (!clipId) return { ok: false, error_code: "missing_input", message: "clipId is required." };

      const patch: ClipPatch = {};
      if (typeof input.title === "string") patch.title = input.title;
      if (typeof input.hook === "string") patch.hook = input.hook;
      if (Array.isArray(input.hashtags)) patch.hashtags = input.hashtags.map((h) => String(h));
      if (typeof input.aspect === "string") patch.aspect = input.aspect as ReelAspect;
      if (typeof input.order === "number") patch.order = input.order;

      const clip = await applyClipUpdate({ clipId, userId: ctx.userId, patch });
      return {
        ok: true,
        data: { clip, hint: "Clip updated. It stays on the Reel Studio canvas." },
        resultRefType: "ReelClip",
        resultRefId: clip.id,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to edit the clip.";
      if (/not found/i.test(msg)) return { ok: false, error_code: "not_found", message: "That clip wasn't found. Call get_reel_content to get valid clip ids." };
      return { ok: false, error_code: "internal", message: msg };
    }
  },
};
