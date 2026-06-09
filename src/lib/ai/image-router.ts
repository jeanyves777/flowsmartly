import { OPENAI_IMAGE_EDIT_MODEL, OPENAI_IMAGE_GEN_MODEL, openaiClient } from "./openai-client";
import { geminiImageClient, sizeToAspectRatioGemini } from "./gemini-image-client";
import { XAI_IMAGE_MODEL, xaiClient, sizeToAspectRatio } from "./xai-client";
import { flowImageClient } from "./flow-image-client";
import type { ImageProvider } from "@/lib/constants/design-presets";
import { imageChain, IMAGE_MODEL_IDS, type ImageRole } from "./media-models";
import { isOpenAiImageDown, isOpenAiQuotaError, markOpenAiImageDown, withoutDownOpenAi } from "./openai-image-health";

export type RoutedImageProvider = ImageProvider | "flow";

export type RoutedImageResult = {
  base64: string | null;
  model: string;
  provider: RoutedImageProvider;
  format: "png" | "jpeg";
};

export type ImageEditIntent = "creative" | "exact" | "identity";

export function getGptImageSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const aspectRatio = width / height;
  if (aspectRatio > 1.3) return "1536x1024";
  if (aspectRatio < 0.77) return "1024x1536";
  return "1024x1024";
}

export function xaiFirstImageProviderOrder(preferred?: ImageProvider | null): ImageProvider[] {
  // Provider tier policy (set by the user):
  //   • STANDARD / default → Google "Nano Banana" (Gemini) PRIMARY, OpenAI then
  //     xAI as fallbacks. (name kept for back-compat; no longer xAI-first.)
  //   • PREMIUM            → OpenAI gpt-image PRIMARY (preferred === "openai"),
  //     Gemini as the fallback — never xAI, so Premium can't drop to Standard.
  const base: Array<ImageProvider | null | undefined> =
    preferred === "openai"
      ? ["openai", "gemini"]
      : preferred === "gemini"
        ? ["gemini", "openai"]
        : ["gemini", preferred, "openai", "xai"];
  const order: ImageProvider[] = [];
  for (const provider of base) {
    if (provider && !order.includes(provider)) order.push(provider);
  }
  // Skip OpenAI while it's in quota cooldown so we don't waste a call on it.
  return withoutDownOpenAi(order);
}

export function xaiFirstImageGenerationProviderOrder(preferred?: ImageProvider | null): RoutedImageProvider[] {
  const order: RoutedImageProvider[] = [];
  for (const provider of [...xaiFirstImageProviderOrder(preferred), "flow"] as RoutedImageProvider[]) {
    if (!order.includes(provider)) order.push(provider);
  }
  return order;
}

export async function generateImageWithProvider(
  provider: RoutedImageProvider,
  prompt: string,
  width: number,
  height: number,
  options: { quality?: "low" | "medium" | "high"; transparent?: boolean; model?: string } = {},
): Promise<RoutedImageResult> {
  switch (provider) {
    case "xai": {
      if (!xaiClient.isAvailable()) {
        throw new Error("xAI provider is not configured. Please set XAI_API_KEY.");
      }
      const aspectRatio = sizeToAspectRatio(width, height);
      // 2K is only valid on the quality model — the base grok-imagine-image
      // rejects it, so gate the resolution on the model name.
      const xaiModel = options.model || XAI_IMAGE_MODEL;
      const wants2k = options.quality === "high" && /quality/.test(xaiModel);
      return {
        base64: await xaiClient.generateImage(prompt, {
          aspectRatio,
          resolution: wants2k ? "2k" : undefined,
        }),
        model: xaiModel,
        provider,
        format: "jpeg",
      };
    }
    case "openai": {
      const size = getGptImageSize(width, height);
      const openaiModel = options.model || OPENAI_IMAGE_GEN_MODEL;
      return {
        base64: await openaiClient.generateImage(prompt, {
          size,
          quality: options.quality || "high",
          transparent: options.transparent,
          model: openaiModel,
        }),
        model: openaiModel,
        provider,
        format: "png",
      };
    }
    case "gemini": {
      if (!geminiImageClient.isAvailable()) {
        throw new Error("Gemini provider is not configured. Please set GEMINI_API_KEY.");
      }
      const aspectRatio = sizeToAspectRatioGemini(width, height);
      const geminiModel = options.model || "imagen-4.0-generate-001";
      return {
        base64: await geminiImageClient.generateImage(prompt, { aspectRatio, model: geminiModel }),
        model: geminiModel,
        provider,
        format: "png",
      };
    }
    case "flow": {
      const isAvailable = await flowImageClient.isAvailable();
      if (!isAvailable) {
        throw new Error("Flow image provider is unavailable.");
      }
      return {
        base64: await flowImageClient.generateImage(prompt, {
          width,
          height,
          steps: options.quality === "high" ? 18 : options.quality === "medium" ? 14 : 10,
        }),
        model: "flow-ai-stable-diffusion",
        provider,
        format: "png",
      };
    }
    default:
      throw new Error(`Unknown image provider: ${provider}`);
  }
}

export async function generateImageXaiFirst(
  prompt: string,
  width: number,
  height: number,
  options: {
    preferredProvider?: ImageProvider | null;
    quality?: "low" | "medium" | "high";
    transparent?: boolean;
    strictProvider?: boolean;
  } = {},
): Promise<RoutedImageResult> {
  const providerOrder = options.strictProvider && options.preferredProvider
    ? [options.preferredProvider]
    : xaiFirstImageGenerationProviderOrder(options.preferredProvider);
  let lastError: unknown = null;

  for (const provider of providerOrder) {
    try {
      const result = await generateImageWithProvider(provider, prompt, width, height, {
        quality: options.quality,
        transparent: options.transparent && provider === "openai",
      });
      if (result.base64) return result;
      throw new Error(`${provider} returned no image`);
    } catch (error) {
      lastError = error;
      if (provider === "openai" && isOpenAiQuotaError(error)) markOpenAiImageDown("generate: insufficient_quota");
      console.warn(
        `[ImageRouter] ${provider} failed${provider !== providerOrder[providerOrder.length - 1] ? ", trying next image provider" : ""}:`,
        error,
      );
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : "Image generation failed");
}

export function referencePreservingEditProviderOrder(
  preferred?: ImageProvider | null,
  intent: ImageEditIntent = "identity",
): ImageProvider[] {
  void intent;
  // Premium tier = Google (Gemini) primary, OpenAI fallback, NEVER xAI —
  // mirrors the generation-order rule above so reference/edit Premium calls
  // behave the same way.
  const order: ImageProvider[] = [];
  const base: Array<ImageProvider | null | undefined> =
    preferred === "gemini"
      ? ["gemini", "openai"]
      : preferred === "openai"
        ? ["openai", "gemini"]
        : ["xai", preferred, "openai", "gemini"];

  for (const provider of base) {
    if (provider && !order.includes(provider)) order.push(provider);
  }
  // Skip OpenAI while it's in quota cooldown (see openai-image-health).
  return withoutDownOpenAi(order);
}

export async function editImagesXaiFirst(
  prompt: string,
  imageBuffers: Buffer[],
  width: number,
  height: number,
  options: {
    preferredProvider?: ImageProvider | null;
    quality?: "low" | "medium" | "high";
    intent?: ImageEditIntent;
    strictProvider?: boolean;
  } = {},
): Promise<RoutedImageResult> {
  const providerOrder = options.strictProvider && options.preferredProvider
    ? [options.preferredProvider]
    : referencePreservingEditProviderOrder(
        options.preferredProvider,
        options.intent ?? "identity",
      );
  let lastError: unknown = null;

  for (const provider of providerOrder) {
    try {
      const sourceBuffers = imageBuffers.filter(Boolean).slice(0, 5);
      if (sourceBuffers.length === 0) throw new Error("At least one image is required for edit");

      if (provider === "xai") {
        if (!xaiClient.isAvailable()) throw new Error("xAI provider is not configured.");
        const aspectRatio = sizeToAspectRatio(width, height);
        const base64s = sourceBuffers.map((buffer) => buffer.toString("base64"));
        return {
          base64: await xaiClient.editImages(prompt, base64s, { aspectRatio }),
          model: XAI_IMAGE_MODEL,
          provider,
          format: "jpeg",
        };
      }

      if (provider === "openai") {
        const size = getGptImageSize(width, height);
        const base64 = sourceBuffers.length > 1
          ? await openaiClient.editMultiImage(
              prompt,
              sourceBuffers.map((buffer, index) => ({
                buffer,
                filename: index === 0 ? "canvas.png" : `reference-${index}.png`,
                type: "image/png",
              })),
              { size, quality: options.quality || "high" },
            )
          : await openaiClient.editImage(prompt, sourceBuffers[0], {
              size,
              quality: options.quality || "high",
            });
        return {
          base64,
          model: OPENAI_IMAGE_EDIT_MODEL,
          provider,
          format: "png",
        };
      }

      if (provider === "gemini") {
        if (!geminiImageClient.isAvailable()) throw new Error("Gemini provider is not configured.");
        const pngBuffers = sourceBuffers.map((buffer) => buffer.toString("base64"));
        return {
          base64: await geminiImageClient.editImages(prompt, pngBuffers, {
            aspectRatio: sizeToAspectRatioGemini(width, height),
          }),
          model: "gemini-2.5-flash-image",
          provider,
          format: "png",
        };
      }

      throw new Error(`Unknown image provider: ${provider}`);
    } catch (error) {
      lastError = error;
      // Trip the breaker so subsequent ops skip OpenAI and go straight to xAI/Gemini.
      if (provider === "openai" && isOpenAiQuotaError(error)) markOpenAiImageDown("edit: insufficient_quota");
      console.warn(
        `[ImageRouter/Edit] ${provider} failed${provider !== providerOrder[providerOrder.length - 1] ? ", trying next image provider" : ""}:`,
        error,
      );
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : "Image edit failed");
}

// ───────────────────────────────────────────────────────────────────────────
// ROLE-AWARE entry points — the preferred way to generate/edit images. They
// consult the GLOBAL media-model policy (src/lib/ai/media-models.ts) so every
// surface uses the same provider+model ladder for a given role, with fallback.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Generate an image for a media ROLE (design_generate / bulk_multi / premium…).
 * Walks that role's provider+model chain and returns the first success.
 */
export async function generateImageForRole(
  role: ImageRole,
  prompt: string,
  width: number,
  height: number,
  options: { quality?: "low" | "medium" | "high"; transparent?: boolean } = {},
): Promise<RoutedImageResult> {
  let lastError: unknown = null;
  const chain = imageChain(role);
  const hasNonOpenAi = chain.some((s) => s.provider !== "openai");
  for (const step of chain) {
    // Skip OpenAI while it's in quota cooldown (as long as another provider exists).
    if (step.provider === "openai" && hasNonOpenAi && isOpenAiImageDown()) continue;
    try {
      const result = await generateImageWithProvider(step.provider, prompt, width, height, {
        quality: options.quality,
        transparent: options.transparent && step.provider === "openai",
        model: step.model,
      });
      if (result.base64) return result;
      throw new Error(`${step.provider} returned no image`);
    } catch (error) {
      lastError = error;
      if (step.provider === "openai" && isOpenAiQuotaError(error)) markOpenAiImageDown("role-generate: insufficient_quota");
      console.warn(
        `[ImageRouter/role:${role}] ${step.provider} (${step.model}) failed, trying next:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  throw new Error(lastError instanceof Error ? lastError.message : "Image generation failed");
}

/**
 * Edit image(s) for a media ROLE. Only edit-capable providers are used: Imagen
 * generate models can't edit, so any "gemini" step is coerced to the Nano Banana
 * edit model and "flow" steps are skipped.
 */
export async function editImagesForRole(
  role: ImageRole,
  prompt: string,
  imageBuffers: Buffer[],
  width: number,
  height: number,
  options: { quality?: "low" | "medium" | "high"; intent?: ImageEditIntent; preferProvider?: ImageProvider } = {},
): Promise<RoutedImageResult> {
  void options.intent;
  const sourceBuffers = imageBuffers.filter(Boolean).slice(0, 5);
  if (sourceBuffers.length === 0) throw new Error("At least one image is required for edit");

  let lastError: unknown = null;
  let editChain = imageChain(role);
  // Allow a caller to push a specific provider to the FRONT of the edit chain —
  // used to escalate a repeat edit to xAI (Grok), which is strong at editing.
  if (options.preferProvider) {
    const pref = options.preferProvider;
    editChain = [...editChain].sort((a, b) => (a.provider === pref ? -1 : 0) - (b.provider === pref ? -1 : 0));
    // Ensure the preferred provider is present even if the role's chain omits it.
    if (!editChain.some((s) => s.provider === pref)) {
      const fallbackModel = pref === "xai" ? IMAGE_MODEL_IDS.xaiBase : pref === "openai" ? IMAGE_MODEL_IDS.gptImage1 : IMAGE_MODEL_IDS.nanoBanana;
      editChain = [{ provider: pref, model: fallbackModel }, ...editChain];
    }
  }
  const editHasNonOpenAi = editChain.some((s) => s.provider !== "openai");
  for (const step of editChain) {
    // Skip OpenAI while it's in quota cooldown (as long as another provider exists).
    if (step.provider === "openai" && editHasNonOpenAi && isOpenAiImageDown()) continue;
    // Edit chains only contain edit-capable providers (gemini/openai/xai).
    const model = step.provider === "gemini" ? IMAGE_MODEL_IDS.nanoBanana : step.model;
    try {
      if (step.provider === "xai") {
        if (!xaiClient.isAvailable()) throw new Error("xAI provider is not configured.");
        const base64 = await xaiClient.editImages(
          prompt,
          sourceBuffers.map((b) => b.toString("base64")),
          { aspectRatio: sizeToAspectRatio(width, height) },
        );
        if (base64) return { base64, model, provider: "xai", format: "jpeg" };
        throw new Error("xai returned no image");
      }
      if (step.provider === "openai") {
        const size = getGptImageSize(width, height);
        const base64 =
          sourceBuffers.length > 1
            ? await openaiClient.editMultiImage(
                prompt,
                sourceBuffers.map((buffer, i) => ({
                  buffer,
                  filename: i === 0 ? "canvas.png" : `reference-${i}.png`,
                  type: "image/png",
                })),
                { size, quality: options.quality || "high", model },
              )
            : await openaiClient.editImage(prompt, sourceBuffers[0], {
                size,
                quality: options.quality || "high",
                model,
              });
        if (base64) return { base64, model, provider: "openai", format: "png" };
        throw new Error("openai returned no image");
      }
      if (step.provider === "gemini") {
        if (!geminiImageClient.isAvailable()) throw new Error("Gemini provider is not configured.");
        const base64 = await geminiImageClient.editImages(
          prompt,
          sourceBuffers.map((b) => b.toString("base64")),
          { aspectRatio: sizeToAspectRatioGemini(width, height) },
        );
        if (base64) return { base64, model, provider: "gemini", format: "png" };
        throw new Error("gemini returned no image");
      }
    } catch (error) {
      lastError = error;
      if (step.provider === "openai" && isOpenAiQuotaError(error)) markOpenAiImageDown("role-edit: insufficient_quota");
      console.warn(
        `[ImageRouter/editRole:${role}] ${step.provider} failed, trying next:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  throw new Error(lastError instanceof Error ? lastError.message : "Image edit failed");
}
