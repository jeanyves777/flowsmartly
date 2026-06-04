import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";

/**
 * Concatenate multiple mp4 video buffers into one, in order. Tries a fast
 * stream copy first (no re-encode), then falls back to a re-encode when the
 * inputs differ in codec/params (Veo vs Grok, mixed resolutions). Returns the
 * combined buffer. Single-input → returned as-is.
 *
 * Extracted from the story-ad pipeline so both it and the long-video composite
 * (generate_video for >8s) share one tested implementation.
 */
export async function concatenateVideoBuffers(buffers: Buffer[]): Promise<Buffer> {
  const clips = buffers.filter((b) => b && b.length > 0);
  if (clips.length === 0) throw new Error("No video clips to concatenate");
  if (clips.length === 1) return clips[0];

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "fs-video-concat-"));
  const outputPath = path.join(tempDir, "final.mp4");
  const listPath = path.join(tempDir, "clips.txt");

  try {
    const clipPaths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clipPath = path.join(tempDir, `clip-${i + 1}.mp4`);
      await writeFile(clipPath, clips[i]);
      clipPaths.push(clipPath);
    }

    const list = clipPaths
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listPath, list);

    try {
      // Fast path — stream copy (works when all inputs share codec/params).
      await runFFmpeg([
        "-f", "concat", "-safe", "0", "-i", listPath,
        "-c", "copy", "-movflags", "+faststart", "-y", outputPath,
      ]);
    } catch {
      // Robust path — re-encode to a common format.
      await runFFmpeg([
        "-f", "concat", "-safe", "0", "-i", listPath,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-y", outputPath,
      ], 900000);
    }

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function runFFmpeg(args: string[], timeoutMs = 600000): Promise<void> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) throw new Error("Video assembly is not available on this server.");

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Video assembly timed out."));
    }, timeoutMs);

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Video assembly failed (${code}): ${stderr.slice(-800)}`));
    });
  });
}
