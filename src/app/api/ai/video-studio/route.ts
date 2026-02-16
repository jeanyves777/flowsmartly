import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { veoClient } from "@/lib/ai/veo-client";
import { xaiClient } from "@/lib/ai/xai-client";
import { ai } from "@/lib/ai/client";
import {
  generateSlideshowScript,
  generateSlideshowImages,
  compositeSlideshowVideo,
} from "@/lib/video-studio";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { nanoid } from "nanoid";
import OpenAI from "openai";
import os from "os";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

const execFileAsync = promisify(execFile);

/**
 * POST /api/ai/video-studio — Generate a video ad/promo using Google Veo 3
 *
 * Uses SSE streaming to provide real-time progress updates.
 * Providers: Veo 3 (AI video with native audio) or Slideshow (AI images + voiceover).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    const {
      prompt,
      category = "product_ad",
      aspectRatio = "16:9",
      duration = 15,
      style = "cinematic",
      resolution = "720p",
      referenceImageUrl = null,
      brandLogo = null,
      voiceOver = "nova" as string | false,
      voiceGender = "female" as string,
      voiceAccent = "american" as string,
      provider = "veo3" as "veo3" | "slideshow",
    } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
    }

    // Validate provider availability
    if (provider === "veo3" && !veoClient.isAvailable()) {
      return new Response(JSON.stringify({ error: "Veo 3 video generation is not configured (GEMINI_API_KEY missing)" }), { status: 503 });
    }
    if (provider === "slideshow" && !xaiClient.isAvailable()) {
      return new Response(JSON.stringify({ error: "Slideshow requires XAI_API_KEY for image generation" }), { status: 503 });
    }

    const baseCost = await getDynamicCreditCost("AI_VIDEO_STUDIO" as const);
    // Credit multiplier: Slideshow 2x, Veo extended = baseCost * number of API calls
    const extensionCount = provider === "veo3" && duration > 8 ? Math.ceil((duration - 8) / 7) : 0;
    const veoCallCount = 1 + extensionCount;
    const creditCost =
      provider === "slideshow" ? Math.round(baseCost * 2) :
      Math.round(baseCost * veoCallCount);

    // Check credits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    const isAdmin = !!session.adminId;
    if (!isAdmin && (!user || user.aiCredits < creditCost)) {
      return new Response(
        JSON.stringify({
          error: "Insufficient credits",
          required: creditCost,
          available: user?.aiCredits || 0,
        }),
        { status: 402 }
      );
    }

    // Create design record
    const design = await prisma.design.create({
      data: {
        userId: session.userId,
        prompt: prompt.trim(),
        category,
        size: aspectRatio,
        style,
        status: "GENERATING",
        metadata: JSON.stringify({ duration, resolution, type: "video", provider, referenceImageUrl: referenceImageUrl || undefined }),
      },
    });

    // SSE streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        send({ type: "start", mode: "video", designId: design.id });

        try {
          // Build enhanced prompt with style
          const enhancedPrompt = buildVideoPrompt(prompt.trim(), category, style);
          const refImage: string | undefined = referenceImageUrl || undefined;

          let finalVideoBuffer: Buffer;
          let totalDuration = 0;

          // Debug directory for saving raw videos
          const debugDir = path.join(process.cwd(), ".cache", "debug-video");
          fs.mkdirSync(debugDir, { recursive: true });
          const debugId = nanoid(6);

          if (provider === "slideshow") {
            // ──────── SLIDESHOW (AI Images + Voiceover + Captions) ────────
            send({ type: "status", message: "Generating slideshow script..." });
            const script = await generateSlideshowScript(prompt.trim(), category, style, 45);
            console.log(`[VideoStudio] Slideshow script: ${script.scenes.length} scenes`);

            send({ type: "status", message: `Generating ${script.scenes.length} scene images...` });
            const slideshowImages = await generateSlideshowImages(
              script.scenes,
              aspectRatio,
              (cur, total) => send({ type: "status", message: `Generating image ${cur}/${total}...` })
            );

            send({ type: "status", message: "Generating voiceover narration..." });
            const voiceId = (typeof voiceOver === "string" && voiceOver !== "none") ? (voiceOver as TTSVoice) : "nova";
            const fullNarration = script.scenes.map((s) => s.narration).join(" ");
            let audioBuffer: Buffer;
            try {
              audioBuffer = await generateTTSAudio(fullNarration, voiceId);
            } catch (ttsErr) {
              const msg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
              if (msg.includes("429") || msg.includes("quota")) {
                throw new Error("OpenAI TTS quota exceeded. Please check your OpenAI billing at platform.openai.com to continue generating voiceover.");
              }
              throw new Error(`Voiceover generation failed: ${msg}`);
            }

            send({ type: "status", message: "Compositing slideshow video..." });
            finalVideoBuffer = await compositeSlideshowVideo({
              scenes: script.scenes,
              images: slideshowImages,
              audioBuffer,
              resolution,
              aspectRatio,
              brandLogo: brandLogo || undefined,
            });
            // Get actual duration from the composited video (voiceover-driven, not fixed 45s)
            totalDuration = await getSlideshowDuration(finalVideoBuffer);
            console.log(`[VideoStudio] DEBUG: Slideshow raw buffer = ${finalVideoBuffer.length} bytes (${(finalVideoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
          } else {
            // ──────── VEO 3 (Google) ────────
            // Veo 3 supports 4, 6, or 8 second videos with native audio
            // For extended videos (>8s), we generate 8s then chain extensions (+7s each)
            const veoDuration = duration <= 4 ? "4" : duration <= 6 ? "6" : "8";
            const veoAspectRatio = aspectRatio === "9:16" ? "9:16" as const : "16:9" as const;
            // Resolution must be 720p for video extension (API requirement)
            const veoResolution = duration > 8 ? "720p" as const : (resolution as "720p" | "1080p");

            // Embed voice characteristics into the prompt for Veo 3 native audio
            const voiceDirective = buildVoiceDirective(voiceGender, voiceAccent);
            const veoPrompt = `${enhancedPrompt}\n\n${voiceDirective}`;

            const isExtended = duration > 8;
            send({
              type: "status",
              message: isExtended
                ? `Generating initial 8s video with Veo 3...`
                : `Generating ${veoDuration}s video with Veo 3 (includes native audio)...`,
            });

            const result = await veoClient.generateVideoBuffer(veoPrompt, {
              durationSeconds: veoDuration as "4" | "6" | "8",
              aspectRatio: veoAspectRatio,
              resolution: veoResolution,
            });

            finalVideoBuffer = result.videoBuffer;
            totalDuration = result.duration;

            // Extension loop: chain additional 7s segments to reach target duration
            let currentVideoUri = result.videoUri;
            if (isExtended && currentVideoUri) {
              const extensionsNeeded = Math.ceil((duration - 8) / 7);
              for (let i = 0; i < extensionsNeeded; i++) {
                const extNum = i + 1;
                const estimatedTotal = 8 + extNum * 7;
                send({
                  type: "status",
                  message: `Extending video (${extNum}/${extensionsNeeded})... ~${estimatedTotal}s total`,
                });

                const extResult = await veoClient.extendVideo(currentVideoUri, veoPrompt, {
                  aspectRatio: veoAspectRatio,
                });

                finalVideoBuffer = extResult.videoBuffer;
                totalDuration = estimatedTotal; // best estimate
                currentVideoUri = extResult.videoUri;

                if (!currentVideoUri) {
                  console.warn(`[VideoStudio] Extension ${extNum} returned no URI, stopping`);
                  break;
                }
              }
              console.log(`[VideoStudio] Video extension complete: ${extensionsNeeded} extensions, ~${totalDuration}s total`);
            }
          }

          // ── DEBUG: Log raw video buffer info and save to disk ──
          const rawMagic = finalVideoBuffer.slice(0, 12).toString("hex");
          const rawMagicAscii = finalVideoBuffer.slice(4, 8).toString("ascii");
          console.log(`[VideoStudio] DEBUG: Raw ${provider} buffer = ${finalVideoBuffer.length} bytes (${(finalVideoBuffer.length / 1024).toFixed(1)} KB), magic: ${rawMagic}, ascii[4:8]: "${rawMagicAscii}"`);
          console.log(`[VideoStudio] DEBUG: Is MP4? ${rawMagicAscii === "ftyp" ? "YES" : "NO — this is NOT a video!"}`);

          // Save raw video to debug dir before any processing
          const rawDebugPath = path.join(debugDir, `raw-${provider}-${debugId}.mp4`);
          fs.writeFileSync(rawDebugPath, finalVideoBuffer);
          console.log(`[VideoStudio] DEBUG: Raw video saved to ${rawDebugPath}`);

          // Also upload raw video directly to S3 (no processing) so user can verify
          const rawS3Key = `ai-video-studio/debug/${session.userId}/raw-${debugId}.mp4`;
          const rawMediaUrl = await uploadToS3(rawS3Key, finalVideoBuffer, "video/mp4");
          console.log(`[VideoStudio] DEBUG: Raw video uploaded to S3: ${rawMediaUrl}`);
          send({ type: "status", message: `Raw video saved (${(finalVideoBuffer.length / 1024).toFixed(0)} KB)...` });

          // Composite brand logo if provided (skip for slideshow — logo outro handled in pipeline)
          if (brandLogo && provider !== "slideshow") {
            send({ type: "status", message: "Adding brand logo..." });
            try {
              finalVideoBuffer = await compositeLogoOnVideo(finalVideoBuffer, brandLogo, resolution);
              console.log(`[VideoStudio] DEBUG: After logo overlay = ${finalVideoBuffer.length} bytes`);
            } catch (logoErr) {
              console.warn("[VideoStudio] Logo overlay failed, continuing without logo:", logoErr);
            }
          }

          // Generate and mix voiceover if enabled (skip for slideshow — voiceover already baked in)
          if (provider !== "slideshow" && voiceOver && voiceOver !== "none") {
            send({ type: "status", message: "Writing voiceover script..." });
            try {
              const videoDuration = totalDuration || duration;
              const script = await generateVoiceoverScript(prompt.trim(), category, style, videoDuration);
              console.log(`[VideoStudio] Voiceover script (${script.length} chars): ${script.substring(0, 120)}...`);

              send({ type: "status", message: "Recording voiceover..." });
              const voiceId = (voiceOver as TTSVoice) || "nova";
              const audioBuffer = await generateTTSAudio(script, voiceId);
              console.log(`[VideoStudio] DEBUG: TTS audio = ${audioBuffer.length} bytes`);

              send({ type: "status", message: "Mixing voiceover with video..." });
              finalVideoBuffer = await mixVoiceoverOnVideo(finalVideoBuffer, audioBuffer);
              console.log(`[VideoStudio] DEBUG: After voiceover mix = ${finalVideoBuffer.length} bytes`);
            } catch (voErr) {
              console.warn("[VideoStudio] Voiceover failed, continuing without narration:", voErr);
            }
          }

          // Final debug log
          console.log(`[VideoStudio] DEBUG: Final video = ${finalVideoBuffer.length} bytes (${(finalVideoBuffer.length / 1024).toFixed(1)} KB)`);
          const finalMagic = finalVideoBuffer.slice(4, 8).toString("ascii");
          console.log(`[VideoStudio] DEBUG: Final is MP4? ${finalMagic === "ftyp" ? "YES" : "NO"}`);

          send({ type: "status", message: "Uploading video..." });

          // Upload final video to S3
          const s3Key = `ai-video-studio/${session.userId}/${nanoid(8)}.mp4`;
          const mediaUrl = await uploadToS3(s3Key, finalVideoBuffer, "video/mp4");

          // Update design record
          await prisma.design.update({
            where: { id: design.id },
            data: {
              imageUrl: mediaUrl,
              status: "COMPLETED",
              metadata: JSON.stringify({
                duration: totalDuration,
                resolution,
                type: "video",
                style,
                provider,
              }),
            },
          });

          // Deduct credits
          let creditsRemaining = (user?.aiCredits || 0) - creditCost;
          if (!isAdmin) {
            await prisma.$transaction([
              prisma.user.update({
                where: { id: session.userId },
                data: { aiCredits: { decrement: creditCost } },
              }),
              prisma.creditTransaction.create({
                data: {
                  userId: session.userId,
                  type: "USAGE",
                  amount: -creditCost,
                  balanceAfter: creditsRemaining,
                  referenceType: "ai_video_studio",
                  referenceId: design.id,
                  description: `Video studio: ${category}`,
                },
              }),
            ]);
          }

          // Save to Media Library
          await prisma.mediaFile.create({
            data: {
              userId: session.userId,
              filename: `video-${design.id}.mp4`,
              originalName: `${category} Video.mp4`,
              url: mediaUrl,
              type: "video",
              mimeType: "video/mp4",
              size: finalVideoBuffer.length,
              tags: JSON.stringify(["video", "ai-generated", category]),
              metadata: JSON.stringify({
                designId: design.id,
                style,
                duration: totalDuration,
                resolution,
              }),
            },
          });

          // Track AI usage
          await prisma.aIUsage.create({
            data: {
              userId: isAdmin ? null : session.userId,
              adminId: isAdmin ? session.adminId : null,
              feature: "video_studio",
              model: provider === "veo3" ? "veo-3.1-generate-preview" : "slideshow",
              inputTokens: 0,
              outputTokens: 0,
              costCents: 0,
              prompt: prompt.substring(0, 500),
              response: `Provider: ${provider}, Duration: ${totalDuration}s`,
            },
          });

          send({
            type: "media",
            mediaType: "video",
            mediaUrl,
            designId: design.id,
            duration: totalDuration,
            creditsUsed: creditCost,
            creditsRemaining,
          });
        } catch (error) {
          console.error("[VideoStudio] Generation error:", error);

          // Update design as failed
          await prisma.design.update({
            where: { id: design.id },
            data: { status: "FAILED" },
          }).catch(() => {});

          // Clean up error message — don't show raw JSON to users
          let errorMsg = "Video generation failed";
          if (error instanceof Error) {
            const msg = error.message;
            if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
              errorMsg = "API quota exceeded. Please wait a few minutes and try again, or check your Google AI billing.";
            } else if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
              errorMsg = "API access denied. Please check your API key configuration.";
            } else if (msg.includes("timeout")) {
              errorMsg = "Video generation timed out. Please try a shorter duration or simpler prompt.";
            } else {
              // Strip JSON blobs from error messages
              errorMsg = msg.replace(/\{[\s\S]*\}/g, "").trim() || "Video generation failed. Please try again.";
            }
          }

          send({
            type: "error",
            message: errorMsg,
          });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[VideoStudio] API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}

/**
 * Build an enhanced video prompt incorporating category and style.
 * Explicitly instructs the model to generate animated video with real motion,
 * camera movement, and dynamic action — not a static image.
 */
function buildVideoPrompt(userPrompt: string, category: string, style: string): string {
  const categoryMotion: Record<string, string> = {
    product_ad:
      "Animated product advertisement video with the product rotating, zooming in on details, dynamic camera orbiting around it, smooth transitions between angles, and objects physically moving through the scene.",
    promo:
      "Energetic promotional video with fast-paced camera movement, elements flying and sliding into frame, zoom transitions, objects animating across the screen, and dynamic motion throughout.",
    social_reel:
      "Punchy social media reel with rapid camera cuts, objects bouncing and sliding, zoom-ins, whip pans, parallax motion, and continuous animated movement to grab attention.",
    explainer:
      "Animated explainer video with objects appearing, moving, transforming, camera panning and zooming smoothly to follow the action, with continuous visual motion and transitions.",
    brand_intro:
      "Cinematic brand introduction with sweeping camera movements, logo elements assembling with motion, smooth dolly shots, particles and elements animating in, and dynamic reveal sequences.",
    testimonial:
      "Professional testimonial-style video with subtle camera drift, background elements gently moving, soft focus shifts, and smooth cinematic camera motion throughout.",
  };

  const styleHints: Record<string, string> = {
    cinematic: "Cinematic look with dramatic lighting, shallow depth of field, slow dolly movements, and film-grade color grading.",
    modern: "Clean modern aesthetic with smooth animated transitions, bold motion graphics, and contemporary design.",
    minimal: "Minimalist approach with elegant slow camera movements, clean compositions, and subtle animated elements.",
    energetic: "High-energy visuals with fast camera cuts, vibrant colors, dynamic zooms, whip pans, and rapid motion.",
    elegant: "Sophisticated premium look with graceful slow-motion, smooth tracking shots, and refined transitions.",
    retro: "Retro/vintage aesthetic with warm tones, film grain, nostalgic camera movements, and old-school transitions.",
  };

  const catHint = categoryMotion[category] || "Animated video with dynamic camera movement and real motion throughout.";
  const styleHint = styleHints[style] || "";

  // Core directive: force the model to generate actual animated video, not a still image
  const motionDirective = "Create a fully animated video with continuous real motion, moving objects, camera movement (panning, zooming, tracking, orbiting), and dynamic action throughout the entire duration. This must NOT be a static image — everything should be visually moving and alive.";

  return `${motionDirective} ${catHint} ${styleHint} ${userPrompt}`.trim();
}

/**
 * Composite a brand logo onto a video using FFmpeg overlay filter.
 * Logo is placed in the top-left corner at 18% of the smaller dimension.
 */
async function compositeLogoOnVideo(
  videoBuffer: Buffer,
  logoUrl: string,
  resolution: string
): Promise<Buffer> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    console.warn("[VideoStudio] FFmpeg not found, skipping logo overlay");
    return videoBuffer;
  }

  // Download logo to a temp file
  const logoBuffer = await downloadLogoFile(logoUrl);
  if (!logoBuffer) {
    console.warn("[VideoStudio] Could not download logo, skipping overlay");
    return videoBuffer;
  }

  const tmpDir = os.tmpdir();
  const id = nanoid(6);
  const videoPath = path.join(tmpDir, `vs-logo-in-${id}.mp4`);
  const logoPath = path.join(tmpDir, `vs-logo-${id}.png`);
  const outputPath = path.join(tmpDir, `vs-logo-out-${id}.mp4`);

  try {
    fs.writeFileSync(videoPath, videoBuffer);
    fs.writeFileSync(logoPath, logoBuffer);

    // Calculate logo size: 18% of smaller video dimension
    const height = resolution === "720p" ? 720 : 480;
    const logoSize = Math.max(60, Math.min(Math.round(height * 0.18), 200));
    // Position: top-left with 2% margin
    const marginX = Math.round(height * 0.02);
    const marginY = Math.round(height * 0.015);

    await execFileAsync(ffmpegPath, [
      "-i", videoPath,
      "-i", logoPath,
      "-filter_complex",
      `[1:v]scale=${logoSize}:-1,format=rgba[logo];[0:v][logo]overlay=${marginX}:${marginY}:eof_action=repeat[v]`,
      "-map", "[v]",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "copy",
      "-y",
      outputPath,
    ], { timeout: 60000 });

    return fs.readFileSync(outputPath);
  } finally {
    for (const f of [videoPath, logoPath, outputPath]) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  }
}

/**
 * Download a logo from URL or resolve from local path.
 */
async function downloadLogoFile(logoUrl: string): Promise<Buffer | null> {
  try {
    // Handle local paths (/uploads/..., /characters/...)
    if (logoUrl.startsWith("/uploads/") || logoUrl.startsWith("/characters/")) {
      const localPath = path.join(process.cwd(), "public", logoUrl);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
    }

    // Handle HTTP(S) URLs (S3 or external)
    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
      const response = await fetch(logoUrl);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // Absolute file path
    if (fs.existsSync(logoUrl)) {
      return fs.readFileSync(logoUrl);
    }

    return null;
  } catch (error) {
    console.error("[VideoStudio] Failed to download logo:", error);
    return null;
  }
}

/**
 * Get the duration of a slideshow video buffer via ffprobe.
 */
async function getSlideshowDuration(videoBuffer: Buffer): Promise<number> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) return 45;

  const tmpPath = path.join(os.tmpdir(), `vs-probe-${nanoid(4)}.mp4`);
  try {
    fs.writeFileSync(tmpPath, videoBuffer);

    const ffprobeDir = path.dirname(ffmpegPath);
    const ffprobeName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
    let ffprobePath = path.join(ffprobeDir, ffprobeName);
    if (!fs.existsSync(ffprobePath)) ffprobePath = ffprobeName;

    const { stdout } = await execFileAsync(ffprobePath, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      tmpPath,
    ], { timeout: 10000 });

    return parseFloat(stdout.trim()) || 45;
  } catch {
    return 45;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

/**
 * Build a voice directive string to embed in the Veo 3 prompt.
 * Veo 3 generates native audio (voice, sound effects, music) based on the prompt text.
 */
function buildVoiceDirective(gender: string, accent: string): string {
  const accentLabels: Record<string, string> = {
    american: "American English",
    british: "British English",
    australian: "Australian English",
    indian: "Indian English",
    african_american: "African American English",
    latin: "Latin American",
    french: "French-accented English",
    middle_eastern: "Middle Eastern-accented English",
  };

  const accentLabel = accentLabels[accent] || accent;
  const genderLabel = gender === "male" ? "male" : "female";

  return `The narration and voiceover should be spoken by a ${genderLabel} voice with a ${accentLabel} accent. The voice should sound natural, confident, and professional — suitable for a marketing advertisement.`;
}

// ─── Voiceover Pipeline ───────────────────────────────────────────────

/**
 * Generate a short ad voiceover script using Claude AI.
 * The script is sized to fit the video duration (~3 words/second).
 */
async function generateVoiceoverScript(
  userPrompt: string,
  category: string,
  style: string,
  durationSeconds: number
): Promise<string> {
  const wordBudget = Math.max(15, Math.round(durationSeconds * 2.8));

  const categoryContext: Record<string, string> = {
    product_ad: "product advertisement",
    promo: "promotional offer or sale",
    social_reel: "short social media ad",
    explainer: "product/service explainer",
    brand_intro: "brand introduction",
    testimonial: "customer testimonial",
  };
  const catCtx = categoryContext[category] || "marketing video";

  const prompt = `Write a voiceover narration script for a ${durationSeconds}-second ${catCtx} video.

Video description: ${userPrompt}
Style: ${style}
Word budget: approximately ${wordBudget} words (MUST be under ${wordBudget + 10} words)

Requirements:
- Write ONLY the spoken narration text, no stage directions, no brackets, no labels
- Compelling, punchy, ad-quality copy
- Match the style: ${style}
- End with a clear call-to-action or tagline
- Output ONLY the narration text, nothing else`;

  const result = await ai.generate(prompt, {
    maxTokens: 300,
    temperature: 0.8,
    systemPrompt: "You are an expert advertising copywriter. Write compelling voiceover scripts for video ads. Output ONLY the spoken narration — no labels, no directions, no formatting.",
  });

  return (result || "").trim();
}

/**
 * Generate TTS audio from a script using OpenAI TTS.
 * Returns the audio as an MP3 Buffer.
 */
async function generateTTSAudio(
  script: string,
  voice: TTSVoice = "nova"
): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: script,
    response_format: "mp3",
    speed: 1.0,
  });

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Mix voiceover audio onto a video using FFmpeg.
 * Replaces the original video audio entirely with the voiceover narration.
 * This prevents double-voice when AI-generated videos already contain audio.
 * Output is capped at the video's actual duration to prevent frozen-frame issues.
 */
async function mixVoiceoverOnVideo(
  videoBuffer: Buffer,
  voiceoverBuffer: Buffer
): Promise<Buffer> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    console.warn("[VideoStudio] FFmpeg not found, skipping voiceover mix");
    return videoBuffer;
  }

  const tmpDir = os.tmpdir();
  const id = nanoid(6);
  const videoPath = path.join(tmpDir, `vs-vo-video-${id}.mp4`);
  const audioPath = path.join(tmpDir, `vs-vo-audio-${id}.mp3`);
  const outputPath = path.join(tmpDir, `vs-vo-out-${id}.mp4`);

  try {
    fs.writeFileSync(videoPath, videoBuffer);
    fs.writeFileSync(audioPath, voiceoverBuffer);

    // Get video duration via ffprobe so we can cap output
    let videoDuration = 0;
    try {
      const ffprobeDir = path.dirname(ffmpegPath);
      const ffprobeName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
      let ffprobePath = path.join(ffprobeDir, ffprobeName);
      if (!fs.existsSync(ffprobePath)) ffprobePath = ffprobeName;

      const { stdout } = await execFileAsync(ffprobePath, [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ], { timeout: 10000 });
      videoDuration = parseFloat(stdout.trim()) || 0;
    } catch {
      console.warn("[VideoStudio] Could not probe video duration");
    }

    // Replace original audio entirely with voiceover (no mixing = no double voice)
    // Cap output at video duration with -t to prevent frozen-frame issues
    const args = [
      "-i", videoPath,
      "-i", audioPath,
      "-map", "0:v",
      "-map", "1:a",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
    ];

    // Cap at video duration if we know it (prevents audio extending past video)
    if (videoDuration > 0) {
      args.push("-t", videoDuration.toFixed(2));
    }

    args.push("-y", outputPath);

    await execFileAsync(ffmpegPath, args, { timeout: 60000 });
    console.log(`[VideoStudio] Voiceover replaced on video (duration: ${videoDuration.toFixed(1)}s)`);

    return fs.readFileSync(outputPath);
  } finally {
    for (const f of [videoPath, audioPath, outputPath]) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  }
}

