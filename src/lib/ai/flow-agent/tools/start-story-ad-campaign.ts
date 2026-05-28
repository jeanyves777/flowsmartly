import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import {
  calculateStoryAdMovieCredits,
  processStoryAdMovie,
  type StoryAdMovieInput,
} from "@/lib/story-ad-movie";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import {
  getUserPreferredLanguage,
  withLanguagePrefix,
  getLanguageLabel,
} from "@/lib/ai/user-language";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";

/**
 * start_story_ad_campaign — kicks off the full Story Ad Movie pipeline
 * (script → characters → scene illustrations → narrator + character
 * voices + ambient SFX → final reel). This is the direct answer to "I
 * want to make a movie" / "make me a story ad" / "narrated cinematic
 * reel" — the agent should reach for THIS instead of pointing the user
 * elsewhere.
 *
 * Runs as a background task. The pipeline itself is fire-and-forget
 * inside the platform; we poll the underlying CartoonVideo row every
 * 5 seconds, emit progress events, and resolve when status reaches
 * COMPLETED or FAILED. User can close the chat — completion fires
 * notifyAgentTaskComplete with a deep link.
 *
 * Mutating, requires confirmed propose_plan. Cost: 100 cr per 10s.
 */
export const startStoryAdCampaign: FlowAgentTool = {
  name: "start_story_ad_campaign",
  description:
    "Kick off a full narrated cinematic 'Story Ad' video for the user — handles screenplay, scene illustrations, narrator + character voices, ambient sound, and final stitching end-to-end. Use this whenever the user says they want a 'movie', 'short film', 'narrated reel', 'cinematic ad', 'story ad', or anything story-driven longer than a single video clip. Runs as a background task; takes 5-15 minutes; user gets a notification when it's done. Cost: 100 credits per 10 seconds of duration. Pass `planId` from a confirmed propose_plan.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      brief: {
        type: "string",
        description: "Plain-English description of the ad — product, message, audience, mood. The pipeline uses this to write the screenplay. Min 12 chars.",
      },
      duration: {
        type: "number",
        description: "Total reel duration in seconds. Must be 10, 20, 30, or 40. Cost = 100 credits per 10 seconds.",
      },
      aspectRatio: {
        type: "string",
        description: "'9:16' (vertical reel, default for social), '1:1' (square), or '16:9' (landscape).",
      },
      style: {
        type: "string",
        description: "One of: 'cinematic' (default), 'local_trust', 'premium', 'social_bold', 'product_showcase'. Match the brand vibe.",
      },
      goal: {
        type: "string",
        description: "Optional — what conversion / outcome the ad should drive (signups, sales, visits).",
      },
      destinationUrl: {
        type: "string",
        description: "Optional — link the CTA points to. Embedded as overlay on the final reel.",
      },
      platforms: {
        type: "array",
        description: "Optional — target platforms ('instagram', 'tiktok', 'facebook', 'youtube'). Tunes the screenplay tone.",
        items: { type: "string" },
      },
      characterBrief: {
        type: "string",
        description: "Optional — describe the protagonist (look, role, vibe). The pipeline generates them if omitted.",
      },
    },
    required: ["planId", "brief", "duration"],
  },
  plans: ["PRO", "BUSINESS", "ENTERPRISE"],
  // Tier-priced via calculateStoryAdMovieCredits. Base = 0.
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    const brief = typeof input.brief === "string" ? input.brief.trim() : "";
    if (brief.length < 12) {
      return {
        ok: false,
        error_code: "missing_input",
        message: "brief must be at least 12 characters — tell me what the ad should be about.",
      };
    }

    const duration = pickStoryDuration(input.duration);
    if (!duration) {
      return {
        ok: false,
        error_code: "validation_failed",
        message: "duration must be 10, 20, 30, or 40 seconds.",
      };
    }

    const aspectRatio: "9:16" | "1:1" | "16:9" =
      input.aspectRatio === "1:1" || input.aspectRatio === "16:9" ? input.aspectRatio : "9:16";
    const style = typeof input.style === "string" && input.style.trim() ? input.style : "cinematic";

    // The pipeline depends on xAI video. If it isn't configured we
    // surface a graceful error the agent can explain — never crash
    // the chat.
    if (!grokVideoClient.isAvailable()) {
      return {
        ok: false,
        error_code: "upstream_failed",
        message: "Story Ad Movies aren't available on this environment yet. Tell the user we're working on it and suggest generate_video as a quick alternative.",
      };
    }

    const cost = calculateStoryAdMovieCredits(duration);
    if (!ctx.isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { aiCredits: true },
      });
      if ((user?.aiCredits ?? 0) < cost) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `Need ${cost} credits for a ${duration}s story ad movie. User has ${user?.aiCredits ?? 0}.`,
          meta: { need: cost, have: user?.aiCredits ?? 0 },
        };
      }
    }

    // Language injection — prepend a one-line directive to the brief so
    // the pipeline's downstream AI calls (screenplay, dialogue, captions,
    // voiceover script) all stay in the user's language. Proper threading
    // of language through processStoryAdMovie is Phase 3 backlog.
    const languageTag = await getUserPreferredLanguage(ctx.userId);
    const languageLabel = getLanguageLabel(languageTag);
    const localizedBrief = withLanguagePrefix(brief, languageTag);
    const localizedGoal =
      typeof input.goal === "string" && input.goal.trim()
        ? `${input.goal.trim()} (in ${languageLabel})`
        : undefined;
    const localizedCharacterBrief =
      typeof input.characterBrief === "string" && input.characterBrief.trim()
        ? `${input.characterBrief.trim()} (dialogue in ${languageLabel})`
        : undefined;

    const platforms = Array.isArray(input.platforms)
      ? input.platforms.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 6)
      : undefined;

    const pipelineInput: StoryAdMovieInput = {
      // jobId is filled in by the worker once the CartoonVideo row exists.
      jobId: "",
      userId: ctx.userId,
      brief: localizedBrief,
      aspectRatio,
      duration,
      style,
      goal: localizedGoal,
      destinationUrl:
        typeof input.destinationUrl === "string" && input.destinationUrl.trim()
          ? input.destinationUrl.trim()
          : undefined,
      platforms,
      characterBrief: localizedCharacterBrief,
    };

    const taskId = await spawnBackgroundTask({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      messageId: ctx.messageId,
      kind: "start_story_ad_campaign",
      input: {
        brief,
        duration,
        aspectRatio,
        style,
        language: languageTag,
      },
      creditCost: cost,
      worker: async (taskId) => {
        // 1. Create the underlying CartoonVideo row (the pipeline expects it).
        const job = await prisma.cartoonVideo.create({
          data: {
            userId: ctx.userId,
            storyPrompt: localizedBrief,
            style,
            animationType: "story_ad_movie",
            duration,
            captionStyle: "cinematic",
            status: "PENDING",
            progress: 2,
            currentStep: "Starting your story ad movie…",
            creditsCost: cost,
            metadata: JSON.stringify({
              product: "story_ad_movie",
              aspectRatio,
              duration,
              style,
              language: languageTag,
              goal: localizedGoal ?? null,
              destinationUrl: pipelineInput.destinationUrl ?? null,
              platforms: platforms ?? [],
              characterBrief: localizedCharacterBrief ?? null,
              flowAiAgent: true,
              flowAiTaskId: taskId,
              flowAiConversationId: ctx.conversationId,
            }),
          },
        });

        // 2. Charge credits. If charging fails (rare since we pre-checked),
        // delete the orphan job and bail.
        if (!ctx.isAdmin) {
          const charge = await creditService.deductCredits({
            userId: ctx.userId,
            type: TRANSACTION_TYPES.USAGE,
            amount: cost,
            referenceType: "flow_ai_story_ad",
            referenceId: job.id,
            description: `Flow-AI story ad movie: ${brief.slice(0, 80)}`,
            metadata: {
              feature: "AI_VIDEO_SLIDESHOW",
              duration,
              aspectRatio,
              language: languageTag,
              pricing: "100 credits per 10 seconds",
              provider: "xai",
              source: "flow_ai_agent",
            },
          });
          if (!charge.success) {
            await prisma.cartoonVideo.delete({ where: { id: job.id } }).catch(() => {});
            throw new Error(charge.error || "Failed to charge credits");
          }
        }

        publishTaskEvent({
          type: "progress",
          taskId,
          progress: 5,
          message: "Writing the screenplay…",
        });

        // 3. Fire-and-forget the pipeline. It writes status updates to
        // the CartoonVideo row; we poll for completion.
        processStoryAdMovie({ ...pipelineInput, jobId: job.id }).catch((err) => {
          console.error("[Flow-AI agent] story-ad pipeline failed:", err);
        });

        // 4. Poll until completion or failure. Cap at 25 minutes — longer
        // than the pipeline's worst-case so a stuck job surfaces as a
        // failure instead of hanging forever.
        const POLL_INTERVAL_MS = 5000;
        const MAX_POLLS = (25 * 60 * 1000) / POLL_INTERVAL_MS; // 300
        let lastProgress = 0;
        let lastStep: string | null = null;

        for (let i = 0; i < MAX_POLLS; i++) {
          await sleep(POLL_INTERVAL_MS);
          const row = await prisma.cartoonVideo.findUnique({
            where: { id: job.id },
            select: {
              status: true,
              progress: true,
              currentStep: true,
              videoUrl: true,
              thumbnailUrl: true,
              errorMessage: true,
            },
          });
          if (!row) {
            throw new Error("Story Ad Movie job vanished from the database");
          }

          // Emit progress if anything changed.
          if (
            (typeof row.progress === "number" && row.progress !== lastProgress) ||
            row.currentStep !== lastStep
          ) {
            lastProgress = row.progress ?? lastProgress;
            lastStep = row.currentStep ?? lastStep;
            publishTaskEvent({
              type: "progress",
              taskId,
              progress: Math.min(99, Math.max(5, row.progress ?? 5)),
              message: row.currentStep ?? "Working on your story ad movie…",
            });
          }

          if (row.status === "COMPLETED") {
            const url = row.videoUrl ?? "";
            await notifyAgentTaskComplete({
              userId: ctx.userId,
              taskId,
              kind: "start_story_ad_campaign",
              ok: true,
              summary: "Your story ad movie is ready",
              deepLink: `/flow-ai?conversationId=${ctx.conversationId}&taskId=${taskId}`,
              previewImageUrl: row.thumbnailUrl ?? undefined,
            });
            return {
              output: {
                url,
                thumbnailUrl: row.thumbnailUrl,
                cartoonVideoId: job.id,
                duration,
                aspectRatio,
                language: languageTag,
              },
              resultRefType: "CartoonVideo",
              resultRefId: job.id,
            };
          }
          if (row.status === "FAILED") {
            const errMsg = row.errorMessage ?? "Story Ad Movie pipeline failed";
            await notifyAgentTaskComplete({
              userId: ctx.userId,
              taskId,
              kind: "start_story_ad_campaign",
              ok: false,
              summary: "Your story ad movie didn't finish",
              detail: errMsg,
              deepLink: `/flow-ai?conversationId=${ctx.conversationId}&taskId=${taskId}`,
            });
            throw new Error(errMsg);
          }
        }
        throw new Error("Story Ad Movie pipeline timed out after 25 minutes");
      },
    });

    ctx.emit({
      type: "task_started",
      taskId,
      kind: "start_story_ad_campaign",
      summary: `Producing a ${duration}s story ad movie — usually 5-15 minutes. You can leave the chat; I'll notify you when it's ready.`,
    });

    return {
      ok: true,
      data: {
        taskId,
        creditCostQuoted: cost,
        duration,
        language: languageTag,
        userMessage: `Started a ${duration}s story ad movie in the background (cost: ${cost} credits). Tell the user it usually takes 5-15 minutes and they'll get a notification when it's ready.`,
      },
    };
  },
};

function pickStoryDuration(value: unknown): 10 | 20 | 30 | 40 | null {
  if (value === 10 || value === 20 || value === 30 || value === 40) return value;
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    if (n === 10 || n === 20 || n === 30 || n === 40) return n;
  }
  if (typeof value === "number") {
    const n = Math.round(value);
    if (n === 10 || n === 20 || n === 30 || n === 40) return n as 10 | 20 | 30 | 40;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
