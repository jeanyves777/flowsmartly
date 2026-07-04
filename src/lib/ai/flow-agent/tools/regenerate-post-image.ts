import { prisma } from "@/lib/db/client";
import { generateBrandedImage } from "@/lib/media/branded-image";
import type { FlowAgentTool } from "../registry";

/**
 * regenerate_post_image — generate an on-brand IMAGE for a Campaign Studio post
 * from its media PROMPT and attach it live to the post's card (never a chat dump).
 * Fires when the user clicks "Generate image" on a planned post (or "New image" to
 * redo it). Uses the post's stored/edited prompt; the caller can pick the quality
 * tier (standard | premium). [[agent-writes-into-ui-element-not-chat]]
 */
export const regeneratePostImage: FlowAgentTool = {
  name: "regenerate_post_image",
  description:
    "Generate an on-brand IMAGE for a scheduled/draft social POST from its media prompt and attach it live to the post's card in Campaign Studio (never paste it in chat). Use when the user clicks 'Generate image' on a planned post, or 'New image' to redo it. Pass the postId, an optional prompt override, and tier: 'standard' (default, cheaper) or 'premium' (higher quality, costs more). Where the user hasn't chosen a tier, ASK standard or premium first.",
  input_schema: {
    type: "object",
    properties: {
      postId: { type: "string", description: "The post id (from the Campaign Studio card)." },
      prompt: { type: "string", description: "Optional prompt override. Defaults to the post's stored media prompt (or its caption)." },
      tier: { type: "string", description: "'standard' (default) or 'premium' (higher quality, more credits)." },
    },
    required: ["postId"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // generateBrandedImage bills its own tier cost
  mutating: false,
  handler: async (input, ctx) => {
    const postId = typeof input.postId === "string" ? input.postId.trim() : "";
    if (!postId) return { ok: false, error_code: "missing_input", message: "postId is required." };

    const post = await prisma.post.findFirst({
      where: { id: postId, userId: ctx.userId, deletedAt: null },
      select: { id: true, caption: true, mediaType: true, mediaMeta: true },
    });
    if (!post) return { ok: false, error_code: "not_found", message: "That post was not found." };

    const tier = input.tier === "premium" ? "premium" : "standard";
    let prompt = typeof input.prompt === "string" && input.prompt.trim() ? input.prompt.trim() : "";
    if (!prompt && (post.mediaType || "").startsWith("planned")) {
      try { const o = JSON.parse(post.mediaMeta || "{}"); if (typeof o.prompt === "string") prompt = o.prompt; } catch { /* fall through */ }
    }
    if (!prompt) prompt = `On-brand social image for: ${(post.caption || "").replace(/\n\s*#[\w-].*$/s, "").slice(0, 180)}. Clean, scroll-stopping, brand colours + style. No text overlays.`;

    const d = await generateBrandedImage({ userId: ctx.userId, prompt, orientation: "square", tier, style: "modern" });
    if (!d.ok || !d.imageUrl) {
      const insufficient = d.errorCode === "insufficient_credits";
      return { ok: false, error_code: insufficient ? "insufficient_credits" : "upstream_failed", message: d.error || "Image generation failed." };
    }

    await prisma.post.update({ where: { id: postId }, data: { mediaUrl: d.imageUrl, mediaMeta: JSON.stringify([d.imageUrl]), mediaType: "image" } });
    ctx.emit({ type: "canvas_update", patch: { __post: { postId, image: true } } });

    return {
      ok: true,
      data: { postId, url: d.imageUrl, tier, userMessage: `Generated the ${tier} image for the post — it's on the card now. Don't repeat it in chat.` },
      resultRefType: "Post",
      resultRefId: postId,
    };
  },
};
