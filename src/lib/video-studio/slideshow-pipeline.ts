/**
 * Slideshow Video Pipeline
 *
 * Creates ~45s narrative videos from AI-generated images with voiceover and captions.
 * Pipeline: Claude script → Grok images → OpenAI TTS → FFmpeg composition
 */

import { ai } from "@/lib/ai/client";
import { xaiClient } from "@/lib/ai/xai-client";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { nanoid } from "nanoid";

const execFileAsync = promisify(execFile);

// ─── Types ───────────────────────────────────────────────────────────

export interface SlideshowScene {
  sceneNumber: number;
  narration: string;
  imagePrompt: string;
  caption: string;
}

export interface SlideshowScript {
  scenes: SlideshowScene[];
}

export interface SlideshowImage {
  sceneNumber: number;
  localPath: string;
}

export interface SlideshowOptions {
  scenes: SlideshowScene[];
  images: SlideshowImage[];
  audioBuffer: Buffer;
  resolution: string;
  aspectRatio: string;
  /** Optional brand logo URL/path — shown as animated outro at the end */
  brandLogo?: string | null;
}

// ─── Ken Burns motion variants ───────────────────────────────────────

// Ken Burns motion variants using proper centering formula: iw/2-(iw/zoom/2), ih/2-(ih/zoom/2)
// This keeps the viewport within bounds at all zoom levels
const MOTION_VARIANTS = [
  // Slow zoom in to center
  { z: "1.0+0.3*on/N", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
  // Slow zoom out from center
  { z: "1.3-0.3*on/N", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
  // Pan left to right (zoomed in)
  { z: "1.25", x: "on/N*(iw-iw/zoom)", y: "ih/2-(ih/zoom/2)" },
  // Pan right to left (zoomed in)
  { z: "1.25", x: "(iw-iw/zoom)-on/N*(iw-iw/zoom)", y: "ih/2-(ih/zoom/2)" },
  // Zoom in with gentle sway
  { z: "1.0+0.25*on/N", x: "iw/2-(iw/zoom/2)+sin(on*0.03)*20", y: "ih/2-(ih/zoom/2)+cos(on*0.02)*15" },
  // Breathing zoom oscillation
  { z: "1.1+0.08*sin(on*0.05)", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
  // Diagonal drift while zooming
  { z: "1.05+0.2*on/N", x: "iw/2-(iw/zoom/2)+on/N*30", y: "ih/2-(ih/zoom/2)+on/N*20" },
  // Zoom in with upward tilt
  { z: "1.0+0.25*on/N", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)-on/N*25" },
];

// ─── Script Generation ───────────────────────────────────────────────

/**
 * Generate a structured slideshow script using Claude AI.
 * Returns 6-8 scenes with narration, image prompts, and captions.
 */
export async function generateSlideshowScript(
  userPrompt: string,
  category: string,
  style: string,
  targetDuration: number = 45
): Promise<SlideshowScript> {
  const numScenes = Math.max(5, Math.min(8, Math.round(targetDuration / 6.5)));
  const wordsPerScene = Math.round((targetDuration / numScenes) * 2.8);

  const categoryHints: Record<string, string> = {
    product_ad: "product advertisement with product features and benefits",
    promo: "promotional video with offer details and urgency",
    social_reel: "social media ad that grabs attention fast",
    explainer: "explainer video that educates about a product or service",
    brand_intro: "brand introduction that builds trust and recognition",
    testimonial: "testimonial-style video with social proof",
  };
  const catHint = categoryHints[category] || "marketing video";

  const prompt = `Create a ${numScenes}-scene slideshow script for a ${catHint}.

Topic: ${userPrompt}
Visual style: ${style}
Target duration: ~${targetDuration} seconds

For EACH scene, provide:
1. "narration": The voiceover text (~${wordsPerScene} words). Compelling ad copy.
2. "imagePrompt": Detailed visual description for AI image generation. Describe colors, composition, lighting, objects. Style: ${style}. IMPORTANT: The image must contain absolutely NO text, NO words, NO letters, NO numbers, NO brand names — only pure visual imagery. Think of it as cinematic B-roll footage.
3. "caption": Very short punchy on-screen text (2-5 words max). Only essential keywords or short phrases — NOT full sentences. Examples: "Pure Comfort", "Feel The Difference", "Start Today". Leave captions EMPTY ("") for purely visual scenes where the imagery speaks for itself. At least half the scenes should have empty captions for a cleaner look.

Scene flow: Hook → Problem/Need → Solution → Benefits → Social Proof → Call to Action
Think of this as a premium TV commercial — clean, cinematic, visual-first.

Return ONLY valid JSON:
{
  "scenes": [
    { "sceneNumber": 1, "narration": "...", "imagePrompt": "...", "caption": "..." },
    ...
  ]
}`;

  const result = await ai.generate(prompt, {
    maxTokens: 2000,
    temperature: 0.8,
    systemPrompt:
      "You are an expert video ad scriptwriter. Create compelling slideshow scripts. Return ONLY valid JSON, no markdown fences, no extra text.",
  });

  // Parse JSON — handle potential markdown code fences
  let cleaned = (result || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  let parsed: { scenes: SlideshowScene[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Retry with simpler prompt if JSON parsing fails
    console.warn("[Slideshow] JSON parse failed, retrying with simplified prompt");
    const retry = await ai.generate(
      `Generate exactly ${numScenes} scenes as JSON for a video ad about: ${userPrompt}\n\nReturn ONLY: {"scenes":[{"sceneNumber":1,"narration":"text","imagePrompt":"description","caption":"short text"},...]}\n\nNo markdown, no explanation.`,
      { maxTokens: 2000, temperature: 0.5, systemPrompt: "Return ONLY valid JSON." }
    );
    let retryText = (retry || "").trim();
    if (retryText.startsWith("```")) {
      retryText = retryText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    parsed = JSON.parse(retryText);
  }

  if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error("Script generation returned no scenes");
  }

  console.log(`[Slideshow] Generated script with ${parsed.scenes.length} scenes`);
  return { scenes: parsed.scenes };
}

// ─── Image Generation ────────────────────────────────────────────────

/**
 * Generate images for each scene using Grok image API.
 * Sequential to avoid rate limits. Retries once per failure.
 */
export async function generateSlideshowImages(
  scenes: SlideshowScene[],
  aspectRatio: string,
  onProgress?: (current: number, total: number) => void
): Promise<SlideshowImage[]> {
  const tmpDir = path.join(os.tmpdir(), `slideshow-${nanoid(6)}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const images: SlideshowImage[] = [];
  const grokAR = aspectRatio as "16:9" | "9:16" | "1:1";

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    onProgress?.(i + 1, scenes.length);

    let base64: string | null = null;

    // First attempt
    try {
      base64 = await xaiClient.generateImage(scene.imagePrompt, { aspectRatio: grokAR });
    } catch (err) {
      console.warn(`[Slideshow] Image gen failed for scene ${i + 1}, retrying:`, err);
    }

    // Retry once
    if (!base64) {
      try {
        base64 = await xaiClient.generateImage(scene.imagePrompt, { aspectRatio: grokAR });
      } catch (retryErr) {
        throw new Error(`Failed to generate image for scene ${i + 1} after retry: ${retryErr instanceof Error ? retryErr.message : "Unknown error"}`);
      }
    }

    if (!base64) {
      throw new Error(`Image generation returned empty result for scene ${i + 1}`);
    }

    // Save to temp file
    const imgPath = path.join(tmpDir, `scene-${i + 1}.jpg`);
    fs.writeFileSync(imgPath, Buffer.from(base64, "base64"));

    images.push({ sceneNumber: scene.sceneNumber, localPath: imgPath });
    console.log(`[Slideshow] Image ${i + 1}/${scenes.length} saved: ${imgPath}`);
  }

  return images;
}

// ─── Video Composition ───────────────────────────────────────────────

/**
 * FFmpeg text escaping for drawtext filter.
 * Handles apostrophes, colons, brackets, percent signs.
 */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\u2019")
    .replace(/\u2018/g, "\u2019")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/%/g, "%%")
    .replace(/;/g, "\\;");
}

/**
 * Get bold font path for the current platform.
 */
function getBoldFontPath(): string {
  if (process.platform === "win32") {
    return "C\\:/Windows/Fonts/arialbd.ttf";
  }
  return "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf";
}

/**
 * Get audio duration in seconds using FFprobe.
 */
async function getAudioDuration(audioPath: string): Promise<number> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) throw new Error("FFmpeg not found");

  // ffprobe is typically alongside ffmpeg
  const ffprobeDir = path.dirname(ffmpegPath);
  const ffprobeName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  let ffprobePath = path.join(ffprobeDir, ffprobeName);

  if (!fs.existsSync(ffprobePath)) {
    // Try just "ffprobe" in PATH
    ffprobePath = ffprobeName;
  }

  const { stdout } = await execFileAsync(ffprobePath, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ], { timeout: 10000 });

  return parseFloat(stdout.trim()) || 45;
}

/**
 * Composite a slideshow video from images + audio + captions.
 *
 * Pipeline per scene:
 *   image → scale 2x → zoompan (Ken Burns) → drawtext (caption) → clip
 * Then concat all clips + mix with TTS audio → final MP4
 */
export async function compositeSlideshowVideo(
  options: SlideshowOptions
): Promise<Buffer> {
  const { scenes, images, audioBuffer, resolution, aspectRatio, brandLogo } = options;

  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) throw new Error("FFmpeg not found");

  const tmpDir = path.join(os.tmpdir(), `slideshow-comp-${nanoid(6)}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // Write audio to temp file
  const audioPath = path.join(tmpDir, "voiceover.mp3");
  fs.writeFileSync(audioPath, audioBuffer);

  // Get audio duration to calculate scene timing
  const totalAudioDuration = await getAudioDuration(audioPath);

  // Calculate per-scene duration proportionally by narration word count
  const wordCounts = scenes.map((s) => s.narration.split(/\s+/).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  const sceneDurations = wordCounts.map((wc) =>
    Math.max(3, (wc / totalWords) * totalAudioDuration)
  );

  // Resolution dimensions
  const [width, height] = getResolutionDims(resolution, aspectRatio);
  const fps = 30;
  const fontPath = getBoldFontPath();

  console.log(`[Slideshow] Compositing ${scenes.length} scenes, total duration: ${totalAudioDuration.toFixed(1)}s, resolution: ${width}x${height}`);

  // Generate individual scene clips
  const clipPaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const image = images[i];
    const dur = sceneDurations[i];
    const totalFrames = Math.ceil(dur * fps);
    const clipPath = path.join(tmpDir, `clip-${i}.mp4`);

    // Pick a Ken Burns motion variant (cycle through)
    const motion = MOTION_VARIANTS[i % MOTION_VARIANTS.length];
    // Replace N with total frame count for normalized time
    const zExpr = motion.z.replace(/N/g, String(totalFrames));
    const xExpr = motion.x.replace(/N/g, String(totalFrames));
    const yExpr = motion.y.replace(/N/g, String(totalFrames));

    // Caption text — skip drawtext for empty captions (clean visual scenes)
    const captionText = scene.caption?.trim() ? escapeDrawtext(scene.caption.trim()) : "";
    const hasCaption = captionText.length > 0;

    // Build filter: scale 2x → zoompan → optional drawtext caption
    const captionY = Math.round(height * 0.82);
    const captionSize = Math.max(24, Math.round(height * 0.045));
    const shadowSize = Math.max(2, Math.round(captionSize * 0.08));

    let filterComplex =
      // Scale image to 2x for zoom headroom
      `[0:v]scale=${width * 2}:${height * 2},` +
      // Ken Burns zoompan
      `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${width}x${height}:fps=${fps},` +
      // Ensure pixel format
      `format=yuv420p`;

    if (hasCaption) {
      filterComplex +=
        // Caption: shadow layer
        `,drawtext=fontfile='${fontPath}':text='${captionText}':fontsize=${captionSize}:fontcolor=black@0.6:x=(w-text_w)/2+${shadowSize}:y=${captionY}+${shadowSize}:enable='between(t,0.3,${(dur - 0.3).toFixed(1)})'` +
        // Caption: main white text
        `,drawtext=fontfile='${fontPath}':text='${captionText}':fontsize=${captionSize}:fontcolor=white:x=(w-text_w)/2:y=${captionY}:enable='between(t,0.3,${(dur - 0.3).toFixed(1)})'`;
    }

    filterComplex += `[v]`;

    const args = [
      "-loop", "1",
      "-i", image.localPath,
      "-filter_complex", filterComplex,
      "-map", "[v]",
      "-t", dur.toFixed(2),
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-y",
      clipPath,
    ];

    await execFileAsync(ffmpegPath, args, { timeout: 60000 });
    clipPaths.push(clipPath);
    console.log(`[Slideshow] Scene ${i + 1}/${scenes.length} clip created (${dur.toFixed(1)}s)`);
  }

  // ── Generate logo outro clip if brand logo is provided ──
  const logoDuration = 3.5; // 3.5s logo reveal at the end
  if (brandLogo) {
    try {
      const logoBuffer = await downloadLogo(brandLogo);
      if (logoBuffer) {
        const logoImgPath = path.join(tmpDir, "logo.png");
        fs.writeFileSync(logoImgPath, logoBuffer);

        const logoClipPath = path.join(tmpDir, `clip-logo.mp4`);
        const logoTotalFrames = Math.ceil(logoDuration * fps);
        const logoSize = Math.round(Math.min(width, height) * 0.35);

        // Logo outro: black background, logo fades in + subtle zoom, centered
        await execFileAsync(ffmpegPath, [
          "-f", "lavfi", "-i", `color=c=black:s=${width}x${height}:d=${logoDuration}:r=${fps}`,
          "-i", logoImgPath,
          "-filter_complex",
          `[1:v]scale=${logoSize}:-1,format=rgba[logo];` +
          `[0:v][logo]overlay=(W-w)/2:(H-h)/2:` +
          `enable='gte(t,0.3)'[v];` +
          `[v]fade=t=in:st=0.2:d=1.0,fade=t=out:st=${(logoDuration - 0.5).toFixed(1)}:d=0.5[vout]`,
          "-map", "[vout]",
          "-t", logoDuration.toFixed(2),
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "23",
          "-pix_fmt", "yuv420p",
          "-y",
          logoClipPath,
        ], { timeout: 30000 });

        clipPaths.push(logoClipPath);
        sceneDurations.push(logoDuration);
        console.log(`[Slideshow] Logo outro clip created (${logoDuration}s)`);
      }
    } catch (logoErr) {
      console.warn("[Slideshow] Logo outro generation failed, skipping:", logoErr);
    }
  }

  // Concatenate clips using xfade filter for smooth crossfade transitions
  const xfadeDuration = 0.5; // 0.5s crossfade between scenes
  const XFADE_TRANSITIONS = [
    "fade", "dissolve", "wipeleft", "slideright",
    "circleopen", "fadeblack", "smoothleft", "radial",
  ];

  const concatVideoPath = path.join(tmpDir, "concat.mp4");

  if (clipPaths.length === 1) {
    // Single clip — just copy it
    fs.copyFileSync(clipPaths[0], concatVideoPath);
  } else {
    // Build xfade filter chain: [0][1]xfade→[v01]; [v01][2]xfade→[v012]; ...
    const inputArgs: string[] = [];
    for (const cp of clipPaths) {
      inputArgs.push("-i", cp);
    }

    let filterChain = "";
    let cumulativeOffset = sceneDurations[0] - xfadeDuration;
    let prevLabel = "[0:v]";

    for (let i = 1; i < clipPaths.length; i++) {
      const transition = XFADE_TRANSITIONS[i % XFADE_TRANSITIONS.length];
      const outLabel = i === clipPaths.length - 1 ? "[vout]" : `[v${i}]`;

      filterChain += `${prevLabel}[${i}:v]xfade=transition=${transition}:duration=${xfadeDuration}:offset=${cumulativeOffset.toFixed(2)}${outLabel}`;

      if (i < clipPaths.length - 1) {
        filterChain += ";";
      }

      // Next offset: current offset + next clip duration - crossfade overlap
      cumulativeOffset += sceneDurations[i] - xfadeDuration;
      prevLabel = outLabel;
    }

    await execFileAsync(ffmpegPath, [
      ...inputArgs,
      "-filter_complex", filterChain,
      "-map", "[vout]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-y",
      concatVideoPath,
    ], { timeout: 180000 });
  }

  console.log("[Slideshow] Clips concatenated with xfade transitions");

  // Mix voiceover audio — let the voice finish naturally (no -shortest, no hard cut)
  const audioMixPath = path.join(tmpDir, "with-audio.mp4");
  await execFileAsync(ffmpegPath, [
    "-i", concatVideoPath,
    "-i", audioPath,
    "-map", "0:v",
    "-map", "1:a",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    "-y",
    audioMixPath,
  ], { timeout: 60000 });

  console.log("[Slideshow] Audio mixed");

  // Overlay brand logo throughout the video (top-left watermark)
  const outputPath = path.join(tmpDir, "final.mp4");
  let didLogoOverlay = false;
  if (brandLogo) {
    try {
      const logoBuf = await downloadLogo(brandLogo);
      if (logoBuf) {
        const logoOverlayPath = path.join(tmpDir, "logo-overlay.png");
        fs.writeFileSync(logoOverlayPath, logoBuf);
        const logoSize = Math.max(60, Math.min(Math.round(Math.min(width, height) * 0.18), 200));
        const marginX = Math.round(height * 0.02);
        const marginY = Math.round(height * 0.015);

        await execFileAsync(ffmpegPath, [
          "-i", audioMixPath,
          "-i", logoOverlayPath,
          "-filter_complex",
          `[1:v]scale=${logoSize}:-1,format=rgba[logo];[0:v][logo]overlay=${marginX}:${marginY}:eof_action=repeat[v]`,
          "-map", "[v]",
          "-map", "0:a",
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "23",
          "-c:a", "copy",
          "-movflags", "+faststart",
          "-y",
          outputPath,
        ], { timeout: 120000 });

        didLogoOverlay = true;
        console.log("[Slideshow] Logo overlay composited on final video");
      }
    } catch (logoOverlayErr) {
      console.warn("[Slideshow] Logo overlay failed, continuing without:", logoOverlayErr);
    }
  }

  if (!didLogoOverlay) {
    fs.copyFileSync(audioMixPath, outputPath);
  }

  console.log("[Slideshow] Final video created");

  const outputBuffer = fs.readFileSync(outputPath);

  // Cleanup temp directory
  try {
    const files = fs.readdirSync(tmpDir);
    for (const f of files) {
      try { fs.unlinkSync(path.join(tmpDir, f)); } catch { /* ignore */ }
    }
    fs.rmdirSync(tmpDir);
  } catch { /* ignore */ }

  // Also cleanup image temp dir
  if (images.length > 0) {
    const imgDir = path.dirname(images[0].localPath);
    try {
      const files = fs.readdirSync(imgDir);
      for (const f of files) {
        try { fs.unlinkSync(path.join(imgDir, f)); } catch { /* ignore */ }
      }
      fs.rmdirSync(imgDir);
    } catch { /* ignore */ }
  }

  return outputBuffer;
}

/**
 * Download a logo from URL or local path. Returns a Buffer or null on failure.
 */
async function downloadLogo(logoUrl: string): Promise<Buffer | null> {
  try {
    // Handle data URIs (base64-encoded)
    if (logoUrl.startsWith("data:")) {
      const b64 = logoUrl.replace(/^data:image\/[^;]+;base64,/, "");
      if (!b64) return null;
      return Buffer.from(b64, "base64");
    }

    // Handle local paths (/uploads/..., /characters/...)
    if (logoUrl.startsWith("/uploads/") || logoUrl.startsWith("/characters/") || logoUrl.startsWith("/")) {
      const localPath = path.join(process.cwd(), "public", logoUrl);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
    }

    // Handle HTTP(S) URLs (S3 or external)
    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
      const response = await fetch(logoUrl);
      if (!response.ok) {
        console.warn(`[Slideshow] Logo fetch returned ${response.status}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // Absolute file path
    if (fs.existsSync(logoUrl)) {
      return fs.readFileSync(logoUrl);
    }

    return null;
  } catch (error) {
    console.error("[Slideshow] Failed to download logo:", error);
    return null;
  }
}

/**
 * Get width/height from resolution and aspect ratio.
 */
function getResolutionDims(resolution: string, aspectRatio: string): [number, number] {
  const height = resolution === "720p" ? 720 : 480;

  if (aspectRatio === "9:16") {
    // Portrait
    const width = resolution === "720p" ? 720 : 480;
    const h = resolution === "720p" ? 1280 : 854;
    return [width, h];
  }
  if (aspectRatio === "1:1") {
    return [height, height];
  }
  // Default 16:9
  const width = resolution === "720p" ? 1280 : 854;
  return [width, height];
}
