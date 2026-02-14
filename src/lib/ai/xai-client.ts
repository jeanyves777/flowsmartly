/**
 * xAI Grok Image Generation Client
 *
 * Uses the grok-imagine-image model for fast, non-photorealistic image generation.
 * For photorealistic content (ads, flyers), use gpt-image-1 via openai-client.ts instead.
 *
 * API endpoint: https://api.x.ai/v1/images/generations
 * Model: grok-imagine-image
 * Uses aspect_ratio instead of size parameter.
 */

const XAI_API_URL = "https://api.x.ai/v1/images/generations";

type AspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "3:2"
  | "2:3"
  | "2:1"
  | "1:2";

class XAIClient {
  private static instance: XAIClient;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.XAI_API_KEY || "";
    if (!this.apiKey) {
      console.warn("[XAI] No XAI_API_KEY found — Grok image generation will not work");
    }
  }

  static getInstance(): XAIClient {
    if (!XAIClient.instance) {
      XAIClient.instance = new XAIClient();
    }
    return XAIClient.instance;
  }

  /**
   * Check if the xAI client is configured and available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate an image using grok-imagine-image
   * Returns the image as a base64 JPEG string
   */
  async generateImage(
    prompt: string,
    options: {
      aspectRatio?: AspectRatio;
      n?: number;
    } = {}
  ): Promise<string | null> {
    const { aspectRatio = "1:1", n = 1 } = options;

    if (!this.apiKey) {
      throw new Error("XAI_API_KEY is not configured");
    }

    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(XAI_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: "grok-imagine-image",
            prompt,
            n,
            aspect_ratio: aspectRatio,
            response_format: "b64_json",
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`xAI API error (${response.status}): ${errBody}`);
        }

        const data = await response.json();
        const imageData = data.data?.[0];

        if (imageData?.b64_json) {
          return imageData.b64_json;
        }
        if (imageData?.url) {
          const res = await fetch(imageData.url);
          const buffer = Buffer.from(await res.arrayBuffer());
          return buffer.toString("base64");
        }
        return null;
      } catch (error) {
        lastError = error;
        console.error(
          `[XAI] Image generation error (attempt ${attempt + 1}/${maxRetries + 1}):`,
          error
        );

        const errMsg = error instanceof Error ? error.message : String(error);
        const isTransient = /rate|limit|timeout|503|529|overloaded|capacity/i.test(errMsg);
        if (!isTransient) break;

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`xAI image generation failed: ${errMsg}`);
  }
}

/**
 * Convert a size string like "1024x1024" to the nearest xAI aspect ratio
 */
export function sizeToAspectRatio(width: number, height: number): AspectRatio {
  const ratio = width / height;
  if (ratio > 1.9) return "2:1";
  if (ratio > 1.6) return "16:9";
  if (ratio > 1.4) return "3:2";
  if (ratio > 1.2) return "4:3";
  if (ratio > 0.85) return "1:1";
  if (ratio > 0.7) return "3:4";
  if (ratio > 0.6) return "2:3";
  if (ratio > 0.5) return "9:16";
  return "1:2";
}

export const xaiClient = XAIClient.getInstance();
export { XAIClient };
