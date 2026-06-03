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
const XAI_VIDEO_EDITS_URL = "https://api.x.ai/v1/videos/edits";
const XAI_VIDEO_STATUS_URL = "https://api.x.ai/v1/videos";
const XAI_VIDEO_PROMPT_LIMIT = 3900;

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
      /** Progress callback used by SSE routes to keep the browser connection alive. */
      onStatus?: (message: string) => void;
      /** Called with the upstream request_id the moment the job is created, so
       *  the caller can persist it and RESUME (poll/pull) after a restart
       *  instead of losing a job the provider is already rendering + billing. */
      onJobId?: (requestId: string) => void | Promise<void>;
      timeoutMs?: number;
    } = {}
  ): Promise<GrokVideoResult> {
    const {
      duration = 8,
      aspectRatio = "16:9",
      resolution = "720p",
      imageUrl,
      onStatus,
      onJobId,
      timeoutMs,
    } = options;

    if (!this.apiKey) {
      throw new Error("XAI_API_KEY is not configured");
    }

    const safePrompt = clampVideoPrompt(prompt);

    console.log(`[GrokVideo] Generating video: duration=${duration}s, aspect=${aspectRatio}, res=${resolution}${imageUrl ? ", with reference image" : ""}`);
    console.log(`[GrokVideo] Prompt (${safePrompt.length} chars): ${safePrompt.substring(0, 100)}...`);

    const bodyPayload: Record<string, unknown> = {
      model: "grok-imagine-video",
      prompt: safePrompt,
      duration,
      aspect_ratio: aspectRatio,
      resolution,
    };

    // Image-to-video: animate a reference/product image. The xAI video
    // endpoint expects an `image` object, not the image-generation
    // `image_url` helper field.
    if (imageUrl) {
      bodyPayload.image = { type: "image_url", url: imageUrl };
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
    // Hand the resumable job id to the caller BEFORE we block on polling, so it
    // can be persisted (a restart mid-poll can then resume instead of failing).
    try { await onJobId?.(requestId); } catch { /* persistence best-effort */ }
    onStatus?.("Video job started. Waiting for the video provider to finish rendering...");

    const result = await this.pollUntilDone(requestId, timeoutMs, onStatus);
    onStatus?.("Video rendered. Downloading the final MP4...");
    const videoBuffer = await this.downloadVideo(result.url);

    return { requestId, videoBuffer, duration: result.duration };
  }

  /**
   * Single (non-blocking) status check for a previously-created job. Used by
   * the recovery cron to RESUME a job whose in-process worker died (deploy /
   * crash) instead of failing a render the provider already finished + billed.
   */
  async pollOnce(
    requestId: string,
  ): Promise<{ state: "pending" | "done" | "failed"; url?: string; duration?: number; error?: string }> {
    if (!this.apiKey) throw new Error("XAI_API_KEY is not configured");
    const response = await fetch(`${XAI_VIDEO_STATUS_URL}/${requestId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      return { state: "failed", error: `status ${response.status}` };
    }
    const data = await response.json();
    const status = data.status || data.state;
    if (status === "done" || status === "completed" || data.video?.url) {
      const url = data.video?.url;
      if (!url) return { state: "pending" };
      return { state: "done", url, duration: data.video?.duration || 0 };
    }
    if (status === "expired" || status === "failed" || status === "error") {
      const rawErr = data.error ?? data.message ?? `Generation ${status}`;
      const error =
        typeof rawErr === "string" ? rawErr : rawErr?.message || JSON.stringify(rawErr).slice(0, 300);
      return { state: "failed", error };
    }
    return { state: "pending" };
  }

  /** Public download wrapper for recovery flows. */
  async fetchVideoBuffer(url: string): Promise<Buffer> {
    return this.downloadVideo(url);
  }

  /**
   * Poll the status endpoint until the video is done or failed.
   */
  private async pollUntilDone(
    requestId: string,
    timeoutMs: number = 600000, // 10 minutes; image-to-video jobs often exceed 5 minutes.
    onStatus?: (message: string) => void
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
        // xAI sometimes returns { error: { message, code, ... } } as an object —
        // make sure we serialise it readably instead of getting "[object Object]".
        const rawErr = data.error ?? data.message ?? `Generation ${status}`;
        let errorMsg: string;
        if (typeof rawErr === "string") {
          errorMsg = rawErr;
        } else if (rawErr && typeof rawErr === "object") {
          errorMsg = rawErr.message || rawErr.code || JSON.stringify(rawErr).slice(0, 500);
        } else {
          errorMsg = String(rawErr);
        }
        console.error(`[GrokVideo] Job ${requestId} ${status}. Full response:`, JSON.stringify(data).slice(0, 1500));
        throw new Error(`xAI video generation ${status} for job ${requestId}: ${errorMsg}`);
      }

      // Log progress every ~15 seconds
      if (attempts % 5 === 0) {
        const elapsed = attempts * 3;
        const message = `Video provider is still rendering (${elapsed}s elapsed)...`;
        console.log(`[GrokVideo] Job ${requestId}: status=${status || "processing"} (${elapsed}s elapsed)`);
        onStatus?.(message);
      }
    }

    throw new Error(`xAI video generation timed out for job ${requestId} after ${timeoutMs / 1000}s`);
  }

  /**
   * Extend an existing video by appending generated content from the last frame.
   * Returns the COMBINED video (original + extension), not just the new segment.
   *
   * Per xAI docs:
   * - Input video: .mp4, 2–15s
   * - Extension duration: 2–10s (default 6) — controls length of appended portion
   * - aspect_ratio and resolution not configurable; matches input, capped at 720p
   */
  async extendVideo(
    sourceVideoUrl: string,
    prompt: string,
    options: {
      duration?: number;
      timeoutMs?: number;
      onStatus?: (message: string) => void;
    } = {},
  ): Promise<GrokVideoResult> {
    if (!this.apiKey) throw new Error("XAI_API_KEY is not configured");

    const { duration = 6, onStatus, timeoutMs } = options;
    const extDur = Math.min(10, Math.max(2, Math.round(duration)));
    const safePrompt = clampVideoPrompt(prompt);

    console.log(`[GrokVideo] Extending video by ${extDur}s from: ${sourceVideoUrl.substring(0, 80)}...`);

    // xAI REST: extension body uses a `video` object like image-to-video does for `image`.
    // The Python SDK shim exposes a flat `video_url=` arg but the underlying REST wants:
    //   { video: { type: "video_url", url: <URL> } }
    const response = await fetch(XAI_VIDEO_EDITS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-video",
        mode: "extend-video",
        video: { type: "video_url", url: sourceVideoUrl },
        prompt: safePrompt,
        duration: extDur,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`xAI video edit API error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const requestId = data.request_id;
    if (!requestId) throw new Error("xAI video edit API did not return a request_id");

    console.log(`[GrokVideo] Extension job created: ${requestId}`);
    onStatus?.("Extension started — generating seamless continuation...");

    const result = await this.pollUntilDone(requestId, timeoutMs, onStatus);
    const videoBuffer = await this.downloadVideo(result.url);
    return { requestId, videoBuffer, duration: result.duration };
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

function clampVideoPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= XAI_VIDEO_PROMPT_LIMIT) return clean;

  const suffix = "\n\nKeep it polished, brand-safe, realistic, continuous, and free of watermarks or distorted people.";
  return clean.slice(0, XAI_VIDEO_PROMPT_LIMIT - suffix.length).trimEnd() + suffix;
}
