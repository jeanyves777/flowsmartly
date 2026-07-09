import { prisma } from "@/lib/db/client";
import { generateAutomationCopy } from "@/lib/content/automation-copy-generator";
import { campaignView } from "@/lib/agent-views/templates";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";

/**
 * create_content_campaign — the Campaign Studio agent skill. From a brief (theme,
 * duration, cadence, platforms, tone, image mode) it generates a BATCH of concrete
 * scheduled posts — captions (brand-aware, Claude Haiku) + on-brand images (the
 * shared generateBrandedImage engine) — spread across the date window, grouped
 * under a ContentCampaign. The posts land as DRAFTs in the Studio for the user to
 * review/edit; approve_campaign then schedules them and the publish-scheduled-posts
 * cron auto-publishes them to the connected accounts.
 *
 * Reuses the proven legacy engine (ContentCampaign + a disabled ContentAutomation
 * "container" that groups the posts + stores the brief, so the recurring scheduler
 * never double-fires it). Heavy (N caption + N image gens) → background task.
 * Mutating → requires a confirmed propose_plan. [[agent-operates-account-full-crud]]
 */

const PLATFORMS = new Set(["feed", "instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube", "pinterest", "threads", "whatsapp"]);
const POST_HOURS = [9, 12, 17]; // rotate morning / midday / evening
const MEDIA_MODES = new Set(["ai", "video", "mix", "none"]);
// Video "types" → a prompt-style hint fed to the video generator.
const VIDEO_STYLES: Record<string, string> = {
  reel: "a fast-paced vertical social reel with dynamic motion and bold on-theme visuals",
  slideshow: "a clean slideshow-style montage of on-brand product and lifestyle shots with smooth transitions",
  cinematic: "a cinematic, premium ad-style clip with smooth camera motion and rich lighting",
  product: "a crisp product-showcase clip highlighting the product from a few flattering angles",
};

function clean(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

/** Spread `count` posts across [start, start+days) at rotating hours. */
function computeSchedule(startMs: number, days: number, count: number): number[] {
  const out: number[] = [];
  const spanMs = Math.max(1, days) * 24 * 3600 * 1000;
  const step = spanMs / count;
  for (let i = 0; i < count; i++) {
    const base = new Date(startMs + Math.round(step * i));
    base.setHours(POST_HOURS[i % POST_HOURS.length], 0, 0, 0);
    // Never schedule in the past (first slot may land today before the hour).
    out.push(Math.max(base.getTime(), Date.now() + 60 * 60 * 1000 + i * 60 * 1000));
  }
  return out;
}

/** Pull a trailing "#a #b #c" block off a caption into a hashtag list. */
function splitHashtags(caption: string): { body: string; tags: string[] } {
  const m = caption.match(/\n\s*(#[\w-]+(?:\s+#[\w-]+)*)\s*$/);
  if (!m) return { body: caption, tags: [] };
  const tags = m[1].split(/\s+/).map((t) => t.replace(/^#/, "")).filter(Boolean);
  return { body: caption.slice(0, m.index).trimEnd(), tags };
}

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtWhen(d: Date | null): string {
  if (!d) return "unscheduled";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()} - ${h}:${String(m).padStart(2, "0")} ${ampm}`;
}
function fmtPlatforms(raw: string | null): string {
  try {
    const a = JSON.parse(raw || "[]");
    return Array.isArray(a) && a.length ? a.map((p: string) => String(p)).join(" | ") : "feed";
  } catch {
    return "feed";
  }
}

export const createContentCampaign: FlowAgentTool = {
  name: "create_content_campaign",
  description:
    "PLAN a full CONTENT CAMPAIGN — a batch of scheduled social posts with captions + dates + a per-post media PROMPT — into the Campaign Studio for the user to review + edit, then generate each image/video ON DEMAND and approve. This does NOT generate images/videos (that happens per-post after review), so it's fast + cheap (only captions). Use when the user wants to 'run a campaign', 'plan a week/month of posts', 'plan content about X', etc. Draws voice from the Brand Kit. Pass: name (campaign title), brief (what it's about + the goal), platforms, days (window, default 14), postsPerWeek (cadence, default 3), tone, mediaMode ('ai' plan images [default] | 'video' plan videos | 'mix' | 'none' text-only) and, for video/mix, videoType ('reel' | 'slideshow' | 'cinematic' | 'product'). The plan streams into Campaign Studio. Pass planId from a confirmed propose_plan. Needs a Brand Kit.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      name: { type: "string", description: "Campaign title (e.g. 'Spring Skincare Launch'). Required." },
      brief: { type: "string", description: "What the campaign is about + the goal — the agent writes captions from this + the Brand Kit. Required." },
      platforms: { type: "array", items: { type: "string" }, description: "Which destinations to post to: 'instagram','facebook','twitter','linkedin','tiktok','youtube','pinterest','threads','feed'. Default ['feed']." },
      startDate: { type: "string", description: "Optional ISO date/datetime for the first post. Default: tomorrow morning." },
      days: { type: "number", description: "How many days the campaign runs. Default 14." },
      postsPerWeek: { type: "number", description: "Cadence — posts per week. Default 3. (Total posts = days/7 × postsPerWeek, capped at 30.)" },
      tone: { type: "string", description: "Voice for the captions (e.g. 'casual', 'professional', 'playful'). Optional." },
      mediaMode: { type: "string", description: "'ai' = an on-brand image per post (default), 'video' = an AI video per post, 'mix' = alternate images + videos, 'none' = text-only. Video costs ~30 credits per post." },
      videoType: { type: "string", description: "For video/mix: 'reel' (default), 'slideshow', 'cinematic', or 'product'." },
      videoSeconds: { type: "number", description: "For video/mix: target clip length in seconds (default 8; 8-15 typical for social)." },
      hashtags: { type: "array", items: { type: "string" }, description: "Optional fixed hashtags to use on every post (else the agent picks brand-aware ones)." },
    },
    required: ["planId", "name", "brief"],
  },
  plans: null,
  // Per-post caption/image credits are charged inside the generators; base 0 here.
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const name = clean(input.name, 120);
      const brief = clean(input.brief, 2000);
      if (!name || !brief) return { ok: false, error_code: "missing_input", message: "name and brief are required." };

      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { id: true, name: true, voiceTone: true },
      });
      if (!brandKit?.name) {
        return { ok: false, error_code: "missing_brand_kit", message: "No Brand Kit configured — campaigns use the user's branding + voice. Ask them to set up their Brand Kit at /home/brand first." };
      }

      const platforms = (Array.isArray(input.platforms) ? input.platforms : [])
        .map((p) => clean(p, 40).toLowerCase())
        .filter((p) => PLATFORMS.has(p));
      if (platforms.length === 0) platforms.push("feed");

      const days = clampInt(input.days, 1, 90, 14);
      const postsPerWeek = clampInt(input.postsPerWeek, 1, 14, 3);
      const count = Math.min(30, Math.max(1, Math.round((days / 7) * postsPerWeek)));
      const tone = clean(input.tone, 60) || (brandKit.voiceTone || "");
      const mediaMode = typeof input.mediaMode === "string" && MEDIA_MODES.has(input.mediaMode)
        ? input.mediaMode
        : (input.imageMode === "none" ? "none" : "ai"); // back-compat with old imageMode
      const videoType = typeof input.videoType === "string" && VIDEO_STYLES[input.videoType] ? input.videoType : "reel";
      const videoSeconds = clampInt(input.videoSeconds, 5, 20, 8);
      const fixedTags = (Array.isArray(input.hashtags) ? input.hashtags : []).map((t) => clean(t, 40).replace(/^#/, "")).filter(Boolean).slice(0, 8);

      const startMs = (() => {
        const raw = clean(input.startDate, 40);
        const d = raw ? new Date(raw) : new Date(Date.now() + 24 * 3600 * 1000);
        return Number.isNaN(d.getTime()) ? Date.now() + 24 * 3600 * 1000 : d.getTime();
      })();
      const schedule = computeSchedule(startMs, days, count);
      const startDate = new Date(schedule[0]);
      const endDate = new Date(schedule[schedule.length - 1]);

      // Campaign + a disabled "container" automation (groups the posts + stores
      // the brief; enabled:false so the recurring scheduler never fires it).
      const campaign = await prisma.contentCampaign.create({
        data: {
          userId: ctx.userId,
          name,
          description: brief,
          status: "DRAFT",
          startDate,
          endDate,
          defaultTone: tone || null,
          defaultPlatforms: JSON.stringify(platforms),
          defaultAiPrompt: brief,
        },
        select: { id: true },
      });
      const container = await prisma.contentAutomation.create({
        data: {
          userId: ctx.userId,
          campaignId: campaign.id,
          channel: "SOCIAL",
          name,
          triggerType: "ONE_OFF",
          triggerConfig: "{}",
          topic: name,
          aiPrompt: brief,
          aiTone: tone || null,
          hashtags: JSON.stringify(fixedTags),
          platforms: JSON.stringify(platforms),
          mediaMode: mediaMode === "none" ? "NONE" : "AI_AT_POST_TIME",
          aiMediaConfig: JSON.stringify({ mode: mediaMode, videoType, videoSeconds }),
          reviewStatus: "APPROVED",
          enabled: false,
          status: "COMPLETED",
          startDate,
          endDate,
        },
        select: { id: true },
      });

      const taskId = await spawnBackgroundTask({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        kind: "create_content_campaign",
        input: { name, count, platforms, mediaMode, videoType },
        creditCost: 0,
        worker: async (taskId) => {
          let made = 0;
          for (let i = 0; i < schedule.length; i++) {
            publishTaskEvent({ type: "progress", taskId, progress: Math.round((i / schedule.length) * 90) + 5, message: `Planning post ${i + 1} of ${schedule.length}…` });
            const iso = new Date(schedule[i]).toISOString();

            // Caption (brand-aware; falls back to the brief inside the generator).
            let caption = brief;
            try {
              const c = await generateAutomationCopy({ userId: ctx.userId, automationId: container.id, occurrenceAt: iso });
              caption = c.caption || brief;
            } catch (e) { console.warn("[create_content_campaign] caption failed:", e); }
            const { body, tags } = splitHashtags(caption);
            const hashtags = fixedTags.length ? fixedTags : tags;

            // PLAN the media — write a PROMPT, do NOT generate the image/video yet.
            // The user reviews + edits the prompt on the card, then generates each
            // one on demand (approve-per-post). Keeps Generate fast + cheap.
            const isVideo = mediaMode === "video" || (mediaMode === "mix" && i % 2 === 1);
            let mediaType: string | null = null;
            let mediaMeta: string | null = null;
            if (mediaMode !== "none") {
              const prompt = isVideo
                ? `${VIDEO_STYLES[videoType]}. ${body.slice(0, 160)}. On-brand for ${brandKit.name}. No text overlays, no captions.`
                : `On-brand social image for: ${body.slice(0, 180)}. Clean, scroll-stopping, uses the brand's colours + style. No text overlays.`;
              mediaType = isVideo ? "planned_video" : "planned_image";
              mediaMeta = JSON.stringify({ prompt });
            }

            await prisma.post.create({
              data: {
                userId: ctx.userId,
                caption: hashtags.length ? `${body}\n\n${hashtags.map((h) => `#${h}`).join(" ")}` : body,
                hashtags: JSON.stringify(hashtags),
                platforms: JSON.stringify(platforms),
                mediaUrl: null,
                mediaMeta,
                mediaType,
                status: "DRAFT",
                scheduledAt: new Date(schedule[i]),
                contentAutomationId: container.id,
              },
            });
            made++;
          }

          await prisma.contentAutomation.update({ where: { id: container.id }, data: { totalGenerated: made, firstPostCreatedAt: new Date() } });

          await notifyAgentTaskComplete({
            userId: ctx.userId,
            taskId,
            kind: "create_content_campaign",
            ok: true,
            summary: `Your "${name}" campaign plan is ready — ${made} posts drafted`,
            detail: "Review and edit each post directly in the chat, generate its image/video, then approve to auto-publish.",
            deepLink: `/home/campaign?campaign=${campaign.id}`,
          });

          const drafted = await prisma.post.findMany({
            where: { userId: ctx.userId, deletedAt: null, contentAutomationId: container.id },
            orderBy: { scheduledAt: "asc" },
            select: { id: true, caption: true, platforms: true, mediaUrl: true, status: true, scheduledAt: true },
          });
          const inlineView = campaignView({
            campaignId: campaign.id,
            name,
            status: "DRAFT",
            posts: drafted.map((p) => ({
              id: p.id,
              when: fmtWhen(p.scheduledAt),
              platforms: fmtPlatforms(p.platforms),
              caption: p.caption || "",
              status: p.status,
              hasMedia: !!p.mediaUrl,
            })),
          });

          return {
            output: { campaignId: campaign.id, posts: made, platforms, inlineView: { requestId: `campaign-view-${campaign.id}`, spec: inlineView } },
            resultRefType: "ContentCampaign",
            resultRefId: campaign.id,
          };
        },
      });

      ctx.emit({ type: "task_started", taskId, kind: "create_content_campaign", summary: `Planning a ${count}-post "${name}" campaign — captions + dates + media prompts. It will appear here as an inline campaign review card; images/videos are generated per-post after review.` });

      return {
        ok: true,
        data: {
          taskId,
          campaignId: campaign.id,
          plannedPosts: count,
          platforms,
          userMessage: `Planning a ${count}-post "${name}" campaign across ${platforms.join(", ")} — captions + dates + a media prompt per post (no images/videos generated yet; that's per-post after review). The full campaign review card will render inline in chat. Do not tell the user to open Campaign Studio.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to start the campaign" };
    }
  },
};
