import { publishReelClips } from "@/lib/reel/reel-publish";
import { REEL_CHANNELS, isReelChannel, type ReelChannelId } from "@/lib/reel/highlights";
import type { FlowAgentTool } from "../registry";

/**
 * publish_reels — post or schedule reel clips to the user's connected channels
 * that support reels/short-form (TikTok, Instagram Reels, YouTube Shorts,
 * Facebook Reels, LinkedIn, X). Creates a ReelPost record per clip×channel
 * ("scheduled" if a time is given, else "posting"). The actual delivery runs on
 * the in-house social publishing pipeline. Get clip ids from get_reel_content.
 */
export const publishReels: FlowAgentTool = {
  name: "publish_reels",
  description:
    "Post or schedule reel clips to the user's connected channels that support reels/short-form (tiktok, instagram, youtube, facebook, linkedin, x). Pass clipIds (from get_reel_content) and channels. Omit scheduleAt to post now; pass an ISO timestamp to schedule. Creates a publish record per clip×channel and returns them. Tell the user which reels went to which channels, and that everything stays under the campaign to manage (repost / delete) later.",
  input_schema: {
    type: "object",
    properties: {
      clipIds: { type: "array", items: { type: "string" }, description: "Clip ids to publish (from get_reel_content)." },
      channels: {
        type: "array",
        items: { type: "string", enum: REEL_CHANNELS.map((c) => c.id) },
        description: "Which channels to publish to.",
      },
      scheduleAt: { type: "string", description: "Optional ISO 8601 time to schedule for. Omit to post now." },
    },
    required: ["clipIds", "channels"],
  },
  plans: null,
  costKey: "AGENT_PUBLISH_REEL",
  mutating: true,
  autoPlanCost: async (input) => {
    const clips = Array.isArray(input.clipIds) ? input.clipIds.length : 0;
    const chans = Array.isArray(input.channels) ? input.channels.length : 0;
    return { credits: 3, label: `Publish ${clips} reel${clips === 1 ? "" : "s"} to ${chans} channel${chans === 1 ? "" : "s"}` };
  },
  handler: async (input, ctx) => {
    try {
      const clipIds = (Array.isArray(input.clipIds) ? input.clipIds : []).map((c) => String(c)).filter(Boolean);
      const channels = (Array.isArray(input.channels) ? input.channels : []).map((c) => String(c)).filter(isReelChannel) as ReelChannelId[];
      if (clipIds.length === 0) return { ok: false, error_code: "missing_input", message: "clipIds is required." };
      if (channels.length === 0) return { ok: false, error_code: "missing_input", message: "At least one supported channel is required." };

      const scheduledAt = typeof input.scheduleAt === "string" && input.scheduleAt ? new Date(input.scheduleAt) : null;
      const validSchedule = scheduledAt && !isNaN(scheduledAt.getTime()) ? scheduledAt : null;

      const outcomes = await publishReelClips({ userId: ctx.userId, clipIds, channels, scheduledAt: validSchedule });
      if (outcomes.length === 0) {
        return { ok: false, error_code: "not_found", message: "None of those clips were found. Call get_reel_content for valid clip ids." };
      }
      const postedCount = outcomes.filter((o) => o.status === "posted").length;
      return {
        ok: true,
        data: {
          published: outcomes.length,
          posted: postedCount,
          mode: validSchedule ? "scheduled" : "posting",
          scheduledAt: validSchedule ? validSchedule.toISOString() : null,
          posts: outcomes,
          hint: "Rendered clips were posted to the connected channels for real; unrendered ones are queued and go out once they render. Everything stays under the campaign's Activity to repost or delete.",
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to publish the reels." };
    }
  },
};
