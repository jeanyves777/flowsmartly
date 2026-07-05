import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";

/**
 * Turn a still image into a vertical YouTube **Short** (MP4).
 *
 * YouTube has no API to create Community/Posts-tab content — the only way to get
 * an image + caption onto a channel programmatically is to upload it as a video.
 * So when a user targets YouTube with an image, we render that image into a
 * 1080×1920 Short (contained over a blurred fill) with a silent audio track and
 * hand the MP4 bytes back for a normal resumable upload.
 *
 * Throws if ffmpeg is unavailable so the caller can report an honest failure
 * (never a fake "Published").
 */
export async function renderImageToShort(
  imageUrl: string,
  opts: { durationSeconds?: number } = {}
): Promise<{ buffer: Buffer; durationSeconds: number }> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    throw new Error(
      "Couldn't render a YouTube Short — the video encoder (ffmpeg) isn't available on the server."
    );
  }

  const duration = Math.min(Math.max(opts.durationSeconds ?? 6, 3), 60);

  // Download the source image.
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Couldn't download the image to turn it into a Short.");
  const imgBuffer = Buffer.from(await res.arrayBuffer());

  const tmpDir = path.join(os.tmpdir(), "fs-shorts");
  await mkdir(tmpDir, { recursive: true });
  const stamp = `${process.pid}-${globalThis.performance?.now?.() ?? ""}-${Math.round(Math.random() * 1e9)}`;
  const inPath = path.join(tmpDir, `short-${stamp}.in`);
  const outPath = path.join(tmpDir, `short-${stamp}.mp4`);
  await writeFile(inPath, imgBuffer);

  // Foreground: fit the whole image inside 1080×1920. Background: the same image
  // scaled to cover and heavily blurred, so portrait/landscape/square all look good.
  const filter =
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:6,eq=brightness=-0.06[bg];" +
    "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];" +
    "[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]";

  const args = [
    "-y",
    "-loop", "1", "-t", String(duration), "-i", inPath,
    // silent stereo audio so the file is valid on every player/platform
    "-f", "lavfi", "-t", String(duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-filter_complex", filter,
    "-map", "[v]", "-map", "1:a",
    "-r", "30",
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k",
    "-shortest", "-movflags", "+faststart",
    outPath,
  ];

  try {
    await new Promise<void>((resolve, reject) => {
      const ff = spawn(ffmpegPath, args, { windowsHide: true });
      let stderr = "";
      ff.stderr.on("data", (d) => { stderr += d.toString(); });
      ff.on("error", (err) => reject(new Error(`ffmpeg failed to start: ${err.message}`)));
      ff.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-400)}`));
      });
    });

    const buffer = await readFile(outPath);
    return { buffer, durationSeconds: duration };
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
