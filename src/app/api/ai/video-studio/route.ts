import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { veoClient } from "@/lib/ai/veo-client";
import { xaiClient } from "@/lib/ai/xai-client";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { soraClient } from "@/lib/ai/sora-client";
import { editImagesXaiFirst } from "@/lib/ai/image-router";
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
import sharp from "sharp";
import os from "os";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
type RequestedVideoProvider = "auto" | "veo3" | "grok" | "slideshow";
type RuntimeVideoProvider = "veo3" | "grok" | "slideshow";
type VideoSpeechMode =
  | "visual_only"
  | "talking_review"
  | "site_walkthrough"
  | "voiceover_presentation";

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
      style = "cinematic",
      resolution = "720p",
      referenceImageUrl = null,
      brandLogo = null,
      voiceOver = "nova" as string | false,
      voiceGender = "female" as string,
      voiceAccent = "american" as string,
    } = body;
    const duration = normalizeRequestedVideoDuration(body.duration ?? body.durationSeconds ?? 15);
    const requestedProvider = normalizeRequestedVideoProvider(body.provider ?? "veo3");
    if (requestedProvider === "slideshow") {
      return new Response(
        JSON.stringify({ error: "Slideshow video is experimental and is not enabled for production generation yet." }),
        { status: 400 }
      );
    }
    const runtimeProvider = resolveRuntimeVideoProvider(requestedProvider, duration);
    const referenceImageUrls = normalizeReferenceImageUrls(body.referenceImageUrls, referenceImageUrl);
    const primaryReferenceImageUrl = referenceImageUrls[0] || null;
    const speechMode = normalizeVideoSpeechMode(
      body.speechMode ??
        (voiceOver && voiceOver !== "none" ? "voiceover_presentation" : "visual_only")
    );
    const shouldMixVoiceover = speechMode === "voiceover_presentation" && !!voiceOver && voiceOver !== "none";

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
    }

    // Validate provider availability
    if (runtimeProvider === "veo3" && !veoClient.isAvailable() && !hasAnyVideoFallbackProvider()) {
      return new Response(JSON.stringify({ error: "Video generation is not configured" }), { status: 503 });
    }
    if (runtimeProvider === "grok" && !grokVideoClient.isAvailable()) {
      return new Response(JSON.stringify({ error: "xAI Grok video generation is not configured" }), { status: 503 });
    }
    if (requestedProvider === "grok" && duration > 15) {
      return new Response(JSON.stringify({ error: "xAI Grok video supports up to 15 seconds. Choose auto provider for 30-second FlowAI videos." }), { status: 400 });
    }
    // Credit cost: Veo scales with extensions. The slideshow compositor is
    // experimental and is not used for production post generation.
    const creditCost = await (async () => {
      const veoCost = await getDynamicCreditCost("AI_VIDEO_STUDIO" as const);
      const extensionCount = runtimeProvider === "veo3" && duration > 8 ? Math.ceil((duration - 8) / 7) : 0;
      return Math.round(veoCost * (1 + extensionCount));
    })();

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
        metadata: JSON.stringify({
          duration,
          resolution,
          type: "video",
          provider: runtimeProvider,
          requestedProvider,
          speechMode,
          referenceImageUrl: primaryReferenceImageUrl || undefined,
          referenceImageUrls: referenceImageUrls.length ? referenceImageUrls : undefined,
        }),
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
          const refImage = await prepareVideoReferenceAnchor({
            referenceImageUrls,
            userId: session.userId,
            speechMode,
            aspectRatio,
            prompt: prompt.trim(),
            category,
            style,
            onStatus: (message) => send({ type: "status", message }),
          });
          // Build enhanced prompt with style, continuity, and duration guidance.
          const enhancedPrompt = buildVideoPrompt(prompt.trim(), category, style, duration, referenceImageUrls.length, speechMode);
          const negativePrompt = buildVideoNegativePrompt(referenceImageUrls.length, speechMode);

          let finalVideoBuffer: Buffer;
          let totalDuration = 0;
          let actualProvider = runtimeProvider as string;

          // Debug directory for saving raw videos
          const debugDir = path.join(process.cwd(), ".cache", "debug-video");
          fs.mkdirSync(debugDir, { recursive: true });
          const debugId = nanoid(6);

          if (false && runtimeProvider === "slideshow") {
            actualProvider = "slideshow";
            // ──────── SLIDESHOW (AI Images + Voiceover + Captions) ────────
            send({ type: "status", message: "Generating slideshow script..." });
            const script = await generateSlideshowScript(prompt.trim(), category, style, Math.max(15, duration));
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
              const msg = getErrorMessage(ttsErr);
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
          } else if (runtimeProvider === "grok") {
            actualProvider = "grok";
            send({ type: "status", message: `Generating ${duration}s video with xAI Grok...` });
            try {
              const result = await grokVideoClient.generateVideo(compactVideoProviderPrompt(enhancedPrompt), {
                duration: Math.max(1, Math.min(15, Math.round(duration || 8))),
                aspectRatio: normalizeVideoAspect(aspectRatio),
                resolution: "720p",
                imageUrl: refImage,
                onStatus: (message) => send({ type: "status", message }),
              });
              finalVideoBuffer = result.videoBuffer;
              totalDuration = result.duration || duration;
            } catch (primaryVideoError) {
              if (!isVideoFallbackError(primaryVideoError)) throw primaryVideoError;
              console.warn("[VideoStudio] xAI video engine failed, trying fallback chain:", primaryVideoError);
              send({ type: "status", message: "Trying another production video engine..." });
              const fallbackResult = await generateFallbackVideoBuffer({
                prompt: enhancedPrompt,
                userPrompt: prompt.trim(),
                category,
                style,
                aspectRatio,
                duration,
                referenceImageUrl: refImage,
                skipGrok: true,
                allowExperimentalSlideshow: false,
                onStatus: (message) => send({ type: "status", message }),
              });
              finalVideoBuffer = fallbackResult.videoBuffer;
              totalDuration = fallbackResult.duration;
              actualProvider = fallbackResult.provider;
              if (totalDuration < duration) {
                send({
                  type: "status",
                  message: `Backup engine generated a ${totalDuration}s clip because the long-video provider is temporarily unavailable.`,
                });
              }
            }
          } else {
            // ──────── VEO 3 (Google) ────────
            // Veo 3 supports 4, 6, or 8 second videos with native audio
            // For extended videos (>8s), we generate 8s then chain extensions (+7s each)
            const veoDuration = duration <= 4 ? "4" : duration <= 6 ? "6" : "8";
            const veoAspectRatio = aspectRatio === "9:16" ? "9:16" as const : "16:9" as const;
            // Resolution must be 720p for video extension (API requirement)
            const veoResolution = duration > 8 ? "720p" as const : (resolution as "720p" | "1080p");

            // Embed speech direction into the prompt for providers with native audio.
            const voiceDirective = buildNativeAudioDirective(speechMode, voiceGender, voiceAccent);
            const veoPrompt = `${enhancedPrompt}\n\n${voiceDirective}`;

            const isExtended = duration > 8;
            send({
              type: "status",
              message: isExtended
                ? `Generating initial 8s video...`
                : `Generating ${veoDuration}s video...`,
            });

            try {
              const result = await veoClient.generateVideoBuffer(veoPrompt, {
                durationSeconds: veoDuration as "4" | "6" | "8",
                aspectRatio: veoAspectRatio,
                resolution: veoResolution,
                referenceImageUrl: refImage,
                negativePrompt,
              });

              actualProvider = "veo3";
              finalVideoBuffer = result.videoBuffer;
              totalDuration = result.duration;

              // Extension loop: chain additional 7s segments to reach target duration
              let currentVideoUri = result.videoUri;
              if (isExtended && currentVideoUri) {
                const extensionsNeeded = Math.ceil((duration - 8) / 7);

                // Wait for Veo to finish processing the initial video before extending
                send({ type: "status", message: "Waiting for video processing before extending..." });
                await new Promise((r) => setTimeout(r, 30000));

                for (let i = 0; i < extensionsNeeded; i++) {
                  const extNum = i + 1;
                  const estimatedTotal = 8 + extNum * 7;
                  if (i > 0) {
                    send({ type: "status", message: "Waiting for the previous video segment to finish processing..." });
                    await new Promise((r) => setTimeout(r, 30000));
                  }
                  send({
                    type: "status",
                    message: `Extending video (${extNum}/${extensionsNeeded})... ~${estimatedTotal}s total`,
                  });

                  // Use a continuation prompt (not the same generation prompt) so each
                  // segment naturally advances the story instead of repeating
                  const continuationPrompt = buildExtensionPrompt(prompt.trim(), category, style, i, extensionsNeeded, speechMode);
                  const extResult = await extendVeoVideoWithProcessingRetry(
                    currentVideoUri,
                    continuationPrompt,
                    veoAspectRatio,
                    (message) => send({ type: "status", message })
                  );

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
            } catch (primaryVideoError) {
              if (!isVideoFallbackError(primaryVideoError)) throw primaryVideoError;
              console.warn("[VideoStudio] Primary video engine failed, trying fallback chain:", primaryVideoError);
              send({ type: "status", message: "Trying another production video engine..." });
              const fallbackResult = await generateFallbackVideoBuffer({
                prompt: veoPrompt,
                userPrompt: prompt.trim(),
                category,
                style,
                aspectRatio,
                duration,
                referenceImageUrl: refImage,
                allowExperimentalSlideshow: false,
                onStatus: (message) => send({ type: "status", message }),
              });
              finalVideoBuffer = fallbackResult.videoBuffer;
              totalDuration = fallbackResult.duration;
              actualProvider = fallbackResult.provider;
              if (totalDuration < duration) {
                send({
                  type: "status",
                  message: `Backup engine generated a ${totalDuration}s clip because the long-video provider is temporarily unavailable.`,
                });
              }
            }
          }

          // ── DEBUG: Log raw video buffer info and save to disk ──
          const rawMagic = finalVideoBuffer.slice(0, 12).toString("hex");
          const rawMagicAscii = finalVideoBuffer.slice(4, 8).toString("ascii");
          console.log(`[VideoStudio] DEBUG: Raw ${actualProvider} buffer = ${finalVideoBuffer.length} bytes (${(finalVideoBuffer.length / 1024).toFixed(1)} KB), magic: ${rawMagic}, ascii[4:8]: "${rawMagicAscii}"`);
          console.log(`[VideoStudio] DEBUG: Is MP4? ${rawMagicAscii === "ftyp" ? "YES" : "NO — this is NOT a video!"}`);

          // Save raw video to debug dir before any processing
          const rawDebugPath = path.join(debugDir, `raw-${actualProvider}-${debugId}.mp4`);
          fs.writeFileSync(rawDebugPath, finalVideoBuffer);
          console.log(`[VideoStudio] DEBUG: Raw video saved to ${rawDebugPath}`);

          // Also upload raw video directly to S3 (no processing) so user can verify
          const rawS3Key = `ai-video-studio/debug/${session.userId}/raw-${debugId}.mp4`;
          const rawMediaUrl = await uploadToS3(rawS3Key, finalVideoBuffer, "video/mp4");
          console.log(`[VideoStudio] DEBUG: Raw video uploaded to S3: ${rawMediaUrl}`);
          send({ type: "status", message: `Raw video saved (${(finalVideoBuffer.length / 1024).toFixed(0)} KB)...` });

          // Composite brand logo if provided (skip for slideshow — logo outro handled in pipeline)
          if (brandLogo && actualProvider !== "slideshow") {
            send({ type: "status", message: "Adding brand logo..." });
            try {
              finalVideoBuffer = await compositeLogoOnVideo(finalVideoBuffer, brandLogo, resolution);
              console.log(`[VideoStudio] DEBUG: After logo overlay = ${finalVideoBuffer.length} bytes`);
            } catch (logoErr) {
              console.warn("[VideoStudio] Logo overlay failed, continuing without logo:", logoErr);
            }
          }

          // Generate and mix voiceover if enabled (skip for slideshow — voiceover already baked in)
          if (actualProvider !== "slideshow" && shouldMixVoiceover) {
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
                provider: actualProvider,
              }),
            },
          });

          // Deduct credits. If a long-video request falls back to a shorter
          // provider because Veo is at capacity, charge the base video cost
          // rather than the Veo extension estimate.
          const finalCreditCost =
            actualProvider === "veo3"
              ? creditCost
              : Math.min(creditCost, await getDynamicCreditCost("AI_VIDEO_STUDIO" as const));
          let creditsRemaining = (user?.aiCredits || 0) - finalCreditCost;
          if (!isAdmin) {
            await prisma.$transaction([
              prisma.user.update({
                where: { id: session.userId },
                data: { aiCredits: { decrement: finalCreditCost } },
              }),
              prisma.creditTransaction.create({
                data: {
                  userId: session.userId,
                  type: "USAGE",
                  amount: -finalCreditCost,
                  balanceAfter: creditsRemaining,
                  referenceType: "ai_video_studio",
                  referenceId: design.id,
                  description: `Video studio: ${category}${actualProvider !== "veo3" && duration > totalDuration ? " (backup provider)" : ""}`,
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
              model: getVideoUsageModel(actualProvider),
              inputTokens: 0,
              outputTokens: 0,
              costCents: 0,
              prompt: prompt.substring(0, 500),
              response: `Provider: ${actualProvider}, Duration: ${totalDuration}s`,
            },
          });

          send({
            type: "media",
            mediaType: "video",
            mediaUrl,
            designId: design.id,
            duration: totalDuration,
            creditsUsed: finalCreditCost,
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
            if (msg.includes("requires the long-video provider") || msg.includes("No production video provider")) {
              errorMsg = msg;
            } else if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("rate limit")) {
              errorMsg = "Video generation is temporarily at capacity. The backup engines were tried too; please try again shortly or use a shorter prompt.";
            } else if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
              errorMsg = "Video generation is not available for this request. Please try again later.";
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getVideoUsageModel(provider: string): string {
  switch (provider) {
    case "veo3":
      return "veo-3.1-generate-preview";
    case "grok":
      return "grok-imagine-video";
    case "sora":
      return "sora-2";
    case "slideshow":
      return "slideshow";
    default:
      return "flowai-video";
  }
}

function normalizeRequestedVideoProvider(value: unknown): RequestedVideoProvider {
  return value === "auto" || value === "veo3" || value === "grok" || value === "slideshow"
    ? value
    : "veo3";
}

function normalizeRequestedVideoDuration(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 15;
  return Math.max(1, Math.min(30, Math.round(parsed)));
}

function normalizeReferenceImageUrls(value: unknown, fallback: unknown): string[] {
  const fromArray = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];
  if (fromArray.length > 0) return [...new Set(fromArray)].slice(0, 3);
  return typeof fallback === "string" && fallback.trim().length > 0 ? [fallback.trim()] : [];
}

function normalizeVideoSpeechMode(value: unknown): VideoSpeechMode {
  return value === "talking_review" ||
    value === "site_walkthrough" ||
    value === "voiceover_presentation" ||
    value === "visual_only"
    ? value
    : "visual_only";
}

function resolveRuntimeVideoProvider(
  requestedProvider: RequestedVideoProvider,
  duration: number
): RuntimeVideoProvider {
  if (requestedProvider === "slideshow") return "slideshow";
  if (requestedProvider === "grok") return "grok";
  if (requestedProvider === "auto" && duration <= 15 && grokVideoClient.isAvailable()) {
    return "grok";
  }
  return "veo3";
}

function hasAnyVideoFallbackProvider(): boolean {
  return grokVideoClient.isAvailable() || soraClient.isAvailable();
}

function isVideoFallbackError(error: unknown): boolean {
  // Any primary provider failure should attempt the fallback chain before
  // surfacing an error to the user. Quotas are the common case, but model
  // access and temporary provider failures should behave the same.
  return !!error;
}

function normalizeVideoAspect(aspectRatio: string): "16:9" | "9:16" | "1:1" {
  return aspectRatio === "9:16" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9";
}

function compactVideoProviderPrompt(prompt: string, maxChars = 2800): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const headLength = Math.floor(maxChars * 0.62);
  const tailLength = Math.max(400, maxChars - headLength - 180);
  return [
    normalized.slice(0, headLength),
    "Provider prompt compacted to fit video API limits. Preserve all identity locks, product/person/site references, duration, speech mode, and continuity rules.",
    normalized.slice(-tailLength),
  ].join(" ");
}

function isVeoProcessingDelayError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return /Input video must be a video that was generated by VEO that has been processed/i.test(message) ||
    (/INVALID_ARGUMENT/i.test(message) && /processed/i.test(message));
}

function buildVideoNegativePrompt(referenceImageCount: number, speechMode: VideoSpeechMode): string {
  const anatomyRules =
    speechMode === "talking_review"
      ? "extra arms, extra hands, extra fingers, duplicated hands, duplicated arms, distorted hands, floating limbs, impossible grip, overhead product pose, product covering face, face distortion, face swap, identity drift"
      : "extra arms, extra hands, extra fingers, duplicated body parts, distorted anatomy, identity drift";
  const productRules =
    referenceImageCount > 0
      ? "changed product, different bag, wrong color, wrong material, mutated product shape, duplicate products, invented logos, unreadable product label"
      : "mutated product, unreadable labels, fake third-party logos";
  return `${anatomyRules}, ${productRules}, low quality, blurry, cropped face, cropped product, watermark, fake AI provider mark`;
}

async function prepareVideoReferenceAnchor({
  referenceImageUrls,
  userId,
  speechMode,
  aspectRatio,
  prompt,
  category,
  style,
  onStatus,
}: {
  referenceImageUrls: string[];
  userId: string;
  speechMode: VideoSpeechMode;
  aspectRatio: string;
  prompt: string;
  category: string;
  style: string;
  onStatus?: (message: string) => void;
}): Promise<string | undefined> {
  if (referenceImageUrls.length === 0) return undefined;

  try {
    onStatus?.("Building a polished first frame from your references...");
    const frame = await buildPolishedVideoReferenceFrame({
      referenceImageUrls: referenceImageUrls.slice(0, 4),
      speechMode,
      aspectRatio,
      prompt,
      category,
      style,
    });
    const key = `ai-video-studio/reference-anchors/${userId}/first-frame-${nanoid(8)}.jpg`;
    return await uploadToS3(key, frame, "image/jpeg");
  } catch (error) {
    console.warn("[VideoStudio] Could not build polished video reference frame; continuing without raw reference frame:", error);
    onStatus?.("Continuing without showing raw reference uploads in the first frame...");
    return undefined;
  }
}

async function buildPolishedVideoReferenceFrame({
  referenceImageUrls,
  speechMode,
  aspectRatio,
  prompt,
  category,
  style,
}: {
  referenceImageUrls: string[];
  speechMode: VideoSpeechMode;
  aspectRatio: string;
  prompt: string;
  category: string;
  style: string;
}): Promise<Buffer> {
  const vertical = aspectRatio === "9:16" || speechMode === "talking_review";
  const square = aspectRatio === "1:1";
  const width = vertical ? 1080 : square ? 1080 : 1280;
  const height = vertical ? 1920 : square ? 1080 : 720;
  const imageBuffers = (
    await Promise.all(referenceImageUrls.map((url) => resolveVideoReferenceBuffer(url)))
  ).filter((buffer): buffer is Buffer => !!buffer);

  if (imageBuffers.length === 0) {
    throw new Error("No reference images could be read for the video first frame.");
  }

  const promptText = [
    `Create the polished first frame for a ${Math.round(width)}x${Math.round(height)} ${category.replace(/_/g, " ")} video.`,
    `Style: ${style}. Speech mode: ${speechMode}.`,
    "",
    "This image will be used as the first frame for image-to-video generation.",
    "It must already look like the final professional scene, not a reference board, not a template preview, not a collage, and not the raw uploaded image.",
    "Do not show upload borders, cards, split panels, labels like reference/template, or any before/after layout.",
    "Use the reference images only as locked identity sources.",
    imageBuffers.length > 1
      ? "Reference roles: first image is the main presenter/primary identity when it contains a person; later images are exact product/site/design assets. Combine them into one believable polished scene."
      : "Reference role: preserve the exact product/person/site identity while improving the environment into a polished ad-ready scene.",
    "If a product is provided, preserve its exact shape, color, material, labels, silhouette, and distinctive details. Do not invent a different product or logo.",
    "If a person is provided, preserve the face identity, skin tone, hairstyle, clothing style, and natural anatomy. Show exactly one person with normal two-arm/two-hand anatomy.",
    "For talking reviews, create a premium TikTok/Reels-style review opening frame: clean background, product visible beside the presenter or held naturally, optional tasteful review UI cues, no product covering the face.",
    "For website walkthroughs, show the site/offer as a polished screen or device scene without fake UI copy.",
    "Do not add fake brand logos, provider marks, watermarks, or random text. Any required brand logo will be applied separately by FlowSmartly.",
    "",
    `User request: ${prompt}`,
  ].join("\n");

  const result = await editImagesXaiFirst(promptText, imageBuffers, width, height, {
    quality: "high",
    intent: speechMode === "talking_review" ? "identity" : "creative",
  });

  if (!result.base64) {
    throw new Error("Image provider returned no polished video first frame.");
  }

  return sharp(Buffer.from(result.base64, "base64"))
    .rotate()
    .resize(width, height, { fit: "cover" })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function buildVideoReferenceBoard(
  referenceImageUrls: string[],
  speechMode: VideoSpeechMode,
  aspectRatio: string
): Promise<Buffer> {
  const vertical = aspectRatio === "9:16" || speechMode === "talking_review";
  const width = vertical ? 1080 : 1280;
  const height = vertical ? 1920 : 720;
  const bgSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="55%" stop-color="#eef8fb"/>
          <stop offset="100%" stop-color="#fff7ed"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
    </svg>`;
  const base = sharp(Buffer.from(bgSvg)).png();

  const slots = vertical
    ? [
        { left: 64, top: 64, width: 952, height: 1040 },
        { left: 104, top: 1160, width: 872, height: 520 },
        { left: 246, top: 1700, width: 588, height: 170 },
      ]
    : [
        { left: 42, top: 42, width: 744, height: 636 },
        { left: 824, top: 72, width: 408, height: 288 },
        { left: 824, top: 390, width: 408, height: 258 },
      ];

  const composites: sharp.OverlayOptions[] = [];
  for (let index = 0; index < referenceImageUrls.length && index < slots.length; index++) {
    const imageBuffer = await resolveVideoReferenceBuffer(referenceImageUrls[index]);
    if (!imageBuffer) continue;
    const slot = slots[index];
    const roundedImage = await renderReferenceSlot(imageBuffer, slot.width, slot.height);
    composites.push({ input: roundedImage, left: slot.left, top: slot.top });
  }

  if (composites.length === 0) {
    throw new Error("No reference images could be read for the video anchor.");
  }

  return base.composite(composites).jpeg({ quality: 92 }).toBuffer();
}

async function renderReferenceSlot(buffer: Buffer, width: number, height: number): Promise<Buffer> {
  const resized = await sharp(buffer)
    .rotate()
    .resize(width, height, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
  const maskSvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${width}" height="${height}" rx="36" ry="36" fill="#fff"/></svg>`;
  return sharp(resized)
    .composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function resolveVideoReferenceBuffer(referenceImageUrl: string): Promise<Buffer | null> {
  try {
    if (referenceImageUrl.startsWith("data:")) {
      const match = referenceImageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!match) return null;
      return Buffer.from(match[1], "base64");
    }

    if (referenceImageUrl.startsWith("http")) {
      const res = await fetch(referenceImageUrl);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }

    const localPath = referenceImageUrl.startsWith("/")
      ? path.join(process.cwd(), "public", referenceImageUrl)
      : path.join(process.cwd(), "public", referenceImageUrl);
    if (!fs.existsSync(localPath)) return null;
    return fs.readFileSync(localPath);
  } catch (error) {
    console.warn("[VideoStudio] Could not read video reference image:", error);
    return null;
  }
}

async function extendVeoVideoWithProcessingRetry(
  videoUri: string,
  prompt: string,
  aspectRatio: "16:9" | "9:16",
  onStatus?: (message: string) => void
): Promise<Awaited<ReturnType<typeof veoClient.extendVideo>>> {
  const retryDelaysMs = [0, 30000, 60000, 90000];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
    const delay = retryDelaysMs[attempt];
    if (delay > 0) {
      const seconds = Math.round(delay / 1000);
      onStatus?.(`Veo is still processing the previous segment. Retrying in ${seconds}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      return await veoClient.extendVideo(videoUri, prompt, { aspectRatio });
    } catch (error) {
      lastError = error;
      if (!isVeoProcessingDelayError(error) || attempt === retryDelaysMs.length - 1) {
        throw error;
      }
      console.warn(`[VideoStudio] Veo extension input not processed yet; retry ${attempt + 1}/${retryDelaysMs.length - 1}`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Veo extension failed while waiting for video processing.");
}

async function materializeReferenceImage(referenceImageUrl?: string | null): Promise<string | undefined> {
  if (!referenceImageUrl) return undefined;
  try {
    let buffer: Buffer | null = null;
    let ext = "png";
    if (referenceImageUrl.startsWith("data:")) {
      const match = referenceImageUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (!match) return undefined;
      ext = match[1].replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 4) || "png";
      buffer = Buffer.from(match[2], "base64");
    } else if (referenceImageUrl.startsWith("http")) {
      const res = await fetch(referenceImageUrl);
      if (!res.ok) return undefined;
      const type = res.headers.get("content-type") || "image/png";
      ext = type.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 4) || "png";
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      const localPath = referenceImageUrl.startsWith("/")
        ? path.join(process.cwd(), "public", referenceImageUrl)
        : path.join(process.cwd(), "public", referenceImageUrl);
      if (!fs.existsSync(localPath)) return undefined;
      ext = path.extname(localPath).replace(".", "") || "png";
      buffer = fs.readFileSync(localPath);
    }
    const tempPath = path.join(os.tmpdir(), `flow-video-ref-${nanoid(6)}.${ext}`);
    fs.writeFileSync(tempPath, buffer);
    return tempPath;
  } catch (error) {
    console.warn("[VideoStudio] Could not prepare video reference image:", error);
    return undefined;
  }
}

async function generateFallbackVideoBuffer(opts: {
  prompt: string;
  userPrompt: string;
  category: string;
  style: string;
  aspectRatio: string;
  duration: number;
  referenceImageUrl?: string | null;
  skipGrok?: boolean;
  allowExperimentalSlideshow?: boolean;
  onStatus?: (message: string) => void;
}): Promise<{ videoBuffer: Buffer; duration: number; provider: string }> {
  const errors: string[] = [];
  const aspect = normalizeVideoAspect(opts.aspectRatio);

  const grokDuration = Math.max(1, Math.min(15, Math.round(opts.duration || 8)));
  if (!opts.skipGrok && grokVideoClient.isAvailable()) {
    try {
      const result = await grokVideoClient.generateVideo(compactVideoProviderPrompt(opts.prompt), {
        duration: grokDuration,
        aspectRatio: aspect,
        resolution: "720p",
        imageUrl: opts.referenceImageUrl || undefined,
        onStatus: opts.onStatus,
      });
      return {
        videoBuffer: result.videoBuffer,
        duration: result.duration || grokDuration,
        provider: "grok",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      console.warn("[VideoStudio] Grok video fallback failed:", error);
    }
  }

  const soraDuration = opts.duration <= 4 ? "4" : opts.duration <= 8 ? "8" : "12";
  if (soraClient.isAvailable()) {
    if (opts.referenceImageUrl) {
      errors.push("Sora fallback skipped because this request uses a reference image and must preserve the exact product/person identity.");
    } else {
      try {
        const result = await soraClient.generateVideoBuffer(compactVideoProviderPrompt(opts.prompt, 3000), {
          seconds: soraDuration,
          size: (aspect === "9:16" ? "720x1280" : "1280x720") as never,
        });
        return {
          videoBuffer: result.videoBuffer,
          duration: result.duration || Number(soraDuration),
          provider: "sora",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        console.warn("[VideoStudio] Sora video fallback failed:", error);
      }
    }
  }

  if (opts.allowExperimentalSlideshow) {
    try {
      const script = await generateSlideshowScript(opts.userPrompt, opts.category, opts.style, 45);
      const slideshowImages = await generateSlideshowImages(script.scenes, opts.aspectRatio, () => undefined);
      const audioBuffer = await generateTTSAudio(script.scenes.map((scene) => scene.narration).join(" "), "nova");
      const videoBuffer = await compositeSlideshowVideo({
        scenes: script.scenes,
        images: slideshowImages,
        audioBuffer,
        resolution: "720p",
        aspectRatio: opts.aspectRatio,
      });
      return {
        videoBuffer,
        duration: await getSlideshowDuration(videoBuffer),
        provider: "slideshow",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      console.warn("[VideoStudio] Slideshow fallback failed:", error);
    }
  }

  const capabilityMessage =
    opts.duration > 15
      ? `${opts.duration}-second video requires the long-video provider. xAI/Grok and Sora fallback are limited to shorter production clips.`
      : "No production video provider is configured for this request";
  const lastError = errors.at(-1);
  throw new Error(lastError ? `${capabilityMessage}. Last provider note: ${lastError.replace(/\{[\s\S]*\}/g, "").trim()}` : capabilityMessage);
}

/**
 * Build an enhanced video prompt incorporating category and style.
 * Explicitly instructs the model to generate animated video with real motion,
 * camera movement, and dynamic action — not a static image.
 */
function buildVideoPrompt(
  userPrompt: string,
  category: string,
  style: string,
  durationSeconds = 8,
  referenceImageCount = 0,
  speechMode: VideoSpeechMode = "visual_only"
): string {
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
      "Cinematic brand introduction with sweeping camera movements, smooth dolly shots, particles and elements animating in, and dynamic reveal sequences.",
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
  const continuityDirective = [
    `Plan this as one seamless ${durationSeconds}-second story: opening hook, product or offer demonstration, proof or benefit moment, and final call-to-action visual.`,
    "Maintain the same subject, product identity, colors, lighting, environment, and brand style from the first frame to the last.",
    "Avoid jumpy resets, unrelated scene changes, duplicated starts, frozen frames, or any visible gap between moments.",
    referenceImageCount > 0
      ? "Use the reference image as the main identity anchor; preserve product shape, color, material, and recognizable details across every shot."
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const referenceLockDirective = referenceImageCount > 0
    ? `REFERENCE LOCK: The uploaded reference ${referenceImageCount > 1 ? "images are" : "image is"} the exact subject source. Preserve the real product/person/site identity from the reference. Do not substitute a similar product, do not change the bag/item design, do not invent a different presenter, and do not reinterpret the supplied website. Keep the same product silhouette, color, material, labels, person appearance, clothing style, face identity, and recognizable visual details as much as the provider allows. If multiple references are supplied, the backend may combine them into one neutral reference anchor; do not reproduce the anchor board, cards, or borders in the final video. Use it only to preserve the first image as the presenter/primary identity and the additional images as exact product/site/assets. Replace or improve the environment into a polished scene when requested, while keeping the referenced face, clothing style, and product identity unchanged.`
    : "";
  const speechDirective = buildVideoSpeechDirective(speechMode, durationSeconds);

  // Core directive: force the model to generate actual animated video, not a still image
  const motionDirective = "Create a fully animated video with continuous real motion, moving objects, camera movement (panning, zooming, tracking, orbiting), and dynamic action throughout the entire duration. This must NOT be a static image — everything should be visually moving and alive.";

  // Clean video directive: no text/branding burned into the video
  const cleanDirective = "CRITICAL — CLEAN VIDEO RULES: Do NOT render any text, brand names, logos, watermarks, titles, subtitles, captions, or any written words anywhere in the video. The video must be purely visual — clean, cinematic footage with NO overlaid text at all. Think of this as raw B-roll footage for a professional TV advertisement. If text absolutely must appear (like on a product label or storefront sign that naturally exists in the scene), keep it minimal, natural, and part of the environment — never as an overlay or graphic element.";

  const cleanPromptDirective =
    speechMode === "site_walkthrough"
      ? "CRITICAL CLEAN VIDEO RULES: Do not create fake marketing text overlays, subtitles, watermarks, or invented UI copy. Website text may appear only when it naturally belongs to the referenced site/page being shown."
      : speechMode === "talking_review"
        ? "SOCIAL REVIEW OVERLAY RULES: Tasteful TikTok/Reels-style review overlays are allowed when the request is a review: short hook text, star rating, comment bubble, simple like/comment/share counters, progress bar, or LIVE-style badge. Keep overlays readable, premium, and away from the face and product. Do not use copyrighted platform logos, watermarks, or fake provider marks."
      : cleanDirective;

  return `${continuityDirective} ${referenceLockDirective} ${speechDirective} ${motionDirective} ${catHint} ${styleHint} ${cleanPromptDirective} ${userPrompt}`.trim();
}

function buildVideoSpeechDirective(mode: VideoSpeechMode, durationSeconds: number): string {
  switch (mode) {
    case "talking_review":
      return `VIDEO FORMAT: Realistic TikTok-style product review for ${durationSeconds} seconds. Show exactly one natural presenter on camera speaking directly to the viewer with the referenced face preserved. The product must remain the exact referenced item and can be shown beside the presenter, on a table, in a clean product insert, or held in one natural way. Preserve normal anatomy: one head, one torso, two arms, two hands, natural fingers, no duplicated limbs, and no impossible grip. Do not lift the product overhead or cover the presenter's face unless the user explicitly asks. Use native synchronized speech from the visible presenter only. No disembodied voiceover or off-screen narrator.`;
    case "site_walkthrough":
      return `VIDEO FORMAT: Realistic website or offer walkthrough for ${durationSeconds} seconds. Show the user's site, product page, booking page, checkout, or offer clearly while a visible presenter talks through what viewers are seeing. The presenter can appear full frame, beside the screen, or picture-in-picture, but speech must come from the visible presenter. No separate voiceover narrator, no subtitles, and no fake interface text beyond what naturally appears on the site.`;
    case "voiceover_presentation":
      return `VIDEO FORMAT: Presentation-style marketing video for ${durationSeconds} seconds. Create clean product, website, feature, and benefit visuals designed for an added voiceover narration track. Do not show a lip-sync presenter talking to camera. Avoid visible mouths speaking, subtitles, or caption overlays. Leave visual breathing room for narration.`;
    case "visual_only":
    default:
      return `VIDEO FORMAT: Visual-only product or brand video for ${durationSeconds} seconds. No spoken words, no presenter dialogue, no voiceover, no subtitles, and no caption overlays. Communicate through realistic action, product handling, camera movement, and clear visual storytelling.`;
  }
}

/**
 * Build a continuation prompt for Veo 3 video extensions.
 * Instead of repeating the original prompt (which causes the AI to restart the same scene),
 * this instructs the model to naturally continue from where the previous segment ended.
 */
function buildExtensionPrompt(
  userPrompt: string,
  category: string,
  style: string,
  extensionNumber: number,
  totalExtensions: number,
  speechMode: VideoSpeechMode = "visual_only"
): string {
  const styleHints: Record<string, string> = {
    cinematic: "cinematic look with dramatic lighting and film-grade color grading",
    modern: "clean modern aesthetic with smooth transitions",
    minimal: "minimalist approach with elegant camera movements",
    energetic: "high-energy visuals with dynamic motion",
    elegant: "sophisticated premium look with graceful movement",
    retro: "retro/vintage aesthetic with warm tones",
  };
  const styleHint = styleHints[style] || "professional visual style";
  const speechHint = buildContinuationSpeechDirective(speechMode);

  const isLastSegment = extensionNumber === totalExtensions;
  const progressHint = isLastSegment
    ? "This is the FINAL segment — build toward a satisfying conclusion and memorable ending moment. End with a strong visual that leaves an impression."
    : `This is segment ${extensionNumber + 1} of ${totalExtensions + 1} — smoothly advance the story with new visuals, a different camera angle or perspective, and fresh visual content.`;

  return `CONTINUE this video seamlessly from exactly where it left off. This is a CONTINUATION, not a restart — do NOT repeat or recreate what was already shown. ${progressHint}

CONTINUATION RULES:
- Maintain visual continuity: same color grading, lighting style, and ${styleHint}
- Show NEW content: different angle, new detail, next moment in the sequence — advance the visual story
- Use a smooth, natural transition as if this were one continuous shot or a professional TV-style cut
- Keep the same mood and energy level but evolve the scene naturally
- ${speechHint}
- Keep the same referenced product/person/site identity. Do not replace the product, presenter, or website with a different invented subject.
- If this is a talking review, preserve the presenter face and exact product, keep normal anatomy with two hands only, and do not add duplicate arms, duplicate products, or impossible holding poses.
- Do NOT render any text, brand names, titles, or written words in the video — keep it purely visual
- Think of this as the next shot in a professional TV commercial — each cut shows something new while maintaining the flow

Original concept: ${userPrompt}`.trim();
}

function buildContinuationSpeechDirective(mode: VideoSpeechMode): string {
  switch (mode) {
    case "talking_review":
      return "Keep the same visible presenter speaking naturally to camera with synced mouth movement; preserve the referenced face and exact product. The product can stay beside the presenter, on a table, in a product insert, or held naturally with normal two-hand anatomy. Do not switch to an off-screen voiceover.";
    case "site_walkthrough":
      return "Keep the same visible presenter or picture-in-picture walkthrough voice connected to the website or offer being shown. Do not switch to a separate narrator.";
    case "voiceover_presentation":
      return "Continue with clean visuals prepared for external voiceover; do not show a lip-sync presenter talking.";
    case "visual_only":
    default:
      return "Continue as a visual-only sequence with no speech, no narration, and no subtitles.";
  }
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
 * Download a logo from URL, data URI, or local path.
 */
async function downloadLogoFile(logoUrl: string): Promise<Buffer | null> {
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
        console.warn(`[VideoStudio] Logo fetch returned ${response.status} for ${logoUrl.substring(0, 80)}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // Absolute file path
    if (fs.existsSync(logoUrl)) {
      return fs.readFileSync(logoUrl);
    }

    console.warn(`[VideoStudio] Unknown logo format: ${logoUrl.substring(0, 60)}`);
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
 * Build native-audio direction for providers that can generate speech with video.
 */
function buildNativeAudioDirective(mode: VideoSpeechMode, gender: string, accent: string): string {
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

  switch (mode) {
    case "talking_review":
      return `NATIVE AUDIO RULE: Generate natural synchronized speech from the visible on-camera presenter only. The presenter should sound like a confident ${genderLabel} UGC creator with a ${accentLabel} accent. Mouth movement must match the speech. Do not add a separate narrator or voiceover track.`;
    case "site_walkthrough":
      return `NATIVE AUDIO RULE: Generate natural synchronized speech from the visible presenter explaining the site or offer. The presenter should sound like a helpful ${genderLabel} guide with a ${accentLabel} accent. Do not add a separate narrator or detached voiceover.`;
    case "voiceover_presentation":
      return "NATIVE AUDIO RULE: Keep provider-generated speech minimal because FlowAI will add a clean narration track after generation. Prefer natural ambient sound or quiet background motion rather than visible lip-sync speech.";
    case "visual_only":
    default:
      return "NATIVE AUDIO RULE: No spoken words, no dialogue, no narration, no voiceover, and no lip-sync speech. Ambient product or environment sound is acceptable only if the provider requires audio.";
  }
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
