/**
 * Design Image Pipeline
 *
 * Generates images for AI Smart Layout placeholders using the selected
 * image provider (OpenAI/xAI/Gemini). Handles hero images (with transparent
 * backgrounds) and scene backgrounds.
 *
 * Flow:
 * 1. Scan layout for image placeholders with imagePrompt
 * 2. Generate images via selected provider (parallel)
 * 3. For hero images on xAI/Gemini: run rembg for transparency
 * 4. Save to S3 and inject imageUrl back into layout
 */

import type { AIDesignLayout, AIImagePlaceholder } from "./design-layout-types";
import { openaiClient } from "./openai-client";
import { xaiClient, sizeToAspectRatio } from "./xai-client";
import { geminiImageClient, sizeToAspectRatioGemini } from "./gemini-image-client";
import { removeBackground, isRembgAvailable } from "@/lib/image-tools/background-remover";
import { saveToFile, saveToFileLocal } from "@/lib/utils/file-storage";
import { randomUUID } from "crypto";

export type ImageProvider = "openai" | "xai" | "gemini";

export interface PipelineOptions {
  generateHeroImage: boolean;
  generateBackground: boolean;
  width: number;
  height: number;
}

export interface PipelineResult {
  layout: AIDesignLayout;
  imagesGenerated: number;
}

/**
 * Generate images for layout placeholders and background.
 * Mutates the layout in-place, populating imageUrl fields.
 */
export async function generateLayoutImages(
  layout: AIDesignLayout,
  provider: ImageProvider,
  options: PipelineOptions
): Promise<PipelineResult> {
  const { generateHeroImage, generateBackground, width, height } = options;
  const tasks: Promise<void>[] = [];
  let imagesGenerated = 0;

  // 1. Generate hero/decoration images from placeholders
  if (generateHeroImage) {
    for (const el of layout.elements) {
      if (el.type !== "image") continue;
      const img = el as AIImagePlaceholder;
      if (!img.imagePrompt) continue;
      if (img.imageRole === "logo-placeholder" || img.imageRole === "background") continue;

      tasks.push(
        generateAndAttachImage(img, provider, width, height, true).then(() => {
          imagesGenerated++;
        })
      );
    }
  }

  // 2. Generate background image
  if (generateBackground) {
    // Look for a background-role element with imagePrompt first
    const bgElement = layout.elements.find(
      (el) => el.type === "image" && (el as AIImagePlaceholder).imageRole === "background"
    ) as AIImagePlaceholder | undefined;

    if (bgElement?.imagePrompt) {
      tasks.push(
        generateAndAttachImage(bgElement, provider, width, height, false).then((url) => {
          if (url) {
            layout.background = { type: "image", imageUrl: url };
          }
          imagesGenerated++;
        })
      );
    } else {
      // Generate background from a generic prompt derived from the layout context
      const bgPrompt = buildBackgroundPrompt(layout);
      if (bgPrompt) {
        tasks.push(
          generateSingleImage(bgPrompt, provider, width, height, false).then((url) => {
            if (url) {
              layout.background = { type: "image", imageUrl: url };
              imagesGenerated++;
            }
          })
        );
      }
    }
  }

  // Run all image generations in parallel
  await Promise.all(tasks);

  return { layout, imagesGenerated };
}

/**
 * Generate an image and attach its URL to the placeholder element.
 * Returns the URL if successful.
 */
async function generateAndAttachImage(
  el: AIImagePlaceholder,
  provider: ImageProvider,
  canvasWidth: number,
  canvasHeight: number,
  needsTransparency: boolean
): Promise<string | null> {
  const url = await generateSingleImage(
    el.imagePrompt!,
    provider,
    canvasWidth,
    canvasHeight,
    needsTransparency
  );
  if (url) {
    el.imageUrl = url;
  }
  return url;
}

/**
 * Generate a single image using the specified provider.
 * Handles transparent background via native support (OpenAI) or rembg fallback.
 * Returns the S3 URL of the saved image.
 */
async function generateSingleImage(
  rawPrompt: string,
  provider: ImageProvider,
  width: number,
  height: number,
  needsTransparency: boolean
): Promise<string | null> {
  // For hero images: enforce isolated subject with no background scene
  // This prevents providers (especially xAI/Gemini) from generating a full design
  let prompt = rawPrompt;
  if (needsTransparency) {
    // Strip any existing background instructions and enforce isolation
    prompt = prompt.replace(/on a plain white background[.]?/gi, "").trim();
    prompt += " Isolated subject on a plain white background. No background scene, no environment, no text, no decorations, no design elements.";
  }

  console.log(`[DesignImagePipeline] Generating image via ${provider} (transparent: ${needsTransparency})`);

  let base64: string | null = null;
  let format: "png" | "jpeg" = "png";

  switch (provider) {
    case "openai": {
      const openaiSize = mapToOpenAISize(width, height);
      base64 = await openaiClient.generateImage(prompt, {
        size: openaiSize,
        quality: "medium",
        transparent: needsTransparency,
      });
      format = "png";
      break;
    }
    case "xai": {
      const aspectRatio = sizeToAspectRatio(width, height);
      base64 = await xaiClient.generateImage(prompt, { aspectRatio });
      format = "jpeg"; // xAI returns JPEG
      break;
    }
    case "gemini": {
      const aspectRatio = sizeToAspectRatioGemini(width, height);
      base64 = await geminiImageClient.generateImage(prompt, { aspectRatio });
      format = "png";
      break;
    }
  }

  if (!base64) return null;

  // For xAI/Gemini hero images: remove background via rembg
  if (needsTransparency && provider !== "openai") {
    const transparentUrl = await applyRembg(base64, format);
    if (transparentUrl) return transparentUrl;
    // If rembg fails, save as-is (user can remove bg manually in studio)
    console.warn("[DesignImagePipeline] rembg fallback failed, saving image without transparency");
  }

  // Save to S3
  const imageId = randomUUID();
  const dataUri = `data:image/${format};base64,${base64}`;
  const url = await saveToFile(dataUri, "designs/layout-images", `${imageId}.${format === "jpeg" ? "jpg" : "png"}`);
  return url;
}

/**
 * Apply rembg background removal to a base64 image.
 * Saves locally first (rembg needs file paths), runs rembg, saves result to S3.
 */
async function applyRembg(base64: string, format: "png" | "jpeg"): Promise<string | null> {
  if (!isRembgAvailable()) {
    console.warn("[DesignImagePipeline] rembg not available, skipping transparency");
    return null;
  }

  try {
    // Save to local temp file for rembg
    const tempId = randomUUID();
    const ext = format === "jpeg" ? "jpg" : "png";
    const dataUri = `data:image/${format};base64,${base64}`;
    const localUrl = await saveToFileLocal(dataUri, "temp", `rembg-input-${tempId}.${ext}`);

    // Run rembg
    const localPath = `${process.cwd()}/public${localUrl}`;
    const result = await removeBackground(localPath, { model: "u2net" });

    // Read result and upload to S3
    const { readFileSync } = await import("fs");
    const resultBuffer = readFileSync(result.outputPath);
    const resultBase64 = resultBuffer.toString("base64");
    const resultDataUri = `data:image/png;base64,${resultBase64}`;

    const finalUrl = await saveToFile(resultDataUri, "designs/layout-images", `${tempId}-nobg.png`);

    // Clean up temp files
    const { unlink } = await import("fs/promises");
    await unlink(localPath).catch(() => {});
    await unlink(result.outputPath).catch(() => {});

    return finalUrl;
  } catch (err) {
    console.error("[DesignImagePipeline] rembg error:", err);
    return null;
  }
}

/**
 * Map canvas dimensions to OpenAI gpt-image-1 size parameter.
 */
function mapToOpenAISize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" | "auto" {
  const ratio = width / height;
  if (ratio > 1.3) return "1536x1024";
  if (ratio < 0.77) return "1024x1536";
  if (Math.abs(ratio - 1) < 0.15) return "1024x1024";
  return "auto";
}

/**
 * Build a generic background prompt from layout text elements.
 */
function buildBackgroundPrompt(layout: AIDesignLayout): string | null {
  const texts = layout.elements
    .filter((el) => el.type === "text")
    .map((el) => (el as { text: string }).text)
    .join(" ");

  if (!texts.trim()) return null;

  return `Professional, visually stunning background scene suitable for a marketing design about: ${texts.substring(0, 200)}. Clean composition with space for text overlay. No text or words in the image.`;
}
