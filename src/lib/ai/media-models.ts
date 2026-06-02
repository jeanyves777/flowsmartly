import type { ImageProvider } from "@/lib/constants/design-presets";

/**
 * GLOBAL MEDIA-MODEL POLICY — single source of truth for which AI model runs
 * for every image/video role across the whole app (FlowCreative, the Flow-AI
 * chat agent, edit, story-ad / narration, video studio).
 *
 * Decided 2026-06-02 (cost + quality evaluation — see feedback-media-provider-labels):
 *   - Google is the MAIN engine for design generation + editing: it's both the
 *     highest quality for our text-heavy branded work AND the cheapest.
 *   - OpenAI gpt-image is the explicit PREMIUM request (sharpest typography) and
 *     a last-resort fallback.
 *   - Cheap/bulk work (narration video stills, story-ad slideshows, multi-image)
 *     uses the fast/economy models.
 *
 * Chains are ordered "best-value first → fall back down the list". The router
 * walks the chain and uses the first provider+model that succeeds, so a provider
 * outage never hard-fails a request.
 *
 * Model IDs are env-overridable so we can retune without a deploy.
 * NEVER expose these provider/model names in user-facing copy — the UI only
 * shows "Standard" / "Premium" (see feedback-media-provider-labels).
 */

const env = process.env;

// ── Image model IDs ──────────────────────────────────────────────────────
export const IMAGE_MODEL_IDS = {
  imagenUltra: env.IMAGEN_ULTRA_MODEL || "imagen-4.0-ultra-generate-001",
  imagenFlagship: env.IMAGEN_FLAGSHIP_MODEL || "imagen-4.0-generate-001",
  imagenFast: env.IMAGEN_FAST_MODEL || "imagen-4.0-fast-generate-001",
  nanoBanana: env.GEMINI_EDIT_MODEL || "gemini-2.5-flash-image",
  xaiBase: env.XAI_IMAGE_MODEL || "grok-imagine-image",
  gptImage1: env.OPENAI_IMAGE_MODEL || "gpt-image-1",
  gptImage2: env.OPENAI_IMAGE_MODEL_2 || "gpt-image-2",
} as const;

export interface ImageModelStep {
  provider: ImageProvider; // "xai" | "openai" | "gemini" | "flow"
  model: string;
}

/**
 * Image roles:
 *  - design_generate: from-scratch branded/marketing designs (FlowCreative + chat) → Imagen 4 Ultra
 *  - design_edit:     editing an existing design/image                            → Gemini 2.5 Flash (Nano Banana)
 *  - bulk_multi:      narration-video stills / story-ad slideshows / multi-image  → Imagen 4 Fast (cheap)
 *  - premium:         explicit Premium request                                    → OpenAI gpt-image
 */
export type ImageRole = "design_generate" | "design_edit" | "bulk_multi" | "premium";

const M = IMAGE_MODEL_IDS;

export const IMAGE_CHAINS: Record<ImageRole, ImageModelStep[]> = {
  design_generate: [
    { provider: "gemini", model: M.imagenUltra },
    { provider: "gemini", model: M.imagenFlagship },
    { provider: "openai", model: M.gptImage1 },
    { provider: "xai", model: M.xaiBase },
  ],
  // Edit/reference work — only providers that accept an input image. Gemini's
  // Nano Banana is the best editor (identity + text); OpenAI then xAI back it up.
  design_edit: [
    { provider: "gemini", model: M.nanoBanana },
    { provider: "openai", model: M.gptImage1 },
    { provider: "xai", model: M.xaiBase },
  ],
  bulk_multi: [
    { provider: "gemini", model: M.imagenFast },
    { provider: "xai", model: M.xaiBase },
    { provider: "gemini", model: M.imagenFlagship },
  ],
  premium: [
    { provider: "openai", model: M.gptImage1 },
    { provider: "openai", model: M.gptImage2 },
    { provider: "gemini", model: M.imagenUltra },
  ],
};

export type MediaTier = "standard" | "premium";

/** Map the user-facing tier to an image GENERATION role. */
export function imageGenerateRole(tier: MediaTier): ImageRole {
  return tier === "premium" ? "premium" : "design_generate";
}
/** Map the user-facing tier to an image EDIT role. */
export function imageEditRole(tier: MediaTier): ImageRole {
  return tier === "premium" ? "premium" : "design_edit";
}
/** Resolve a role to its ordered provider+model chain. */
export function imageChain(role: ImageRole): ImageModelStep[] {
  return IMAGE_CHAINS[role];
}

// ── Video model policy ───────────────────────────────────────────────────
// Same philosophy: best-value first → fall back. Providers map to the existing
// clients (Veo 3.1 tiers, xAI Grok video, Sora).
export type VideoProvider = "veo3" | "grok" | "sora";
export type VeoTier = "lite" | "fast" | "quality";

export interface VideoModelStep {
  provider: VideoProvider;
  /** For Veo, which internal tier (lite/fast/quality). Ignored for grok/sora. */
  veoTier?: VeoTier;
}

export type VideoRole = "video_standard" | "video_premium" | "bulk_video";

export const VIDEO_CHAINS: Record<VideoRole, VideoModelStep[]> = {
  // Standard: cheap-but-good first. Grok is the economy option; Veo fast backs it up.
  video_standard: [
    { provider: "grok" },
    { provider: "veo3", veoTier: "fast" },
  ],
  // Premium: highest fidelity with native audio, falling back down the cost ladder.
  video_premium: [
    { provider: "veo3", veoTier: "quality" },
    { provider: "veo3", veoTier: "fast" },
    { provider: "grok" },
  ],
  // Bulk (story-ad hook clips / per-scene) — keep it cheap.
  bulk_video: [
    { provider: "grok" },
    { provider: "veo3", veoTier: "lite" },
  ],
};

export function videoRole(tier: MediaTier): VideoRole {
  return tier === "premium" ? "video_premium" : "video_standard";
}
export function videoChain(role: VideoRole): VideoModelStep[] {
  return VIDEO_CHAINS[role];
}
