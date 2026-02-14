import OpenAI, { toFile } from "openai";
import type { Uploadable } from "openai/uploads";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * OpenAI Client for FlowSmartly
 * Used for image generation (gpt-image-1) to create photorealistic
 * backgrounds, objects, people, and design elements.
 */
class OpenAIClient {
  private static instance: OpenAIClient;
  private client: OpenAI;

  private constructor() {
    this.client = openai;
  }

  static getInstance(): OpenAIClient {
    if (!OpenAIClient.instance) {
      OpenAIClient.instance = new OpenAIClient();
    }
    return OpenAIClient.instance;
  }

  /**
   * Generate an image using gpt-image-1
   * Returns the image as a base64 PNG string
   */
  async generateImage(
    prompt: string,
    options: {
      size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
      quality?: "low" | "medium" | "high";
      transparent?: boolean;
    } = {}
  ): Promise<string | null> {
    const { size = "auto", quality = "medium", transparent = false } = options;

    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.images.generate({
          model: "gpt-image-1",
          prompt,
          n: 1,
          size,
          quality,
          ...(transparent ? { background: "transparent" as const } : {}),
        });

        // gpt-image-1 returns base64 by default
        const imageData = response.data?.[0];
        if (imageData && imageData.b64_json) {
          return imageData.b64_json;
        }
        // Fallback: if URL is returned
        if (imageData && imageData.url) {
          const res = await fetch(imageData.url);
          const buffer = Buffer.from(await res.arrayBuffer());
          return buffer.toString("base64");
        }
        return null;
      } catch (error) {
        lastError = error;
        console.error(`OpenAI image generation error (attempt ${attempt + 1}/${maxRetries + 1}):`, error);

        // Don't retry on non-transient errors
        const errMsg = error instanceof Error ? error.message : String(error);
        const isTransient = /rate|limit|timeout|503|529|overloaded|capacity/i.test(errMsg);
        if (!isTransient) break;

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`OpenAI image generation failed: ${errMsg}`);
  }
  /**
   * Edit/reference an image using gpt-image-1
   * Uses images.edit() with a reference image for template-based generation
   * Returns the image as a base64 PNG string
   */
  async editImage(
    prompt: string,
    referenceImage: Buffer,
    options: {
      size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
      quality?: "low" | "medium" | "high";
    } = {}
  ): Promise<string | null> {
    const { size = "auto", quality = "high" } = options;

    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const imageFile: Uploadable = await toFile(referenceImage, "template.png", {
          type: "image/png",
        });

        const response = await this.client.images.edit({
          model: "gpt-image-1",
          image: imageFile,
          prompt,
          n: 1,
          size,
          quality,
        });

        const imageData = response.data?.[0];
        if (imageData && imageData.b64_json) {
          return imageData.b64_json;
        }
        if (imageData && imageData.url) {
          const res = await fetch(imageData.url);
          const buffer = Buffer.from(await res.arrayBuffer());
          return buffer.toString("base64");
        }
        return null;
      } catch (error) {
        lastError = error;
        console.error(`OpenAI image edit error (attempt ${attempt + 1}/${maxRetries + 1}):`, error);

        const errMsg = error instanceof Error ? error.message : String(error);
        const isTransient = /rate|limit|timeout|503|529|overloaded|capacity/i.test(errMsg);
        if (!isTransient) break;

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`OpenAI image edit failed: ${errMsg}`);
  }
}

export const openaiClient = OpenAIClient.getInstance();
export { OpenAIClient };
