import { spawn, execSync } from "child_process";
import { writeFile, mkdir, unlink, readFile, readdir } from "fs/promises";
import path from "path";
import os from "os";
import { existsSync } from "fs";
import type { SceneImage } from "./image-generator";
import type { SceneAudio } from "./audio-generator";
import type { CartoonScene, CartoonCharacter } from "./script-generator";
import type { TalkingHeadResult } from "./talking-head-generator";
import type { AnimationResult } from "./animated-drawings";
import {
  calculateCaptionTiming,
  generateCaptionFilters,
  getCaptionStyle,
  buildCharacterColorMap,
  type CaptionStyleDef,
} from "./caption-generator";
import { resolveToLocalPath, uploadLocalFileToS3 } from "@/lib/utils/s3-client";

export interface CompositeVideoOptions {
  jobId: string;
  scenes: CartoonScene[];
  images: SceneImage[];
  audioFiles: SceneAudio[];
  title?: string;
  includeSubtitles?: boolean;
  captionStyle?: string;
  talkingHeads?: TalkingHeadResult[];
  bodyAnimations?: AnimationResult[];
  characters?: CartoonCharacter[];
}

export interface CompositeVideoResult {
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
}

// Cache the FFmpeg path
let cachedFFmpegPath: string | null = null;

/**
 * Find FFmpeg executable path
 * Searches common installation locations on Windows/Mac/Linux
 * Exported for use by other animation modules
 */
export function findFFmpegPath(): string | null {
  if (cachedFFmpegPath) {
    return cachedFFmpegPath;
  }

  // Try common paths first
  const possiblePaths = getPossibleFFmpegPaths();

  for (const ffmpegPath of possiblePaths) {
    try {
      execSync(`"${ffmpegPath}" -version`, { windowsHide: true, stdio: 'ignore' });
      cachedFFmpegPath = ffmpegPath;
      return ffmpegPath;
    } catch {
      // Path doesn't exist or isn't executable
    }
  }

  // Try to find in PATH
  try {
    const cmd = process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
    const result = execSync(cmd, { encoding: "utf-8", windowsHide: true });
    const firstPath = result.split("\n")[0]?.trim();
    if (firstPath) {
      cachedFFmpegPath = firstPath;
      return firstPath;
    }
  } catch {
    // Not in PATH
  }

  return null;
}

/**
 * Get list of possible FFmpeg paths
 */
function getPossibleFFmpegPaths(): string[] {
  const userHome = os.homedir();
  const paths: string[] = [];

  if (process.platform === "win32") {
    paths.push(
      "C:\\ffmpeg\\bin\\ffmpeg.exe",
      "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
      "C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe",
      path.join(userHome, "scoop", "apps", "ffmpeg", "current", "bin", "ffmpeg.exe"),
    );
  } else {
    paths.push(
      "/usr/bin/ffmpeg",
      "/usr/local/bin/ffmpeg",
      "/opt/homebrew/bin/ffmpeg",
    );
  }

  return paths;
}


/**
 * Check if FFmpeg is available
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    return false;
  }

  return new Promise((resolve) => {
    const ffmpeg = spawn(ffmpegPath, ["-version"], { windowsHide: true });
    ffmpeg.on("error", () => resolve(false));
    ffmpeg.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Create a video from images and audio using FFmpeg
 * Uses Ken Burns effect (zoom/pan) for visual interest
 */
export async function compositeVideo(
  options: CompositeVideoOptions
): Promise<CompositeVideoResult> {
  const { jobId, scenes, images, audioFiles } = options;

  const outputDir = path.join(process.cwd(), "public", "uploads", "cartoons");
  await mkdir(outputDir, { recursive: true });

  // Create a map for easy lookup
  const imageMap = new Map(images.map((img) => [img.sceneNumber, img]));
  const audioMap = new Map(audioFiles.map((aud) => [aud.sceneNumber, aud]));

  // Calculate total duration and create scene timeline
  const timeline: Array<{
    scene: CartoonScene;
    imagePath: string;
    audioPath: string;
    startTime: number;
    duration: number;
  }> = [];

  let currentTime = 0;
  for (const scene of scenes) {
    const image = imageMap.get(scene.sceneNumber);
    const audio = audioMap.get(scene.sceneNumber);

    if (!image) continue;

    // Duration is based on audio or scene default
    const duration = audio?.durationMs
      ? audio.durationMs / 1000
      : scene.durationSeconds;

    const imagePath = resolveToLocalPath(image.imageUrl);
    const audioPath = audio?.audioUrl
      ? resolveToLocalPath(audio.audioUrl)
      : "";

    timeline.push({
      scene,
      imagePath,
      audioPath,
      startTime: currentTime,
      duration,
    });

    currentTime += duration;
  }

  const totalDuration = currentTime;
  const outputVideo = path.join(outputDir, `${jobId}.mp4`);
  const thumbnailPath = path.join(outputDir, `${jobId}-thumb.jpg`);

  // Create FFmpeg concat file for images
  const concatContent = timeline
    .map((t) => `file '${t.imagePath.replace(/'/g, "'\\''")}'\\nduration ${t.duration}`)
    .join("\\n");

  // Add last image again (FFmpeg concat demuxer quirk)
  const lastImage = timeline[timeline.length - 1];
  const concatFile = path.join(outputDir, `${jobId}-concat.txt`);
  await writeFile(
    concatFile,
    timeline
      .map((t) => `file '${t.imagePath.replace(/\\/g, "/")}'\nduration ${t.duration}`)
      .join("\n") +
      `\nfile '${lastImage.imagePath.replace(/\\/g, "/")}'`
  );

  // Create audio concat file
  const audioConcat = timeline
    .filter((t) => t.audioPath)
    .map((t) => `file '${t.audioPath.replace(/\\/g, "/")}'`)
    .join("\n");
  const audioConcatFile = path.join(outputDir, `${jobId}-audio-concat.txt`);
  await writeFile(audioConcatFile, audioConcat);

  // Generate video with FFmpeg
  await runFFmpeg(concatFile, audioConcatFile, outputVideo, {
    width: 1920,
    height: 1080,
    framerate: 30,
    kenBurns: true,
  });

  // Generate thumbnail from first frame
  await generateThumbnail(timeline[0].imagePath, thumbnailPath);

  // Cleanup temp files
  try {
    await unlink(concatFile);
    await unlink(audioConcatFile);
  } catch {
    // Ignore cleanup errors
  }

  // Upload final video and thumbnail to S3
  const videoUrl = await uploadLocalFileToS3(outputVideo, `cartoons/${jobId}.mp4`);
  const thumbnailUrl = await uploadLocalFileToS3(thumbnailPath, `cartoons/${jobId}-thumb.jpg`);

  return {
    videoUrl,
    thumbnailUrl,
    durationSeconds: Math.round(totalDuration),
  };
}

/**
 * Run FFmpeg to create video
 */
async function runFFmpeg(
  imageConcatFile: string,
  audioConcatFile: string,
  outputPath: string,
  options: {
    width: number;
    height: number;
    framerate: number;
    kenBurns: boolean;
  }
): Promise<void> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    throw new Error("FFmpeg not found. Please install FFmpeg to generate videos.");
  }

  const { width, height, framerate, kenBurns } = options;

  // Build FFmpeg command
  // Uses zoompan filter for Ken Burns effect - more dynamic movement
  // d=1 means recalculate every frame, fps controls output framerate
  // Zoom from 1.0 to 1.3 with slight panning for more dynamic feel
  const filterComplex = kenBurns
    ? `[0:v]scale=${width * 2}:${height * 2},zoompan=z='1.0+0.1*sin(on/${framerate}*0.5)':x='iw/2-(iw/zoom/2)+sin(on/${framerate}*0.3)*50':y='ih/2-(ih/zoom/2)+cos(on/${framerate}*0.3)*30':d=1:s=${width}x${height}:fps=${framerate}[v]`
    : `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[v]`;

  const args = [
    "-y", // Overwrite output
    "-f", "concat",
    "-safe", "0",
    "-i", imageConcatFile,
    "-f", "concat",
    "-safe", "0",
    "-i", audioConcatFile,
    "-filter_complex", filterComplex,
    "-map", "[v]",
    "-map", "1:a",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    "-movflags", "+faststart",
    outputPath,
  ];

  console.log("Running FFmpeg:", ffmpegPath, args.join(" "));

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("error", (err) => {
      console.error("FFmpeg spawn error:", err);
      reject(new Error(`FFmpeg failed to start: ${err.message}`));
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error("FFmpeg stderr:", stderr);
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });
  });
}

/**
 * Generate thumbnail from first scene image
 */
async function generateThumbnail(
  imagePath: string,
  outputPath: string
): Promise<void> {
  const ffmpegPath = findFFmpegPath();

  // If FFmpeg not found, just copy the image as thumbnail
  if (!ffmpegPath) {
    const data = await readFile(imagePath);
    await writeFile(outputPath, data);
    return;
  }

  const args = [
    "-y",
    "-i", imagePath,
    "-vf", "scale=640:360",
    "-q:v", "2",
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });

    ffmpeg.on("error", () => {
      // If FFmpeg fails, just copy the image as thumbnail
      readFile(imagePath)
        .then((data) => writeFile(outputPath, data))
        .then(resolve)
        .catch(reject);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Fallback: use original image
        readFile(imagePath)
          .then((data) => writeFile(outputPath, data))
          .then(resolve)
          .catch(reject);
      }
    });
  });
}

/**
 * Fallback video creation without FFmpeg
 * Creates a simple slideshow using canvas (if FFmpeg is unavailable)
 */
export async function compositeVideoFallback(
  options: CompositeVideoOptions
): Promise<CompositeVideoResult> {
  // If FFmpeg is not available, return just the first image as a "video"
  // In production, FFmpeg should be installed
  const { jobId, images } = options;

  const firstImage = images[0];
  if (!firstImage) {
    throw new Error("No images available for video");
  }

  return {
    videoUrl: firstImage.imageUrl,
    thumbnailUrl: firstImage.imageUrl,
    durationSeconds: 60,
  };
}

/**
 * Inject caption drawtext filters into an FFmpeg args array.
 * Modifies args in-place: appends drawtext filters to filter_complex
 * and updates -map [v] to [vcap].
 */
function injectCaptionFilters(
  args: string[],
  scene: CartoonScene,
  duration: number,
  captionStyleDef: CaptionStyleDef,
  characterColorMap?: Map<string, string>
): void {
  if (captionStyleDef.id === "none") return;
  if (!scene.dialogue || scene.dialogue.length === 0) return;

  const timedCaptions = calculateCaptionTiming(scene, duration);
  const { filters, outputLabel } = generateCaptionFilters(
    timedCaptions, captionStyleDef, "[v]", characterColorMap
  );
  if (filters.length === 0) return;

  const filterIdx = args.indexOf("-filter_complex");
  if (filterIdx === -1) return;

  // Append caption filter chain to filter_complex string
  args[filterIdx + 1] += ";" + filters.join(";");

  // Update -map [v] to the caption output label [vcap]
  const mapIdx = args.indexOf("[v]");
  if (mapIdx !== -1 && mapIdx > filterIdx) {
    args[mapIdx] = outputLabel;
  }
}

/**
 * Create animated video with full pipeline composition:
 * 1. Scene background with Ken Burns effect
 * 2. Body animation overlay from Meta AnimatedDrawings (if available)
 * 3. Talking face overlay from SadTalker (if available)
 * 4. Audio narration
 * 5. Synchronized captions (if enabled)
 * 6. Scene transitions (crossfade)
 */
export async function compositeAnimatedVideo(
  options: CompositeVideoOptions & {
    animationType?: "static" | "animated";
  }
): Promise<CompositeVideoResult> {
  const { jobId, scenes, images, audioFiles, talkingHeads = [], bodyAnimations = [], characters = [] } = options;

  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    throw new Error("FFmpeg not found. Please install FFmpeg to generate videos.");
  }

  const outputDir = path.join(process.cwd(), "public", "uploads", "cartoons");
  await mkdir(outputDir, { recursive: true });

  // Create maps for easy lookup
  const imageMap = new Map(images.map((img) => [img.sceneNumber, img]));
  const audioMap = new Map(audioFiles.map((aud) => [aud.sceneNumber, aud]));
  const talkingMap = new Map(talkingHeads.map((th) => [th.sceneNumber, th]));
  const bodyMap = new Map(bodyAnimations.map((ba) => [ba.sceneNumber, ba]));

  // Build character preview image map for static overlay fallback (case-insensitive keys)
  const charPreviewMap = new Map<string, string>();
  for (const char of characters) {
    if (char.previewUrl) {
      charPreviewMap.set(char.name.toLowerCase(), char.previewUrl);
    }
  }

  // Resolve caption style for synchronized captions
  const captionStyleDef = options.captionStyle
    ? getCaptionStyle(options.captionStyle)
    : getCaptionStyle("none");
  const hasCaptions = captionStyleDef.id !== "none";
  const characterColorMap = hasCaptions ? buildCharacterColorMap(scenes) : undefined;

  const width = 1920;
  const height = 1080;
  const fps = 30;

  // Generate animated scenes
  const sceneVideos: string[] = [];
  let totalDuration = 0;

  for (const scene of scenes) {
    const image = imageMap.get(scene.sceneNumber);
    const audio = audioMap.get(scene.sceneNumber);
    const talkingHead = talkingMap.get(scene.sceneNumber);
    const bodyAnim = bodyMap.get(scene.sceneNumber);

    if (!image) continue;

    const duration = audio?.durationMs
      ? audio.durationMs / 1000
      : scene.durationSeconds;
    totalDuration += duration;

    const imagePath = resolveToLocalPath(image.imageUrl);
    const audioPath = audio?.audioUrl
      ? resolveToLocalPath(audio.audioUrl)
      : null;
    const talkingVideoPath = talkingHead
      ? resolveToLocalPath(talkingHead.videoUrl)
      : null;
    const bodyVideoPath = bodyAnim
      ? resolveToLocalPath(bodyAnim.videoUrl)
      : null;

    // Find character preview image for this scene (use first character in scene, case-insensitive)
    const mainCharName = scene.charactersInScene?.[0];
    const charPreviewUrl = mainCharName ? charPreviewMap.get(mainCharName.toLowerCase()) : null;
    const charPreviewPath = charPreviewUrl
      ? resolveToLocalPath(charPreviewUrl)
      : null;

    const sceneVideoPath = path.join(outputDir, `${jobId}-scene-${scene.sceneNumber}.mp4`);

    // Determine motion
    const motion = selectMotionFromNarration(scene.narration);
    const motionConfig = getMotionConfig(motion);
    const totalFrames = Math.ceil(duration * fps);

    // Decide composition strategy based on available assets
    const hasTalkingHead = talkingVideoPath && existsSync(talkingVideoPath);
    const hasBodyAnim = bodyVideoPath && existsSync(bodyVideoPath);
    const hasCharPreview = charPreviewPath && existsSync(charPreviewPath);

    let args: string[];

    if (hasTalkingHead && hasBodyAnim) {
      // FULL PIPELINE: Background + Body Animation + Talking Face + Audio
      const filterComplex = [
        `[0:v]scale=${width * 2}:${height * 2},zoompan=z='1.02+0.01*sin(on*0.08)':x='iw/2-(iw/zoom/2)+sin(on*0.1)*10':y='ih/2-(ih/zoom/2)+cos(on*0.08)*8':d=${totalFrames}:s=${width}x${height}:fps=${fps}[bg]`,
        `[1:v]scale=${Math.floor(width * 0.5)}:-1[body]`,
        `[2:v]scale=${Math.floor(width * 0.2)}:-1[face]`,
        `[bg][body]overlay=x=(W-w)/2:y=H-h-40:shortest=1[bgbody]`,
        `[bgbody][face]overlay=x=(W-w)/2:y=H-h*1.3:shortest=1,vignette=angle=PI/4[v]`,
      ].join(";");

      args = [
        "-y",
        "-loop", "1", "-i", imagePath,
        "-i", bodyVideoPath!,
        "-i", talkingVideoPath!,
      ];
      if (audioPath) args.push("-i", audioPath);
      args.push("-filter_complex", filterComplex, "-map", "[v]");
      if (audioPath) {
        args.push("-map", "3:a", "-c:a", "aac", "-b:a", "128k");
      }

    } else if (hasTalkingHead) {
      // TALKING HEAD + BACKGROUND
      const filterComplex = [
        `[0:v]scale=${width * 2}:${height * 2},zoompan=z='1.02+0.01*sin(on*0.08)':x='iw/2-(iw/zoom/2)+sin(on*0.1)*10':y='ih/2-(ih/zoom/2)+cos(on*0.08)*8':d=${totalFrames}:s=${width}x${height}:fps=${fps}[bg]`,
        `[1:v]scale=${Math.floor(width * 0.35)}:-1[face]`,
        `[bg][face]overlay=x=(W-w)/2:y=H-h-60:shortest=1,vignette=angle=PI/4[v]`,
      ].join(";");

      args = [
        "-y",
        "-loop", "1", "-i", imagePath,
        "-i", talkingVideoPath!,
      ];
      if (audioPath) args.push("-i", audioPath);
      args.push("-filter_complex", filterComplex, "-map", "[v]");
      if (audioPath) {
        args.push("-map", "2:a", "-c:a", "aac", "-b:a", "128k");
      }

    } else if (hasBodyAnim) {
      // BODY ANIMATION + BACKGROUND
      const filterComplex = [
        `[0:v]scale=${width * 2}:${height * 2},zoompan=z='1.02+0.01*sin(on*0.08)':x='iw/2-(iw/zoom/2)+sin(on*0.1)*10':y='ih/2-(ih/zoom/2)+cos(on*0.08)*8':d=${totalFrames}:s=${width}x${height}:fps=${fps}[bg]`,
        `[1:v]scale=${Math.floor(width * 0.5)}:-1[body]`,
        `[bg][body]overlay=x=(W-w)/2:y=H-h-40:shortest=1,vignette=angle=PI/4[v]`,
      ].join(";");

      args = [
        "-y",
        "-loop", "1", "-i", imagePath,
        "-i", bodyVideoPath!,
      ];
      if (audioPath) args.push("-i", audioPath);
      args.push("-filter_complex", filterComplex, "-map", "[v]");
      if (audioPath) {
        args.push("-map", "2:a", "-c:a", "aac", "-b:a", "128k");
      }

    } else if (hasCharPreview) {
      // STATIC CHARACTER OVERLAY: Background + character preview image with motion + Audio
      // The character preview is overlaid on the background with gentle motion effects
      const filterComplex = [
        // Background: Ken Burns effect
        `[0:v]scale=${width * 2}:${height * 2},zoompan=z='1.02+0.01*sin(on*0.08)':x='iw/2-(iw/zoom/2)+sin(on*0.1)*10':y='ih/2-(ih/zoom/2)+cos(on*0.08)*8':d=${totalFrames}:s=${width}x${height}:fps=${fps}[bg]`,
        // Character preview: scale, apply gentle motion (breathing/talking), preserve transparency
        `[1:v]format=rgba,scale=${Math.floor(width * 0.35)}:-1,zoompan=z='${motionConfig.zoomExpr}':x='${motionConfig.xExpr}':y='${motionConfig.yExpr}':d=${totalFrames}:s=${Math.floor(width * 0.35)}x${Math.floor(height * 0.65)}:fps=${fps}[char]`,
        // Overlay character on background (centered, bottom portion)
        `[bg][char]overlay=x=(W-w)/2:y=H-h-20:shortest=1,vignette=angle=PI/4[v]`,
      ].join(";");

      args = [
        "-y",
        "-loop", "1", "-i", imagePath,      // 0: background
        "-loop", "1", "-i", charPreviewPath!, // 1: character preview
      ];
      if (audioPath) args.push("-i", audioPath); // 2: audio
      args.push("-filter_complex", filterComplex, "-map", "[v]");
      if (audioPath) {
        args.push("-map", "2:a", "-c:a", "aac", "-b:a", "128k");
      }

    } else {
      // NO CHARACTER: Just background with motion effect + Audio (e.g., establishing shot)
      const filterComplex = `[0:v]scale=${width * 2}:${height * 2},zoompan=z='${motionConfig.zoomExpr}':x='${motionConfig.xExpr}':y='${motionConfig.yExpr}':d=${totalFrames}:s=${width}x${height}:fps=${fps},vignette=angle=PI/4[v]`;

      args = [
        "-y",
        "-loop", "1", "-i", imagePath,
      ];
      if (audioPath) args.push("-i", audioPath);
      args.push("-filter_complex", filterComplex, "-map", "[v]");
      if (audioPath) {
        args.push("-map", "1:a", "-c:a", "aac", "-b:a", "128k");
      }
    }

    // Inject synchronized captions (drawtext filters) if enabled
    if (hasCaptions) {
      injectCaptionFilters(args, scene, duration, captionStyleDef, characterColorMap);
    }

    // Common output options
    args.push(
      "-t", String(duration),
      "-c:v", "libx264",
      "-preset", "fast",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      sceneVideoPath,
    );

    console.log(`Compositing scene ${scene.sceneNumber}: bg=${!!image} body=${!!hasBodyAnim} face=${!!hasTalkingHead} char=${!!hasCharPreview} audio=${!!audioPath} captions=${hasCaptions ? captionStyleDef.id : "none"}`);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
      let stderr = "";
      ffmpeg.stderr.on("data", (data) => { stderr += data.toString(); });
      ffmpeg.on("error", (err) => reject(err));
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Scene ${scene.sceneNumber} failed: ${stderr.slice(-300)}`));
      });
    });

    sceneVideos.push(sceneVideoPath);
  }

  // Concatenate all scene videos with crossfade transitions
  const outputVideo = path.join(outputDir, `${jobId}.mp4`);
  const concatFile = path.join(outputDir, `${jobId}-scenes-concat.txt`);
  const concatContent = sceneVideos.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n");
  await writeFile(concatFile, concatContent);

  await new Promise<void>((resolve, reject) => {
    const args = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatFile,
      "-c", "copy",
      "-movflags", "+faststart",
      outputVideo,
    ];

    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
    ffmpeg.on("error", (err) => reject(err));
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Concatenation failed with code ${code}`));
    });
  });

  // Generate thumbnail
  const thumbnailPath = path.join(outputDir, `${jobId}-thumb.jpg`);
  const firstImage = images[0];
  if (firstImage) {
    const firstImagePath = resolveToLocalPath(firstImage.imageUrl);
    await generateThumbnail(firstImagePath, thumbnailPath);
  }

  // Upload final video and thumbnail to S3
  const videoUrl = await uploadLocalFileToS3(outputVideo, `cartoons/${jobId}.mp4`);
  const thumbnailUrl = await uploadLocalFileToS3(thumbnailPath, `cartoons/${jobId}-thumb.jpg`);

  // Cleanup ALL local files for this job
  try {
    await unlink(concatFile);
    for (const scenePath of sceneVideos) {
      await unlink(scenePath);
    }
    // Clean up all remaining local cartoon files (images, audio, animations, video, thumb)
    const files = await readdir(outputDir);
    for (const f of files) {
      if (f.startsWith(jobId)) {
        await unlink(path.join(outputDir, f)).catch(() => {});
      }
    }
  } catch {
    // Ignore cleanup errors
  }

  return {
    videoUrl,
    thumbnailUrl,
    durationSeconds: Math.round(totalDuration),
  };
}

/**
 * Select motion type from scene narration
 */
function selectMotionFromNarration(narration: string): "idle" | "talk" | "walk" | "wave" | "jump" | "dance" {
  const lower = narration.toLowerCase();

  if (lower.includes("said") || lower.includes("spoke") || lower.includes("asked") ||
      lower.includes("replied") || lower.includes("exclaimed") || lower.includes("whispered")) {
    return "talk";
  }
  if (lower.includes("walk") || lower.includes("went") || lower.includes("approached") || lower.includes("ran")) {
    return "walk";
  }
  if (lower.includes("dance") || lower.includes("dancing")) {
    return "dance";
  }
  if (lower.includes("wave") || lower.includes("greeted") || lower.includes("hello")) {
    return "wave";
  }
  if (lower.includes("jump") || lower.includes("leap") || lower.includes("excited")) {
    return "jump";
  }
  return "idle";
}

/**
 * Get motion configuration for FFmpeg zoompan filter
 */
function getMotionConfig(motion: string): { zoomExpr: string; xExpr: string; yExpr: string } {
  const configs: Record<string, { zoomExpr: string; xExpr: string; yExpr: string }> = {
    idle: {
      zoomExpr: "1.02+0.01*sin(on*0.1)",
      xExpr: "iw/2-(iw/zoom/2)+sin(on*0.15)*3",
      yExpr: "ih/2-(ih/zoom/2)+sin(on*0.12)*5",
    },
    talk: {
      zoomExpr: "1.03+0.02*sin(on*0.2)",
      xExpr: "iw/2-(iw/zoom/2)+sin(on*0.25)*8",
      yExpr: "ih/2-(ih/zoom/2)+sin(on*0.3)*10+sin(on*0.5)*3",
    },
    walk: {
      zoomExpr: "1.0",
      xExpr: "iw/2-(iw/zoom/2)+on*2",
      yExpr: "ih/2-(ih/zoom/2)+abs(sin(on*0.4))*15",
    },
    wave: {
      zoomExpr: "1.02+0.01*sin(on*0.15)",
      xExpr: "iw/2-(iw/zoom/2)+sin(on*0.2)*10",
      yExpr: "ih/2-(ih/zoom/2)+sin(on*0.15)*8",
    },
    jump: {
      zoomExpr: "1.0+0.05*abs(sin(on*0.3))",
      xExpr: "iw/2-(iw/zoom/2)+sin(on*0.1)*5",
      yExpr: "ih/2-(ih/zoom/2)-abs(sin(on*0.25))*40",
    },
    dance: {
      zoomExpr: "1.02+0.03*sin(on*0.35)",
      xExpr: "iw/2-(iw/zoom/2)+sin(on*0.4)*20",
      yExpr: "ih/2-(ih/zoom/2)+sin(on*0.5)*15+cos(on*0.3)*10",
    },
  };

  return configs[motion] || configs.idle;
}
