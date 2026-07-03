import { prisma } from "@/lib/db/client";
import { generateAutomationMedia } from "@/lib/content/automation-media-generator";
import type { FlowAgentTool } from "../registry";

/**
 * regenerate_post_image — generate a fresh on-brand image for a Campaign Studio
 * post and attach it so it updates live on the post's card (never a chat dump).
 * Fires when the user clicks "New image" on a campaign post. Reuses the shared
 * generateAutomationMedia engine (same on-brand quality as the campaign build).
 * [[agent-writes-into-ui-element-not-chat]]
 */
export const regeneratePostImage: FlowAgentTool = {
  name: "regenerate_post_image",
  description:
    "Generate a fresh on-brand IMAGE for a scheduled/draft social POST and attach it so it updates on the post's card in Campaign Studio (never paste it in chat). Use when the user clicks 'New image' on a campaign post or asks to change a post's image. Pass the postId. Charges the standard image-generation cost.",
  input_schema: {
    type: "object",
    properties: {
      postId: { type: "string", description: "The post id (from the Campaign Studio card)." },
    },
    required: ["postId"],
  },
  plans: null,
  // generateAutomationMedia charges the image credits itself — base 0 here.
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: false,
  handler: async (input, ctx) => {
    const postId = typeof input.postId === "string" ? input.postId.trim() : "";
    if (!postId) return { ok: false, error_code: "missing_input", message: "postId is required." };

    const post = await prisma.post.findFirst({
      where: { id: postId, userId: ctx.userId, deletedAt: null },
      select: { id: true, contentAutomationId: true },
    });
    if (!post) return { ok: false, error_code: "not_found", message: "That post was not found." };
    if (!post.contentAutomationId) {
      return { ok: false, error_code: "validation_failed", message: "This post isn't part of a campaign — use create_branded_design to make an image, then update_post to attach it." };
    }

    let url: string;
    try {
      const m = await generateAutomationMedia({ userId: ctx.userId, automationId: post.contentAutomationId, aspect: "square", tier: "standard", keyTag: "campaigns" });
      url = m.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Image generation failed.";
      const insufficient = (e as { code?: string })?.code === "INSUFFICIENT_CREDITS";
      return { ok: false, error_code: insufficient ? "insufficient_credits" : "upstream_failed", message: msg };
    }

    await prisma.post.update({ where: { id: postId }, data: { mediaUrl: url, mediaMeta: JSON.stringify([url]), mediaType: "image" } });
    ctx.emit({ type: "canvas_update", patch: { __post: { postId, image: true } } });

    return {
      ok: true,
      data: { postId, url, userMessage: "Generated a fresh on-brand image for the post — it's on the card now. Don't repeat it in chat." },
      resultRefType: "Post",
      resultRefId: postId,
    };
  },
};
