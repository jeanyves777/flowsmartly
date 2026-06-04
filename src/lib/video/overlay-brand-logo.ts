import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";

const execFileAsync = promisify(execFile);

/**
 * Composite the user's REAL BrandKit logo onto a generated video (top-right
 * watermark, full duration). AI video models misspell rendered brand text
 * (e.g. "FlowSmatly"), so we tell them NOT to draw the brand and stamp the
 * real logo here instead — same principle as the image pipeline.
 *
 * Best-effort: returns the original buffer unchanged if ffmpeg or the logo
 * isn't available, so video generation never fails because of branding.
 */
export async function overlayBrandLogoOnVideo(
  videoBuffer: Buffer,
  logoSource: string,
): Promise<Buffer> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) return videoBuffer;

  const logoBuf = await loadLogoBuffer(logoSource);
  if (!logoBuf) return videoBuffer;

  const tmpDir = path.join(os.tmpdir(), `fs-vlogo-${randomUUID()}`);
  const inPath = path.join(tmpDir, "in.mp4");
  const logoPath = path.join(tmpDir, "logo.png");
  const outPath = path.join(tmpDir, "out.mp4");
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(inPath, videoBuffer);
    fs.writeFileSync(logoPath, logoBuf);

    await execFileAsync(
      ffmpegPath,
      [
        "-i", inPath,
        "-i", logoPath,
        "-filter_complex",
        // Fit the logo inside a 220x110 box (handles wide wordmarks + square
        // icons), then place it top-right with a 24px margin for the whole clip.
        "[1:v]scale=w='min(220,iw)':h='min(110,ih)':force_original_aspect_ratio=decrease,format=rgba[logo];" +
          "[0:v][logo]overlay=W-w-24:24:eof_action=repeat[v]",
        "-map", "[v]",
        "-map", "0:a?", // keep audio if present (Veo has native audio)
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "copy",
        "-movflags", "+faststart",
        "-y",
        outPath,
      ],
      { timeout: 120000 },
    );

    return fs.readFileSync(outPath);
  } catch (err) {
    console.warn("[video-logo] overlay failed; using original video:", err instanceof Error ? err.message : err);
    return videoBuffer;
  } finally {
    try {
      for (const f of fs.readdirSync(tmpDir)) fs.unlinkSync(path.join(tmpDir, f));
      fs.rmdirSync(tmpDir);
    } catch {
      /* ignore */
    }
  }
}

async function loadLogoBuffer(src: string): Promise<Buffer | null> {
  try {
    if (src.startsWith("data:")) {
      const b64 = src.replace(/^data:image\/[^;]+;base64,/, "");
      return b64 ? Buffer.from(b64, "base64") : null;
    }
    if (src.startsWith("http://") || src.startsWith("https://")) {
      const res = await fetch(src);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    if (src.startsWith("/")) {
      const local = path.join(process.cwd(), "public", src);
      if (fs.existsSync(local)) return fs.readFileSync(local);
    }
    if (fs.existsSync(src)) return fs.readFileSync(src);
    return null;
  } catch {
    return null;
  }
}
