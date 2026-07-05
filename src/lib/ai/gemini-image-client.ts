/**
 * Google Gemini Imagen 4 Image Generation Client
 *
 * Uses the @google/genai SDK for AI image generation.
 * Model: imagen-4.0-generate-001
 * Auth:  GEMINI_API_KEY environment variable (shared with Veo video client)
 *
 * Supported aspect ratios: 1:1, 4:3, 3:4, 16:9, 9:16
 * Supported sizes: "1K" (up to 1024px), "2K" (up to 2048px)
 */

import { GoogleGenAI } from "@google/genai";

export type GeminiAspectRatio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16";

class GeminiImageClient {
  private static instance: GeminiImageClient;
  private client: GoogleGenAI | null = null;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      console.warn("[GeminiImage] No GEMINI_API_KEY found — Imagen generation will not work");
    }
  }

  static getInstance(): GeminiImageClient {
    if (!GeminiImageClient.instance) {
      GeminiImageClient.instance = new GeminiImageClient();
    }
    return GeminiImageClient.instance;
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  /**
   * Generate an image using Imagen 4.
   * Returns the image as a base64 PNG string.
   */
  /**
   * Edit/transform an image using Gemini Flash image model.
   * Pass a reference image as base64 and a prompt describing the desired output.
   * Uses gemini-2.5-flash-image (Nano Banana) with image generation capabilities.
   */
  async editImage(
    prompt: string,
    imageBase64: string,
    options: { aspectRatio?: GeminiAspectRatio } = {}
  ): Promise<string | null> {
    const { aspectRatio = "1:1" } = options;

    if (!this.client) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const maxRetries = 2;
    let lastError: unknown;

    // Tell Nano Banana to do a SURGICAL edit on the same canvas. Without this it
    // tends to recrop/resize the canvas and re-render untouched regions (the
    // source of most "edit broke the design" reports).
    const editPrompt = `${prompt}\n\n[You are EDITING the provided image — not generating a new one. Output exactly ONE image at the SAME ${aspectRatio} aspect ratio and the same pixel dimensions as the input: do NOT crop, zoom, letterbox, pad, rotate, or change the canvas size. Apply ONLY the requested change and keep every other pixel — all existing text, faces, layout, colors — identical to the input.]`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.models.generateContent({
          // gemini-2.5-flash is text-only — image editing requires the
          // image variant (`gemini-2.5-flash-image`, aka Nano Banana).
          model: "gemini-2.5-flash-image",
          contents: [
            {
              role: "user",
              parts: [
                { text: editPrompt },
                { inlineData: { mimeType: "image/png", data: imageBase64 } },
              ],
            },
          ],
          config: {
            responseModalities: ["TEXT", "IMAGE"],
            // Hard aspect-ratio control. The text hint alone does NOT stop Nano
            // Banana defaulting to a 1:1 square (portrait flyers came out square);
            // imageConfig.aspectRatio is the real lever.
            imageConfig: { aspectRatio },
          },
        });

        // Extract image from response parts
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData?.data) {
              return part.inlineData.data;
            }
          }
        }

        console.warn("[GeminiImage] No image data in edit response");
        return null;
      } catch (error) {
        lastError = error;
        console.error(
          `[GeminiImage] Edit error (attempt ${attempt + 1}/${maxRetries + 1}):`,
          error
        );

        const errMsg = error instanceof Error ? error.message : String(error);
        const isTransient = /rate|limit|timeout|503|529|overloaded|capacity|quota/i.test(errMsg);
        if (!isTransient) break;

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Gemini image edit failed: ${errMsg}`);
  }

  /**
   * Edit an image with additional reference images. Image 1 should be the
   * current canvas; later images are user references for style, people,
   * products, or replacement assets.
   */
  async editImages(
    prompt: string,
    imageBase64s: string[],
    options: { aspectRatio?: GeminiAspectRatio } = {}
  ): Promise<string | null> {
    const { aspectRatio = "1:1" } = options;

    if (!this.client) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const images = imageBase64s
      .filter(Boolean)
      .slice(0, 5)
      .map((value) => value.replace(/^data:image\/[^;]+;base64,/, ""));

    if (images.length === 0) {
      throw new Error("At least one image is required for Gemini image edit");
    }
    if (images.length === 1) {
      return this.editImage(prompt, images[0], { aspectRatio });
    }

    const maxRetries = 2;
    let lastError: unknown;

    // FIRST image is the canvas being edited; the rest are references (logo,
    // product, person). Same surgical-edit framing as the single-image path.
    const editPrompt = `${prompt}\n\n[You are EDITING the FIRST image (the canvas). Any additional images are REFERENCES to use, not canvases. Output exactly ONE image at the SAME ${aspectRatio} aspect ratio and the same pixel dimensions as the FIRST image: do NOT crop, zoom, letterbox, pad, or change its canvas size. Apply ONLY the requested change and keep every other pixel of the first image — all existing text, faces, layout, colors — identical.]`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [
            {
              role: "user",
              parts: [
                { text: editPrompt },
                ...images.map((data) => ({
                  inlineData: { mimeType: "image/png", data },
                })),
              ],
            },
          ],
          config: {
            responseModalities: ["TEXT", "IMAGE"],
            // Hard aspect-ratio control. The text hint alone does NOT stop Nano
            // Banana defaulting to a 1:1 square (portrait flyers came out square);
            // imageConfig.aspectRatio is the real lever.
            imageConfig: { aspectRatio },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData?.data) {
              return part.inlineData.data;
            }
          }
        }

        console.warn("[GeminiImage] No image data in multi-image edit response");
        return null;
      } catch (error) {
        lastError = error;
        console.error(
          `[GeminiImage] Multi-image edit error (attempt ${attempt + 1}/${maxRetries + 1}):`,
          error
        );

        const errMsg = error instanceof Error ? error.message : String(error);
        const isTransient = /rate|limit|timeout|503|529|overloaded|capacity|quota/i.test(errMsg);
        if (!isTransient) break;

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Gemini multi-image edit failed: ${errMsg}`);
  }

  /**
   * Generate an image using Imagen 4.
   * Returns the image as a base64 PNG string.
   */
  async generateImage(
    prompt: string,
    options: {
      aspectRatio?: GeminiAspectRatio;
      numberOfImages?: number;
      /** Imagen model id — defaults to the flagship. Pass Ultra/Fast per role. */
      model?: string;
    } = {}
  ): Promise<string | null> {
    const {
      aspectRatio = "1:1",
      numberOfImages = 1,
      model = "imagen-4.0-generate-001",
    } = options;

    if (!this.client) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const maxRetries = 2;
    let lastError: unknown;

    // Two distinct Google image engines:
    //  - imagen-*  → photorealism model, via the dedicated generateImages API.
    //  - gemini-*  (Nano Banana, gemini-2.5-flash-image) → the design/text
    //    powerhouse, via generateContent. Imagen makes pretty photos but poor
    //    graphic-design layouts; Nano Banana is what we want for flyers/posters.
    const isImagen = /^imagen/i.test(model);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (!isImagen) {
          // Nano Banana text-to-image (no source image = pure generation).
          const response = await this.client.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [{ text: `${prompt}\n\n[Output a single ${aspectRatio} image.]` }],
              },
            ],
            config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio } },
          });
          const parts = response.candidates?.[0]?.content?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.data) return part.inlineData.data;
            }
          }
          console.warn("[GeminiImage] No image data in Nano Banana generate response");
          return null;
        }

        const response = await this.client.models.generateImages({
          model,
          prompt,
          config: {
            numberOfImages,
            aspectRatio,
          },
        });

        const image = response.generatedImages?.[0];
        if (image?.image?.imageBytes) {
          return image.image.imageBytes;
        }

        console.warn("[GeminiImage] No image data in response");
        return null;
      } catch (error) {
        lastError = error;
        console.error(
          `[GeminiImage] Generation error (attempt ${attempt + 1}/${maxRetries + 1}):`,
          error
        );

        const errMsg = error instanceof Error ? error.message : String(error);
        const isTransient = /rate|limit|timeout|503|529|overloaded|capacity|quota/i.test(errMsg);
        if (!isTransient) break;

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Gemini image generation failed: ${errMsg}`);
  }
}

/**
 * Convert pixel dimensions to the nearest Gemini-supported aspect ratio.
 */
export function sizeToAspectRatioGemini(width: number, height: number): GeminiAspectRatio {
  const ratio = width / height;
  if (ratio > 1.5) return "16:9";
  if (ratio > 1.15) return "4:3";
  if (ratio > 0.88) return "1:1";
  if (ratio > 0.65) return "3:4";
  return "9:16";
}

export const geminiImageClient = GeminiImageClient.getInstance();
