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
