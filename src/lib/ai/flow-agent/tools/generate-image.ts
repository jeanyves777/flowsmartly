import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { getUserPreferredLanguage, withLanguagePrefix } from "@/lib/ai/user-language";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";
import { saveToMediaLibrary } from "../save-media";

/**
 * generate_image — produce a single image from a prompt. Tiered (premium
 * = highest quality provider chain, standard = fast/cheap). Runs as a
 * BACKGROUND TASK so the agent can tell the user "I'll notify you when
 * it's done" and end the chat turn — the user can leave and come back.
 *
 * Mutating: yes (charges credits + produces a persistent S3 artifact).
 * Requires a confirmed propose_plan first.
 *
 * Credit cost is tier-dependent (handler picks the right key) — the
 * registry's costKey here is the BASE charge (free) because the real
 * charge happens after we know the tier.
 *
 * Brand-aware: prompt is prefixed with the user's brand name + 1-line
 * description so the result fits the brand. We do NOT ask the AI to
 * draw a logo (per feedback-media-generation-rules). Logo composite
 * after generation is left for a follow-up tool.
 */
export const generateImage: FlowAgentTool = {
  name: "generate_image",
  description:
    "Generate a single AI image from a text prompt. Tier 'premium' uses the highest-quality provider chain (best for hero shots, ads, polished marketing); 'standard' is faster and cheaper (good for quick concepts, social posts). Runs as a background task — returns IMMEDIATELY with a taskId, then notifies the user when the image is ready. The user can leave the chat and come back; the result will be in the thread. Pass `planId` from a confirmed propose_plan. Cost: Standard = 12 credits, Premium = 18 credits.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      prompt: {
        type: "string",
        description: "What to generate — subject, mood, style, composition. Be specific. Don't ask for any logo or brand mark in the image (we composite the real one after).",
      },
      tier: {
        type: "string",
        description: "'premium' (best quality) or 'standard' (fast/cheap). Default 'standard'.",
      },
      width: { type: "number", description: "Default 1024. Common: 1024, 1080." },
      height: { type: "number", description: "Default 1024. Common: 1024, 1080, 1920." },
    },
    required: ["planId", "prompt"],
  },
  plans: null,
  // Base cost is 0 — the handler charges the tier-specific cost itself.
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt) {
      return { ok: false, error_code: "missing_input", message: "prompt is required" };
    }
    const tier = input.tier === "premium" ? "premium" : "standard";
    const width = clampDim(input.width, 1024);
    const height = clampDim(input.height, 1024);

    const costKey = tier === "premium" ? "AGENT_GENERATE_IMAGE_PREMIUM" : "AGENT_GENERATE_IMAGE_STANDARD";
    const cost = await getDynamicCreditCost(costKey);

    // Pre-flight credit check — return structured error so the agent
    // can suggest a top-up rather than crashing the chat.
    if (!ctx.isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { aiCredits: true },
      });
      if ((user?.aiCredits ?? 0) < cost) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `Need ${cost} credits for ${tier} image generation. User has ${user?.aiCredits ?? 0}. Suggest /credits to top up.`,
          meta: { need: cost, have: user?.aiCredits ?? 0, costKey },
        };
      }
    }

    // Pull a thin brand snapshot so the image fits the brand.
    const [brandKit, languageTag] = await Promise.all([
      prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { name: true, description: true, voiceTone: true },
      }),
      getUserPreferredLanguage(ctx.userId),
    ]);
    const brandLine = brandKit
      ? `Brand: ${brandKit.name}${brandKit.description ? ` — ${brandKit.description.slice(0, 120)}` : ""}.`
      : "";
    // Language prefix ensures any rendered text (CTA buttons, signs, copy
    // baked into the image) comes out in the user's language. See
    // feedback-ai-respects-user-language memory.
    const enrichedPrompt = withLanguagePrefix(
      [
        prompt,
        brandLine,
        "Composition: clean, scroll-stopping. No text overlays unless explicitly requested. Do NOT include any logo or brand mark — we composite the real one after.",
      ]
        .filter(Boolean)
        .join(" "),
      languageTag,
    );

    // Spawn background task. The agent's chat turn returns immediately
    // with the taskId — the user can leave and come back.
    const taskId = await spawnBackgroundTask({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      messageId: ctx.messageId,
      kind: "generate_image",
      input: { prompt, tier, width, height },
      creditCost: cost,
      worker: async (taskId) => {
        publishTaskEvent({
          type: "progress",
          taskId,
          progress: 10,
          message: "Generating image…",
        });

        const preferredProvider = tier === "premium" ? "openai" : "xai";
        const result = await generateImageXaiFirst(enrichedPrompt, width, height, {
          quality: tier === "premium" ? "high" : "medium",
          preferredProvider,
        });
        if (!result.base64) {
          throw new Error("Image generator returned no image");
        }

        publishTaskEvent({
          type: "progress",
          taskId,
          progress: 80,
          message: "Uploading…",
        });

        const buffer = Buffer.from(result.base64, "base64");
        const ext = result.format === "png" ? "png" : "jpg";
        const key = `flow-ai/${ctx.userId}/${ctx.conversationId}-${Date.now()}.${ext}`;
        const url = await uploadToS3(key, buffer, `image/${result.format}`);

        // Save to the Media Library so it appears in /media too.
        await saveToMediaLibrary({
          userId: ctx.userId,
          url,
          type: "image",
          mimeType: `image/${result.format}`,
          size: buffer.length,
          tags: ["flow-ai", tier],
          metadata: { prompt, tier, width, height },
        });

        // Charge credits AFTER the work succeeded (so a provider failure
        // doesn't drain the user's balance).
        if (!ctx.isAdmin && cost > 0) {
          await creditService.deductCredits({
            userId: ctx.userId,
            amount: cost,
            type: "USAGE",
            description: `Flow-AI agent: ${tier} image`,
            referenceType: "flow_ai_task",
            referenceId: taskId,
          });
        }

        // Notify the user — fires both an in-app notification and an email
        // so the result reaches them even if they closed the tab.
        await notifyAgentTaskComplete({
          userId: ctx.userId,
          taskId,
          kind: "generate_image",
          ok: true,
          summary: `Your ${tier === "premium" ? "Premium" : "Standard"} image is ready`,
          deepLink: `/flow-ai?conversationId=${ctx.conversationId}&taskId=${taskId}`,
          previewImageUrl: url,
        });

        return {
          output: { url, tier, width, height, prompt },
          resultRefType: "AgentImage",
          resultRefId: url,
        };
      },
    });

    ctx.emit({
      type: "task_started",
      taskId,
      kind: "generate_image",
      summary: `Generating ${tier} image…`,
    });

    return {
      ok: true,
      data: {
        taskId,
        tier,
        creditCostQuoted: cost,
        userMessage: `Started a ${tier} image generation in the background. The user will see the image inline when it's ready and get a notification — they can leave the chat and come back.`,
      },
    };
  },
};

function clampDim(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(2048, Math.max(256, Math.round(value)));
}
