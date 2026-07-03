import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateVideoForRole } from "@/lib/ai/video-router";
import { uploadToS3 } from "@/lib/utils/s3-client";
import type { FlowAgentTool } from "../registry";

/**
 * regenerate_post_video — generate an on-brand VIDEO for a Campaign Studio post
 * from its media PROMPT and attach it live to the post's card (never a chat dump).
 * Fires when the user clicks "Generate video" on a planned post (or "New video").
 * Uses the post's stored/edited prompt + the campaign's style/length; the caller
 * picks the tier (standard | premium). [[agent-writes-into-ui-element-not-chat]]
 */

const VIDEO_STYLES: Record<string, string> = {
  reel: "a fast-paced vertical social reel with dynamic motion and bold on-theme visuals",
  slideshow: "a clean slideshow-style montage of on-brand product and lifestyle shots with smooth transitions",
  cinematic: "a cinematic, premium ad-style clip with smooth camera motion and rich lighting",
  product: "a crisp product-showcase clip highlighting the product from a few flattering angles",
};

export const regeneratePostVideo: FlowAgentTool = {
  name: "regenerate_post_video",
  description:
    "Generate an on-brand VIDEO for a scheduled/draft social POST from its media prompt and attach it live to the post's card in Campaign Studio (never paste it in chat). Use when the user clicks 'Generate video' on a planned post, or 'New video' to redo it. Pass the postId, an optional prompt override, and tier: 'standard' (default, ~30 credits) or 'premium' (Veo Quality with audio, ~60 credits). Where the user hasn't chosen a tier, ASK standard or premium first.",
  input_schema: {
    type: "object",
    properties: {
      postId: { type: "string", description: "The post id (from the Campaign Studio card)." },
      prompt: { type: "string", description: "Optional prompt override. Defaults to the post's stored media prompt." },
      tier: { type: "string", description: "'standard' (default, ~30 credits) or 'premium' (~60 credits, higher quality + audio)." },
    },
    required: ["postId"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // charged manually after a successful render
  mutating: false,
  handler: async (input, ctx) => {
    const postId = typeof input.postId === "string" ? input.postId.trim() : "";
    if (!postId) return { ok: false, error_code: "missing_input", message: "postId is required." };

    const post = await prisma.post.findFirst({
      where: { id: postId, userId: ctx.userId, deletedAt: null },
      select: { id: true, caption: true, mediaType: true, mediaMeta: true, contentAutomation: { select: { aiMediaConfig: true } } },
    });
    if (!post) return { ok: false, error_code: "not_found", message: "That post was not found." };

    const tier = input.tier === "premium" ? "premium" : "standard";
    const role = tier === "premium" ? "video_premium" : "video_standard";
    const costKey = tier === "premium" ? "AI_VIDEO_STUDIO" : "AI_VIDEO_LITE";

    let videoType = "reel";
    let videoSeconds = 8;
    try {
      const cfg = JSON.parse(post.contentAutomation?.aiMediaConfig || "{}");
      if (typeof cfg.videoType === "string" && VIDEO_STYLES[cfg.videoType]) videoType = cfg.videoType;
      if (typeof cfg.videoSeconds === "number" && cfg.videoSeconds >= 5 && cfg.videoSeconds <= 20) videoSeconds = Math.round(cfg.videoSeconds);
    } catch { /* defaults */ }

    // Prompt: explicit override → the post's stored plan prompt → built from caption.
    let prompt = typeof input.prompt === "string" && input.prompt.trim() ? input.prompt.trim() : "";
    if (!prompt && (post.mediaType || "").startsWith("planned")) {
      try { const o = JSON.parse(post.mediaMeta || "{}"); if (typeof o.prompt === "string") prompt = o.prompt; } catch { /* fall through */ }
    }
    if (!prompt) {
      const body = (post.caption || "").replace(/\n\s*#[\w-].*$/s, "").slice(0, 160);
      prompt = `${VIDEO_STYLES[videoType]}. ${body}. No text overlays, no captions.`;
    }

    const cost = await getDynamicCreditCost(costKey);
    if (!ctx.isAdmin && cost > 0) {
      const bal = await creditService.getBalance(ctx.userId);
      if (bal < cost) return { ok: false, error_code: "insufficient_credits", message: `A ${tier} post video costs ${cost} credits. User has ${bal}. Suggest /home/billing to top up.`, meta: { need: cost, have: bal } };
    }

    let url: string;
    try {
      const v = await generateVideoForRole(role, { prompt, durationSeconds: videoSeconds, aspectRatio: "9:16", resolution: "720p" });
      if (!v.videoBuffer) throw new Error("no video");
      const key = `campaigns/${ctx.userId}/${Date.now()}-regen.mp4`;
      url = await uploadToS3(key, v.videoBuffer, "video/mp4");
    } catch (e) {
      return { ok: false, error_code: "upstream_failed", message: e instanceof Error ? e.message : "Video generation failed." };
    }

    await prisma.post.update({ where: { id: postId }, data: { mediaUrl: url, mediaMeta: JSON.stringify([url]), mediaType: "video" } });
    if (!ctx.isAdmin && cost > 0) {
      await creditService.deductCredits({ userId: ctx.userId, amount: cost, type: "USAGE", description: `Campaign post video (${tier})`, referenceType: "flow_ai_tool", referenceId: postId }).catch(() => {});
    }
    ctx.emit({ type: "canvas_update", patch: { __post: { postId, video: true } } });

    return {
      ok: true,
      data: { postId, url, tier, userMessage: `Rendered the ${tier} video for the post — it's on the card now. Don't repeat it in chat.` },
      resultRefType: "Post",
      resultRefId: postId,
    };
  },
};
