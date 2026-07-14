/**
 * FFmpeg clip builders for the Director stitch. Every scene — an AI/avatar MP4,
 * a reel trim, or a design/media still — is normalised to the film's exact
 * dimensions WITH a guaranteed stereo AAC track, so the heterogeneous provider
 * outputs (Veo/Grok/HeyGen/stills) concatenate into one clean film.
 */

import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import type { FilmAspect } from "./types";

export function filmDims(aspect: FilmAspect): { w: number; h: number } {
  return aspect === "16:9" ? { w: 1280, h: 720 } : aspect === "1:1" ? { w: 1080, h: 1080 } : { w: 720, h: 1280 };
}

function ffprobePath(): string | null {
  const ff = findFFmpegPath();
  if (!ff) return null;
  return ff.replace(/ffmpeg(\.exe)?$/i, (m) => (/\.exe$/i.test(m) ? "ffprobe.exe" : "ffprobe"));
}

function run(cmd: string, args: string[], timeoutMs = 300000): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("ffmpeg timed out")); }, timeoutMs);
    proc.stderr.on("data", (c) => { stderr += c.toString(); if (stderr.length > 8000) stderr = stderr.slice(-8000); });
    proc.on("error", (e) => { clearTimeout(timer); reject(e); });
    proc.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-600)}`)); });
  });
}

function hasAudio(filePath: string): Promise<boolean> {
  const probe = ffprobePath();
  if (!probe) return Promise.resolve(false);
  return new Promise((resolve) => {
    const p = spawn(probe, ["-i", filePath, "-show_streams", "-select_streams", "a", "-loglevel", "error"], { windowsHide: true });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("close", () => resolve(out.trim().length > 0));
    p.on("error", () => resolve(false));
  });
}

const VF = (w: number, h: number) =>
  `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`;
const ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", "-y"];
const ANULL = ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];

/** A still image → an N-second clip at film dims with a silent audio track. */
export async function imageToClip(imgBuffer: Buffer, durationSec: number, w: number, h: number): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-img-"));
  try {
    const inPath = path.join(dir, "img");
    const outPath = path.join(dir, "out.mp4");
    await writeFile(inPath, imgBuffer);
    const dur = Math.max(1, Math.min(30, Math.round(durationSec || 3)));
    await run(ff, ["-loop", "1", "-i", inPath, ...ANULL, "-t", String(dur),
      "-vf", VF(w, h), "-map", "0:v:0", "-map", "1:a:0", "-shortest", ...ENC, outPath]);
    return await readFile(outPath);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Map a Director transition name to an ffmpeg xfade transition. */
export function xfadeName(t?: string): string {
  switch (t) {
    case "dissolve": return "dissolve";
    case "slide": return "slideleft";
    case "crossfade": return "fade";
    default: return "fade";
  }
}

/**
 * Cross-fade clip B onto clip A (both already normalised to WxH + audio).
 * `durA` is A's running duration; the transition overlaps by `d` seconds. Used
 * to build a film with transitions pairwise (robust vs one giant xfade graph).
 */
export async function crossfadePair(aBuf: Buffer, bBuf: Buffer, durA: number, d: number, transition: string): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-xf-"));
  try {
    const a = path.join(dir, "a.mp4"), b = path.join(dir, "b.mp4"), out = path.join(dir, "out.mp4");
    await writeFile(a, aBuf); await writeFile(b, bBuf);
    const off = Math.max(0.1, durA - d);
    const fc = `[0:v][1:v]xfade=transition=${transition}:duration=${d}:offset=${off}[v];[0:a][1:a]acrossfade=d=${d}[a]`;
    await run(ff, ["-i", a, "-i", b, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", out], 600000);
    return await readFile(out);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/**
 * Composite a PiP overlay clip onto a base clip (both any dimensions). The overlay
 * is scaled to `scale` of the base width and placed in a corner with a margin. If
 * the overlay has audio (an avatar VO), it's mixed over a ducked base; otherwise
 * the base audio is kept. Base length wins.
 */
export async function compositeOverlay(
  baseBuf: Buffer,
  overlayBuf: Buffer,
  corner: "tl" | "tr" | "bl" | "br",
  scale: number,
  margin = 28,
): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-pip-"));
  try {
    const base = path.join(dir, "base.mp4"), ov = path.join(dir, "ov.mp4"), out = path.join(dir, "out.mp4");
    await writeFile(base, baseBuf); await writeFile(ov, overlayBuf);
    const s = Math.max(0.15, Math.min(0.5, scale));
    const x = corner === "tr" || corner === "br" ? `main_w-overlay_w-${margin}` : `${margin}`;
    const y = corner === "bl" || corner === "br" ? `main_h-overlay_h-${margin}` : `${margin}`;
    const ovHasAudio = await hasAudio(ov);
    const vfilter = `[1:v]scale=iw*${s}:-1:force_original_aspect_ratio=decrease,format=yuv420p[ov];[0:v][ov]overlay=${x}:${y}[v]`;
    const args = ["-i", base, "-i", ov];
    if (ovHasAudio) {
      // presenter VO over a ducked base bed
      args.push("-filter_complex", `${vfilter};[0:a]volume=0.4[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[a]`, "-map", "[v]", "-map", "[a]");
    } else {
      args.push("-filter_complex", vfilter, "-map", "[v]", "-map", "0:a?");
    }
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", out);
    await run(ff, args, 600000);
    return await readFile(out);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Mix a music bed under a finished film (looped, ducked); film length wins. */
export async function mixMusicUnder(videoBuf: Buffer, musicBuf: Buffer, volume = 0.28): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-mus-"));
  try {
    const v = path.join(dir, "v.mp4"), m = path.join(dir, "m"), out = path.join(dir, "out.mp4");
    await writeFile(v, videoBuf); await writeFile(m, musicBuf);
    const fc = `[1:a]volume=${volume},aloop=loop=-1:size=2000000000[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0[a]`;
    await run(ff, ["-i", v, "-i", m, "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", "-y", out], 600000);
    return await readFile(out);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/**
 * Normalise a source video to film dims + a guaranteed stereo AAC track.
 * `preferSourceAudio` keeps the clip's own audio (AI/avatar VO) when present,
 * else falls back to silence; `trim` cuts [start,end] first (reel clips).
 */
export async function normalizeClip(
  vidBuffer: Buffer,
  w: number,
  h: number,
  opts: { preferSourceAudio?: boolean; trim?: { start: number; end: number } } = {},
): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-norm-"));
  try {
    const inPath = path.join(dir, "in.mp4");
    const outPath = path.join(dir, "out.mp4");
    await writeFile(inPath, vidBuffer);

    const trimArgs: string[] = [];
    if (opts.trim && opts.trim.end > opts.trim.start) {
      trimArgs.push("-ss", String(Math.max(0, opts.trim.start)), "-to", String(opts.trim.end));
    }
    const keep = opts.preferSourceAudio && (await hasAudio(inPath));
    if (keep) {
      // source video + its own audio
      await run(ff, [...trimArgs, "-i", inPath, "-vf", VF(w, h), "-map", "0:v:0", "-map", "0:a:0?", ...ENC, outPath]);
    } else {
      // source video + a fresh silent track (uniform audio for a clean concat)
      await run(ff, [...trimArgs, "-i", inPath, ...ANULL, "-vf", VF(w, h), "-map", "0:v:0", "-map", "1:a:0", "-shortest", ...ENC, outPath]);
    }
    return await readFile(outPath);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Keep xAI's edited picture but restore the exact source audio/dialogue. Video
 * editing is used for visual corrections, so approved speech must not drift. */
export async function preserveSourceAudio(editedVideo: Buffer, sourceVideo: Buffer): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) return editedVideo;
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-edit-aud-"));
  try {
    const edited = path.join(dir, "edited.mp4");
    const source = path.join(dir, "source.mp4");
    const out = path.join(dir, "out.mp4");
    await writeFile(edited, editedVideo);
    await writeFile(source, sourceVideo);
    if (!(await hasAudio(source))) return editedVideo;
    await run(ff, [
      "-i", edited, "-i", source,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
      "-shortest", "-movflags", "+faststart", "-y", out,
    ]);
    return await readFile(out);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
