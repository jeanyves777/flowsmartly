import { postPreviewView } from "@/lib/agent-views/templates";
import type { FlowAgentTool } from "../registry";

/**
 * preview_social_post — render an inline PREVIEW of the post the agent is about
 * to publish (media + caption + the exact channels) so the user reviews it in
 * the chat like the Publish view, then taps "Post now" / "Schedule". Free and
 * read-only: it renders a card, it does NOT create or publish anything.
 *
 * Flow: preview_social_post → user taps Post now → propose_plan (AGENT_SCHEDULE_POST)
 * → on confirm, schedule_social_post actually publishes and returns the honest
 * per-channel result card.
 */
export const previewSocialPost: FlowAgentTool = {
  name: "preview_social_post",
  description:
    "Show the user an inline PREVIEW of the social post you're about to publish — the media, the caption, and exactly which channels it targets — so they can confirm before it goes out (the full Publish experience, in chat). Free, renders only. Call this right before posting once you have the caption + media + chosen platforms; the user taps 'Post now' (then you propose_plan → schedule_social_post) or 'Edit caption'. Pass the SAME caption/mediaUrl/platforms you'll post with.",
  input_schema: {
    type: "object",
    properties: {
      caption: { type: "string", description: "The exact caption that will be posted." },
      mediaUrl: { type: "string", description: "Optional media URL (the real generated/attached asset) shown in the preview." },
      mediaType: { type: "string", description: "'image' or 'video'. Default 'image' when mediaUrl is set." },
      platforms: {
        type: "array",
        description: "Channels the post targets, e.g. ['feed','instagram','facebook']. Defaults to ['feed'].",
        items: { type: "string" },
      },
      scheduledAtLabel: { type: "string", description: "Optional human label of the schedule time (e.g. 'Sun, Aug 2 at 12:00 PM'); omit for immediate posts." },
      postId: { type: "string", description: "Optional existing Post id this preview is for." },
    },
    required: ["caption"],
  },
  plans: null,
  costKey: "AGENT_LIST_FEATURES", // free — renders a card only
  mutating: false,
  handler: async (input, _ctx) => {
    const caption = typeof input.caption === "string" ? input.caption.trim() : "";
    if (!caption && !input.mediaUrl) {
      return { ok: false, error_code: "missing_input", message: "Provide a caption or media to preview." };
    }
    const platformsRaw = Array.isArray(input.platforms) ? input.platforms : ["feed"];
    const platforms = platformsRaw
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .slice(0, 8);
    if (platforms.length === 0) platforms.push("feed");
    const mediaUrl = typeof input.mediaUrl === "string" && input.mediaUrl.trim() ? input.mediaUrl.trim() : null;
    const mediaType = input.mediaType === "video" ? "video" : "image";
    const scheduledAtLabel = typeof input.scheduledAtLabel === "string" && input.scheduledAtLabel.trim() ? input.scheduledAtLabel.trim() : null;
    const postId = typeof input.postId === "string" && input.postId.trim() ? input.postId.trim() : null;

    const spec = postPreviewView({
      caption,
      mediaUrl,
      mediaType: mediaUrl ? mediaType : null,
      platforms,
      scheduledAtLabel,
      postId,
    });

    return {
      ok: true,
      data: {
        inlineView: { requestId: `post-preview-${postId || Date.now()}`, spec },
        platforms,
        userMessage:
          "Showed the post preview inline. STOP and wait — the user taps 'Post now' (then propose_plan → schedule_social_post) or 'Edit caption'. Don't re-describe the preview as text.",
      },
    };
  },
};
