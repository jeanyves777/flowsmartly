import { prisma } from "@/lib/db/client";
import { buildCampaignInlineView } from "./campaign-inline-view";
import type { FlowAgentTool } from "../registry";

function inferMediaType(url: string, explicit?: unknown): "image" | "video" {
  if (explicit === "video") return "video";
  if (/\.(mp4|webm|mov|m4v|avi|mkv)(?:\?|#|$)/i.test(url)) return "video";
  return "image";
}

/**
 * attach_media_to_post - attach an existing uploaded/library media asset to a
 * Campaign Studio post, then return a refreshed inline campaign card.
 */
export const attachMediaToPost: FlowAgentTool = {
  name: "attach_media_to_post",
  description:
    "Attach an uploaded or media-library image/video to a Campaign Studio post and refresh the inline campaign card. Use after the user uploads media for a campaign post, or clicks 'Attach to post' in the media picker. Pass postId plus either mediaUrl or mediaId. Include campaignId when available.",
  input_schema: {
    type: "object",
    properties: {
      postId: { type: "string", description: "The campaign Post id." },
      mediaUrl: { type: "string", description: "Hosted media URL to attach." },
      mediaId: { type: "string", description: "MediaFile id from the user's library." },
      mediaType: { type: "string", enum: ["image", "video"], description: "Optional explicit media type." },
      campaignId: { type: "string", description: "Optional ContentCampaign id for refreshed inline view." },
    },
    required: ["postId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    const postId = typeof input.postId === "string" ? input.postId.trim() : "";
    if (!postId) return { ok: false, error_code: "missing_input", message: "postId is required." };

    const post = await prisma.post.findFirst({
      where: { id: postId, userId: ctx.userId, deletedAt: null },
      select: { id: true, contentAutomation: { select: { campaignId: true } } },
    });
    if (!post) return { ok: false, error_code: "not_found", message: "That post was not found." };

    let url = typeof input.mediaUrl === "string" ? input.mediaUrl.trim() : "";
    let mediaTypeHint: unknown = input.mediaType;
    if (!url && typeof input.mediaId === "string" && input.mediaId.trim()) {
      const media = await prisma.mediaFile.findFirst({
        where: { id: input.mediaId.trim(), userId: ctx.userId },
        select: { url: true, type: true },
      });
      if (!media) return { ok: false, error_code: "not_found", message: "That media file was not found." };
      url = media.url;
      mediaTypeHint = media.type;
    }
    if (!url) return { ok: false, error_code: "missing_input", message: "mediaUrl or mediaId is required." };

    const mediaType = inferMediaType(url, mediaTypeHint);
    await prisma.post.update({
      where: { id: postId },
      data: { mediaUrl: url, mediaMeta: JSON.stringify([url]), mediaType },
    });
    ctx.emit({ type: "canvas_update", patch: { __post: { postId, media: true } } });

    const campaignId =
      typeof input.campaignId === "string" && input.campaignId.trim()
        ? input.campaignId.trim()
        : post.contentAutomation?.campaignId;
    const inlineView = await buildCampaignInlineView({ userId: ctx.userId, campaignId, postIdForRequest: postId });

    return {
      ok: true,
      data: {
        postId,
        url,
        mediaUrl: url,
        mediaType,
        inlineView,
        userMessage: `Attached the ${mediaType} and refreshed the campaign card below with the media visible.`,
      },
      resultRefType: "Post",
      resultRefId: postId,
    };
  },
};
