/**
 * Flow AI Client — calls the self-hosted Stable Diffusion server.
 * Returns base64 PNG strings, same interface as OpenAI client.
 */

const FLOW_AI_URL = process.env.FLOW_AI_URL || "http://localhost:7860";
const TIMEOUT_MS = 1_800_000; // 30 minutes (CPU inference is very slow)
const BUSY_RETRY_DELAY_MS = 30_000; // 30 seconds between busy-wait retries
const BUSY_MAX_RETRIES = 40; // 40 × 30s = 20 minutes max wait for busy server

// Custom undici Agent with long timeouts for CPU inference (~8-10 min per image)
// Default headersTimeout is 300s (5 min) which is too short for CPU SD generation
import { Agent as UndiciAgent } from "undici";
const flowAgent = new UndiciAgent({
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
  keepAliveTimeout: 60_000,
});

class FlowImageClient {
  private static instance: FlowImageClient;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = FLOW_AI_URL;
  }

  static getInstance(): FlowImageClient {
    if (!FlowImageClient.instance) {
      FlowImageClient.instance = new FlowImageClient();
    }
    return FlowImageClient.instance;
  }

  /**
   * Generate an image using the self-hosted Stable Diffusion server.
   * Returns the image as a base64 PNG string, or null on failure.
   */
  async generateImage(
    prompt: string,
    options: {
      width?: number;
      height?: number;
      steps?: number;
      guidanceScale?: number;
      negativePrompt?: string;
    } = {}
  ): Promise<string | null> {
    const {
      width = 384,
      height = 384,
      steps = 12,
      guidanceScale = 7.5,
      negativePrompt = "blurry, low quality, deformed, ugly, bad anatomy, watermark, text, signature, extra limbs, extra fingers, mutated hands, poorly drawn",
    } = options;

    const maxErrorRetries = 1;
    let busyRetries = 0;
    let lastError: unknown;

    // Outer loop: busy-wait when server is processing another image
    while (busyRetries <= BUSY_MAX_RETRIES) {
      let gotBusy = false;

      // Inner loop: retry on transient errors (connection refused, timeout)
      for (let attempt = 0; attempt <= maxErrorRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

          const response = await fetch(`${this.baseUrl}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              negative_prompt: negativePrompt,
              width,
              height,
              num_inference_steps: steps,
              guidance_scale: guidanceScale,
            }),
            signal: controller.signal,
            // @ts-expect-error -- Node.js-specific: custom dispatcher with long headersTimeout for CPU inference
            dispatcher: flowAgent,
          });

          clearTimeout(timeout);

          // Server is busy generating another image — wait and retry
          if (response.status === 503) {
            const body = await response.text().catch(() => "");
            if (/busy/i.test(body)) {
              gotBusy = true;
              busyRetries++;
              console.log(`Flow AI server busy (attempt ${busyRetries}/${BUSY_MAX_RETRIES}), waiting ${BUSY_RETRY_DELAY_MS / 1000}s...`);
              await new Promise((r) => setTimeout(r, BUSY_RETRY_DELAY_MS));
              break; // Break inner loop, continue outer busy-wait loop
            }
            // Non-busy 503 (e.g. model not loaded) — treat as error
            throw new Error(`Flow AI server error: 503${body ? ` - ${body}` : ""}`);
          }

          if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new Error(`Flow AI server error: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`);
          }

          const data = await response.json();
          if (!data.image) {
            throw new Error("Flow AI returned empty image data");
          }
          return data.image;
        } catch (error) {
          lastError = error;
          console.error(`Flow AI image generation error (attempt ${attempt + 1}/${maxErrorRetries + 1}):`, error);

          // Retry only on transient connection errors
          // Node.js fetch() wraps the real error in error.cause, so check both
          const errMsg = error instanceof Error ? error.message : String(error);
          const causeMsg = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
          const fullMsg = `${errMsg} ${causeMsg}`;
          const isTransient = /abort|timeout|ECONNREFUSED|ECONNRESET|fetch failed/i.test(fullMsg);
          if (!isTransient) break;

          if (attempt < maxErrorRetries) {
            await new Promise((r) => setTimeout(r, 5000));
          }
        }
      }

      // If we didn't get a busy response, we're done (success returned above or error thrown)
      if (!gotBusy) break;
    }

    if (busyRetries > BUSY_MAX_RETRIES) {
      throw new Error("Flow AI image generation failed: server busy for too long");
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Flow AI image generation failed: ${errMsg}`);
  }

  /**
   * Check if the Flow AI server is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.status === "ok";
    } catch {
      return false;
    }
  }
}

export const flowImageClient = FlowImageClient.getInstance();
export { FlowImageClient };
