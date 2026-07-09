import { prisma } from "@/lib/db/client";
import { generateBrandedImage } from "@/lib/media/branded-image";
import { campaignTimelineView } from "@/lib/agent-views/templates";
import type { FlowAgentTool } from "../registry";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtWhen(d: Date | null): string {
  if (!d) return "unscheduled";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} - ${h}:${String(m).padStart(2, "0")} ${ampm}`;
}
function fmtPlatforms(raw: string | null): string {
  try {
    const a = JSON.parse(raw || "[]");
    return Array.isArray(a) && a.length ? a.map((p: string) => String(p)).join(" - ") : "feed";
  } catch {
    return "feed";
  }
}

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
      select: { id: true, caption: true, mediaType: true, mediaMeta: true, contentAutomation: { select: { campaignId: true } } },
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

    let inlineView: { requestId: string; spec: ReturnType<typeof campaignTimelineView> } | undefined;
    const campaignId = post.contentAutomation?.campaignId;
    if (campaignId) {
      const campaign = await prisma.contentCampaign.findFirst({
        where: { id: campaignId, userId: ctx.userId },
        select: {
          id: true,
          name: true,
          status: true,
          automations: {
            select: {
              posts: {
                select: { id: true, caption: true, platforms: true, mediaUrl: true, mediaType: true, status: true, scheduledAt: true },
              },
            },
          },
        },
      });
      if (campaign) {
        const posts = campaign.automations
          .flatMap((automation) => automation.posts)
          .sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0))
          .map((item) => ({
            id: item.id,
            when: fmtWhen(item.scheduledAt),
            platforms: fmtPlatforms(item.platforms),
            caption: item.caption || "",
            status: item.status,
            hasMedia: !!item.mediaUrl,
            mediaUrl: item.mediaUrl,
            mediaType: item.mediaType,
          }));
        inlineView = {
          requestId: `campaign-view-${campaign.id}-media-${postId}`,
          spec: campaignTimelineView({ campaignId: campaign.id, name: campaign.name, status: campaign.status, posts }),
        };
      }
    }

    return {
      ok: true,
      data: { postId, url: d.imageUrl, tier, inlineView, userMessage: `Generated the ${tier} image and refreshed the campaign card below with the media attached. Don't repeat the post list as plain text.` },
      resultRefType: "Post",
      resultRefId: postId,
    };
  },
};
