import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { veoClient } from "@/lib/ai/veo-client";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { videoRole } from "@/lib/ai/media-models";
import { generateVideoForRole } from "@/lib/ai/video-router";
import { generateCompositeVideo, planSegmentCount } from "@/lib/video/long-video";
import { overlayBrandLogoOnVideo } from "@/lib/video/overlay-brand-logo";
import { addBrandOutro } from "@/lib/video/brand-outro";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { getUserPreferredLanguage, withLanguagePrefix } from "@/lib/ai/user-language";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";
import { saveToMediaLibrary } from "../save-media";

/**
 * generate_video — single short video clip. Tiered: premium = Google Veo
 * (longest, native-audio quality), standard = xAI Grok (fast/cheap, with
 * polling status). Runs as a background task; user can leave + come back.
 *
 * If premium isn't configured we fall through to standard so the user
 * never sees "video gen is not configured" — config issues are an admin
 * concern, not a user-facing chat failure.
 *
 * Mutating: yes. Requires confirmed propose_plan.
 */
export const generateVideo: FlowAgentTool = {
  name: "generate_video",
  description:
    "Generate an AI video from a text prompt. Short clips (≤8s) render as one shot. For a LONGER video (e.g. 30s) the system builds it from multiple high-quality segments composited together — it does NOT just hand back a single short clip. You choose the long-form style: pass `scenes` (2-4 distinct shot descriptions) for a MULTI-SCENE cut like an ad; OR omit `scenes` and set `durationSeconds` for a CONTINUOUS single flowing shot grown to length. Pick based on the request (a 'product ad' → scenes; a 'flowing drone shot' → continuous). Tier 'premium' = highest-quality engine (best for ads/hero reels), 'standard' = faster/cheaper. Runs as a background task — returns a taskId immediately and notifies when ready; the user can leave and come back. Pass `planId` from a confirmed propose_plan. COST SCALES with length: it's the per-segment price × the number of ~8s segments (a 30s video ≈ 4×). Read the exact per-segment price from list_my_features (admin-set) and put the real total in propose_plan — never hardcode it.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      prompt: { type: "string", description: "Describe the scene — action, camera, mood, style. For a continuous long shot, describe the through-line." },
      scenes: {
        type: "array",
        items: { type: "string" },
        description: "Optional. For a MULTI-SCENE long video (ad-style cuts), provide 2-4 short scene descriptions — each becomes one ~8s shot, cut together in order. Omit for a single continuous shot.",
      },
      tier: { type: "string", description: "'premium' or 'standard'. Default 'standard'. Long videos use the premium Veo engine for quality regardless." },
      aspectRatio: { type: "string", description: "'16:9' (default), '9:16', or '1:1'. Note: 1:1 long videos use the standard engine (premium engine is 16:9/9:16 only)." },
      durationSeconds: { type: "number", description: "Default 8. Up to ~32s — anything over 8s is composited from multiple segments. Ignored when `scenes` is provided (scene count drives length)." },
    },
    required: ["planId", "prompt"],
  },
  plans: null,
  // Tier-priced — handler charges the right key. Base = 0.
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt) {
      return { ok: false, error_code: "missing_input", message: "prompt is required" };
    }
    const tier = input.tier === "premium" ? "premium" : "standard";
    const aspectRatio =
      input.aspectRatio === "9:16" || input.aspectRatio === "1:1" ? input.aspectRatio : "16:9";
    // Up to ~32s; >8s is composited from multiple segments.
    const durationSeconds = clampInt(input.durationSeconds, 8, 4, 32);

    // Agent-supplied distinct scenes → multi-scene cut. Clamp to 4.
    const scenes = Array.isArray(input.scenes)
      ? input.scenes.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim()).slice(0, 4)
      : [];

    // Cost scales with the number of ~8s segments (honest per-segment pricing).
    // A single ≤8s clip → 1 segment → unchanged price.
    const segments = planSegmentCount(durationSeconds, scenes.length);
    const isLong = segments > 1;
    // Long videos always use the premium (Veo) engine for quality, so they're
    // priced at the premium per-segment rate regardless of the requested tier.
    const effectiveTier: "premium" | "standard" = isLong ? "premium" : tier;

    const costKey = effectiveTier === "premium" ? "AGENT_GENERATE_VIDEO_PREMIUM" : "AGENT_GENERATE_VIDEO_STANDARD";
    const baseCost = await getDynamicCreditCost(costKey);
    const cost = baseCost * segments;

    if (!ctx.isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { aiCredits: true },
      });
      if ((user?.aiCredits ?? 0) < cost) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `Need ${cost} credits for this video (${segments} × ${baseCost}-credit segment${segments > 1 ? "s" : ""}). User has ${user?.aiCredits ?? 0}.`,
          meta: { need: cost, have: user?.aiCredits ?? 0, costKey, segments, perSegment: baseCost },
        };
      }
    }

    // Provider selection is centralized in the video router (media-models
    // VIDEO_CHAINS): premium → Veo quality (native audio, 1080p), standard →
    // Grok, duration-aware (Veo only ≤8s) with automatic fallback. We never
    // show provider names to the user. Fail fast only if NOTHING is configured.
    if (!veoClient.isAvailable() && !grokVideoClient.isAvailable()) {
      return {
        ok: false,
        error_code: "upstream_failed",
        message: "Video generation isn't configured on this environment. Tell the user we're working on it.",
      };
    }
    const role = videoRole(tier);

    // Language prefix — any rendered text or generated voiceover stays
    // in the user's language. See feedback-ai-respects-user-language.
    const languageTag = await getUserPreferredLanguage(ctx.userId);

    // Real brand logo — composited onto the finished video. AI video models
    // misspell rendered brand text ("FlowSmatly"), so we tell the model NOT to
    // draw the brand and stamp the real logo afterward (like the image flow).
    const brandKit = await prisma.brandKit
      .findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { logo: true, iconLogo: true, colors: true },
      })
      .catch(() => null);
    const logoSource = brandKit?.iconLogo || brandKit?.logo || null;
    // Primary brand color for the animated outro end-card.
    const brandColor = (() => {
      try {
        const c = JSON.parse(brandKit?.colors || "{}") as { primary?: string };
        return typeof c.primary === "string" ? c.primary : null;
      } catch {
        return null;
      }
    })();

    const NO_BRAND_TEXT =
      "\n\nIMPORTANT: Do NOT render the brand name, wordmark, or any logo as on-screen text — AI video often misspells it. The real brand logo is composited on top afterward. Use the brand's colors and style; keep any other on-screen text minimal and avoid the brand name entirely.";
    const enrichedPrompt = withLanguagePrefix(`${prompt}${NO_BRAND_TEXT}`, languageTag);
    // Per-scene prompts for the multi-scene path get the same language + no-logo treatment.
    const enrichedScenes = scenes.map((s) => withLanguagePrefix(`${s}${NO_BRAND_TEXT}`, languageTag));

    const taskId = await spawnBackgroundTask({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      messageId: ctx.messageId,
      kind: "generate_video",
      input: { prompt, tier, aspectRatio, durationSeconds, segments, scenes: scenes.length, language: languageTag },
      creditCost: cost,
      worker: async (taskId) => {
        publishTaskEvent({
          type: "progress",
          taskId,
          progress: 5,
          message: "Starting video render…",
        });

        // Veo has no progress callback — fire periodic heartbeats so the UI
        // doesn't look stuck during the (multi-minute) render.
        const heartbeat = setInterval(() => {
          publishTaskEvent({ type: "progress", taskId, message: "Rendering video…" });
        }, 15000);
        let videoBuffer: Buffer;
        try {
          if (isLong) {
            // Long video → composite multiple high-quality segments (Veo) into
            // the requested length instead of a single capped clip. The agent
            // picks the style: scenes[] → multi-scene cut, else → continuous.
            const composite = await generateCompositeVideo({
              prompt: enrichedPrompt,
              scenes: enrichedScenes.length >= 2 ? enrichedScenes : undefined,
              totalSeconds: durationSeconds,
              aspectRatio,
              tier: effectiveTier,
              onStatus: (message) => publishTaskEvent({ type: "progress", taskId, message }),
            });
            videoBuffer = composite.videoBuffer;
          } else {
            const gen = await generateVideoForRole(role, {
              prompt: enrichedPrompt,
              durationSeconds,
              aspectRatio,
              onStatus: (message) => publishTaskEvent({ type: "progress", taskId, message }),
              // Persist the provider job handle so the recovery cron can RESUME
              // (poll + pull) this render if the worker dies before it finishes —
              // we're billed by the provider either way, so never just fail it.
              onJobId: async ({ provider, jobId }) => {
                await prisma.agentTask
                  .update({ where: { id: taskId }, data: { output: JSON.stringify({ pending: { provider, jobId } }) } })
                  .catch(() => {});
              },
            });
            videoBuffer = gen.videoBuffer;
          }
        } finally {
          clearInterval(heartbeat);
        }

        // Stamp the real brand logo onto the finished video (best-effort).
        if (logoSource) {
          publishTaskEvent({ type: "progress", taskId, progress: 78, message: "Adding your brand logo…" });
          videoBuffer = await overlayBrandLogoOnVideo(videoBuffer, logoSource);

          // Always end on the brand: an animated logo outro end-card (best-effort).
          publishTaskEvent({ type: "progress", taskId, progress: 82, message: "Adding your brand outro…" });
          videoBuffer = await addBrandOutro(videoBuffer, { logoSource, aspectRatio, brandColor });
        }

        publishTaskEvent({
          type: "progress",
          taskId,
          progress: 85,
          message: "Uploading…",
        });

        const key = `flow-ai/${ctx.userId}/${ctx.conversationId}-${Date.now()}.mp4`;
        const url = await uploadToS3(key, videoBuffer, "video/mp4");

        await saveToMediaLibrary({
          userId: ctx.userId,
          url,
          type: "video",
          mimeType: "video/mp4",
          size: videoBuffer.length,
          tags: ["flow-ai", effectiveTier],
          metadata: { prompt, tier: effectiveTier, aspectRatio, durationSeconds, segments, scenes: scenes.length },
        });

        if (!ctx.isAdmin && cost > 0) {
          await creditService.deductCredits({
            userId: ctx.userId,
            amount: cost,
            type: "USAGE",
            description: isLong ? `Flow-AI agent: ${durationSeconds}s composite video (${segments} segments)` : `Flow-AI agent: ${effectiveTier} video`,
            referenceType: "flow_ai_task",
            referenceId: taskId,
          });
        }

        await notifyAgentTaskComplete({
          userId: ctx.userId,
          taskId,
          kind: "generate_video",
          ok: true,
          summary: isLong ? `Your ${durationSeconds}s video is ready` : `Your ${effectiveTier === "premium" ? "Premium" : "Standard"} video is ready`,
          deepLink: `/flow-ai?conversationId=${ctx.conversationId}&taskId=${taskId}`,
        });

        return {
          output: { url, tier: effectiveTier, aspectRatio, durationSeconds, segments, prompt },
          resultRefType: "AgentVideo",
          resultRefId: url,
        };
      },
    });

    ctx.emit({
      type: "task_started",
      taskId,
      kind: "generate_video",
      summary: isLong
        ? `Building your ${durationSeconds}s video from ${segments} segments — a few minutes…`
        : `Generating ${effectiveTier} video — usually 30s to a few minutes…`,
    });

    return {
      ok: true,
      data: {
        taskId,
        tier: effectiveTier,
        segments,
        mode: scenes.length >= 2 ? "multi-scene" : isLong ? "continuous" : "single",
        creditCostQuoted: cost,
        userMessage: isLong
          ? `Started a ${durationSeconds}s ${scenes.length >= 2 ? "multi-scene" : "continuous"} video (${segments} segments, ${cost} credits) in the background. Tell the user you'll notify them when it's ready — they can leave the chat.`
          : `Started a ${effectiveTier} video generation in the background. Tell the user you'll notify them when it's ready — they can leave the chat.`,
      },
    };
  },
};

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
