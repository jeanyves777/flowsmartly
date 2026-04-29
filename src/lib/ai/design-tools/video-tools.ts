/**
 * Video-generation primitives for the Video Agent.
 *
 * Uses Google Veo 3.1 via @google/genai (vertexai mode). Auth via
 * Application Default Credentials — set GOOGLE_APPLICATION_CREDENTIALS
 * to a service account JSON or run with `gcloud auth application-default
 * login`.
 *
 * Veo is async — submit a long-running operation and poll until done.
 * This helper handles both submit + poll inside one call so the agent
 * sees a synchronous-looking result. Polling backs off from 5s → 30s.
 *
 * Veo's response shape (verified by manual diagnostic 2026-04-29):
 *   op.response.generatedVideos[0].video.videoBytes  // inline base64 mp4
 *   op.response.generatedVideos[0].video.gcsUri      // when outputGcsUri is set
 *   op.response.generatedVideos[0].video.uri         // sometimes for image-to-video
 *   op.response.raiMediaFilteredCount                // count of safety-filtered videos
 *
 * We support all three return paths and surface the safety-filter count
 * so the caller knows when no video came back due to RAI filtering.
 */

import { GoogleGenAI } from "@google/genai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

export interface VeoGenerateInput {
  prompt: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  /** Veo 3.1 supports 4-8s clips. */
  durationSeconds: number;
  /** Optional first-frame image (data URL or HTTP URL). */
  referenceImageUrl?: string;
  negativePrompt?: string;
  /** Whether the result should include AI-generated audio (Veo 3+). */
  generateAudio?: boolean;
  /** Resolution: "720p" | "1080p". */
  resolution?: "720p" | "1080p";
}

export interface VeoGenerateResult {
  /** Final video URL — either a `gs://` URI or an https URL depending on
   *  how the operation was submitted. */
  videoUrl: string;
  /** Veo's operation name (acts as job id). */
  jobId: string;
  /** Resolved model id. */
  model: string;
  durationSeconds: number;
  /** Whether the result has baked-in AI audio. */
  hasAudio: boolean;
}

const VEO_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || "gen-lang-client-0438435525";
const VEO_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const VEO_MODEL = process.env.VEO_MODEL || "veo-3.1-generate-001";

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (_client) return _client;
  _client = new GoogleGenAI({
    vertexai: true,
    project: VEO_PROJECT,
    location: VEO_LOCATION,
  });
  return _client;
}

/** Resolve a URL / data URL into base64 bytes + mime type for Veo. */
async function resolveImageForVeo(url: string): Promise<{ imageBytes: string; mimeType: string } | null> {
  try {
    if (url.startsWith("data:")) {
      const m = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (!m) return null;
      return { mimeType: m[1], imageBytes: m[2] };
    }
    if (url.startsWith("http")) {
      const r = await fetch(url);
      if (!r.ok) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      const mime = r.headers.get("content-type") || "image/png";
      return { mimeType: mime, imageBytes: buf.toString("base64") };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a video via Google Veo 3.1. Submits the long-running
 * operation, then polls until done. Returns the final video URI.
 */
export async function generateVideoVeo(input: VeoGenerateInput): Promise<VeoGenerateResult> {
  const ai = getClient();

  // Optional first-frame image — wired through the `image` field per
  // Veo's image-to-video flow.
  let image: { imageBytes: string; mimeType: string } | undefined;
  if (input.referenceImageUrl) {
    const resolved = await resolveImageForVeo(input.referenceImageUrl);
    if (resolved) image = resolved;
  }

  console.log(`[Veo] submitting ${VEO_MODEL} job aspect=${input.aspectRatio} dur=${input.durationSeconds}s ref=${!!image}`);

  let operation = await ai.models.generateVideos({
    model: VEO_MODEL,
    prompt: input.prompt,
    image,
    config: {
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      numberOfVideos: 1,
      personGeneration: "allow_adult",
      negativePrompt: input.negativePrompt,
      generateAudio: input.generateAudio ?? false,
      resolution: input.resolution || "720p",
    },
  });
  const jobId = operation.name || `veo-${Date.now()}`;
  console.log(`[Veo] operation submitted: ${jobId}`);

  // Poll until done. Veo typically lands in 30-90s; max 6 minutes.
  const startedAt = Date.now();
  const maxMs = 6 * 60 * 1000;
  let pollMs = 5_000;
  while (!operation.done) {
    if (Date.now() - startedAt > maxMs) {
      throw new Error(`Veo operation timed out after ${Math.round((Date.now() - startedAt) / 1000)}s (jobId=${jobId})`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
    pollMs = Math.min(pollMs * 1.4, 30_000);
    operation = await ai.operations.getVideosOperation({ operation });
  }

  if (operation.error) {
    const msg = JSON.stringify(operation.error);
    throw new Error(`Veo operation failed: ${msg.slice(0, 500)}`);
  }

  const response = operation.response as {
    generatedVideos?: Array<{
      video?: { videoBytes?: string; gcsUri?: string; uri?: string; mimeType?: string };
    }>;
    raiMediaFilteredCount?: number;
    raiMediaFilteredReasons?: string[];
  } | undefined;

  const first = response?.generatedVideos?.[0]?.video;
  const filteredCount = response?.raiMediaFilteredCount ?? 0;

  if (!first) {
    if (filteredCount > 0) {
      const reasons = response?.raiMediaFilteredReasons?.join("; ") || "no specific reason given";
      throw new Error(
        `Veo Responsible-AI filter blocked the video (jobId=${jobId}, filtered=${filteredCount}, reasons: ${reasons}). Try a less ambiguous prompt or set personGeneration explicitly.`,
      );
    }
    throw new Error(`Veo operation completed but generatedVideos is empty (jobId=${jobId})`);
  }

  // Resolve to a usable URL. Three paths:
  //   1. videoBytes (inline base64) — write to a temp .mp4 and return file path.
  //      Caller uploads to S3 if a public URL is needed.
  //   2. gcsUri — return as-is, caller can fetch via GCS client or signed URL.
  //   3. uri — already an https URL, return as-is.
  let videoUrl: string;
  if (first.videoBytes) {
    const tmpDir = path.join(os.tmpdir(), "fs-veo");
    await mkdir(tmpDir, { recursive: true });
    const filename = `veo-${jobId.split("/").pop()}-${randomUUID().slice(0, 6)}.mp4`;
    const filepath = path.join(tmpDir, filename);
    await writeFile(filepath, Buffer.from(first.videoBytes, "base64"));
    videoUrl = filepath;
    console.log(`[Veo] done — wrote ${first.videoBytes.length} base64 chars to ${filepath}`);
  } else if (first.gcsUri) {
    videoUrl = first.gcsUri;
    console.log(`[Veo] done — gcsUri=${first.gcsUri}`);
  } else if (first.uri) {
    videoUrl = first.uri;
    console.log(`[Veo] done — uri=${first.uri.slice(0, 80)}...`);
  } else {
    throw new Error(
      `Veo operation completed but video has no videoBytes / gcsUri / uri (jobId=${jobId}, fields: ${Object.keys(first).join(",")})`,
    );
  }

  return {
    videoUrl,
    jobId,
    model: VEO_MODEL,
    durationSeconds: input.durationSeconds,
    hasAudio: !!input.generateAudio,
  };
}
