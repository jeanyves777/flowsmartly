import { readLatestReelCampaign, readReelCampaignById, listPostsForCampaign } from "@/lib/reel/reel-editor";
import { REEL_CHANNELS } from "@/lib/reel/highlights";
import type { FlowAgentTool } from "../registry";

/**
 * get_reel_content — read a Reel campaign (the latest by default, or by id) so
 * the agent can edit or publish it precisely: the source info, every clip with
 * its score/timing/caption/hashtags/render status, the publish history, and the
 * reel-capable channels. Read-only, cheap. Call BEFORE edit_clip / publish_reels.
 */
export const getReelContent: FlowAgentTool = {
  name: "get_reel_content",
  description:
    "Read a Reel campaign so you can edit or publish it precisely. Returns the source (title, url, duration), settings, and EVERY clip with its id, score, timing, title, hook, caption, hashtags and render status — plus the publish history and the list of channels that support reels. Defaults to the user's most recent campaign; pass campaignId for a specific one. Call this BEFORE edit_clip (you need the clip id) or publish_reels. Read-only and cheap.",
  input_schema: {
    type: "object",
    properties: { campaignId: { type: "string", description: "Optional — defaults to the most recent campaign." } },
    required: [],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const campaign =
        typeof input.campaignId === "string" && input.campaignId
          ? await readReelCampaignById(input.campaignId, ctx.userId)
          : await readLatestReelCampaign(ctx.userId);
      if (!campaign) {
        return {
          ok: false,
          error_code: "validation_failed",
          message:
            "No reels yet. Offer to build some with build_reels — ask for a video link (or upload), transcribe it, then pass the transcript.",
        };
      }
      const posts = await listPostsForCampaign(campaign.id, ctx.userId);
      return {
        ok: true,
        data: {
          ...campaign,
          posts,
          channels: REEL_CHANNELS,
          hint:
            "Use edit_clip with a clip id to change a clip's title/hook/hashtags/aspect. Use publish_reels with clip ids + channels to post now or schedule. Clips with renderStatus 'pending' are still queued to render to 9:16.",
        },
        resultRefType: "ReelCampaign",
        resultRefId: campaign.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to read the reels." };
    }
  },
};
