import { veoClient } from "./veo-client";
import { grokVideoClient } from "./grok-video-client";
import { videoChain, type VideoRole, type VideoProvider } from "./media-models";
import { isBlankVideoBuffer } from "@/lib/media/video-quality-guard";

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
// xAI Grok renders a single clip up to 15s; longer shots are built by chaining
// seamless extensions (2–10s each) from the last frame. Cap the total so a shot
// can't balloon into an unbounded render (each extra segment is its own render).
const GROK_MAX_SINGLE_SHOT_SECONDS = 15;   // text-to-video single clip
const GROK_MAX_IMG2VID_SECONDS = 8;        // image-to-video (reference image) hard-caps ~8.7s → keep 8
const GROK_MAX_LONGFORM_SECONDS = 30;

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
  /** Called when the upstream provider job is created, so the caller can
   *  persist {provider, jobId} and resume/pull it after a restart. */
  onJobId?: (info: { provider: VideoProvider; jobId: string }) => void | Promise<void>;
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
          // Persist a resumable handle (the Veo operation name) so an orphaned
          // render can be recovered after a restart — same as Grok.
          onOperationName: (name) => input.onJobId?.({ provider: "veo3", jobId: name }),
        });
        if (result.videoBuffer?.length) {
          const vcheck = await isBlankVideoBuffer(result.videoBuffer);
          if (!vcheck.blank) {
            return { videoBuffer: result.videoBuffer, provider: "veo3", model: `veo-3.1-${veoTier}` };
          }
          console.warn(`[VideoRouter] Veo returned a blank/black video (${vcheck.reason}); trying next`);
        }
        throw new Error("Veo returned no usable video (empty or blank/black)");
      } catch (error) {
        lastError = error;
        console.warn("[VideoRouter] Veo failed, trying next:", error instanceof Error ? error.message : error);
      }
    } else if (step.provider === "grok") {
      if (!grokVideoClient.isAvailable()) continue;
      consideredAny = true;
      try {
        // Base clip, then chain seamless extensions off the xAI clip URL until we
        // reach the target (or a segment fails — then we keep what we have rather than
        // losing the whole shot). CRITICAL: xAI IMAGE-TO-VIDEO (a reference/keyframe
        // image) caps at ~8.7s and hard-fails "Video is too long" above that — so with
        // a reference image the BASE is ≤8s and the rest is built from extensions
        // (which are video-to-video, not image-to-video). Text-to-video allows ≤15s.
        const target = Math.min(GROK_MAX_LONGFORM_SECONDS, duration);
        const baseMax = input.referenceImageUrl ? GROK_MAX_IMG2VID_SECONDS : GROK_MAX_SINGLE_SHOT_SECONDS;
        const result = await grokVideoClient.generateVideo(input.prompt, {
          duration: Math.min(baseMax, target),
          aspectRatio: input.aspectRatio,
          // Grok tops out at 720p.
          resolution: "720p",
          imageUrl: input.referenceImageUrl ?? undefined,
          onStatus: input.onStatus,
          onJobId: (jobId) => input.onJobId?.({ provider: "grok", jobId }),
        });
        let videoBuffer = result.videoBuffer;
        let sourceUrl = result.videoUrl;
        let have = Math.min(baseMax, target);
        while (have < target && sourceUrl) {
          const need = Math.min(10, target - have);
          if (need < 2) break; // extensions are 2–10s
          input.onStatus?.(`Extending the shot to ${have + need}s…`);
          try {
            const ext = await grokVideoClient.extendVideo(sourceUrl, input.prompt, {
              duration: need,
              onStatus: input.onStatus,
              // Persist THIS segment's job so a restart resumes the latest extension.
              onJobId: (jobId) => input.onJobId?.({ provider: "grok", jobId }),
            });
            if (!ext.videoBuffer?.length) break;
            videoBuffer = ext.videoBuffer; // extendVideo returns the COMBINED clip
            sourceUrl = ext.videoUrl;
            have += need;
          } catch (e) {
            console.warn("[VideoRouter] Grok extension failed; using the clip so far:", e instanceof Error ? e.message : e);
            break;
          }
        }
        if (videoBuffer?.length) {
          const vcheck = await isBlankVideoBuffer(videoBuffer);
          if (!vcheck.blank) {
            return { videoBuffer, provider: "grok", model: "grok-imagine-video" };
          }
          console.warn(`[VideoRouter] Grok returned a blank/black video (${vcheck.reason}); trying next`);
        }
        throw new Error("Grok returned no usable video (empty or blank/black)");
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
