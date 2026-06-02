import { veoClient } from "./veo-client";
import { grokVideoClient } from "./grok-video-client";
import { videoChain, type VideoRole, type VideoProvider } from "./media-models";

/**
 * Video router — the single entry point for text-to-video generation. Walks
 * the GLOBAL video policy (media-models VIDEO_CHAINS) for a role and returns
 * the first provider that succeeds, so every surface (chat generate_video,
 * assistant chat, video studio) gets the SAME quality-first ladder + fallback.
 *
 * Provider capabilities baked into the routing:
 *   - Veo 3.1 = highest fidelity + native audio, but a single shot maxes at 8s
 *     and only does 16:9 / 9:16. So Veo steps are SKIPPED when the requested
 *     duration is > 8s (use Grok for longer clips).
 *   - Grok = 1–15s, up to 720p, many aspect ratios, image-to-video.
 *
 * Never surface provider/model names to the user (Premium / Standard only).
 */

const VEO_MAX_SINGLE_SHOT_SECONDS = 8;

export interface VideoGenInput {
  prompt: string;
  durationSeconds: number;
  aspectRatio: "1:1" | "16:9" | "9:16";
  /** Target resolution. Premium roles default to 1080p (Veo only). */
  resolution?: "720p" | "1080p";
  /** First-frame / image-to-video source. */
  referenceImageUrl?: string | null;
  /** Veo character anchors (face/wardrobe consistency, up to 3). */
  characterReferenceUrls?: string[];
  disableAudio?: boolean;
  onStatus?: (message: string) => void;
}

export interface VideoGenResult {
  videoBuffer: Buffer;
  provider: VideoProvider;
  model: string;
}

export async function generateVideoForRole(
  role: VideoRole,
  input: VideoGenInput,
): Promise<VideoGenResult> {
  const duration = Math.max(1, Math.round(input.durationSeconds || 8));
  const isPremium = role === "video_premium";
  let lastError: unknown = null;
  let consideredAny = false;

  for (const step of videoChain(role)) {
    if (step.provider === "veo3") {
      // Veo single-shot can't exceed 8s — skip it for longer clips.
      if (duration > VEO_MAX_SINGLE_SHOT_SECONDS || !veoClient.isAvailable()) continue;
      consideredAny = true;
      try {
        input.onStatus?.("Rendering video…");
        const veoAspect: "16:9" | "9:16" = input.aspectRatio === "16:9" ? "16:9" : "9:16";
        const veoTier = step.veoTier ?? (isPremium ? "quality" : "fast");
        const result = await veoClient.generateVideoBuffer(input.prompt, {
          durationSeconds: String(Math.min(VEO_MAX_SINGLE_SHOT_SECONDS, duration)) as "4" | "6" | "8",
          resolution: input.resolution || (isPremium ? "1080p" : "720p"),
          aspectRatio: veoAspect,
          tier: veoTier,
          referenceImageUrl: input.referenceImageUrl ?? null,
          characterReferenceUrls: input.characterReferenceUrls ?? [],
          disableAudio: input.disableAudio,
        });
        if (result.videoBuffer?.length) {
          return { videoBuffer: result.videoBuffer, provider: "veo3", model: `veo-3.1-${veoTier}` };
        }
        throw new Error("Veo returned no video");
      } catch (error) {
        lastError = error;
        console.warn("[VideoRouter] Veo failed, trying next:", error instanceof Error ? error.message : error);
      }
    } else if (step.provider === "grok") {
      if (!grokVideoClient.isAvailable()) continue;
      consideredAny = true;
      try {
        const result = await grokVideoClient.generateVideo(input.prompt, {
          duration: Math.min(15, duration),
          aspectRatio: input.aspectRatio,
          // Grok tops out at 720p.
          resolution: "720p",
          imageUrl: input.referenceImageUrl ?? undefined,
          onStatus: input.onStatus,
        });
        if (result.videoBuffer?.length) {
          return { videoBuffer: result.videoBuffer, provider: "grok", model: "grok-imagine-video" };
        }
        throw new Error("Grok returned no video");
      } catch (error) {
        lastError = error;
        console.warn("[VideoRouter] Grok failed, trying next:", error instanceof Error ? error.message : error);
      }
    }
    // "sora" steps (none in the current chains) fall through.
  }

  if (!consideredAny) {
    throw new Error("No video provider is configured for this environment.");
  }
  throw new Error(lastError instanceof Error ? lastError.message : "Video generation failed");
}
