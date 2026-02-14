import OpenAI from "openai";
import type { Videos } from "openai/resources/videos";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type SoraModel = Videos.VideoModel;
export type SoraSize = Videos.VideoSize;
export type SoraDuration = Videos.VideoSeconds; // '4' | '8' | '12' (strings)

export interface SoraGenerateOptions {
  model?: SoraModel;
  /** Duration in seconds ('4', '8', or '12') */
  seconds?: SoraDuration;
  /** Output resolution */
  size?: SoraSize;
  /** Path to a reference image for character consistency */
  referenceImagePath?: string;
}

export interface SoraVideoResult {
  videoId: string;
  /** Local file path of the downloaded MP4 */
  localPath: string;
}

/**
 * Sora Video Generation Client
 *
 * Uses OpenAI's Sora API to generate short video clips from text prompts.
 * Supports reference images for character consistency across scenes.
 */
class SoraClient {
  private static instance: SoraClient;
  private client: OpenAI;

  private constructor() {
    this.client = openai;
  }

  static getInstance(): SoraClient {
    if (!SoraClient.instance) {
      SoraClient.instance = new SoraClient();
    }
    return SoraClient.instance;
  }

  /**
   * Generate a video clip and download the MP4.
   * Polls until the job completes, then saves the video to outputDir.
   */
  async generateVideo(
    prompt: string,
    outputDir: string,
    outputFilename: string,
    options: SoraGenerateOptions = {}
  ): Promise<SoraVideoResult> {
    const {
      model = "sora-2",
      seconds = "8",
      size = "1280x720",
      referenceImagePath,
    } = options;

    // Build create params
    const createParams: Videos.VideoCreateParams = {
      model,
      prompt,
      seconds,
      size,
    };

    // If a reference image is provided, include it
    if (referenceImagePath && fs.existsSync(referenceImagePath)) {
      createParams.input_reference = fs.createReadStream(referenceImagePath);
    }

    console.log(`[Sora] Generating video: model=${model}, seconds=${seconds}, size=${size}`);
    console.log(`[Sora] Prompt: ${prompt.substring(0, 100)}...`);

    // Create the video job
    const video = await this.client.videos.create(createParams);
    const videoId = video.id;

    console.log(`[Sora] Job created: ${videoId}, polling for completion...`);

    // Poll for completion
    let status = video.status;
    let attempts = 0;
    const maxAttempts = 120; // ~10 minutes at 5s intervals
    const pollInterval = 5000;

    while (status !== "completed" && status !== "failed" && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const check = await this.client.videos.retrieve(videoId);
      status = check.status;
      attempts++;

      if (attempts % 6 === 0) {
        console.log(`[Sora] Job ${videoId}: status=${status} (${attempts * 5}s elapsed)`);
      }
    }

    if (status === "failed") {
      throw new Error(`Sora video generation failed for job ${videoId}`);
    }
    if (status !== "completed") {
      throw new Error(`Sora video generation timed out for job ${videoId} (status: ${status})`);
    }

    // Download the MP4
    console.log(`[Sora] Job ${videoId} completed, downloading video...`);

    const response = await this.client.videos.downloadContent(videoId, { variant: "video" });

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const localPath = path.join(outputDir, outputFilename);

    // downloadContent returns a Response — read as ArrayBuffer and write to file
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(arrayBuffer));

    console.log(`[Sora] Video saved to: ${localPath}`);

    return { videoId, localPath };
  }

  /**
   * Generate a video and return it as a Buffer (no file saved).
   * Convenience method for the Video Studio pipeline.
   */
  async generateVideoBuffer(
    prompt: string,
    options: SoraGenerateOptions = {}
  ): Promise<{ videoId: string; videoBuffer: Buffer; duration: number }> {
    const {
      model = "sora-2",
      seconds = "8",
      size = "1280x720",
      referenceImagePath,
    } = options;

    const createParams: Videos.VideoCreateParams = {
      model,
      prompt,
      seconds,
      size,
    };

    if (referenceImagePath && fs.existsSync(referenceImagePath)) {
      createParams.input_reference = fs.createReadStream(referenceImagePath);
    }

    console.log(`[Sora] Generating video buffer: model=${model}, seconds=${seconds}, size=${size}`);
    console.log(`[Sora] Prompt: ${prompt.substring(0, 100)}...`);

    const video = await this.client.videos.create(createParams);
    const videoId = video.id;

    console.log(`[Sora] Job created: ${videoId}, polling for completion...`);

    let status = video.status;
    let attempts = 0;
    const maxAttempts = 120;
    const pollInterval = 5000;

    while (status !== "completed" && status !== "failed" && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const check = await this.client.videos.retrieve(videoId);
      status = check.status;
      attempts++;

      if (attempts % 6 === 0) {
        console.log(`[Sora] Job ${videoId}: status=${status} (${attempts * 5}s elapsed)`);
      }
    }

    if (status === "failed") {
      throw new Error(`Sora video generation failed for job ${videoId}`);
    }
    if (status !== "completed") {
      throw new Error(`Sora video generation timed out for job ${videoId} (status: ${status})`);
    }

    console.log(`[Sora] Job ${videoId} completed, downloading video...`);
    const response = await this.client.videos.downloadContent(videoId, { variant: "video" });
    const arrayBuffer = await response.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);
    const duration = parseInt(seconds, 10) || 8;

    console.log(`[Sora] Video buffer ready (${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

    return { videoId, videoBuffer, duration };
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }
}

export const soraClient = SoraClient.getInstance();
export { SoraClient };
