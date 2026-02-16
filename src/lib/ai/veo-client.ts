/**
 * Google Veo 3 Video Generation Client
 *
 * Uses the Gemini API via @google/genai SDK for AI video generation.
 * Supports text-to-video with native audio (voice, sound effects, music).
 *
 * Model: veo-3.1-generate-preview (up to 8s, 720p/1080p, native audio)
 * Auth:  GEMINI_API_KEY environment variable
 */

import { GoogleGenAI } from "@google/genai";

export type VeoDuration = "4" | "6" | "8";
export type VeoResolution = "720p" | "1080p";
export type VeoAspectRatio = "16:9" | "9:16";

export interface VeoGenerateOptions {
  /** Duration in seconds ('4', '6', or '8'). Default: '8' */
  durationSeconds?: VeoDuration;
  /** Output resolution. Default: '720p' */
  resolution?: VeoResolution;
  /** Aspect ratio. Default: '16:9' */
  aspectRatio?: VeoAspectRatio;
  /** Content to exclude from the video */
  negativePrompt?: string;
  /** Use the fast model variant for quicker generation */
  fast?: boolean;
}

export interface VeoVideoResult {
  videoBuffer: Buffer;
  duration: number;
  /** Video URI from Veo response — pass to extendVideo() for chaining */
  videoUri: string | null;
}

class VeoClient {
  private static instance: VeoClient;
  private client: GoogleGenAI | null = null;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      console.warn("[Veo] No GEMINI_API_KEY found — Veo 3 video generation will not work");
    }
  }

  static getInstance(): VeoClient {
    if (!VeoClient.instance) {
      VeoClient.instance = new VeoClient();
    }
    return VeoClient.instance;
  }

  isAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  /**
   * Generate a video from a text prompt and return it as a Buffer.
   * Polls until the job completes, then downloads the video.
   */
  async generateVideoBuffer(
    prompt: string,
    options: VeoGenerateOptions = {}
  ): Promise<VeoVideoResult> {
    if (!this.client) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const {
      durationSeconds = "8",
      resolution = "720p",
      aspectRatio = "16:9",
      negativePrompt,
      fast = false,
    } = options;

    const model = fast
      ? "veo-3.1-fast-generate-preview"
      : "veo-3.1-generate-preview";

    console.log(`[Veo] Generating video: model=${model}, duration=${durationSeconds}s, res=${resolution}, aspect=${aspectRatio}`);
    console.log(`[Veo] Prompt: ${prompt.substring(0, 120)}...`);

    // Build config — durationSeconds must be a number for the API
    const config: Record<string, unknown> = {
      aspectRatio,
      durationSeconds: parseInt(durationSeconds, 10),
    };

    // Only add resolution for non-720p (720p is default)
    if (resolution !== "720p") {
      config.resolution = resolution;
    }

    if (negativePrompt) {
      config.negativePrompt = negativePrompt;
    }

    // Create the video generation job
    let operation;
    try {
      operation = await this.client.models.generateVideos({
        model,
        prompt,
        config,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        throw new Error("Gemini API quota exceeded. Please wait a few minutes or check your Google AI billing at ai.google.dev.");
      }
      if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
        throw new Error("Gemini API access denied. Please check your API key permissions.");
      }
      throw new Error(`Video generation failed: ${msg.substring(0, 200)}`);
    }

    const { videoBuffer, videoUri } = await this.pollAndDownload(operation);
    const duration = parseInt(durationSeconds, 10) || 8;

    return { videoBuffer, duration, videoUri };
  }

  /**
   * Extend an existing video by ~7 seconds using the Veo extension API.
   * Pass the videoUri from a previous generation/extension result.
   * Resolution is always 720p for extensions (API requirement).
   * Returns the COMBINED video (original + extension), not just the new segment.
   */
  async extendVideo(
    videoUri: string,
    prompt: string,
    options: { aspectRatio?: VeoAspectRatio; fast?: boolean } = {}
  ): Promise<VeoVideoResult> {
    if (!this.client) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const { aspectRatio = "16:9", fast = false } = options;

    const model = fast
      ? "veo-3.1-fast-generate-preview"
      : "veo-3.1-generate-preview";

    console.log(`[Veo] Extending video: model=${model}, aspect=${aspectRatio}`);

    let operation;
    try {
      operation = await this.client.models.generateVideos({
        model,
        prompt,
        video: { uri: videoUri },
        config: { aspectRatio },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        throw new Error("Gemini API quota exceeded. Please wait a few minutes or check your Google AI billing at ai.google.dev.");
      }
      if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
        throw new Error("Gemini API access denied. Please check your API key permissions.");
      }
      throw new Error(`Video extension failed: ${msg.substring(0, 200)}`);
    }

    const { videoBuffer, videoUri: newUri } = await this.pollAndDownload(operation);

    // Duration is estimated: we don't know exact total, but each extension adds ~7s
    // The caller tracks the running total
    return { videoBuffer, duration: 0, videoUri: newUri };
  }

  /**
   * Poll a Veo operation until done, then download the resulting video.
   * Shared by generateVideoBuffer() and extendVideo().
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async pollAndDownload(operation: any): Promise<{ videoBuffer: Buffer; videoUri: string | null }> {
    console.log(`[Veo] Job created, polling for completion...`);

    const maxAttempts = 72; // 72 * 5s = 360s = 6 minutes
    let attempts = 0;

    while (!operation.done && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 5000));
      attempts++;

      operation = await this.client!.operations.getVideosOperation({ operation });

      if (attempts % 6 === 0) {
        console.log(`[Veo] Polling... (${attempts * 5}s elapsed, done=${operation.done})`);
      }
    }

    if (!operation.done) {
      throw new Error(`Veo video generation timed out after ${maxAttempts * 5}s`);
    }

    const response = operation.response;
    if (!response?.generatedVideos?.length) {
      throw new Error("Veo video generation completed but no videos returned");
    }

    const generatedVideo = response.generatedVideos[0];
    if (!generatedVideo.video) {
      throw new Error("Veo video generation completed but video data is missing");
    }

    const videoUri = generatedVideo.video?.uri || null;

    console.log(`[Veo] Video ready, downloading...`);

    // Download the video content
    const videoBuffer = await this.downloadVideoFile(generatedVideo.video);

    console.log(`[Veo] Video buffer ready (${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

    return { videoBuffer, videoUri };
  }

  /**
   * Download a video file object and return it as a Buffer.
   */
  private async downloadVideoFile(videoFile: { uri?: string | null }): Promise<Buffer> {
    if (!videoFile.uri) {
      throw new Error("No video URI available for download");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const downloadUrl = videoFile.uri.includes("?")
      ? `${videoFile.uri}&key=${apiKey}`
      : `${videoFile.uri}?key=${apiKey}`;

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      const fallbackResponse = await fetch(videoFile.uri);
      if (!fallbackResponse.ok) {
        throw new Error(`Failed to download Veo video (${response.status})`);
      }
      const arrayBuffer = await fallbackResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export const veoClient = VeoClient.getInstance();
export { VeoClient };
