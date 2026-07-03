import { prisma } from "@/lib/db/client";
import { generateAutomationCopy } from "@/lib/content/automation-copy-generator";
import { generateAutomationMedia } from "@/lib/content/automation-media-generator";
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

export const createContentCampaign: FlowAgentTool = {
  name: "create_content_campaign",
  description:
    "Generate a full CONTENT CAMPAIGN — a batch of scheduled social posts (captions + on-brand images) spread over a date window — into the Campaign Studio for the user to review, then approve to auto-publish. Use when the user wants to 'run a campaign', 'schedule a week/month of posts', 'plan content about X', etc. Draws voice + visuals from the Brand Kit. Pass: name (campaign title), brief (what it's about + the goal), platforms (which connected socials to post to), days (window length, default 14), postsPerWeek (cadence, default 3), tone, imageMode ('ai' on-brand images | 'none' text-only). Runs in the background (generates each post) and lands in Campaign Studio. Pass planId from a confirmed propose_plan. Needs a Brand Kit.",
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
      imageMode: { type: "string", description: "'ai' = generate an on-brand image per post (default), 'none' = text-only." },
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
      const imageMode = input.imageMode === "none" ? "none" : "ai";
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
          mediaMode: imageMode === "ai" ? "AI_AT_POST_TIME" : "NONE",
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
        input: { name, count, platforms, imageMode },
        creditCost: 0,
        worker: async (taskId) => {
          let made = 0;
          for (let i = 0; i < schedule.length; i++) {
            publishTaskEvent({ type: "progress", taskId, progress: Math.round((i / schedule.length) * 90) + 5, message: `Writing post ${i + 1} of ${schedule.length}…` });
            const iso = new Date(schedule[i]).toISOString();

            // Caption (brand-aware; falls back to the brief inside the generator).
            let caption = brief;
            try {
              const c = await generateAutomationCopy({ userId: ctx.userId, automationId: container.id, occurrenceAt: iso });
              caption = c.caption || brief;
            } catch (e) { console.warn("[create_content_campaign] caption failed:", e); }
            const { body, tags } = splitHashtags(caption);
            const hashtags = fixedTags.length ? fixedTags : tags;

            // On-brand image (optional; text-only on failure so a post never blocks).
            let mediaUrl: string | null = null;
            if (imageMode === "ai") {
              try {
                const m = await generateAutomationMedia({ userId: ctx.userId, automationId: container.id, aspect: "square", tier: "standard", keyTag: "campaigns" });
                mediaUrl = m.url;
              } catch (e) { console.warn("[create_content_campaign] image failed:", e); }
            }

            await prisma.post.create({
              data: {
                userId: ctx.userId,
                caption: hashtags.length ? `${body}\n\n${hashtags.map((h) => `#${h}`).join(" ")}` : body,
                hashtags: JSON.stringify(hashtags),
                platforms: JSON.stringify(platforms),
                mediaUrl: mediaUrl || null,
                mediaMeta: mediaUrl ? JSON.stringify([mediaUrl]) : null,
                mediaType: mediaUrl ? "image" : null,
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
            summary: `Your "${name}" campaign is ready — ${made} posts drafted`,
            detail: "Open Campaign Studio to review, edit, and approve them to auto-publish.",
            deepLink: `/home/campaign?campaign=${campaign.id}`,
          });

          return {
            output: { campaignId: campaign.id, posts: made, platforms, link: `/home/campaign?campaign=${campaign.id}` },
            resultRefType: "ContentCampaign",
            resultRefId: campaign.id,
          };
        },
      });

      ctx.emit({ type: "task_started", taskId, kind: "create_content_campaign", summary: `Building a ${count}-post "${name}" campaign — captions + on-brand images. I'll open it in Campaign Studio when it's ready.` });

      return {
        ok: true,
        data: {
          taskId,
          campaignId: campaign.id,
          plannedPosts: count,
          platforms,
          userMessage: `Started a ${count}-post "${name}" campaign across ${platforms.join(", ")}. It generates in the background and lands in Campaign Studio for review + approval. Tell the user you'll notify them when it's ready.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to start the campaign" };
    }
  },
};
