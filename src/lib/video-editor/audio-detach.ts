import { spawn } from "child_process";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { uploadLocalFileToS3 } from "@/lib/utils/s3-client";

/**
 * Extract audio from a video file using FFmpeg.
 * Returns the uploaded audio URL and duration.
 */
export async function extractAudioFromVideo(
  videoUrl: string
): Promise<{ audioUrl: string; audioDuration: number }> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    throw new Error("FFmpeg not found. Cannot extract audio.");
  }

  // Download video to temp file
  const tempDir = await mkdtemp(join(tmpdir(), "audio-extract-"));
  const videoPath = join(tempDir, "input.mp4");
  const audioPath = join(tempDir, "output.mp3");

  try {
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error("Failed to download video");
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    await writeFile(videoPath, videoBuffer);

    // Extract audio with FFmpeg
    const duration = await new Promise<number>((resolve, reject) => {
      const proc = spawn(ffmpegPath, [
        "-i", videoPath,
        "-vn",                    // no video
        "-acodec", "libmp3lame",  // MP3 output
        "-q:a", "2",              // quality
        "-y",                     // overwrite
        audioPath,
      ]);

      let stderr = "";
      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          // Check if video has no audio stream
          if (stderr.includes("does not contain any stream") ||
              stderr.includes("Output file is empty")) {
            reject(new Error("Video has no audio stream"));
            return;
          }
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr.slice(-200)}`));
          return;
        }

        // Parse duration from stderr
        const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        let dur = 0;
        if (durationMatch) {
          dur =
            parseInt(durationMatch[1]) * 3600 +
            parseInt(durationMatch[2]) * 60 +
            parseFloat(durationMatch[3]);
        }
        resolve(dur);
      });

      proc.on("error", reject);
    });

    // Upload extracted audio
    const audioUrl = await uploadLocalFileToS3(
      audioPath,
      `video-editor/extracted-audio-${Date.now()}.mp3`
    );

    return { audioUrl, audioDuration: duration };
  } finally {
    // Cleanup
    await unlink(videoPath).catch(() => {});
    await unlink(audioPath).catch(() => {});
    const { rmdir } = await import("fs/promises");
    await rmdir(tempDir).catch(() => {});
  }
}
