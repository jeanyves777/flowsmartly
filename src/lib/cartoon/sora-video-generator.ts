import { soraClient, type SoraDuration } from "@/lib/ai/sora-client";
import { resolveToLocalPath, uploadLocalFileToS3 } from "@/lib/utils/s3-client";
import { spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import os from "os";
import type { CartoonScene, CartoonCharacter } from "./script-generator";
import type { SceneAudio } from "./audio-generator";

export interface SoraSceneResult {
  sceneNumber: number;
  /** Local path to the generated MP4 clip */
  localPath: string;
}

export interface SoraVideoResult {
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
}

/**
 * Build a visual prompt for Sora from a scene's data.
 * Includes character descriptions for consistency.
 */
function buildSoraPrompt(
  scene: CartoonScene,
  style: string,
  characters: CartoonCharacter[]
): string {
  // Collect descriptions of characters in this scene
  const sceneCharNames = scene.charactersInScene || [];
  const charDescriptions = sceneCharNames
    .map((name) => {
      const char = characters.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      return char
        ? `${char.name}: ${char.visualAppearance || char.description}`
        : null;
    })
    .filter(Boolean)
    .join(". ");

  // Build dialogue summary for the scene
  const dialogueSummary = (scene.dialogue || [])
    .map((d) => `${d.character} says: "${d.line}"`)
    .join(". ");

  const parts = [
    `Animated ${style} style cartoon scene.`,
    scene.visualDescription,
    charDescriptions ? `Characters: ${charDescriptions}.` : "",
    dialogueSummary
      ? `The characters are talking: ${dialogueSummary}`
      : scene.narration,
    "Smooth animation, cinematic camera work, vibrant colors.",
    "16:9 landscape format.",
  ];

  return parts.filter(Boolean).join(" ");
}

/**
 * Find FFmpeg binary (reused from video-compositor pattern)
 */
function findFFmpegSync(): string {
  const candidates = [
    "ffmpeg",
    "C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe",
    path.join(os.homedir(), "scoop", "shims", "ffmpeg.exe"),
  ];
  for (const c of candidates) {
    try {
      const { execSync } = require("child_process");
      execSync(`"${c}" -version`, { stdio: "ignore", windowsHide: true });
      return c;
    } catch {}
  }
  return "ffmpeg";
}

/**
 * Generate Sora video clips for each scene, then concatenate them
 * with TTS audio into a final video.
 */
export async function generateSoraVideo(options: {
  jobId: string;
  scenes: CartoonScene[];
  characters: CartoonCharacter[];
  audioFiles: SceneAudio[];
  style: string;
  title?: string;
  referenceImagePaths?: string[];
  onProgress?: (step: string, progress: number) => void;
}): Promise<SoraVideoResult> {
  const {
    jobId,
    scenes,
    characters,
    audioFiles,
    style,
    title,
    referenceImagePaths,
    onProgress,
  } = options;

  const tmpDir = path.join(os.tmpdir(), "flowsmartly-sora", jobId);
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  // Use the first reference image for character consistency across all scenes
  const refImagePath =
    referenceImagePaths && referenceImagePaths.length > 0
      ? referenceImagePaths[0]
      : undefined;

  // Determine seconds per scene clip
  // Sora supports '4', '8', or '12' seconds (string values per SDK)
  const getClipDuration = (sceneDuration: number): SoraDuration => {
    if (sceneDuration <= 5) return "4";
    if (sceneDuration <= 10) return "8";
    return "12";
  };

  // Step 1: Generate a Sora video clip for each scene
  const sceneResults: SoraSceneResult[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const prompt = buildSoraPrompt(scene, style, characters);
    const clipDuration = getClipDuration(scene.durationSeconds);

    onProgress?.(
      `Generating Sora video for scene ${i + 1}/${scenes.length}...`,
      10 + Math.round((i / scenes.length) * 50)
    );

    try {
      const result = await soraClient.generateVideo(
        prompt,
        tmpDir,
        `scene-${scene.sceneNumber}.mp4`,
        {
          model: "sora-2",
          seconds: clipDuration,
          size: "1280x720",
          referenceImagePath: refImagePath,
        }
      );

      sceneResults.push({
        sceneNumber: scene.sceneNumber,
        localPath: result.localPath,
      });
    } catch (error) {
      console.error(
        `[Sora] Failed to generate scene ${scene.sceneNumber}:`,
        error
      );
      // Continue with other scenes — we'll work with what we have
    }
  }

  if (sceneResults.length === 0) {
    throw new Error("Sora failed to generate any scene videos");
  }

  onProgress?.("Assembling final video...", 70);

  // Step 2: Concatenate all scene clips and add audio
  const ffmpegPath = findFFmpegSync();
  const outputPath = path.join(tmpDir, `${jobId}-final.mp4`);

  // Create concat file
  const concatFilePath = path.join(tmpDir, "concat.txt");
  const concatContent = sceneResults
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
    .map((r) => `file '${r.localPath.replace(/\\/g, "/")}'`)
    .join("\n");

  const { writeFileSync } = require("fs");
  writeFileSync(concatFilePath, concatContent);

  // Merge all audio files into one track
  const sortedAudio = audioFiles
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  // Build FFmpeg command to concat video clips + overlay audio
  const args: string[] = [];

  // Input: concat demuxer for video clips
  args.push("-f", "concat", "-safe", "0", "-i", concatFilePath);

  // Input: audio files (if available)
  if (sortedAudio.length > 0) {
    // Create a combined audio using concat
    const audioConcatPath = path.join(tmpDir, "audio-concat.txt");
    const audioConcatContent: string[] = [];

    for (const audio of sortedAudio) {
      const localAudioPath = await resolveToLocalPath(audio.audioUrl);
      if (localAudioPath && existsSync(localAudioPath)) {
        audioConcatContent.push(
          `file '${localAudioPath.replace(/\\/g, "/")}'`
        );
      }
    }

    if (audioConcatContent.length > 0) {
      writeFileSync(audioConcatPath, audioConcatContent.join("\n"));
      args.push("-f", "concat", "-safe", "0", "-i", audioConcatPath);
      // Map video from first input, audio from second
      args.push("-map", "0:v", "-map", "1:a", "-shortest");
    }
  }

  // Output settings
  args.push(
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    "-y",
    outputPath
  );

  // Run FFmpeg
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg concat failed (code ${code}): ${stderr.slice(-500)}`));
    });
    proc.on("error", reject);
  });

  onProgress?.("Uploading video...", 90);

  // Step 3: Upload to S3
  const videoFilename = `cartoons/${jobId}-sora.mp4`;
  const videoUrl = await uploadLocalFileToS3(outputPath, videoFilename);

  // Generate thumbnail from the first frame
  const thumbnailPath = path.join(tmpDir, `${jobId}-thumb.jpg`);
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        ffmpegPath,
        ["-i", outputPath, "-vframes", "1", "-q:v", "2", "-y", thumbnailPath],
        { windowsHide: true }
      );
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error("Thumbnail generation failed"));
      });
      proc.on("error", reject);
    });
  } catch {
    // Non-critical: thumbnail generation failure
  }

  let thumbnailUrl = "";
  if (existsSync(thumbnailPath)) {
    thumbnailUrl = await uploadLocalFileToS3(
      thumbnailPath,
      `cartoons/${jobId}-sora-thumb.jpg`
    );
  }

  // Calculate total duration
  const totalDuration = scenes.reduce(
    (sum, s) => sum + s.durationSeconds,
    0
  );

  onProgress?.("Video ready!", 100);

  return {
    videoUrl,
    thumbnailUrl,
    durationSeconds: totalDuration,
  };
}
