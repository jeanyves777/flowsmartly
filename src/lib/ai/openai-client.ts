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
   * Generate N images from a single prompt in one API call (gpt-image-1
   * supports n=1..10). Used by the studio template-discovery search to
   * return 8 prototype thumbnails for ~$0.09 in ~12 seconds.
   *
   * Always returns an array — caller maps over it. Failed generations
   * (any image with no b64_json AND no fetchable URL) are filtered out
   * silently rather than failing the whole batch.
   */
  async generateImagesBulk(
    prompt: string,
    options: {
      n?: number;                // 1..10, default 4
      size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
      quality?: "low" | "medium" | "high";
      transparent?: boolean;
    } = {},
  ): Promise<string[]> {
    const { n = 4, size = "1024x1024", quality = "low", transparent = false } = options;
    const safeN = Math.max(1, Math.min(10, n));

    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.images.generate({
          model: "gpt-image-1",
          prompt,
          n: safeN,
          size,
          quality,
          ...(transparent ? { background: "transparent" as const } : {}),
        });

        const datas = response.data || [];
        // Resolve each datum: prefer b64_json, fall back to url-fetch.
        const resolved = await Promise.all(
          datas.map(async (d) => {
            if (d.b64_json) return d.b64_json;
            if (d.url) {
              try {
                const r = await fetch(d.url);
                return Buffer.from(await r.arrayBuffer()).toString("base64");
              } catch { return null; }
            }
            return null;
          }),
        );
        return resolved.filter((b): b is string => !!b);
      } catch (error) {
        lastError = error;
        console.error(`OpenAI bulk image gen error (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
        const errMsg = error instanceof Error ? error.message : String(error);
        const isTransient = /rate|limit|timeout|503|529|overloaded|capacity/i.test(errMsg);
        if (!isTransient) break;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`OpenAI bulk image gen failed: ${errMsg}`);
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

  /**
   * Multi-reference image edit. Passes the source template + any number
   * of user-supplied reference photos to gpt-image-1 in a single call.
   * Returns the resulting image as base64 PNG.
   *
   * Use this for "remix this template into my version" workflows where
   * the model needs to preserve layout/composition from the source while
   * substituting the people/products/copy from the references.
   */
  async editMultiImage(
    prompt: string,
    images: Array<{ buffer: Buffer; filename: string; type: string }>,
    options: {
      size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
      quality?: "low" | "medium" | "high";
    } = {},
  ): Promise<string | null> {
    const { size = "auto", quality = "high" } = options;

    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const imageFiles: Uploadable[] = await Promise.all(
          images.map((img) => toFile(img.buffer, img.filename, { type: img.type })),
        );

        const response = await this.client.images.edit({
          model: "gpt-image-1",
          // SDK accepts Uploadable | Uploadable[] — multi-image supported
          // by gpt-image-1 since 2025-04 release. First image is treated
          // as the primary reference (composition); rest are auxiliary.
          image: imageFiles,
          prompt,
          n: 1,
          size,
          quality,
        });

        const imageData = response.data?.[0];
        if (imageData?.b64_json) return imageData.b64_json;
        if (imageData?.url) {
          const res = await fetch(imageData.url);
          return Buffer.from(await res.arrayBuffer()).toString("base64");
        }
        return null;
      } catch (error) {
        lastError = error;
        console.error(`OpenAI multi-image edit error (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
        const errMsg = error instanceof Error ? error.message : String(error);
        const isTransient = /rate|limit|timeout|503|529|overloaded|capacity/i.test(errMsg);
        if (!isTransient) break;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }

    throw new Error(
      `OpenAI multi-image edit failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }
}

export const openaiClient = OpenAIClient.getInstance();
export { OpenAIClient };
