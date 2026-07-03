import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateVideoForRole } from "@/lib/ai/video-router";
import { uploadToS3 } from "@/lib/utils/s3-client";
import type { FlowAgentTool } from "../registry";

/**
 * regenerate_post_video — generate a fresh on-brand VIDEO for a Campaign Studio
 * post and attach it so it updates live on the post's card (never a chat dump).
 * Fires when the user clicks "New" on a VIDEO post. Reuses the video-router
 * (video_standard) at the campaign's chosen video style. Charges the video cost.
 * [[agent-writes-into-ui-element-not-chat]]
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
    "Generate a fresh on-brand VIDEO for a scheduled/draft social POST and attach it so it updates on the post's card in Campaign Studio (never paste it in chat). Use when the user clicks 'New' on a VIDEO post or asks to change a post's video. Pass the postId. Renders an 8s vertical clip in the campaign's chosen style. Charges the standard video cost (~30 credits) — mention that.",
  input_schema: {
    type: "object",
    properties: {
      postId: { type: "string", description: "The post id (from the Campaign Studio card)." },
      videoType: { type: "string", description: "Optional style override: 'reel' | 'slideshow' | 'cinematic' | 'product'. Defaults to the campaign's style." },
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
      select: { id: true, caption: true, contentAutomation: { select: { aiMediaConfig: true } } },
    });
    if (!post) return { ok: false, error_code: "not_found", message: "That post was not found." };

    let videoType = typeof input.videoType === "string" && VIDEO_STYLES[input.videoType] ? input.videoType : "reel";
    let videoSeconds = 8;
    try {
      const cfg = JSON.parse(post.contentAutomation?.aiMediaConfig || "{}");
      if (!(typeof input.videoType === "string" && VIDEO_STYLES[input.videoType]) && typeof cfg.videoType === "string" && VIDEO_STYLES[cfg.videoType]) videoType = cfg.videoType;
      if (typeof cfg.videoSeconds === "number" && cfg.videoSeconds >= 5 && cfg.videoSeconds <= 20) videoSeconds = Math.round(cfg.videoSeconds);
    } catch { /* defaults */ }

    const cost = await getDynamicCreditCost("AI_VIDEO_LITE");
    if (!ctx.isAdmin && cost > 0) {
      const bal = await creditService.getBalance(ctx.userId);
      if (bal < cost) return { ok: false, error_code: "insufficient_credits", message: `A post video costs ${cost} credits. User has ${bal}. Suggest /home/billing to top up.`, meta: { need: cost, have: bal } };
    }

    const brand = await prisma.brandKit.findFirst({ where: { userId: ctx.userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: { name: true } });
    const body = (post.caption || "").replace(/\n\s*#[\w-].*$/s, "").slice(0, 160);

    let url: string;
    try {
      const prompt = `${VIDEO_STYLES[videoType]}. ${body}. On-brand for ${brand?.name || "the brand"}. No text overlays, no captions.`;
      const v = await generateVideoForRole("video_standard", { prompt, durationSeconds: videoSeconds, aspectRatio: "9:16", resolution: "720p" });
      if (!v.videoBuffer) throw new Error("no video");
      const key = `campaigns/${ctx.userId}/${Date.now()}-regen.mp4`;
      url = await uploadToS3(key, v.videoBuffer, "video/mp4");
    } catch (e) {
      return { ok: false, error_code: "upstream_failed", message: e instanceof Error ? e.message : "Video generation failed." };
    }

    await prisma.post.update({ where: { id: postId }, data: { mediaUrl: url, mediaMeta: JSON.stringify([url]), mediaType: "video" } });
    if (!ctx.isAdmin && cost > 0) {
      await creditService.deductCredits({ userId: ctx.userId, amount: cost, type: "USAGE", description: "Campaign post video (regenerate)", referenceType: "flow_ai_tool", referenceId: postId }).catch(() => {});
    }
    ctx.emit({ type: "canvas_update", patch: { __post: { postId, video: true } } });

    return {
      ok: true,
      data: { postId, url, userMessage: "Rendered a fresh on-brand video for the post — it's on the card now. Don't repeat it in chat." },
      resultRefType: "Post",
      resultRefId: postId,
    };
  },
};
