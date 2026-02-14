/**
 * xAI Grok Video Generation Client
 *
 * Uses the grok-imagine-video model for AI video generation.
 * Supports text-to-video (up to 15s) with native audio generation.
 *
 * API endpoints:
 *   POST https://api.x.ai/v1/videos/generations — create video
 *   GET  https://api.x.ai/v1/videos/{request_id} — poll status
 *
 * Model: grok-imagine-video
 */

const XAI_VIDEO_URL = "https://api.x.ai/v1/videos/generations";
const XAI_VIDEO_STATUS_URL = "https://api.x.ai/v1/videos";

type VideoAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3";
type VideoResolution = "480p" | "720p";

export interface GrokVideoResult {
  requestId: string;
  videoBuffer: Buffer;
  duration: number;
}

class GrokVideoClient {
  private static instance: GrokVideoClient;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.XAI_API_KEY || "";
    if (!this.apiKey) {
      console.warn("[GrokVideo] No XAI_API_KEY found — Grok video generation will not work");
    }
  }

  static getInstance(): GrokVideoClient {
    if (!GrokVideoClient.instance) {
      GrokVideoClient.instance = new GrokVideoClient();
    }
    return GrokVideoClient.instance;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate a video from a text prompt.
   * Duration: 1-15 seconds (integer).
   * Returns the video as a Buffer.
   */
  async generateVideo(
    prompt: string,
    options: {
      duration?: number;
      aspectRatio?: VideoAspectRatio;
      resolution?: VideoResolution;
      /** URL of a reference image to animate into video (image-to-video) */
      imageUrl?: string;
    } = {}
  ): Promise<GrokVideoResult> {
    const { duration = 8, aspectRatio = "16:9", resolution = "720p", imageUrl } = options;

    if (!this.apiKey) {
      throw new Error("XAI_API_KEY is not configured");
    }

    console.log(`[GrokVideo] Generating video: duration=${duration}s, aspect=${aspectRatio}, res=${resolution}${imageUrl ? ", with reference image" : ""}`);
    console.log(`[GrokVideo] Prompt: ${prompt.substring(0, 100)}...`);

    const bodyPayload: Record<string, unknown> = {
      model: "grok-imagine-video",
      prompt,
      duration,
      aspect_ratio: aspectRatio,
      resolution,
    };

    // Image-to-video: animate a reference/product image
    if (imageUrl) {
      bodyPayload.image_url = imageUrl;
    }

    const response = await fetch(XAI_VIDEO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`xAI video API error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const requestId = data.request_id;

    if (!requestId) {
      throw new Error("xAI video API did not return a request_id");
    }

    console.log(`[GrokVideo] Job created: ${requestId}, polling for completion...`);

    const result = await this.pollUntilDone(requestId);
    const videoBuffer = await this.downloadVideo(result.url);

    return { requestId, videoBuffer, duration: result.duration };
  }

  /**
   * Poll the status endpoint until the video is done or failed.
   */
  private async pollUntilDone(
    requestId: string,
    timeoutMs: number = 300000 // 5 minutes
  ): Promise<{ url: string; duration: number }> {
    const pollInterval = 3000; // 3 seconds
    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollInterval));
      attempts++;

      const response = await fetch(`${XAI_VIDEO_STATUS_URL}/${requestId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`xAI video status API error (${response.status}): ${errBody}`);
      }

      const data = await response.json();

      // xAI returns { video: { url, duration } } when done (no status field),
      // or { status: "pending" } while generating, or { status: "expired" } on failure
      const status = data.status || data.state;

      // Check if video is ready — xAI omits "status" when done and returns video directly
      if (status === "done" || status === "completed" || data.video?.url) {
        const url = data.video?.url;
        const duration = data.video?.duration || 0;
        if (!url) {
          console.error("[GrokVideo] Completed but no URL. Full response:", JSON.stringify(data));
          throw new Error("xAI video completed but no URL returned");
        }
        console.log(`[GrokVideo] Job ${requestId} completed (${attempts * 3}s elapsed)`);
        return { url, duration };
      }

      if (status === "expired" || status === "failed" || status === "error") {
        const errorMsg = data.error || data.message || `Generation ${status}`;
        throw new Error(`xAI video generation ${status} for job ${requestId}: ${errorMsg}`);
      }

      // Log progress every ~15 seconds
      if (attempts % 5 === 0) {
        console.log(`[GrokVideo] Job ${requestId}: status=${status || "processing"} (${attempts * 3}s elapsed)`);
      }
    }

    throw new Error(`xAI video generation timed out for job ${requestId} after ${timeoutMs / 1000}s`);
  }

  /**
   * Download a video from a temporary URL and return it as a Buffer.
   */
  private async downloadVideo(url: string): Promise<Buffer> {
    console.log(`[GrokVideo] Downloading video from URL: ${url.substring(0, 150)}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download video (${response.status})`);
    }

    const contentType = response.headers.get("content-type") || "unknown";
    const contentLength = response.headers.get("content-length") || "unknown";
    console.log(`[GrokVideo] Download: content-type=${contentType}, content-length=${contentLength}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const magic = buffer.slice(4, 8).toString("ascii");
    console.log(`[GrokVideo] Downloaded ${buffer.length} bytes (${(buffer.length / 1024).toFixed(1)} KB), magic[4:8]="${magic}", is MP4: ${magic === "ftyp"}`);

    return buffer;
  }
}

export const grokVideoClient = GrokVideoClient.getInstance();
export { GrokVideoClient };
