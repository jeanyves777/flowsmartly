/**
 * FFmpeg clip builders for the Director stitch. Every scene — an AI/avatar MP4,
 * a reel trim, or a design/media still — is normalised to the film's exact
 * dimensions WITH a guaranteed stereo AAC track, so the heterogeneous provider
 * outputs (Veo/Grok/HeyGen/stills) concatenate into one clean film.
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
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

/**
 * The REAL duration of a rendered clip, in seconds (ffprobe), or null if it
 * can't be read. A provider's clip is rarely the exact length we asked for, and
 * a scene that keeps its PLANNED durationSec gets cut short at stitch time —
 * so the true length has to come from the file, not the request.
 */
export async function probeDurationSec(buf: Buffer): Promise<number | null> {
  const probe = ffprobePath();
  if (!probe) return null;
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-dur-"));
  try {
    const p = path.join(dir, "in.mp4");
    await writeFile(p, buf);
    const out = await new Promise<string>((resolve) => {
      const pr = spawn(probe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", p], { windowsHide: true });
      let s = "";
      pr.stdout.on("data", (d) => (s += d.toString()));
      pr.on("close", () => resolve(s));
      pr.on("error", () => resolve(""));
    });
    const n = parseFloat(out.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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

export type KenBurns = "in" | "out" | "left" | "right" | "none";

/**
 * A still → an N-second clip with a slow Ken Burns move. This is what keeps an
 * image-driven narration from looking like a slideshow.
 *
 * zoompan runs on an upscaled frame: it steps zoom PER OUTPUT FRAME, so zooming a
 * source-sized input makes the pan jitter between whole source pixels. Rendering the
 * move at 2x and scaling down keeps it smooth.
 */
export async function imageToKenBurnsClip(
  imgBuffer: Buffer,
  durationSec: number,
  w: number,
  h: number,
  move: KenBurns = "in",
): Promise<Buffer> {
  if (move === "none") return imageToClip(imgBuffer, durationSec, w, h);
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-kb-"));
  try {
    const inPath = path.join(dir, "img");
    const outPath = path.join(dir, "out.mp4");
    await writeFile(inPath, imgBuffer);
    const dur = Math.max(1, Math.min(30, Math.round(durationSec || 5)));
    const fps = 30;
    const frames = dur * fps;
    const bigW = w * 2, bigH = h * 2;
    const Z = 1.18; // total travel — beyond ~1.2 it reads as a lurch, not a drift

    // zoompan wants zoom as an expression over `on` (output frame number).
    const zIn = `min(1+(${Z - 1})*on/${frames},${Z})`;
    const zOut = `max(${Z}-(${Z - 1})*on/${frames},1)`;
    let zoom = zIn, x = "iw/2-(iw/zoom/2)", y = "ih/2-(ih/zoom/2)";
    if (move === "out") zoom = zOut;
    if (move === "left" || move === "right") {
      zoom = String(Z); // hold the zoom and travel across instead
      const t = `on/${frames}`;
      x = move === "left"
        ? `(iw-iw/zoom)*(1-${t})`
        : `(iw-iw/zoom)*${t}`;
    }
    const vf = [
      `scale=${bigW}:${bigH}:force_original_aspect_ratio=increase`,
      `crop=${bigW}:${bigH}`,
      `zoompan=z='${zoom}':x='${x}':y='${y}':d=${frames}:s=${bigW}x${bigH}:fps=${fps}`,
      `scale=${w}:${h}`,
      "setsar=1",
      "format=yuv420p",
    ].join(",");
    await run(ff, ["-loop", "1", "-i", inPath, ...ANULL, "-t", String(dur),
      "-vf", vf, "-map", "0:v:0", "-map", "1:a:0", "-shortest", ...ENC, outPath]);
    return await readFile(outPath);
  } catch {
    // Motion is a nicety — never lose the shot over it.
    return imageToClip(imgBuffer, durationSec, w, h);
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

export interface TimedMediaLayerSpec {
  kind: "image" | "video";
  x: number;
  y: number;
  width: number;
  opacity: number;
  startSec: number;
  endSec: number;
  volume?: number;
}

/** Composite a freely-positioned image/video layer over the stitched film. */
export async function compositeTimedMedia(
  baseBuf: Buffer,
  mediaBuf: Buffer,
  frameW: number,
  frameH: number,
  spec: TimedMediaLayerSpec,
): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-layer-"));
  try {
    const base = path.join(dir, "base.mp4"), media = path.join(dir, "media"), out = path.join(dir, "out.mp4");
    await writeFile(base, baseBuf); await writeFile(media, mediaBuf);
    const start = Math.max(0, spec.startSec);
    const end = Math.max(start + 0.1, spec.endSec);
    const x = Math.round(Math.max(0, Math.min(0.95, spec.x)) * frameW);
    const y = Math.round(Math.max(0, Math.min(0.95, spec.y)) * frameH);
    const ow = Math.max(24, Math.round(Math.max(0.05, Math.min(1, spec.width)) * frameW));
    const opacity = Math.max(0, Math.min(1, spec.opacity));
    const inputArgs = spec.kind === "image" ? ["-loop", "1", "-i", media] : ["-stream_loop", "-1", "-i", media];
    const mediaVideo = spec.kind === "video"
      ? `[1:v]setpts=PTS-STARTPTS+${start}/TB,scale=${ow}:-1:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=${opacity}[layer]`
      : `[1:v]scale=${ow}:-1:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=${opacity}[layer]`;
    const overlay = `${mediaVideo};[0:v][layer]overlay=${x}:${y}:enable='between(t,${start},${end})':eof_action=pass[v]`;
    const mediaHasAudio = spec.kind === "video" && await hasAudio(media);
    const args = ["-i", base, ...inputArgs];
    if (mediaHasAudio) {
      const delay = Math.round(start * 1000);
      const duration = Math.max(0.1, end - start);
      const volume = Math.max(0, Math.min(2, spec.volume ?? 0.8));
      const audio = `[1:a]atrim=0:${duration},asetpts=PTS-STARTPTS,volume=${volume},adelay=${delay}|${delay}[la];[0:a][la]amix=inputs=2:duration=first:dropout_transition=0[a]`;
      args.push("-filter_complex", `${overlay};${audio}`, "-map", "[v]", "-map", "[a]");
    } else {
      args.push("-filter_complex", overlay, "-map", "[v]", "-map", "0:a?");
    }
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", "-y", out);
    await run(ff, args, 600000);
    return await readFile(out);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

export interface TimedTextLayerSpec {
  text: string;
  x: number | "center";
  y: number | "top" | "middle" | "bottom";
  font: "sans" | "serif" | "display";
  fontSize: number;
  color: string;
  backgroundColor: string;
  opacity: number;
  startSec: number;
  endSec: number;
  boxed?: boolean;
  shadow?: boolean;
}

const ffColor = (value: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(value) ? value.replace("#", "0x") : fallback;
const filterPath = (value: string) => value.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
const composerFont = (font: TimedTextLayerSpec["font"]): { file?: string; family: string } => {
  const bold = font === "display";
  const serif = font === "serif";
  const candidates = process.platform === "win32"
    ? [serif ? "C:\\Windows\\Fonts\\times.ttf" : bold ? "C:\\Windows\\Fonts\\arialbd.ttf" : "C:\\Windows\\Fonts\\arial.ttf"]
    : [
        serif ? "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf" : bold ? "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        serif ? "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf" : bold ? "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" : "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
      ];
  return {
    file: candidates.find((candidate) => existsSync(candidate)),
    family: serif ? "DejaVu Serif" : bold ? "DejaVu Sans Bold" : "DejaVu Sans",
  };
};

/** Burn a timed text/caption layer into the film. Text lives in a temp file so
 * user punctuation never escapes into the FFmpeg filter graph. */
export async function compositeTimedText(baseBuf: Buffer, frameW: number, frameH: number, spec: TimedTextLayerSpec): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-text-"));
  try {
    const base = path.join(dir, "base.mp4"), textPath = path.join(dir, "text.txt"), out = path.join(dir, "out.mp4");
    await writeFile(base, baseBuf); await writeFile(textPath, spec.text, "utf8");
    const font = composerFont(spec.font);
    const size = Math.max(12, Math.min(160, Math.round(spec.fontSize)));
    const x = spec.x === "center" ? "(w-text_w)/2" : String(Math.round(Math.max(0, Math.min(0.95, spec.x)) * frameW));
    const y = spec.y === "top" ? String(Math.round(frameH * 0.08))
      : spec.y === "middle" ? "(h-text_h)/2"
        : spec.y === "bottom" ? "h-text_h-h*0.08" : String(Math.round(Math.max(0, Math.min(0.95, spec.y)) * frameH));
    const start = Math.max(0, spec.startSec), end = Math.max(start + 0.1, spec.endSec);
    const box = spec.boxed === false ? "box=0" : `box=1:boxcolor=${ffColor(spec.backgroundColor, "0x000000")}@${Math.max(0, Math.min(1, spec.opacity * 0.72))}:boxborderw=${Math.max(8, Math.round(size * 0.28))}`;
    const shadow = spec.shadow ? ":shadowcolor=0x000000@0.9:shadowx=3:shadowy=3:borderw=1:bordercolor=0x000000@0.7" : "";
    const fontOption = font.file ? `fontfile='${filterPath(font.file)}'` : `font='${font.family}'`;
    const vf = `drawtext=${fontOption}:textfile='${filterPath(textPath)}':fontcolor=${ffColor(spec.color, "0xffffff")}@${Math.max(0, Math.min(1, spec.opacity))}:fontsize=${size}:line_spacing=${Math.round(size * 0.18)}:x=${x}:y=${y}:${box}${shadow}:enable='between(t,${start},${end})'`;
    await run(ff, ["-i", base, "-vf", vf, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "-y", out], 600000);
    return await readFile(out);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Mix a timed audio layer onto the final film. */
export async function mixTimedAudio(videoBuf: Buffer, audioBuf: Buffer, startSec: number, endSec: number, volume = 0.8): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-dir-audio-layer-"));
  try {
    const video = path.join(dir, "video.mp4"), audio = path.join(dir, "audio"), out = path.join(dir, "out.mp4");
    await writeFile(video, videoBuf); await writeFile(audio, audioBuf);
    const start = Math.max(0, startSec), duration = Math.max(0.1, endSec - start), delay = Math.round(start * 1000);
    const fc = `[1:a]atrim=0:${duration},asetpts=PTS-STARTPTS,volume=${Math.max(0, Math.min(2, volume))},adelay=${delay}|${delay}[extra];[0:a][extra]amix=inputs=2:duration=first:dropout_transition=0[a]`;
    await run(ff, ["-i", video, "-stream_loop", "-1", "-i", audio, "-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", "-y", out], 600000);
    return await readFile(out);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** N seconds of silence — the placeholder for a beat that carries no read. */
export async function silentAudio(seconds: number): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Audio assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-sil-"));
  try {
    const out = path.join(dir, "sil.m4a");
    const dur = Math.max(0.2, Math.round(seconds * 10) / 10);
    await run(ff, [...ANULL, "-t", String(dur), "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2", "-y", out]);
    return await readFile(out);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/**
 * Force a clip to EXACTLY `seconds` at film dims: trimmed if long, last frame held
 * if short. Narrated films depend on this — the narration track is laid out from the
 * shots' holds, so a clip that runs even half a second off would drift the voice out
 * of sync with the picture for the rest of the film.
 */
export async function fitClipTo(vidBuffer: Buffer, w: number, h: number, seconds: number): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-fit-"));
  try {
    const inPath = path.join(dir, "in.mp4"), out = path.join(dir, "out.mp4");
    await writeFile(inPath, vidBuffer);
    const dur = Math.max(0.5, Math.round(seconds * 10) / 10);
    // tpad clones the final frame to reach `dur`; the trailing trim caps a long clip.
    // apad does the same for audio so the muxer can't shorten the result.
    const vf = `${VF(w, h)},tpad=stop_mode=clone:stop_duration=${dur},trim=0:${dur},setpts=PTS-STARTPTS`;
    const af = `apad=whole_dur=${dur},atrim=0:${dur},asetpts=PTS-STARTPTS`;
    await run(ff, ["-i", inPath, ...ANULL, "-filter_complex",
      `[0:v]${vf}[v];[0:a]${af}[a0];[1:a]atrim=0:${dur}[sil];[a0][sil]amix=inputs=2:duration=first:dropout_transition=0[a]`,
      "-map", "[v]", "-map", "[a]", "-t", String(dur), ...ENC, out], 600000);
    return await readFile(out);
  } catch {
    // No audio stream to filter? Re-run treating the source as silent.
    const dir2 = await mkdtemp(path.join(os.tmpdir(), "fs-fit2-"));
    try {
      const inPath = path.join(dir2, "in.mp4"), out = path.join(dir2, "out.mp4");
      await writeFile(inPath, vidBuffer);
      const dur = Math.max(0.5, Math.round(seconds * 10) / 10);
      await run(ff, ["-i", inPath, ...ANULL,
        "-vf", `${VF(w, h)},tpad=stop_mode=clone:stop_duration=${dur},trim=0:${dur},setpts=PTS-STARTPTS`,
        "-map", "0:v:0", "-map", "1:a:0", "-t", String(dur), ...ENC, out], 600000);
      return await readFile(out);
    } finally { await rm(dir2, { recursive: true, force: true }); }
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/**
 * Build ONE continuous narration track from per-shot segments, each padded with
 * silence to exactly its shot's hold. Because the shots are cut (never cross-faded)
 * their durations are additive, so padding each segment to its hold is what keeps
 * the voice locked to the picture for the whole film — no forced alignment needed.
 */
export async function buildNarrationTrack(segments: { buf: Buffer; holdSec: number }[]): Promise<Buffer> {
  if (segments.length === 0) throw new Error("No narration to lay down.");
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Audio assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-narr-"));
  try {
    const out = path.join(dir, "narration.m4a");
    const args: string[] = [];
    const parts: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const p = path.join(dir, `seg${i}`);
      await writeFile(p, segments[i].buf);
      args.push("-i", p);
      // apad to the exact hold, then atrim so a long read can't push the film out of sync.
      const hold = Math.max(0.5, segments[i].holdSec);
      parts.push(`[${i}:a]aresample=44100,apad=whole_dur=${hold},atrim=0:${hold},asetpts=PTS-STARTPTS[s${i}]`);
    }
    const fc = `${parts.join(";")};${segments.map((_, i) => `[s${i}]`).join("")}concat=n=${segments.length}:v=0:a=1[a]`;
    await run(ff, [...args, "-filter_complex", fc, "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-y", out], 600000);
    return await readFile(out);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/**
 * Lay the narration over a finished cut. Whatever audio the shots carry (a
 * generated video's own ambience) is ducked far under so the narrator stays the
 * voice of the film; the picture's length always wins.
 */
export async function narrateOver(videoBuf: Buffer, narrationBuf: Buffer, ambience = 0.1): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "fs-vo-"));
  try {
    const v = path.join(dir, "v.mp4"), a = path.join(dir, "vo"), out = path.join(dir, "out.mp4");
    await writeFile(v, videoBuf); await writeFile(a, narrationBuf);
    // duration=first ⇒ the video's own track governs length, so a short/long read
    // can never truncate or stretch the picture.
    const fc = `[0:a]volume=${Math.max(0, Math.min(1, ambience))}[amb];[1:a]aresample=44100,volume=1.0[vo];[amb][vo]amix=inputs=2:duration=first:dropout_transition=0[a]`;
    await run(ff, ["-i", v, "-i", a, "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", "-y", out], 600000);
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
