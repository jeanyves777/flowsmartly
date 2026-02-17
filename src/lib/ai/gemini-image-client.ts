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
  async generateImage(
    prompt: string,
    options: {
      aspectRatio?: GeminiAspectRatio;
      numberOfImages?: number;
    } = {}
  ): Promise<string | null> {
    const {
      aspectRatio = "1:1",
      numberOfImages = 1,
    } = options;

    if (!this.client) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.models.generateImages({
          model: "imagen-4.0-generate-001",
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
