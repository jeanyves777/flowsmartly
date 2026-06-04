import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";

const execFileAsync = promisify(execFile);

/**
 * Append an ANIMATED brand outro (the user's REAL logo, sliding up + fading in
 * on a brand-color end-card) to a generated video. Every Flow-AI video ends on
 * the brand — a small, consistent value-add.
 *
 * Best-effort: any failure (no ffmpeg, no logo, encode error) returns the
 * original video unchanged, so branding never breaks generation.
 */

type Aspect = "16:9" | "9:16" | "1:1";

function targetDims(aspect: Aspect): { w: number; h: number } {
  if (aspect === "9:16") return { w: 1080, h: 1920 };
  if (aspect === "1:1") return { w: 1080, h: 1080 };
  return { w: 1920, h: 1080 };
}

/** "#0ea5e9" / "0ea5e9" → ffmpeg "0x0ea5e9". Falls back to a deep brand navy. */
function toFfmpegColor(hex?: string | null): string {
  const m = (hex || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(m)) return `0x${m.toLowerCase()}`;
  return "0x0b1220";
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

export interface BrandOutroOptions {
  logoSource: string;
  aspectRatio: Aspect;
  brandColor?: string | null;
  /** Outro length in seconds. Default 2.6. */
  durationSec?: number;
}

/**
 * Returns the video with the outro appended, or the original buffer on any
 * failure. Single ffmpeg pass concatenates via the concat FILTER (scales+pads
 * both segments to a common size) so the content and outro can differ in
 * resolution; content audio is carried for its duration, the outro plays
 * silently — no stream-matching pitfalls.
 */
export async function addBrandOutro(contentBuffer: Buffer, opts: BrandOutroOptions): Promise<Buffer> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) return contentBuffer;

  const logoBuf = await loadLogoBuffer(opts.logoSource);
  if (!logoBuf) return contentBuffer;

  const { w, h } = targetDims(opts.aspectRatio);
  const dur = Math.min(5, Math.max(1.5, opts.durationSec ?? 2.6));
  const bg = toFfmpegColor(opts.brandColor);
  // Logo box ~55% width / 45% height of the card.
  const logoW = Math.round(w * 0.55);
  const logoH = Math.round(h * 0.45);

  const tmpDir = path.join(os.tmpdir(), `fs-outro-${randomUUID()}`);
  const inPath = path.join(tmpDir, "in.mp4");
  const logoPath = path.join(tmpDir, "logo.png");
  const outPath = path.join(tmpDir, "out.mp4");
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(inPath, contentBuffer);
    fs.writeFileSync(logoPath, logoBuf);

    // Inputs: 0 = content, 1 = generated color card, 2 = looped logo.
    const filter =
      // Normalize content to the target frame.
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:-1:-1:color=black,setsar=1,fps=30[v0];` +
      // Animate the logo: scale into a box, fade in, fade out near the end.
      `[2:v]scale=w='min(${logoW},iw)':h='min(${logoH},ih)':force_original_aspect_ratio=decrease,format=rgba,` +
      `fade=in:st=0:d=0.7:alpha=1,fade=out:st=${(dur - 0.6).toFixed(2)}:d=0.6:alpha=1[logo];` +
      // Place it on the card, sliding up ~36px as it fades in.
      `[1:v][logo]overlay=x=(W-w)/2:y='(H-h)/2 + 36*(1-min(t/0.7,1))':format=auto,setsar=1,fps=30[v1];` +
      // Concatenate content → outro (video only).
      `[v0][v1]concat=n=2:v=1:a=0[v]`;

    await execFileAsync(
      ffmpegPath,
      [
        "-i", inPath,
        "-f", "lavfi", "-t", String(dur), "-i", `color=c=${bg}:s=${w}x${h}:r=30`,
        "-loop", "1", "-t", String(dur), "-i", logoPath,
        "-filter_complex", filter,
        "-map", "[v]",
        "-map", "0:a?", // carry the content's audio (if any); outro stays silent
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        "-y", outPath,
      ],
      { timeout: 240000, maxBuffer: 1024 * 1024 * 16 },
    );

    return fs.readFileSync(outPath);
  } catch (err) {
    console.warn("[brand-outro] append failed; using original video:", err instanceof Error ? err.message : err);
    return contentBuffer;
  } finally {
    try {
      for (const f of fs.readdirSync(tmpDir)) fs.unlinkSync(path.join(tmpDir, f));
      fs.rmdirSync(tmpDir);
    } catch {
      /* ignore */
    }
  }
}
