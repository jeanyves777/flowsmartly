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

/**
 * Build a STANDALONE brand-outro clip (color card + animated logo + optional
 * music) — not appended to anything. Used as a real "outro scene" in a reel so
 * it shows as its own card and flows through the normal concat/transitions.
 * Returns null on any failure (no ffmpeg, no logo) so callers can skip it.
 */
export async function buildBrandOutroClip(opts: BrandOutroOptions): Promise<Buffer | null> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    console.warn("[brand-outro] no ffmpeg on PATH");
    return null;
  }
  // Prefer a caller-supplied buffer (fetched via the app's robust downloader);
  // fall back to our own loader for the logoSource string.
  const logoBuf = (opts.logoBuffer && opts.logoBuffer.length ? opts.logoBuffer : null) || (await loadLogoBuffer(opts.logoSource));
  if (!logoBuf) {
    console.warn("[brand-outro] could not load logo from:", String(opts.logoSource).slice(0, 120));
    return null;
  }

  const { w, h } = targetDims(opts.aspectRatio);
  const dur = Math.min(6, Math.max(2, opts.durationSec ?? 3));
  const bg = toFfmpegColor(opts.brandColor);
  const logoW = Math.round(w * 0.55);
  const logoH = Math.round(h * 0.45);
  const hasMusic = !!(opts.musicBuffer && opts.musicBuffer.length);

  const tmpDir = path.join(os.tmpdir(), `fs-outroclip-${randomUUID()}`);
  const logoPath = path.join(tmpDir, "logo.png");
  const musicPath = path.join(tmpDir, `music.${(opts.musicExt || "wav").replace(/[^a-z0-9]/gi, "") || "wav"}`);
  const outPath = path.join(tmpDir, "outro.mp4");
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(logoPath, logoBuf);
    if (hasMusic) fs.writeFileSync(musicPath, opts.musicBuffer as Buffer);

    const videoFilter =
      `[1:v]scale=w='min(${logoW},iw)':h='min(${logoH},ih)':force_original_aspect_ratio=decrease,format=rgba,` +
      `fade=in:st=0:d=0.7:alpha=1,fade=out:st=${(dur - 0.6).toFixed(2)}:d=0.6:alpha=1[logo];` +
      `[0:v][logo]overlay=x=(W-w)/2:y='(H-h)/2 + 36*(1-min(t/0.7,1))':format=auto,setsar=1,fps=30[v]`;

    const args = [
      "-f", "lavfi", "-t", String(dur), "-i", `color=c=${bg}:s=${w}x${h}:r=30`,
      "-loop", "1", "-t", String(dur), "-i", logoPath,
      ...(hasMusic ? ["-i", musicPath] : ["-f", "lavfi", "-t", String(dur), "-i", "anullsrc=r=48000:cl=stereo"]),
      "-filter_complex",
      hasMusic
        ? `${videoFilter};[2:a]atrim=0:${dur.toFixed(2)},asetpts=PTS-STARTPTS,afade=in:st=0:d=0.5,afade=out:st=${(dur - 0.7).toFixed(2)}:d=0.7,volume=0.8,aformat=sample_rates=48000:channel_layouts=stereo[a]`
        : videoFilter,
      "-map", "[v]",
      "-map", hasMusic ? "[a]" : "2:a",
      "-t", String(dur),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k",
      "-movflags", "+faststart",
      "-y", outPath,
    ];
    await execFileAsync(ffmpegPath, args, { timeout: 180000, maxBuffer: 1024 * 1024 * 16 });
    return fs.readFileSync(outPath);
  } catch (err) {
    console.warn("[brand-outro] standalone clip failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    try {
      for (const f of fs.readdirSync(tmpDir)) fs.unlinkSync(path.join(tmpDir, f));
      fs.rmdirSync(tmpDir);
    } catch {
      /* ignore */
    }
  }
}

export interface BrandOutroOptions {
  logoSource: string;
  aspectRatio: Aspect;
  brandColor?: string | null;
  /** Outro length in seconds. Default 2.6. */
  durationSec?: number;
  /** Optional music played over the outro segment (e.g. a Lyria sting). */
  musicBuffer?: Buffer | null;
  /** File extension for the music buffer (default "wav"). */
  musicExt?: string;
  /** Pre-fetched logo bytes (preferred over re-loading logoSource). */
  logoBuffer?: Buffer | null;
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
  const musicPath = path.join(tmpDir, `music.${(opts.musicExt || "wav").replace(/[^a-z0-9]/gi, "") || "wav"}`);
  const outPath = path.join(tmpDir, "out.mp4");
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(inPath, contentBuffer);
    fs.writeFileSync(logoPath, logoBuf);
    const hasMusic = !!(opts.musicBuffer && opts.musicBuffer.length);
    if (hasMusic) fs.writeFileSync(musicPath, opts.musicBuffer as Buffer);

    const videoFilter =
      // Normalize content to the target frame.
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:-1:-1:color=black,setsar=1,fps=30[v0];` +
      // Animate the logo: scale into a box, fade in, fade out near the end.
      `[2:v]scale=w='min(${logoW},iw)':h='min(${logoH},ih)':force_original_aspect_ratio=decrease,format=rgba,` +
      `fade=in:st=0:d=0.7:alpha=1,fade=out:st=${(dur - 0.6).toFixed(2)}:d=0.6:alpha=1[logo];` +
      // Place it on the card, sliding up ~36px as it fades in.
      `[1:v][logo]overlay=x=(W-w)/2:y='(H-h)/2 + 36*(1-min(t/0.7,1))':format=auto,setsar=1,fps=30[v1];` +
      // Concatenate content → outro (video only).
      `[v0][v1]concat=n=2:v=1:a=0[v]`;

    // With music: keep the content's own audio, then play the music over the
    // outro segment (content audio + outro music, concatenated). If the content
    // has no audio stream this graph errors and we fall back to the original.
    const audioFilter = hasMusic
      ? `;[0:a]aformat=sample_rates=44100:channel_layouts=stereo[ac];` +
        `[3:a]atrim=0:${dur.toFixed(2)},asetpts=PTS-STARTPTS,` +
        `afade=in:st=0:d=0.5,afade=out:st=${(dur - 0.7).toFixed(2)}:d=0.7,volume=0.7,` +
        `aformat=sample_rates=44100:channel_layouts=stereo[am];` +
        `[ac][am]concat=n=2:v=0:a=1[aout]`
      : "";

    const args = [
      "-i", inPath,
      "-f", "lavfi", "-t", String(dur), "-i", `color=c=${bg}:s=${w}x${h}:r=30`,
      "-loop", "1", "-t", String(dur), "-i", logoPath,
      ...(hasMusic ? ["-i", musicPath] : []),
      "-filter_complex", videoFilter + audioFilter,
      "-map", "[v]",
      ...(hasMusic ? ["-map", "[aout]"] : ["-map", "0:a?"]),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k",
      "-movflags", "+faststart",
      "-y", outPath,
    ];

    try {
      await execFileAsync(ffmpegPath, args, { timeout: 240000, maxBuffer: 1024 * 1024 * 16 });
    } catch (err) {
      // Music graph can fail if the content has no audio stream — retry the
      // silent-outro path so we still get the branded end-card.
      if (hasMusic) {
        const silentArgs = [
          "-i", inPath,
          "-f", "lavfi", "-t", String(dur), "-i", `color=c=${bg}:s=${w}x${h}:r=30`,
          "-loop", "1", "-t", String(dur), "-i", logoPath,
          "-filter_complex", videoFilter,
          "-map", "[v]",
          "-map", "0:a?",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart",
          "-y", outPath,
        ];
        await execFileAsync(ffmpegPath, silentArgs, { timeout: 240000, maxBuffer: 1024 * 1024 * 16 });
      } else {
        throw err;
      }
    }

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
