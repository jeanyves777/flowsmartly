/**
 * xAI Grok Image Generation Client
 *
 * Primary xAI image client for FlowSmartly media generation.
 *
 * API endpoint: https://api.x.ai/v1/images/generations
 * Model: grok-imagine-image-quality
 * Uses aspect_ratio instead of size parameter.
 */

const XAI_GENERATIONS_URL = "https://api.x.ai/v1/images/generations";
const XAI_EDITS_URL = "https://api.x.ai/v1/images/edits";
export const XAI_IMAGE_MODEL = process.env.XAI_IMAGE_MODEL || "grok-imagine-image-quality";

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

function toImageDataUri(imageBase64OrDataUri: string): string {
  if (imageBase64OrDataUri.startsWith("data:image/")) {
    return imageBase64OrDataUri;
  }
  return `data:image/png;base64,${imageBase64OrDataUri}`;
}

async function readImageResponse(data: {
  data?: Array<{ b64_json?: string; url?: string }>;
}): Promise<string | null> {
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
}

async function readImageResponses(data: {
  data?: Array<{ b64_json?: string; url?: string }>;
}): Promise<string[]> {
  const images = data.data || [];
  const resolved = await Promise.all(
    images.map(async (imageData) => {
      if (imageData?.b64_json) return imageData.b64_json;
      if (imageData?.url) {
        const res = await fetch(imageData.url);
        const buffer = Buffer.from(await res.arrayBuffer());
        return buffer.toString("base64");
      }
      return null;
    })
  );
  return resolved.filter((item): item is string => !!item);
}

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
      resolution?: "1k" | "2k";
    } = {}
  ): Promise<string | null> {
    const { aspectRatio = "1:1", n = 1, resolution } = options;

    if (!this.apiKey) {
      throw new Error("XAI_API_KEY is not configured");
    }

    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(XAI_GENERATIONS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: XAI_IMAGE_MODEL,
            prompt,
            n,
            aspect_ratio: aspectRatio,
            response_format: "b64_json",
            ...(resolution ? { resolution } : {}),
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`xAI API error (${response.status}): ${errBody}`);
        }

        const data = await response.json();
        return readImageResponse(data);
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

  /**
   * Generate multiple images from one prompt. Used by template discovery
   * so xAI can be primary for batch thumbnail generation too.
   */
  async generateImagesBulk(
    prompt: string,
    options: {
      aspectRatio?: AspectRatio;
      n?: number;
      resolution?: "1k" | "2k";
    } = {}
  ): Promise<string[]> {
    const { aspectRatio = "1:1", n = 4, resolution } = options;
    const safeN = Math.max(1, Math.min(10, Math.round(n)));

    if (!this.apiKey) {
      throw new Error("XAI_API_KEY is not configured");
    }

    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(XAI_GENERATIONS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: XAI_IMAGE_MODEL,
            prompt,
            n: safeN,
            aspect_ratio: aspectRatio,
            response_format: "b64_json",
            ...(resolution ? { resolution } : {}),
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`xAI bulk image API error (${response.status}): ${errBody}`);
        }

        const data = await response.json();
        return readImageResponses(data);
      } catch (error) {
        lastError = error;
        console.error(
          `[XAI] Bulk image generation error (attempt ${attempt + 1}/${maxRetries + 1}):`,
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
    throw new Error(`xAI bulk image generation failed: ${errMsg}`);
  }

  /**
   * Edit/transform an image using grok-imagine-image.
   * Pass a reference image as base64 and a prompt describing the desired output.
   * Returns the result as a base64 string.
   *
   * Single image only. For multi-image edits use `editImages`.
   */
  async editImage(
    prompt: string,
    imageBase64: string,
    options: { aspectRatio?: AspectRatio } = {}
  ): Promise<string | null> {
    const { aspectRatio = "1:1" } = options;

    if (!this.apiKey) {
      throw new Error("XAI_API_KEY is not configured");
    }

    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(XAI_EDITS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: XAI_IMAGE_MODEL,
            prompt,
            image: {
              url: toImageDataUri(imageBase64),
              type: "image_url",
            },
            n: 1,
            aspect_ratio: aspectRatio,
            response_format: "b64_json",
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`xAI edit API error (${response.status}): ${errBody}`);
        }

        const data = await response.json();
        return readImageResponse(data);
      } catch (error) {
        lastError = error;
        console.error(
          `[XAI] Image edit error (attempt ${attempt + 1}/${maxRetries + 1}):`,
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
    throw new Error(`xAI image edit failed: ${errMsg}`);
  }

  /**
   * Edit an image with up to 4 additional reference images.
   * Image 1 should be the source canvas; later images are auxiliary
   * references named in the prompt.
   */
  async editImages(
    prompt: string,
    imageBase64sOrDataUris: string[],
    options: { aspectRatio?: AspectRatio } = {}
  ): Promise<string | null> {
    const { aspectRatio = "1:1" } = options;

    if (!this.apiKey) {
      throw new Error("XAI_API_KEY is not configured");
    }

    const images = imageBase64sOrDataUris.filter(Boolean).slice(0, 5).map(toImageDataUri);
    if (images.length === 0) {
      throw new Error("At least one image is required for xAI image edit");
    }
    if (images.length === 1) {
      return this.editImage(prompt, images[0], { aspectRatio });
    }

    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(XAI_EDITS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: XAI_IMAGE_MODEL,
            prompt,
            images: images.map((url) => ({ type: "image_url", url })),
            n: 1,
            aspect_ratio: aspectRatio,
            response_format: "b64_json",
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`xAI multi-image edit API error (${response.status}): ${errBody}`);
        }

        const data = await response.json();
        return readImageResponse(data);
      } catch (error) {
        lastError = error;
        console.error(
          `[XAI] Multi-image edit error (attempt ${attempt + 1}/${maxRetries + 1}):`,
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
    throw new Error(`xAI multi-image edit failed: ${errMsg}`);
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
