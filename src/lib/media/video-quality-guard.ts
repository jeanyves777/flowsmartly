import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { isBlankImageBuffer } from "./image-quality-guard";

const execFileAsync = promisify(execFile);

export interface BlankVideoCheck {
  blank: boolean;
  reason?: string;
  framesChecked: number;
}

/**
 * Detect a "dead" video: fully black/blank across sampled frames. Video models
 * (Grok / Veo / Sora) sometimes return a decodable-but-black clip on a soft
 * safety block or a glitch — the buffer is non-empty so a `.length` check
 * passes, and the black clip ships (the "Father's Day video came out black"
 * bug). This is the video analogue of isBlankImageBuffer: sample a few frames,
 * run the image blank-detector, and only condemn the clip if EVERY sampled
 * frame is blank (one black transition frame must not fail a good clip).
 *
 * Best-effort: if ffmpeg is unavailable or extraction fails, returns
 * blank=false — never block video delivery on a tooling gap.
 */
export async function isBlankVideoBuffer(videoBuffer: Buffer): Promise<BlankVideoCheck> {
  if (!videoBuffer?.length) return { blank: true, reason: "empty buffer", framesChecked: 0 };

  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) return { blank: false, reason: "ffmpeg unavailable", framesChecked: 0 };

  const tmpDir = path.join(os.tmpdir(), `fs-vguard-${randomUUID()}`);
  const inPath = path.join(tmpDir, "in.mp4");
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(inPath, videoBuffer);

    // Sample frames spread across the clip; skip the very first frame, which is
    // often a legitimate black fade-in. Timestamps past the clip end just yield
    // no frame and are ignored.
    const timestamps = ["0.4", "1.5", "3.0"];
    const frames: Buffer[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const outPath = path.join(tmpDir, `f${i}.png`);
      try {
        await execFileAsync(
          ffmpegPath,
          ["-ss", timestamps[i], "-i", inPath, "-frames:v", "1", "-q:v", "3", "-y", outPath],
          { timeout: 30000 },
        );
        if (fs.existsSync(outPath)) frames.push(fs.readFileSync(outPath));
      } catch {
        /* timestamp past clip end / decode hiccup — skip this sample */
      }
    }
    if (frames.length === 0) return { blank: false, reason: "no frames extracted", framesChecked: 0 };

    const checks = await Promise.all(frames.map((f) => isBlankImageBuffer(f)));
    const blankCount = checks.filter((c) => c.blank).length;
    const blank = blankCount === checks.length;
    return {
      blank,
      reason: blank ? `all ${checks.length} sampled frames blank/black` : undefined,
      framesChecked: checks.length,
    };
  } catch (err) {
    return { blank: false, reason: `guard error: ${err instanceof Error ? err.message : String(err)}`, framesChecked: 0 };
  } finally {
    try {
      for (const f of fs.readdirSync(tmpDir)) fs.unlinkSync(path.join(tmpDir, f));
      fs.rmdirSync(tmpDir);
    } catch {
      /* ignore cleanup errors */
    }
  }
}
