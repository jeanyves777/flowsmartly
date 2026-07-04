import { prisma } from "@/lib/db/client";
import { generateAutomationCopy } from "@/lib/content/automation-copy-generator";
import type { FlowAgentTool } from "../registry";

/**
 * add_campaign_post — the Campaign Studio "Add a post" skill. Adds ONE more
 * DRAFT post (a caption + a media PROMPT only) to an existing content campaign,
 * matching plan-first: it does NOT generate the image/video and does NOT
 * schedule/publish — the post lands as a DRAFT on the calendar for the user to
 * review, then generate its media + approve per-post. Fires when the user clicks
 * "Add a post (agent fills it)" in Campaign Studio. [[campaign-studio-playground]]
 * [[agent-writes-into-ui-element-not-chat]]
 */

const VIDEO_STYLES: Record<string, string> = {
  reel: "a fast-paced vertical social reel with dynamic motion and bold on-theme visuals",
  slideshow: "a clean slideshow-style montage of on-brand product and lifestyle shots with smooth transitions",
  cinematic: "a cinematic, premium ad-style clip with smooth camera motion and rich lighting",
  product: "a crisp product-showcase clip highlighting the product from a few flattering angles",
};

function splitHashtags(caption: string): { body: string; tags: string[] } {
  const m = caption.match(/\n\s*(#[\w-]+(?:\s+#[\w-]+)*)\s*$/);
  if (!m) return { body: caption, tags: [] };
  const tags = m[1].split(/\s+/).map((t) => t.replace(/^#/, "")).filter(Boolean);
  return { body: caption.slice(0, m.index).trimEnd(), tags };
}

export const addCampaignPost: FlowAgentTool = {
  name: "add_campaign_post",
  description:
    "Add ONE more DRAFT post to an existing Campaign Studio campaign — a caption + a media PROMPT only. This does NOT generate the image/video and does NOT schedule or publish it; the post lands as a DRAFT on the campaign calendar for the user to review, then generate its media and approve. Use when the user clicks 'Add a post' in Campaign Studio, or asks to add a post to a campaign. Pass campaignId + a fresh on-brand caption that fits the campaign theme + a matching mediaPrompt. Optional: platforms, scheduledAt (ISO). NEVER generate media or schedule from here.",
  input_schema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "The content campaign id (from Campaign Studio)." },
      caption: { type: "string", description: "The post caption — on-brand, fitting the campaign theme. If omitted, one is generated from the campaign brief." },
      mediaPrompt: { type: "string", description: "The image/video PROMPT for this post (what to generate LATER). If omitted, it's derived from the caption." },
      platforms: { type: "array", items: { type: "string" }, description: "Optional destinations; defaults to the campaign's platforms." },
      scheduledAt: { type: "string", description: "Optional ISO date/time; defaults to the day after the campaign's last post." },
    },
    required: ["campaignId"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // no media generated → no charge, no plan gate
  mutating: false,
  handler: async (input, ctx) => {
    const campaignId = typeof input.campaignId === "string" ? input.campaignId.trim() : "";
    if (!campaignId) return { ok: false, error_code: "missing_input", message: "campaignId is required." };

    const campaign = await prisma.contentCampaign.findFirst({
      where: { id: campaignId, userId: ctx.userId },
      select: { id: true, name: true, description: true, defaultPlatforms: true },
    });
    if (!campaign) return { ok: false, error_code: "not_found", message: "That campaign was not found." };

    // The disabled "container" automation groups the campaign's posts.
    const container = await prisma.contentAutomation.findFirst({
      where: { campaignId: campaign.id, userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, platforms: true, hashtags: true, aiMediaConfig: true },
    });
    if (!container) return { ok: false, error_code: "not_found", message: "That campaign has no post container." };

    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: ctx.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { name: true },
    });

    // Platforms: explicit → container default → feed.
    let platforms: string[] = [];
    try { platforms = JSON.parse(container.platforms || campaign.defaultPlatforms || "[]"); } catch { /* default below */ }
    if (Array.isArray(input.platforms) && input.platforms.length) {
      platforms = input.platforms.map((p) => String(p).toLowerCase().trim()).filter(Boolean);
    }
    if (!platforms.length) platforms = ["feed"];

    // When: explicit ISO, else the day after the last post (9am), never past.
    let when: Date;
    const rawWhen = typeof input.scheduledAt === "string" ? input.scheduledAt.trim() : "";
    if (rawWhen) {
      const d = new Date(rawWhen);
      when = Number.isNaN(d.getTime()) ? new Date(Date.now() + 24 * 3600 * 1000) : d;
    } else {
      const last = await prisma.post.findFirst({
        where: { contentAutomationId: container.id, deletedAt: null },
        orderBy: { scheduledAt: "desc" },
        select: { scheduledAt: true },
      });
      const base = last?.scheduledAt ? last.scheduledAt.getTime() + 24 * 3600 * 1000 : Date.now() + 24 * 3600 * 1000;
      const d = new Date(base);
      d.setHours(9, 0, 0, 0);
      when = new Date(Math.max(d.getTime(), Date.now() + 3600 * 1000));
    }

    // Caption: the agent's, else generated from the campaign brief.
    let caption = typeof input.caption === "string" ? input.caption.trim() : "";
    if (!caption) {
      try {
        const c = await generateAutomationCopy({ userId: ctx.userId, automationId: container.id, occurrenceAt: when.toISOString() });
        caption = c.caption || campaign.description || campaign.name;
      } catch { caption = campaign.description || campaign.name; }
    }
    const { body, tags } = splitHashtags(caption);
    let containerTags: string[] = [];
    try { containerTags = JSON.parse(container.hashtags || "[]"); } catch { /* none */ }
    const hashtags = tags.length ? tags : containerTags;

    // PLAN the media (prompt only) unless the campaign is text-only.
    let mediaMode = "ai";
    let videoType = "reel";
    try {
      const cfg = JSON.parse(container.aiMediaConfig || "{}");
      if (typeof cfg.mode === "string") mediaMode = cfg.mode;
      if (typeof cfg.videoType === "string") videoType = cfg.videoType;
    } catch { /* defaults */ }
    const isVideo = mediaMode === "video";
    let mediaType: string | null = null;
    let mediaMeta: string | null = null;
    if (mediaMode !== "none") {
      const prompt = (typeof input.mediaPrompt === "string" && input.mediaPrompt.trim())
        ? input.mediaPrompt.trim()
        : isVideo
          ? `${VIDEO_STYLES[videoType] || VIDEO_STYLES.reel}. ${body.slice(0, 160)}. On-brand for ${brandKit?.name || "the brand"}. No text overlays, no captions.`
          : `On-brand social image for: ${body.slice(0, 180)}. Clean, scroll-stopping, uses the brand's colours + style. No text overlays.`;
      mediaType = isVideo ? "planned_video" : "planned_image";
      mediaMeta = JSON.stringify({ prompt });
    }

    const post = await prisma.post.create({
      data: {
        userId: ctx.userId,
        caption: hashtags.length ? `${body}\n\n${hashtags.map((h) => `#${h}`).join(" ")}` : body,
        hashtags: JSON.stringify(hashtags),
        platforms: JSON.stringify(platforms),
        mediaUrl: null,
        mediaMeta,
        mediaType,
        status: "DRAFT",
        scheduledAt: when,
        contentAutomationId: container.id,
      },
      select: { id: true },
    });

    ctx.emit({ type: "canvas_update", patch: { __post: { added: true, postId: post.id, campaignId: campaign.id } } });

    return {
      ok: true,
      data: {
        postId: post.id,
        campaignId: campaign.id,
        scheduledAt: when.toISOString(),
        userMessage: `Added a DRAFT post to "${campaign.name}" — the caption + image prompt are on the new card in Campaign Studio. The user reviews it, then generates the media and approves. Do NOT paste the post in chat, and do NOT generate the media yourself.`,
      },
      resultRefType: "Post",
      resultRefId: post.id,
    };
  },
};
