import { spawn, execFile } from "child_process";
import { promises as fsp } from "fs";
import os from "os";
import path from "path";
import OpenAI from "openai";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { extractAudioFromVideo } from "@/lib/video-editor/audio-detach";
import { uploadLocalFileToS3 } from "@/lib/utils/s3-client";
import { prisma } from "@/lib/db/client";
import { finalizeCampaignBuild, markReelCampaignStatus } from "./reel-editor";
import type { Transcript } from "./highlights";
import type { ReelClipContent } from "./highlights";

/**
 * reel-pipeline.ts — the real INGEST + RENDER for Reel Studio, reusing the
 * repo's proven ffmpeg + whisper + S3 helpers.
 *
 *  - transcribeVideoUrl(): a source video file → audio (ffmpeg) → whisper
 *    verbose_json → Transcript { segments:[{start,end,text}] }.
 *  - renderReelClip(): cut [start,end] from the source, 9:16 center-crop +
 *    scale to 1080x1920, output mp4 + thumbnail, upload to S3.
 *  - renderCampaignClips(): render every pending clip of a campaign and flip
 *    renderStatus pending→ready (or failed). Detached/fire-and-forget safe.
 *
 * Everything DEGRADES: if ffmpeg is absent (findFFmpegPath()===null) or a step
 * throws, the clip is marked "failed" and the rest of the app is unaffected.
 * ffmpeg + OpenAI whisper + yt-dlp are available on the VPS. URL ingest uses
 * yt-dlp (downloadSourceVideoFromUrl → transcribe → build → render); uploaded
 * files skip the download step.
 */

function runFFmpeg(ffmpegPath: string, args: string[], timeoutMs = 600000): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("Reel render timed out.")); }, timeoutMs);
    proc.stderr.on("data", (c) => { stderr += c.toString(); if (stderr.length > 8000) stderr = stderr.slice(-8000); });
    proc.on("error", (e) => { clearTimeout(timer); reject(e); });
    proc.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Reel render failed (${code}): ${stderr.slice(-600)}`)); });
  });
}

async function downloadToTemp(url: string, ext: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Source download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const p = path.join(os.tmpdir(), `reel-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`);
  await fsp.writeFile(p, buf);
  return p;
}

// ── INGEST: video file → transcript ───────────────────────────────────────────
export async function transcribeVideoUrl(videoUrl: string): Promise<{ transcript: Transcript; durationSec: number }> {
  const { audioUrl, audioDuration } = await extractAudioFromVideo(videoUrl);
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Extracted audio unreachable (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = new File([new Uint8Array(buf)], "audio.mp3", { type: "audio/mpeg" });
  const openai = new OpenAI();
  const tr = await openai.audio.transcriptions.create({ model: "whisper-1", file, response_format: "verbose_json" });
  const segs = (tr as unknown as { segments?: Array<{ start: number; end: number; text: string }> }).segments || [];
  return {
    transcript: { segments: segs.map((s) => ({ start: s.start, end: s.end, text: (s.text || "").trim() })).filter((s) => s.end > s.start && s.text) },
    durationSec: Math.round(audioDuration || 0),
  };
}

// ── Speaker-aware reframe helpers ──────────────────────────────────────────────
function resolvePython(): string {
  return process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
}

/** ffprobe the video's WxH (ffprobe sits next to ffmpeg). null on failure. */
function probeVideoDimensions(ffmpegPath: string, file: string): Promise<{ w: number; h: number } | null> {
  const ffprobe = path.join(path.dirname(ffmpegPath), process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  return new Promise((resolve) => {
    execFile(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file], { timeout: 15000 }, (err, stdout) => {
      const m = err ? null : String(stdout).trim().match(/(\d+)x(\d+)/);
      resolve(m ? { w: Number(m[1]), h: Number(m[2]) } : null);
    });
  });
}

/**
 * Face-detection reframe hint: horizontal centre (0..1) of the dominant speaker
 * across a clip, via scripts/reel-reframe.py (OpenCV). Degrades to 0.5 (centre)
 * on any error / no faces / missing python|opencv.
 */
function computeReframeCenterX(localPath: string, startSec: number, endSec: number): Promise<number> {
  const script = path.join(process.cwd(), "scripts", "reel-reframe.py");
  return new Promise((resolve) => {
    execFile(resolvePython(), [script, localPath, String(startSec), String(endSec)], { timeout: 120000 }, (err, stdout) => {
      if (err) { resolve(0.5); return; }
      try {
        const cx = Number(JSON.parse(String(stdout).trim()).cx);
        resolve(Number.isFinite(cx) && cx >= 0 && cx <= 1 ? cx : 0.5);
      } catch { resolve(0.5); }
    });
  });
}

// ── RENDER: one clip → vertical mp4 + thumb ────────────────────────────────────
export async function renderReelClip(
  sourceUrl: string,
  clip: Pick<ReelClipContent, "id" | "startSec" | "endSec">,
  opts?: { speakerTracking?: boolean },
): Promise<{ renderUrl: string; thumbUrl: string | null }> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) throw new Error("Video rendering is not available on this server (ffmpeg not found).");

  const src = await downloadToTemp(sourceUrl, "mp4");
  const out = src.replace(/\.mp4$/, `-${clip.id}.mp4`);
  const dur = Math.max(1, clip.endSec - clip.startSec);

  // Default: scale-to-cover + centre-crop to 1080x1920 (any aspect; validated).
  let vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1";
  // Speaker-aware reframe for LANDSCAPE sources: follow the dominant face x.
  if (opts?.speakerTracking !== false) {
    try {
      const dims = await probeVideoDimensions(ffmpegPath, src);
      if (dims && dims.w > dims.h * 1.2) {
        const cx = await computeReframeCenterX(src, clip.startSec, clip.endSec);
        const scaledW = Math.round((1920 * dims.w) / dims.h);
        const off = Math.max(0, Math.min(scaledW - 1080, Math.round(cx * scaledW - 540)));
        vf = `scale=-2:1920,crop=1080:1920:${off}:0,setsar=1`;
      }
    } catch { /* keep the centre-crop fallback */ }
  }
  try {
    await runFFmpeg(ffmpegPath, [
      "-ss", String(clip.startSec), "-i", src, "-t", String(dur),
      "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", out,
    ]);
    const key = `reels/${clip.id}-${Date.now()}.mp4`;
    const renderUrl = await uploadLocalFileToS3(out, key);

    let thumbUrl: string | null = null;
    try {
      const thumb = out.replace(/\.mp4$/, ".jpg");
      await runFFmpeg(ffmpegPath, ["-ss", "1", "-i", out, "-frames:v", "1", "-y", thumb], 60000);
      thumbUrl = await uploadLocalFileToS3(thumb, key.replace(/\.mp4$/, ".jpg"));
      await fsp.unlink(thumb).catch(() => {});
    } catch { /* thumbnail is best-effort */ }

    return { renderUrl, thumbUrl };
  } finally {
    await fsp.unlink(src).catch(() => {});
    await fsp.unlink(out).catch(() => {});
  }
}

// ── RENDER orchestrator: render all pending clips of a campaign ────────────────
export async function renderCampaignClips(campaignId: string): Promise<void> {
  const campaign = await prisma.reelCampaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    include: { clips: { where: { renderStatus: "pending" } } },
  });
  if (!campaign) return;
  const sourceUrl = campaign.sourceFileUrl || campaign.sourceUrl;
  if (!sourceUrl) return; // nothing to render from (e.g. a link with no fetched file)
  let speakerTracking = true;
  try { speakerTracking = (JSON.parse(campaign.settings || "{}") as { speakerTracking?: boolean }).speakerTracking !== false; } catch { /* default on */ }

  for (const clip of campaign.clips) {
    try {
      await prisma.reelClip.update({ where: { id: clip.id }, data: { renderStatus: "rendering" } });
      const { renderUrl, thumbUrl } = await renderReelClip(sourceUrl, { id: clip.id, startSec: clip.startSec, endSec: clip.endSec }, { speakerTracking });
      await prisma.reelClip.update({ where: { id: clip.id }, data: { renderStatus: "ready", renderUrl, thumbUrl } });
    } catch (e) {
      await prisma.reelClip.update({ where: { id: clip.id }, data: { renderStatus: "failed" } }).catch(() => {});
      console.error(`[reel-render] clip ${clip.id} failed:`, e instanceof Error ? e.message : e);
    }
  }
}

/** Fire-and-forget render (used after a build). Never throws to the caller. */
export function renderCampaignClipsDetached(campaignId: string): void {
  void renderCampaignClips(campaignId).catch((e) => console.error("[reel-render] campaign failed:", e));
}

// ── INGEST from a URL (yt-dlp) ────────────────────────────────────────────────
function resolveYtDlpPath(): string {
  return process.env.YT_DLP_PATH || "yt-dlp";
}

/**
 * Download a video from a link (YouTube/Vimeo/…) with yt-dlp → S3. yt-dlp uses
 * ffmpeg to merge best video+audio (both present on the VPS). Returns an S3 URL.
 */
export async function downloadSourceVideoFromUrl(url: string): Promise<string> {
  const ytdlp = resolveYtDlpPath();
  const out = path.join(os.tmpdir(), `reel-src-${Date.now()}-${Math.round(Math.random() * 1e6)}.mp4`);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ytdlp, [
      "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
      "--merge-output-format", "mp4",
      "--no-playlist", "--no-warnings", "--quiet",
      "-o", out, url,
    ], { windowsHide: true });
    let err = "";
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("Source download timed out.")); }, 600000);
    proc.stderr.on("data", (c) => { err += c.toString(); if (err.length > 8000) err = err.slice(-8000); });
    proc.on("error", (e) => { clearTimeout(timer); reject(new Error(`yt-dlp not available: ${e instanceof Error ? e.message : e}`)); });
    proc.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`yt-dlp failed (${code}): ${err.slice(-400)}`)); });
  });
  const key = `reels/sources/${Date.now()}-${Math.round(Math.random() * 1e6)}.mp4`;
  const sourceFileUrl = await uploadLocalFileToS3(out, key);
  await fsp.unlink(out).catch(() => {});
  return sourceFileUrl;
}

/**
 * Full URL ingest for a PROCESSING campaign: download → transcribe → build
 * scored clips → render. Updates campaign status. Never throws (marks FAILED).
 */
export async function ingestUrlAndBuild(campaignId: string, url: string): Promise<void> {
  try {
    const sourceFileUrl = await downloadSourceVideoFromUrl(url);
    const { transcript, durationSec } = await transcribeVideoUrl(sourceFileUrl);
    await finalizeCampaignBuild(campaignId, { sourceFileUrl, durationSec, transcript });
    await renderCampaignClips(campaignId);
  } catch (e) {
    await markReelCampaignStatus(campaignId, "FAILED", e instanceof Error ? e.message : "Ingest failed").catch(() => {});
    console.error("[reel-ingest] failed:", e instanceof Error ? e.message : e);
  }
}

export function ingestUrlAndBuildDetached(campaignId: string, url: string): void {
  void ingestUrlAndBuild(campaignId, url).catch((e) => console.error("[reel-ingest]", e));
}
