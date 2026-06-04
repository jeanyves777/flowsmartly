import { veoClient } from "@/lib/ai/veo-client";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { concatenateVideoBuffers } from "./concat-videos";

/**
 * Long-video composite — builds a video LONGER than a single Veo shot (8s) by
 * generating multiple high-quality segments and stitching them, instead of
 * dropping to a single capped xAI/Grok clip. Two modes the orchestrator agent
 * chooses between:
 *
 *   • multi-scene  — the agent passes `scenes[]` (distinct shots for an ad).
 *     Each scene renders as its own ~8s Veo clip; clips are concatenated
 *     (story-ad style). Scenes render in PARALLEL (independent) so total wall
 *     time ≈ one shot.
 *   • continuous   — one `prompt`, no scenes. Veo's native extend-chaining
 *     grows ONE coherent shot to the target length (each extend continues the
 *     exact prior video). Sequential by nature.
 *
 * Veo (Google) is the quality engine and is unaffected by the OpenAI image
 * quota. When Veo isn't available (or aspect is 1:1, which Veo can't do), we
 * fall back to Grok segments + concat so the user still gets a real long video.
 *
 * Segment count is capped at 4 (~32s) so even a fully sequential render stays
 * well under the background-task orphan-failsafe window. Raise with heartbeats
 * if longer is needed.
 */

const VEO_SHOT_SECONDS = 8;
const MAX_SEGMENTS = 4;

export type CompositeAspect = "16:9" | "9:16" | "1:1";

export interface CompositeVideoInput {
  prompt: string;
  /** Distinct scene prompts → multi-scene cut. Omit for a continuous shot. */
  scenes?: string[];
  totalSeconds: number;
  aspectRatio: CompositeAspect;
  tier: "premium" | "standard";
  onStatus?: (message: string) => void;
}

export interface CompositeVideoResult {
  videoBuffer: Buffer;
  segments: number;
  mode: "continuous" | "multi-scene";
  provider: "veo3" | "grok";
}

/** How many ~8s segments a target length needs (capped). Used for cost too. */
export function planSegmentCount(totalSeconds: number, sceneCount?: number): number {
  if (sceneCount && sceneCount >= 2) return Math.min(MAX_SEGMENTS, sceneCount);
  return Math.max(1, Math.min(MAX_SEGMENTS, Math.ceil(totalSeconds / VEO_SHOT_SECONDS)));
}

function veoAspect(a: CompositeAspect): "16:9" | "9:16" {
  return a === "16:9" ? "16:9" : "9:16";
}

/** Render one ~8s shot — Veo when possible, else Grok. Never returns empty. */
async function renderShot(
  prompt: string,
  aspectRatio: CompositeAspect,
  tier: "premium" | "standard",
  canUseVeo: boolean,
): Promise<Buffer> {
  if (canUseVeo) {
    try {
      const r = await veoClient.generateVideoBuffer(prompt, {
        durationSeconds: "8",
        aspectRatio: veoAspect(aspectRatio),
        resolution: tier === "premium" ? "1080p" : "720p",
        tier: tier === "premium" ? "quality" : "fast",
      });
      if (r.videoBuffer?.length) return r.videoBuffer;
    } catch (e) {
      console.warn("[long-video] Veo shot failed, falling back to Grok:", e instanceof Error ? e.message : e);
    }
  }
  const g = await grokVideoClient.generateVideo(prompt, {
    duration: 8,
    aspectRatio,
    resolution: "720p",
  });
  if (!g.videoBuffer?.length) throw new Error("Scene render returned no video");
  return g.videoBuffer;
}

export async function generateCompositeVideo(input: CompositeVideoInput): Promise<CompositeVideoResult> {
  // Veo can't do 1:1; route those (and Veo-unavailable) to the Grok concat path.
  const canUseVeo = veoClient.isAvailable() && input.aspectRatio !== "1:1";
  const scenes = (input.scenes || [])
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, MAX_SEGMENTS);
  const isMultiScene = scenes.length >= 2;

  // ── Multi-scene cut: one shot per scene (parallel), then concat ──
  if (isMultiScene) {
    input.onStatus?.(`Rendering ${scenes.length} scenes…`);
    const buffers = await Promise.all(
      scenes.map((scene) => renderShot(scene, input.aspectRatio, input.tier, canUseVeo)),
    );
    const videoBuffer = await concatenateVideoBuffers(buffers);
    return { videoBuffer, segments: buffers.length, mode: "multi-scene", provider: canUseVeo ? "veo3" : "grok" };
  }

  // ── Continuous: Veo extend-chaining (one coherent shot) ──
  if (canUseVeo) {
    input.onStatus?.("Rendering opening shot…");
    let gen = await veoClient.generateVideoBuffer(input.prompt, {
      durationSeconds: "8",
      aspectRatio: veoAspect(input.aspectRatio),
      resolution: input.tier === "premium" ? "1080p" : "720p",
      tier: input.tier === "premium" ? "quality" : "fast",
    });
    let videoBuffer = gen.videoBuffer;
    let videoUri = gen.videoUri;
    let segments = 1;
    let elapsed = VEO_SHOT_SECONDS;
    // Each extend adds ~7s of combined video; cap by segment budget.
    while (elapsed < input.totalSeconds && videoUri && segments < MAX_SEGMENTS) {
      input.onStatus?.(`Extending the shot (~${elapsed}s)…`);
      try {
        gen = await veoClient.extendVideo(videoUri, input.prompt, {
          aspectRatio: veoAspect(input.aspectRatio),
          fast: input.tier !== "premium",
        });
      } catch (e) {
        console.warn("[long-video] Veo extend failed, returning what we have:", e instanceof Error ? e.message : e);
        break;
      }
      if (!gen.videoBuffer?.length) break;
      videoBuffer = gen.videoBuffer;
      videoUri = gen.videoUri;
      elapsed += 7;
      segments += 1;
    }
    return { videoBuffer, segments, mode: "continuous", provider: "veo3" };
  }

  // ── Fallback: Grok segments (≤15s each) concatenated ──
  const perClip = 15;
  const count = Math.max(1, Math.min(MAX_SEGMENTS, Math.ceil(input.totalSeconds / perClip)));
  input.onStatus?.(`Rendering ${count} part${count > 1 ? "s" : ""}…`);
  const parts: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const secs = Math.max(4, Math.min(perClip, input.totalSeconds - i * perClip));
    const r = await grokVideoClient.generateVideo(input.prompt, {
      duration: secs,
      aspectRatio: input.aspectRatio,
      resolution: "720p",
    });
    if (r.videoBuffer?.length) parts.push(r.videoBuffer);
  }
  if (parts.length === 0) throw new Error("Video generation returned no clips");
  const videoBuffer = await concatenateVideoBuffers(parts);
  return { videoBuffer, segments: parts.length, mode: "continuous", provider: "grok" };
}
