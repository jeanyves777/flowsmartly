/**
 * Meta Animated Drawings Integration
 *
 * Animates 2D character drawings using Meta's Animated Drawings library.
 * https://github.com/facebookresearch/AnimatedDrawings
 *
 * For production, this requires:
 * 1. A Python environment with AnimatedDrawings installed
 * 2. Or a microservice running the animation API
 *
 * Currently supports:
 * - Local Python script execution (for development)
 * - External API endpoint (for production)
 */

import { spawn, execSync } from "child_process";
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { resolveToLocalPath } from "@/lib/utils/s3-client";

const ANIMATED_DRAWINGS_API = process.env.ANIMATED_DRAWINGS_API_URL;

export interface AnimationOptions {
  characterImageUrl: string; // URL to character image (transparent PNG preferred)
  audioUrl?: string; // Optional audio for timing
  motion: "dance" | "walk" | "wave" | "jump" | "idle" | "talk";
  durationMs: number;
  jobId: string;
  sceneNumber: number;
}

export interface AnimationResult {
  sceneNumber: number;
  videoUrl: string;
  durationMs: number;
}

// Cache the result so we only check once per process
let _animationAvailableCache: boolean | null = null;

/**
 * Check if animation service is available
 * Actually verifies Python + AnimatedDrawings can be imported
 */
export function isAnimationAvailable(): boolean {
  // Check for API first
  if (ANIMATED_DRAWINGS_API) return true;

  // Return cached result if we already checked
  if (_animationAvailableCache !== null) return _animationAvailableCache;

  // Actually verify Python + AnimatedDrawings are installed and importable
  const pythonPath = process.env.ANIMATED_DRAWINGS_PYTHON_PATH || "python";
  try {
    execSync(`"${pythonPath}" -c "from animated_drawings import render"`, {
      windowsHide: true,
      stdio: "ignore",
      timeout: 15000,
    });
    _animationAvailableCache = true;
    console.log("AnimatedDrawings: available (Python import verified)");
    return true;
  } catch {
    _animationAvailableCache = false;
    console.warn("AnimatedDrawings: NOT available (Python import failed)");
    return false;
  }
}

/**
 * Available animation motions
 */
export const ANIMATION_MOTIONS = [
  { id: "idle", name: "Idle", description: "Subtle breathing/movement" },
  { id: "talk", name: "Talking", description: "Character speaking animation" },
  { id: "wave", name: "Wave", description: "Friendly wave gesture" },
  { id: "walk", name: "Walk", description: "Walking in place" },
  { id: "dance", name: "Dance", description: "Dancing movement" },
  { id: "jump", name: "Jump", description: "Jumping animation" },
] as const;

/**
 * Animate a character using Meta Animated Drawings
 */
export async function animateCharacter(
  options: AnimationOptions
): Promise<AnimationResult> {
  // Try external API first
  if (ANIMATED_DRAWINGS_API) {
    return animateViaAPI(options);
  }

  // Use local Python execution (AnimatedDrawings installed via pip)
  return animateViaLocalPython(options);
}

/**
 * Animate via external API endpoint
 */
async function animateViaAPI(options: AnimationOptions): Promise<AnimationResult> {
  const { characterImageUrl, audioUrl, motion, durationMs, jobId, sceneNumber } = options;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const absoluteImageUrl = characterImageUrl.startsWith("http")
    ? characterImageUrl
    : `${baseUrl}${characterImageUrl}`;

  const response = await fetch(`${ANIMATED_DRAWINGS_API}/animate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: absoluteImageUrl,
      audio_url: audioUrl ? (audioUrl.startsWith("http") ? audioUrl : `${baseUrl}${audioUrl}`) : undefined,
      motion,
      duration_ms: durationMs,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Animation API error: ${error}`);
  }

  const data = await response.json();

  // Download the animated video
  const videoResponse = await fetch(data.video_url);
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  // Save locally
  const outputDir = path.join(process.cwd(), "public", "uploads", "cartoons");
  await mkdir(outputDir, { recursive: true });

  const filename = `${jobId}-animated-${sceneNumber}.mp4`;
  const filePath = path.join(outputDir, filename);
  await writeFile(filePath, videoBuffer);

  return {
    sceneNumber,
    videoUrl: `/uploads/cartoons/${filename}`,
    durationMs: data.duration_ms || durationMs,
  };
}

/**
 * Animate via local Python script
 * Requires AnimatedDrawings to be installed locally
 */
async function animateViaLocalPython(options: AnimationOptions): Promise<AnimationResult> {
  const { characterImageUrl, motion, durationMs, jobId, sceneNumber } = options;

  const pythonPath = process.env.ANIMATED_DRAWINGS_PYTHON_PATH || "python";
  const scriptPath = path.join(process.cwd(), "scripts", "animate_character.py");

  const outputDir = path.join(process.cwd(), "public", "uploads", "cartoons");
  await mkdir(outputDir, { recursive: true });

  const inputImagePath = resolveToLocalPath(characterImageUrl);
  const outputVideoPath = path.join(outputDir, `${jobId}-animated-${sceneNumber}.mp4`);

  return new Promise((resolve, reject) => {
    const args = [
      scriptPath,
      "--input", inputImagePath,
      "--output", outputVideoPath,
      "--motion", motion,
      "--duration", String(durationMs / 1000),
    ];

    console.log(`Running animation: ${pythonPath} ${args.join(" ")}`);

    const process = spawn(pythonPath, args, { windowsHide: true });

    let stderr = "";
    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("error", (err) => {
      reject(new Error(`Failed to start animation script: ${err.message}`));
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve({
          sceneNumber,
          videoUrl: `/uploads/cartoons/${jobId}-animated-${sceneNumber}.mp4`,
          durationMs,
        });
      } else {
        reject(new Error(`Animation script failed: ${stderr}`));
      }
    });
  });
}

/**
 * Select the best motion based on scene narration
 */
export function selectMotionForScene(narration: string): typeof ANIMATION_MOTIONS[number]["id"] {
  const lowerNarration = narration.toLowerCase();

  if (lowerNarration.includes("said") || lowerNarration.includes("spoke") || lowerNarration.includes("asked") || lowerNarration.includes("replied")) {
    return "talk";
  }
  if (lowerNarration.includes("walk") || lowerNarration.includes("went") || lowerNarration.includes("approached")) {
    return "walk";
  }
  if (lowerNarration.includes("dance") || lowerNarration.includes("dancing")) {
    return "dance";
  }
  if (lowerNarration.includes("wave") || lowerNarration.includes("greeted") || lowerNarration.includes("hello")) {
    return "wave";
  }
  if (lowerNarration.includes("jump") || lowerNarration.includes("leap") || lowerNarration.includes("excited")) {
    return "jump";
  }

  // Default to idle for subtle movement
  return "idle";
}

/**
 * Animate all characters in a scene
 */
export async function animateSceneCharacters(
  scene: {
    sceneNumber: number;
    narration: string;
    durationSeconds: number;
    charactersInScene?: string[];
  },
  characterImages: Map<string, string>, // name -> imageUrl
  jobId: string,
  onProgress?: (message: string) => void
): Promise<AnimationResult[]> {
  if (!isAnimationAvailable()) {
    console.warn("Animation not available - returning empty results");
    return [];
  }

  const results: AnimationResult[] = [];
  const motion = selectMotionForScene(scene.narration);
  const durationMs = scene.durationSeconds * 1000;

  for (const characterName of scene.charactersInScene || []) {
    // Case-insensitive lookup
    const imageUrl = characterImages.get(characterName) || characterImages.get(characterName.toLowerCase());
    if (!imageUrl) continue;

    try {
      onProgress?.(`Animating ${characterName}...`);
      const result = await animateCharacter({
        characterImageUrl: imageUrl,
        motion,
        durationMs,
        jobId,
        sceneNumber: scene.sceneNumber,
      });
      results.push(result);
    } catch (error) {
      console.error(`Failed to animate ${characterName}:`, error);
    }
  }

  return results;
}
