import { spawn } from "child_process";
import { writeFile, unlink, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { uploadLocalFileToS3 } from "@/lib/utils/s3-client";
import {
  generateCaptionFilters,
  getCaptionStyle,
} from "@/lib/cartoon/caption-generator";
import type { TimedCaption } from "@/lib/cartoon/caption-generator";
import type {
  TimelineClip,
  TimelineTrack,
  ExportSettings,
  CaptionSegment,
} from "./types";

export interface ExportInput {
  tracks: TimelineTrack[];
  clips: Record<string, TimelineClip>;
  settings: ExportSettings;
  projectName: string;
}

export interface ExportResult {
  videoUrl: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

type ProgressCallback = (status: string, progress: number) => void;

/**
 * Full export pipeline: compose all timeline tracks into a single video file.
 */
export async function exportVideoProject(
  input: ExportInput,
  onProgress?: ProgressCallback
): Promise<ExportResult> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    throw new Error("FFmpeg not found. Cannot export.");
  }

  const tempDir = join(tmpdir(), `video-export-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    onProgress?.("Downloading media files...", 10);

    // 1. Collect all media clips and download them
    const allClips = Object.values(input.clips);
    const videoClips = allClips.filter(
      (c) => (c.type === "video" || c.type === "image") && c.sourceUrl
    );
    const audioClips = allClips.filter(
      (c) => (c.type === "audio" || c.type === "voiceover") && c.sourceUrl
    );
    const captionClips = allClips.filter(
      (c) => c.type === "caption" && c.captionData
    );

    // Download media to temp files
    const mediaMap = new Map<string, string>(); // clipId -> local path

    for (const clip of [...videoClips, ...audioClips]) {
      const ext = clip.type === "image" ? "png" : clip.type === "audio" || clip.type === "voiceover" ? "mp3" : "mp4";
      const localPath = join(tempDir, `${clip.id}.${ext}`);
      const res = await fetch(clip.sourceUrl);
      if (!res.ok) throw new Error(`Failed to download ${clip.sourceUrl}`);
      await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
      mediaMap.set(clip.id, localPath);
    }

    onProgress?.("Building video composition...", 30);

    // 2. Determine output resolution
    const resMap: Record<string, { w: number; h: number }> = {
      "480p": { w: 854, h: 480 },
      "720p": { w: 1280, h: 720 },
      "1080p": { w: 1920, h: 1080 },
    };
    const { w: outW, h: outH } = resMap[input.settings.resolution] || resMap["720p"];
    const fps = input.settings.fps;

    // 3. Compute total duration
    let totalDuration = 0;
    for (const clip of allClips) {
      const end = clip.startTime + clip.duration;
      if (end > totalDuration) totalDuration = end;
    }
    if (totalDuration <= 0) throw new Error("Nothing to export (no clips)");

    // 4. Build FFmpeg command
    const ffmpegArgs: string[] = [];
    const inputFiles: string[] = [];
    const filterParts: string[] = [];
    let inputIndex = 0;

    // Add a blank video base
    ffmpegArgs.push(
      "-f", "lavfi",
      "-i", `color=c=black:s=${outW}x${outH}:d=${totalDuration}:r=${fps}`,
    );
    const baseIdx = inputIndex++;
    filterParts.push(`[${baseIdx}:v]setpts=PTS-STARTPTS[base]`);

    let lastVideo = "base";
    let overlayCount = 0;

    // Sort video clips by track order then start time
    const sortedVideoClips = videoClips.sort((a, b) => {
      const aTrackIdx = input.tracks.findIndex((t) => t.id === a.trackId);
      const bTrackIdx = input.tracks.findIndex((t) => t.id === b.trackId);
      if (aTrackIdx !== bTrackIdx) return aTrackIdx - bTrackIdx;
      return a.startTime - b.startTime;
    });

    // Add video/image inputs and overlay filters
    for (const clip of sortedVideoClips) {
      const localPath = mediaMap.get(clip.id);
      if (!localPath) continue;

      if (clip.type === "image") {
        ffmpegArgs.push("-loop", "1", "-t", String(clip.duration), "-i", localPath);
      } else {
        ffmpegArgs.push("-i", localPath);
      }

      const idx = inputIndex++;
      const trimmed = `v${idx}trimmed`;
      const scaled = `v${idx}scaled`;
      const outputLabel = `overlay${overlayCount}`;

      // Trim
      filterParts.push(
        `[${idx}:v]trim=start=${clip.trimStart}:duration=${clip.duration},setpts=PTS-STARTPTS[${trimmed}]`
      );

      // Scale to fit output
      filterParts.push(
        `[${trimmed}]scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2[${scaled}]`
      );

      // Overlay at correct time
      filterParts.push(
        `[${lastVideo}][${scaled}]overlay=0:0:enable='between(t,${clip.startTime},${clip.startTime + clip.duration})'[${outputLabel}]`
      );

      lastVideo = outputLabel;
      overlayCount++;
    }

    onProgress?.("Processing audio tracks...", 50);

    // Add audio inputs and mixing
    const audioInputs: { idx: number; clip: TimelineClip }[] = [];
    for (const clip of audioClips) {
      const localPath = mediaMap.get(clip.id);
      if (!localPath) continue;

      ffmpegArgs.push("-i", localPath);
      audioInputs.push({ idx: inputIndex++, clip });
    }

    // Audio mix filter
    let audioLabel = "";
    if (audioInputs.length > 0) {
      const audioDelays: string[] = [];
      for (const { idx, clip } of audioInputs) {
        const delayMs = Math.round(clip.startTime * 1000);
        const label = `a${idx}`;
        filterParts.push(
          `[${idx}:a]atrim=start=${clip.trimStart}:duration=${clip.duration},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},volume=${clip.muted ? 0 : clip.volume}[${label}]`
        );
        audioDelays.push(`[${label}]`);
      }

      if (audioDelays.length === 1) {
        audioLabel = `a${audioInputs[0].idx}`;
      } else {
        filterParts.push(
          `${audioDelays.join("")}amix=inputs=${audioDelays.length}:duration=longest:dropout_transition=0[amixed]`
        );
        audioLabel = "amixed";
      }
    }

    onProgress?.("Adding captions...", 65);

    // 5. Captions - convert to TimedCaption format and generate drawtext filters
    if (captionClips.length > 0 && input.settings.captionStyleId !== "none") {
      const timedCaptions: TimedCaption[] = [];

      for (const clip of captionClips) {
        const data = clip.captionData!;
        for (const segment of data.segments) {
          timedCaptions.push({
            character: "",
            line: segment.text,
            startSeconds: clip.startTime + segment.startTime,
            endSeconds: clip.startTime + segment.endTime,
            wordCount: segment.words.length,
          });
        }
      }

      if (timedCaptions.length > 0) {
        const styleId = input.settings.captionStyleId || "classic";
        const style = getCaptionStyle(styleId);
        if (style) {
          const captionResult = generateCaptionFilters(
            timedCaptions,
            style,
            lastVideo
          );

          if (captionResult.filters.length > 0) {
            filterParts.push(...captionResult.filters);
            lastVideo = captionResult.outputLabel;
          }
        }
      }
    }

    onProgress?.("Encoding final video...", 75);

    // 6. Build final FFmpeg command
    const filterComplex = filterParts.join("; ");
    const outputPath = join(tempDir, `export.${input.settings.format}`);

    ffmpegArgs.push(
      "-filter_complex", filterComplex,
      "-map", `[${lastVideo}]`,
    );

    if (audioLabel) {
      ffmpegArgs.push("-map", `[${audioLabel}]`);
    }

    ffmpegArgs.push(
      "-c:v", "libx264",
      "-preset", input.settings.quality === "draft" ? "ultrafast" : input.settings.quality === "high" ? "slow" : "medium",
      "-crf", input.settings.quality === "high" ? "18" : input.settings.quality === "draft" ? "28" : "23",
      "-r", String(fps),
      "-pix_fmt", "yuv420p",
    );

    if (audioLabel) {
      ffmpegArgs.push("-c:a", "aac", "-b:a", "192k");
    }

    ffmpegArgs.push(
      "-t", String(totalDuration),
      "-y",
      outputPath
    );

    // Run FFmpeg
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath, ffmpegArgs);

      let stderr = "";
      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
        // Parse progress from FFmpeg output
        const timeMatch = data.toString().match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
          const currentSec =
            parseInt(timeMatch[1]) * 3600 +
            parseInt(timeMatch[2]) * 60 +
            parseFloat(timeMatch[3]);
          const pct = Math.min(95, 75 + (currentSec / totalDuration) * 20);
          onProgress?.("Encoding...", pct);
        }
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg failed (code ${code}): ${stderr.slice(-300)}`));
        } else {
          resolve();
        }
      });

      proc.on("error", reject);
    });

    onProgress?.("Uploading...", 95);

    // 7. Upload result
    const key = `video-editor/exports/${input.projectName.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}.${input.settings.format}`;
    const videoUrl = await uploadLocalFileToS3(outputPath, key);

    const { stat } = await import("fs/promises");
    const fileStat = await stat(outputPath);

    onProgress?.("Done!", 100);

    return {
      videoUrl,
      durationSeconds: totalDuration,
      fileSizeBytes: fileStat.size,
    };
  } finally {
    // Cleanup temp dir
    try {
      const { rm } = await import("fs/promises");
      await rm(tempDir, { recursive: true, force: true });
    } catch {}
  }
}
