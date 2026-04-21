import { ai } from "@/lib/ai/client";
import {
  buildImagePipelineTools,
  uploadCachedImage,
  type ImagePipelineToolContext,
} from "./image-pipeline-tools";
import type { AIDesignLayout, AIImagePlaceholder } from "./design-layout-types";

/**
 * Agent-driven image pipeline — replaces the hardcoded provider/transparency
 * strategy in `design-image-pipeline.ts:generateLayoutImages`.
 *
 * For each image placeholder:
 *   1. Claude picks the best provider for the subject (photoreal vs illustrated)
 *   2. Claude composes the prompt — the tool layer adds the right
 *      transparency-isolation language per provider
 *   3. The image is generated, optionally rembg'd
 *   4. Claude vision evaluates and reruns up to 2 times if score < 7
 *
 * Falls back to the old hardcoded pipeline only on agent failure.
 */

interface RunOptions {
  generateHeroImage: boolean;
  generateBackground: boolean;
  width: number;
  height: number;
  /** Optional brand context to bias provider/style decisions. */
  brandContext?: {
    name?: string | null;
    industry?: string | null;
    voiceTone?: string | null;
  };
}

export interface PipelineAgentResult {
  layout: AIDesignLayout;
  imagesGenerated: number;
  agentRuns: number;
  usage: { inputTokens: number; outputTokens: number };
}

const SYSTEM_PROMPT = `You are an image-direction agent inside FlowSmartly's design pipeline.

Your job per image: produce ONE high-quality result that matches the placeholder's subject.

WORKFLOW:
1. Read the subject + role + brand context provided in the user message.
2. Pick a provider deliberately (don't default to one):
   - photorealistic people / complex multi-subject scenes → openai
   - illustrations, stylized art, character portraits → xai
   - photorealistic landscapes / clean product shots → gemini
3. Compose a tight prompt (under 200 words) — describe the subject, lighting, style, mood. Do NOT include background instructions when needsTransparency=true; the tool adds them.
4. Call generate_image once.
5. Call evaluate_image to QA. Pass requireTransparent appropriately.
6. If the score is < 7 OR subjectMatches is false OR (requireTransparent && transparentOK is false), regenerate ONCE with a refined prompt addressing the specific issues. Try a different provider if appropriate. Maximum 1 retry per image.
7. Return your final answer as JSON ONLY: { "handle": "pimg-N", "score": N, "provider": "..." }

No commentary outside the JSON. Pick exactly ONE handle.`;

interface SingleImageInput {
  subject: string;
  role: "hero" | "decoration" | "icon" | "background";
  needsTransparency: boolean;
  brandContext?: RunOptions["brandContext"];
}

async function runSingleImageAgent(
  ctx: ImagePipelineToolContext,
  input: SingleImageInput,
): Promise<{ handle: string; usage: { inputTokens: number; outputTokens: number } } | null> {
  const tools = buildImagePipelineTools(ctx);
  const brandLines: string[] = [];
  if (input.brandContext?.name) brandLines.push(`Brand: ${input.brandContext.name}`);
  if (input.brandContext?.industry) brandLines.push(`Industry: ${input.brandContext.industry}`);
  if (input.brandContext?.voiceTone) brandLines.push(`Voice: ${input.brandContext.voiceTone}`);

  const userPrompt = `Generate one image.

Subject: ${input.subject}
Role: ${input.role}
Transparency required: ${input.needsTransparency ? "YES (subject will overlay a background)" : "NO (full scene)"}
${brandLines.length ? "\nBrand context:\n" + brandLines.join("\n") : ""}

Pick the right provider, generate, evaluate, retry if needed (max 1 retry), then return the chosen handle as JSON.`;

  try {
    const run = await ai.runWithTools<{ handle: string; score?: number; provider?: string }>(
      userPrompt,
      tools,
      {
        systemPrompt: SYSTEM_PROMPT,
        maxTokens: 4000,
        temperature: 1, // Opus 4.7 ignores; legacy keeps
        maxIterations: 6, // 1 generate + 1 evaluate + 1 retry generate + 1 retry evaluate + 2 buffer
        thinkingBudget: 1500,
      },
    );
    const handle = run.json?.handle;
    if (!handle || !ctx.images.has(handle)) return null;
    return { handle, usage: run.usage };
  } catch (err) {
    console.error("[ImagePipelineAgent] runSingleImageAgent failed:", err);
    return null;
  }
}

export async function runImagePipelineAgent(
  layout: AIDesignLayout,
  options: RunOptions,
): Promise<PipelineAgentResult> {
  const ctx: ImagePipelineToolContext = {
    canvasWidth: options.width,
    canvasHeight: options.height,
    images: new Map(),
  };

  const tasks: Promise<unknown>[] = [];
  let imagesGenerated = 0;
  let agentRuns = 0;
  let totalIn = 0;
  let totalOut = 0;

  // Hero / decoration / icon placeholders
  if (options.generateHeroImage) {
    for (const el of layout.elements) {
      if (el.type !== "image") continue;
      const img = el as AIImagePlaceholder;
      if (!img.imagePrompt) continue;
      if (img.imageRole === "logo-placeholder" || img.imageRole === "background") continue;

      tasks.push(
        runSingleImageAgent(ctx, {
          subject: img.imagePrompt,
          role: img.imageRole === "icon" ? "icon" : img.imageRole === "decoration" ? "decoration" : "hero",
          needsTransparency: true,
          brandContext: options.brandContext,
        }).then(async (res) => {
          agentRuns++;
          if (!res) return;
          totalIn += res.usage.inputTokens;
          totalOut += res.usage.outputTokens;
          const url = await uploadCachedImage(ctx, res.handle);
          if (url) {
            img.imageUrl = url;
            imagesGenerated++;
          }
        }),
      );
    }
  }

  // Background image
  if (options.generateBackground) {
    const bgEl = layout.elements.find(
      (el) => el.type === "image" && (el as AIImagePlaceholder).imageRole === "background",
    ) as AIImagePlaceholder | undefined;
    const bgPrompt =
      bgEl?.imagePrompt ||
      buildBackgroundFallbackPrompt(layout) ||
      null;

    if (bgPrompt) {
      tasks.push(
        runSingleImageAgent(ctx, {
          subject: bgPrompt,
          role: "background",
          needsTransparency: false,
          brandContext: options.brandContext,
        }).then(async (res) => {
          agentRuns++;
          if (!res) return;
          totalIn += res.usage.inputTokens;
          totalOut += res.usage.outputTokens;
          const url = await uploadCachedImage(ctx, res.handle);
          if (url) {
            layout.background = { type: "image", imageUrl: url };
            imagesGenerated++;
          }
        }),
      );
    }
  }

  await Promise.all(tasks);

  return {
    layout,
    imagesGenerated,
    agentRuns,
    usage: { inputTokens: totalIn, outputTokens: totalOut },
  };
}

function buildBackgroundFallbackPrompt(layout: AIDesignLayout): string | null {
  const texts = layout.elements
    .filter((el) => el.type === "text")
    .map((el) => (el as { text: string }).text)
    .join(" ");
  if (!texts.trim()) return null;
  return `Atmospheric background scene related to: ${texts.substring(0, 200)}. Composition leaves room at top/center for headline overlay. No text or words in the image.`;
}
