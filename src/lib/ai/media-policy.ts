import { prisma } from "@/lib/db/client";
import type { ImageProvider } from "@/lib/constants/design-presets";
import {
  IMAGE_CHAINS,
  IMAGE_MODEL_IDS,
  type ImageRole,
  type ImageModelStep,
} from "./media-models";

/**
 * IMAGE-PIPELINE POLICY — a hot-swappable overlay on top of the static
 * media-model chains (src/lib/ai/media-models.ts). The admin Control Hub writes
 * this to the `image_pipeline_policy` SystemSetting row so provider order, model
 * choice, and the art-direction recipe can be retuned WITHOUT a deploy (the VPS
 * deploy patches code but never runs `prisma db push`, and SystemSetting already
 * exists — so we persist JSON into a value column, no migration needed).
 *
 * The router (generateImageForRole / editImagesForRole) resolves a role's chain
 * through here: a saved override wins, else the code default. Invalid/empty
 * overrides fall back to the default so a bad edit can never brick generation.
 */

export const IMAGE_POLICY_KEY = "image_pipeline_policy";

export interface RecipeConfig {
  /** Full-bleed / anti-card rules (design fills the canvas, never a card on a bg). */
  fullBleed: boolean;
  /** Premium-polish art-direction (Stripe/Linear-grade depth, glassmorphism, 2K sharpness). */
  premiumPolish: boolean;
  /** Reinforce EXACT copy (no misspelling / duplication / invented text). */
  enforceExactCopy: boolean;
  /** Model draws NO brand mark; the real logo is composited exactly once. */
  singleLogo: boolean;
}

export interface ImagePipelinePolicy {
  /** Per-role provider+model chain overrides. Missing role → code default. */
  chains: Partial<Record<ImageRole, ImageModelStep[]>>;
  recipe: RecipeConfig;
}

export const DEFAULT_RECIPE: RecipeConfig = {
  fullBleed: true,
  premiumPolish: true,
  enforceExactCopy: true,
  singleLogo: true,
};

const VALID_PROVIDERS: ReadonlySet<string> = new Set(["xai", "openai", "gemini", "flow"]);
const ALL_ROLES: ImageRole[] = ["design_generate", "design_edit", "bulk_multi", "premium"];

/** The catalog the Control Hub offers per provider (id → friendly label). */
export const IMAGE_MODEL_CATALOG: Record<ImageProvider, { id: string; label: string }[]> = {
  xai: [
    { id: IMAGE_MODEL_IDS.xaiQuality, label: "Grok Imagine — Quality (2K)" },
    { id: IMAGE_MODEL_IDS.xaiBase, label: "Grok Imagine — Base" },
  ],
  gemini: [
    { id: IMAGE_MODEL_IDS.nanoBanana, label: "Nano Banana (Gemini 2.5 Flash Image)" },
    { id: IMAGE_MODEL_IDS.imagenUltra, label: "Imagen 4 Ultra" },
    { id: IMAGE_MODEL_IDS.imagenFlagship, label: "Imagen 4" },
    { id: IMAGE_MODEL_IDS.imagenFast, label: "Imagen 4 Fast" },
  ],
  openai: [
    { id: IMAGE_MODEL_IDS.gptImage1, label: "GPT Image 1" },
    { id: IMAGE_MODEL_IDS.gptImage2, label: "GPT Image 2" },
  ],
};

export function defaultImagePolicy(): ImagePipelinePolicy {
  // Deep-clone the static chains so callers can't mutate the module constant.
  const chains: Partial<Record<ImageRole, ImageModelStep[]>> = {};
  for (const role of ALL_ROLES) chains[role] = IMAGE_CHAINS[role].map((s) => ({ ...s }));
  return { chains, recipe: { ...DEFAULT_RECIPE } };
}

function sanitizeChain(raw: unknown): ImageModelStep[] | null {
  if (!Array.isArray(raw)) return null;
  const steps: ImageModelStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const provider = (s as { provider?: unknown }).provider;
    const model = (s as { model?: unknown }).model;
    if (typeof provider === "string" && VALID_PROVIDERS.has(provider) && typeof model === "string" && model.trim()) {
      steps.push({ provider: provider as ImageProvider, model: model.trim() });
    }
  }
  return steps.length ? steps : null;
}

function sanitizePolicy(raw: unknown): ImagePipelinePolicy {
  const base = defaultImagePolicy();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as { chains?: unknown; recipe?: unknown };
  // Recipe: coerce each flag, default-on.
  const r = (obj.recipe && typeof obj.recipe === "object" ? obj.recipe : {}) as Partial<RecipeConfig>;
  base.recipe = {
    fullBleed: r.fullBleed !== false,
    premiumPolish: r.premiumPolish !== false,
    enforceExactCopy: r.enforceExactCopy !== false,
    singleLogo: r.singleLogo !== false,
  };
  // Chains: only accept valid, non-empty per-role overrides; else keep default.
  if (obj.chains && typeof obj.chains === "object") {
    for (const role of ALL_ROLES) {
      const cleaned = sanitizeChain((obj.chains as Record<string, unknown>)[role]);
      if (cleaned) base.chains[role] = cleaned;
    }
  }
  return base;
}

// ── cache (30s TTL) so the hot path doesn't hit the DB every generation ──
let cache: { policy: ImagePipelinePolicy; at: number } | null = null;
const TTL_MS = 30_000;

/** Read the effective policy (override merged over code defaults), cached. */
export async function getImagePipelinePolicy(): Promise<ImagePipelinePolicy> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.policy;
  let policy = defaultImagePolicy();
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: IMAGE_POLICY_KEY } });
    if (row?.value) policy = sanitizePolicy(JSON.parse(row.value));
  } catch {
    /* DB/parse error → safe defaults */
  }
  cache = { policy, at: Date.now() };
  return policy;
}

/** Resolve a role's provider+model chain: saved override wins, else code default. */
export async function resolveImageChain(role: ImageRole): Promise<ImageModelStep[]> {
  const policy = await getImagePipelinePolicy();
  const chain = policy.chains[role];
  return chain && chain.length ? chain : IMAGE_CHAINS[role];
}

/** The art-direction recipe flags (cached with the policy). */
export async function getRecipeConfig(): Promise<RecipeConfig> {
  return (await getImagePipelinePolicy()).recipe;
}

/** Persist a full policy (admin Control Hub). Sanitized before write; busts cache. */
export async function setImagePipelinePolicy(raw: unknown, updatedBy?: string | null): Promise<ImagePipelinePolicy> {
  const clean = sanitizePolicy(raw);
  await prisma.systemSetting.upsert({
    where: { key: IMAGE_POLICY_KEY },
    create: {
      key: IMAGE_POLICY_KEY,
      value: JSON.stringify(clean),
      type: "json",
      category: "ai",
      description: "Image-generation provider chains + art-direction recipe (Control Hub).",
      updatedBy: updatedBy ?? null,
    },
    update: { value: JSON.stringify(clean), updatedBy: updatedBy ?? null },
  });
  cache = { policy: clean, at: Date.now() };
  return clean;
}

/** Force the next read to hit the DB (used after an external write). */
export function bustImagePolicyCache(): void {
  cache = null;
}
