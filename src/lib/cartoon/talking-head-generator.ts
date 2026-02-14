/**
 * Talking Head Generator using SadTalker (local) or D-ID API (cloud fallback)
 *
 * Creates animated talking head videos from:
 * - A character image (portrait/face)
 * - Audio file (TTS narration)
 *
 * Features: lip sync, head movement, eye blinks, facial expressions
 *
 * Priority: SadTalker (local, free) → D-ID API (cloud, paid)
 */

import { spawn } from "child_process";
import { writeFile, mkdir, readFile, access, stat } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { resolveToLocalPath } from "@/lib/utils/s3-client";

const D_ID_API_KEY = process.env.D_ID_API_KEY;
const D_ID_API_URL = "https://api.d-id.com";

// SadTalker configuration
const SADTALKER_PATH = process.env.SADTALKER_PATH || path.resolve(process.cwd(), "..", "SadTalker");
const SADTALKER_SCRIPT = path.join(process.cwd(), "scripts", "sadtalker_generate.py");
const PYTHON_PATH = process.env.SADTALKER_PYTHON_PATH || "python";

export interface TalkingHeadOptions {
  imageUrl: string; // URL or local path to character image
  audioUrl: string; // URL or local path to audio file
  jobId: string;
  sceneNumber: number;
  size?: number; // 256 or 512 (default 256 for speed)
  enhancer?: string; // 'gfpgan' for face enhancement
}

export interface TalkingHeadResult {
  sceneNumber: number;
  videoUrl: string;
  durationMs: number;
}

/**
 * Check if SadTalker is available locally
 */
export function isSadTalkerAvailable(): boolean {
  const checkpointDir = path.join(SADTALKER_PATH, "checkpoints");
  const requiredModel = path.join(checkpointDir, "SadTalker_V0.0.2_256.safetensors");
  return existsSync(SADTALKER_SCRIPT) && existsSync(requiredModel);
}

/**
 * Check if D-ID API is available
 */
export function isDIDAvailable(): boolean {
  return !!D_ID_API_KEY;
}

/**
 * Check if any talking head method is available
 * Set DISABLE_TALKING_HEAD=true to skip lip-sync (e.g. when no GPU available)
 */
export function isTalkingHeadAvailable(): boolean {
  if (process.env.DISABLE_TALKING_HEAD === "true") return false;
  return isSadTalkerAvailable() || isDIDAvailable();
}

/**
 * Create a talking head video using SadTalker (local)
 */
async function createTalkingHeadSadTalker(
  options: TalkingHeadOptions
): Promise<TalkingHeadResult> {
  const { imageUrl, audioUrl, jobId, sceneNumber, size = 256 } = options;

  // Resolve URLs to local file paths
  const imagePath = resolveToLocalPath(imageUrl);
  const audioPath = resolveToLocalPath(audioUrl);

  // Output path
  const outputDir = path.join(process.cwd(), "public", "uploads", "cartoons");
  await mkdir(outputDir, { recursive: true });
  const filename = `${jobId}-talking-${sceneNumber}.mp4`;
  const outputPath = path.join(outputDir, filename);

  console.log(`[SadTalker] Generating talking head for scene ${sceneNumber}...`);
  console.log(`[SadTalker] Image: ${imagePath}`);
  console.log(`[SadTalker] Audio: ${audioPath}`);

  return new Promise((resolve, reject) => {
    const args = [
      SADTALKER_SCRIPT,
      "--image", imagePath,
      "--audio", audioPath,
      "--output", outputPath,
      "--size", String(size),
      "--preprocess", "crop",
      "--batch-size", "1", // Lower batch for CPU
    ];

    if (options.enhancer) {
      args.push("--enhancer", options.enhancer);
    }

    const env = {
      ...process.env,
      SADTALKER_PATH: SADTALKER_PATH,
    };

    const proc = spawn(PYTHON_PATH, args, {
      env,
      windowsHide: true,
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      console.log(`[SadTalker] ${text.trim()}`);
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to start SadTalker: ${err.message}`));
    });

    proc.on("close", async (code) => {
      if (code === 0 && existsSync(outputPath)) {
        // Get video duration from file size estimate (roughly 1MB per 10s of video)
        let durationMs = 10000;
        try {
          const stats = await stat(outputPath);
          durationMs = Math.max(3000, (stats.size / 100000) * 1000);
        } catch {
          // Use default
        }

        console.log(`[SadTalker] Talking head saved: ${filename}`);
        resolve({
          sceneNumber,
          videoUrl: `/uploads/cartoons/${filename}`,
          durationMs,
        });
      } else {
        const errorMsg = stderr || stdout || `SadTalker exited with code ${code}`;
        console.error(`[SadTalker] Error: ${errorMsg.slice(-500)}`);
        reject(new Error(`SadTalker failed: ${errorMsg.slice(-300)}`));
      }
    });
  });
}

/**
 * Create a talking head video using D-ID API (cloud fallback)
 */
async function createTalkingHeadDID(
  options: TalkingHeadOptions
): Promise<TalkingHeadResult> {
  if (!D_ID_API_KEY) {
    throw new Error("D-ID API key not configured. Set D_ID_API_KEY environment variable.");
  }

  const { imageUrl, audioUrl, jobId, sceneNumber } = options;

  // D-ID needs public URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const absoluteImageUrl = imageUrl.startsWith("http") ? imageUrl : `${baseUrl}${imageUrl}`;
  const absoluteAudioUrl = audioUrl.startsWith("http") ? audioUrl : `${baseUrl}${audioUrl}`;

  console.log(`[D-ID] Creating talking head for scene ${sceneNumber}...`);

  // Step 1: Create the talk
  const createResponse = await fetch(`${D_ID_API_URL}/talks`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${D_ID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_url: absoluteImageUrl,
      script: {
        type: "audio",
        audio_url: absoluteAudioUrl,
      },
      config: {
        stitch: true,
        result_format: "mp4",
      },
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`D-ID create talk failed: ${error}`);
  }

  const createData = await createResponse.json();
  const talkId = createData.id;

  // Step 2: Poll for completion
  let result = null;
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const statusResponse = await fetch(`${D_ID_API_URL}/talks/${talkId}`, {
      headers: { "Authorization": `Basic ${D_ID_API_KEY}` },
    });

    if (!statusResponse.ok) continue;

    const statusData = await statusResponse.json();

    if (statusData.status === "done") {
      result = statusData;
      break;
    } else if (statusData.status === "error") {
      throw new Error(`D-ID processing failed: ${statusData.error?.description || "Unknown error"}`);
    }
  }

  if (!result) {
    throw new Error("D-ID processing timed out");
  }

  // Step 3: Download the result video
  const videoUrl = result.result_url;
  const videoResponse = await fetch(videoUrl);
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  const outputDir = path.join(process.cwd(), "public", "uploads", "cartoons");
  await mkdir(outputDir, { recursive: true });

  const filename = `${jobId}-talking-${sceneNumber}.mp4`;
  const filePath = path.join(outputDir, filename);
  await writeFile(filePath, videoBuffer);

  return {
    sceneNumber,
    videoUrl: `/uploads/cartoons/${filename}`,
    durationMs: result.duration ? result.duration * 1000 : 10000,
  };
}

/**
 * Create a talking head video
 * Automatically selects the best available method:
 * 1. SadTalker (local, free) - lip sync, head movement, eye blinks, expressions
 * 2. D-ID API (cloud, paid) - similar features but requires API key
 */
export async function createTalkingHead(
  options: TalkingHeadOptions
): Promise<TalkingHeadResult> {
  // Try SadTalker first (free, local)
  if (isSadTalkerAvailable()) {
    try {
      return await createTalkingHeadSadTalker(options);
    } catch (error) {
      console.error("[SadTalker] Failed, trying D-ID fallback:", error);
    }
  }

  // Fallback to D-ID API
  if (isDIDAvailable()) {
    return await createTalkingHeadDID(options);
  }

  throw new Error("No talking head generator available. Install SadTalker or set D_ID_API_KEY.");
}

/**
 * Create talking head videos for all scenes
 */
export async function createAllTalkingHeads(
  scenes: Array<{
    sceneNumber: number;
    characterImageUrl: string;
    audioUrl: string;
  }>,
  jobId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<TalkingHeadResult[]> {
  if (!isTalkingHeadAvailable()) {
    console.warn("No talking head generator available - scenes will use static images");
    return [];
  }

  const results: TalkingHeadResult[] = [];
  const total = scenes.length;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    try {
      const result = await createTalkingHead({
        imageUrl: scene.characterImageUrl,
        audioUrl: scene.audioUrl,
        jobId,
        sceneNumber: scene.sceneNumber,
      });
      results.push(result);
      onProgress?.(i + 1, total);
    } catch (error) {
      console.error(`Failed to create talking head for scene ${scene.sceneNumber}:`, error);
    }
  }

  return results;
}

/**
 * Ken Burns effect for scenes without talking heads
 */
export function getKenBurnsFilter(sceneIndex: number, duration: number): string {
  const patterns = [
    `zoompan=z='min(zoom+0.001,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
    `zoompan=z='if(lte(zoom,1.0),1.2,max(1.001,zoom-0.001))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
    `zoompan=z=1.1:x='if(lte(on,1),0,min(iw/10,x+1))':y='ih/10'`,
    `zoompan=z=1.1:x='if(lte(on,1),iw/10,max(0,x-1))':y='ih/10'`,
  ];

  return patterns[sceneIndex % patterns.length];
}
