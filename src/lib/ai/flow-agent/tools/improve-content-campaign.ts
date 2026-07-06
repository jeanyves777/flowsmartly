import { prisma } from "@/lib/db/client";
import { generateAutomationCopy } from "@/lib/content/automation-copy-generator";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";

/**
 * improve_content_campaign — the "Improve" button in Campaign Studio. Rewrites an
 * EXISTING campaign's drafted posts IN PLACE from an improved brief/tone: fresh,
 * sharper captions + refreshed media PROMPTS, keeping the same posts, dates and
 * count. It does NOT create a new campaign and does NOT render images/videos (the
 * user regenerates media per-post after review), so it's fast + cheap (captions
 * only). Contrast with create_content_campaign, which always makes a NEW campaign.
 * [[agent-operates-account-full-crud]] [[campaign-studio-playground]]
 */

const PLATFORMS = new Set(["feed", "instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube", "pinterest", "threads", "whatsapp"]);
const VIDEO_STYLES: Record<string, string> = {
  reel: "a fast-paced vertical social reel with dynamic motion and bold on-theme visuals",
  slideshow: "a clean slideshow-style montage of on-brand product and lifestyle shots with smooth transitions",
  cinematic: "a cinematic, premium ad-style clip with smooth camera motion and rich lighting",
  product: "a crisp product-showcase clip highlighting the product from a few flattering angles",
};

function clean(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
/** Pull a trailing "#a #b #c" block off a caption into a hashtag list. */
function splitHashtags(caption: string): { body: string; tags: string[] } {
  const m = caption.match(/\n\s*(#[\w-]+(?:\s+#[\w-]+)*)\s*$/);
  if (!m) return { body: caption, tags: [] };
  const tags = m[1].split(/\s+/).map((t) => t.replace(/^#/, "")).filter(Boolean);
  return { body: caption.slice(0, m.index).trimEnd(), tags };
}

export const improveContentCampaign: FlowAgentTool = {
  name: "improve_content_campaign",
  description:
    "IMPROVE an EXISTING content campaign IN PLACE — rewrite its already-drafted posts' captions + media prompts from an improved brief/tone, WITHOUT creating a new campaign and WITHOUT rendering any images/videos. Use this (NOT create_content_campaign) when the user clicks 'Improve' on an open campaign or asks to 'improve / refresh / rewrite / sharpen this campaign'. Keeps the same posts, dates and count — only the copy + prompts change. Pass campaignId (the open campaign), the improved brief, and optionally tone, platforms, and free-form instructions on HOW to improve. Cheap (captions only). Pass planId from a confirmed propose_plan.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "planId from a confirmed propose_plan." },
      campaignId: { type: "string", description: "REQUIRED — the campaign to improve (the one open in Campaign Studio)." },
      brief: { type: "string", description: "The improved brief / goal — captions are rewritten from this + the Brand Kit. If omitted, the campaign's current brief is kept." },
      tone: { type: "string", description: "Optional new voice/tone for the captions (e.g. 'bold', 'professional')." },
      platforms: { type: "array", items: { type: "string" }, description: "Optional — change the destinations for every post." },
      instructions: { type: "string", description: "Optional free-form guidance on HOW to improve (e.g. 'make them punchier', 'add a 15% launch-week discount CTA', 'more playful')." },
    },
    required: ["campaignId"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // per-post caption credits are charged inside the generator; base 0.
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const campaignId = clean(input.campaignId, 60);
      if (!campaignId) return { ok: false, error_code: "missing_input", message: "campaignId is required." };

      const campaign = await prisma.contentCampaign.findFirst({
        where: { id: campaignId, userId: ctx.userId },
        select: { id: true, name: true, description: true },
      });
      if (!campaign) return { ok: false, error_code: "not_found", message: "That campaign doesn't exist (or isn't yours)." };

      // The container automation groups the posts + holds the brief the copy
      // generator reads. Update it so regeneration writes to the improved brief.
      const container = await prisma.contentAutomation.findFirst({
        where: { campaignId, userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, aiMediaConfig: true },
      });
      if (!container) return { ok: false, error_code: "not_found", message: "This campaign has no posts to improve yet — plan it first." };

      const posts = await prisma.post.findMany({
        where: { userId: ctx.userId, deletedAt: null, contentAutomationId: container.id },
        orderBy: { scheduledAt: "asc" },
        select: { id: true, scheduledAt: true, mediaType: true },
      });
      if (posts.length === 0) return { ok: false, error_code: "not_found", message: "There are no drafted posts to improve." };

      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { name: true },
      });

      const newBrief = clean(input.brief, 2000);
      const newTone = clean(input.tone, 60);
      const instructions = clean(input.instructions, 600);
      const platforms = (Array.isArray(input.platforms) ? input.platforms : [])
        .map((p) => clean(p, 40).toLowerCase())
        .filter((p) => PLATFORMS.has(p));

      // Fold the improved brief (+ any instructions) into the container's aiPrompt
      // so generateAutomationCopy — which reads that field — writes to it; keep the
      // campaign meta in sync with what the studio shows.
      const briefWithNotes = [newBrief || campaign.description || "", instructions ? `Improvement notes: ${instructions}` : ""].filter(Boolean).join("\n\n");
      const contData: Record<string, unknown> = {};
      const campData: Record<string, unknown> = {};
      if (briefWithNotes) { contData.aiPrompt = briefWithNotes; }
      if (newBrief) { campData.description = newBrief; campData.defaultAiPrompt = newBrief; }
      if (newTone) { contData.aiTone = newTone; campData.defaultTone = newTone; }
      if (platforms.length) { contData.platforms = JSON.stringify(platforms); campData.defaultPlatforms = JSON.stringify(platforms); }
      if (Object.keys(contData).length) await prisma.contentAutomation.update({ where: { id: container.id }, data: contData });
      if (Object.keys(campData).length) await prisma.contentCampaign.update({ where: { id: campaignId }, data: campData });

      const videoType = (() => { try { const o = JSON.parse(container.aiMediaConfig || "{}"); return typeof o.videoType === "string" && VIDEO_STYLES[o.videoType] ? o.videoType : "reel"; } catch { return "reel"; } })();
      const effectivePlatforms = platforms.length ? platforms : null;

      const taskId = await spawnBackgroundTask({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        kind: "improve_content_campaign",
        input: { campaignId, count: posts.length },
        creditCost: 0,
        worker: async (taskId) => {
          let improved = 0;
          for (let i = 0; i < posts.length; i++) {
            const p = posts[i];
            publishTaskEvent({ type: "progress", taskId, progress: Math.round((i / posts.length) * 90) + 5, message: `Improving post ${i + 1} of ${posts.length}…` });
            const iso = (p.scheduledAt ?? new Date()).toISOString();

            let caption = "";
            try {
              const c = await generateAutomationCopy({ userId: ctx.userId, automationId: container.id, occurrenceAt: iso });
              caption = c.caption || "";
            } catch (e) { console.warn("[improve_content_campaign] caption failed:", e); }
            if (!caption) continue; // keep the existing caption if generation failed

            const { body, tags } = splitHashtags(caption);
            const finalCaption = tags.length ? `${body}\n\n${tags.map((h) => `#${h}`).join(" ")}` : body;
            const data: Record<string, unknown> = { caption: finalCaption, hashtags: JSON.stringify(tags) };
            if (effectivePlatforms) data.platforms = JSON.stringify(effectivePlatforms);

            // Rewrite the PLANNED media prompt to match the fresh copy (only for
            // media not yet generated — never touch a real generated asset).
            const planned = (p.mediaType || "").startsWith("planned");
            if (planned && body) {
              const isVideo = p.mediaType === "planned_video";
              const prompt = isVideo
                ? `${VIDEO_STYLES[videoType]}. ${body.slice(0, 160)}.${brandKit?.name ? ` On-brand for ${brandKit.name}.` : ""} No text overlays, no captions.`
                : `On-brand social image for: ${body.slice(0, 180)}. Clean, scroll-stopping, uses the brand's colours + style. No text overlays.`;
              data.mediaMeta = JSON.stringify({ prompt });
            }

            await prisma.post.update({ where: { id: p.id }, data });
            improved++;
          }

          await notifyAgentTaskComplete({
            userId: ctx.userId,
            taskId,
            kind: "improve_content_campaign",
            ok: true,
            summary: `Improved "${campaign.name}" — ${improved} posts rewritten`,
            detail: "Open Campaign Studio to review the refreshed captions, generate media, then approve.",
            deepLink: `/home/campaign?campaign=${campaignId}`,
          });

          return {
            output: { campaignId, improved },
            resultRefType: "ContentCampaign",
            resultRefId: campaignId,
          };
        },
      });

      ctx.emit({ type: "task_started", taskId, kind: "improve_content_campaign", summary: `Improving "${campaign.name}" — rewriting ${posts.length} posts' captions + media prompts to match your update. They refresh in Campaign Studio; nothing is re-rendered.` });

      return {
        ok: true,
        data: {
          taskId,
          campaignId,
          userMessage: `Improving the "${campaign.name}" campaign — rewriting its ${posts.length} posts' captions + media prompts to match the update (no new campaign, no media re-rendered). They refresh in the studio. Say this in ONE short sentence.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to improve the campaign" };
    }
  },
};
