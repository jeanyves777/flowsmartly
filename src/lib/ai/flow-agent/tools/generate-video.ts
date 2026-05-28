import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { veoClient } from "@/lib/ai/veo-client";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { getUserPreferredLanguage, withLanguagePrefix } from "@/lib/ai/user-language";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";

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
    "Generate a single short AI video clip (8-15s) from a text prompt. Tier 'premium' uses the longest, highest-quality generator (best for ads, hero reels); 'standard' is faster and cheaper. Runs as a background task — returns a taskId immediately and notifies the user when ready. The user can leave the chat and come back; the video will be inline. Pass `planId` from a confirmed propose_plan. Cost: Standard = 35 credits, Premium = 65 credits.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      prompt: { type: "string", description: "Describe the scene — action, camera, mood, style." },
      tier: { type: "string", description: "'premium' or 'standard'. Default 'standard'." },
      aspectRatio: { type: "string", description: "'16:9' (default), '9:16', or '1:1'." },
      durationSeconds: { type: "number", description: "Default 8. Standard tier supports up to 15." },
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
    const durationSeconds = clampInt(input.durationSeconds, 8, 4, 15);

    const costKey = tier === "premium" ? "AGENT_GENERATE_VIDEO_PREMIUM" : "AGENT_GENERATE_VIDEO_STANDARD";
    const cost = await getDynamicCreditCost(costKey);

    if (!ctx.isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { aiCredits: true },
      });
      if ((user?.aiCredits ?? 0) < cost) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `Need ${cost} credits for ${tier} video generation. User has ${user?.aiCredits ?? 0}.`,
          meta: { need: cost, have: user?.aiCredits ?? 0, costKey },
        };
      }
    }

    // Pick the provider. Premium prefers Veo when configured; otherwise
    // fall through to Grok. We NEVER show provider names to the user.
    const useVeo = tier === "premium" && veoClient.isAvailable();
    const useGrok = !useVeo && grokVideoClient.isAvailable();
    if (!useVeo && !useGrok) {
      return {
        ok: false,
        error_code: "upstream_failed",
        message: "Video generation isn't configured on this environment. Tell the user we're working on it.",
      };
    }

    // Language prefix — any rendered text or generated voiceover stays
    // in the user's language. See feedback-ai-respects-user-language.
    const languageTag = await getUserPreferredLanguage(ctx.userId);
    const enrichedPrompt = withLanguagePrefix(prompt, languageTag);

    const taskId = await spawnBackgroundTask({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      messageId: ctx.messageId,
      kind: "generate_video",
      input: { prompt, tier, aspectRatio, durationSeconds, language: languageTag },
      creditCost: cost,
      worker: async (taskId) => {
        publishTaskEvent({
          type: "progress",
          taskId,
          progress: 5,
          message: "Starting video render…",
        });

        let videoBuffer: Buffer;
        if (useVeo) {
          // Veo has no progress callback — fire periodic heartbeats so the
          // UI doesn't look stuck. Veo internally polls every 5s for up to
          // 6 min, so this matches its real cadence.
          const heartbeat = setInterval(() => {
            publishTaskEvent({
              type: "progress",
              taskId,
              message: "Rendering video…",
            });
          }, 15000);
          try {
            // Veo only supports 16:9 and 9:16. If the user asked for 1:1,
            // fall through to 9:16 (vertical) — closer to square reels.
            const veoAspect: "16:9" | "9:16" = aspectRatio === "16:9" ? "16:9" : "9:16";
            const veoResult = await veoClient.generateVideoBuffer(enrichedPrompt, {
              durationSeconds: String(Math.min(8, durationSeconds)) as "8",
              resolution: "720p",
              aspectRatio: veoAspect,
            });
            videoBuffer = veoResult.videoBuffer;
          } finally {
            clearInterval(heartbeat);
          }
        } else {
          const grokResult = await grokVideoClient.generateVideo(enrichedPrompt, {
            duration: durationSeconds,
            aspectRatio,
            resolution: "720p",
            onStatus: (message) => {
              publishTaskEvent({ type: "progress", taskId, message });
            },
          });
          videoBuffer = grokResult.videoBuffer;
        }

        publishTaskEvent({
          type: "progress",
          taskId,
          progress: 85,
          message: "Uploading…",
        });

        const key = `flow-ai/${ctx.userId}/${ctx.conversationId}-${Date.now()}.mp4`;
        const url = await uploadToS3(key, videoBuffer, "video/mp4");

        if (!ctx.isAdmin && cost > 0) {
          await creditService.deductCredits({
            userId: ctx.userId,
            amount: cost,
            type: "USAGE",
            description: `Flow-AI agent: ${tier} video`,
            referenceType: "flow_ai_task",
            referenceId: taskId,
          });
        }

        await notifyAgentTaskComplete({
          userId: ctx.userId,
          taskId,
          kind: "generate_video",
          ok: true,
          summary: `Your ${tier === "premium" ? "Premium" : "Standard"} video is ready`,
          deepLink: `/flow-ai?conversationId=${ctx.conversationId}&taskId=${taskId}`,
        });

        return {
          output: { url, tier, aspectRatio, durationSeconds, prompt },
          resultRefType: "AgentVideo",
          resultRefId: url,
        };
      },
    });

    ctx.emit({
      type: "task_started",
      taskId,
      kind: "generate_video",
      summary: `Generating ${tier} video — usually 30s to a few minutes…`,
    });

    return {
      ok: true,
      data: {
        taskId,
        tier,
        creditCostQuoted: cost,
        userMessage: `Started a ${tier} video generation in the background. Tell the user you'll notify them when it's ready — they can leave the chat.`,
      },
    };
  },
};

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
