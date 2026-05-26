import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { nanoid } from "nanoid";
import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { TRANSACTION_TYPES, creditService } from "@/lib/credits";
import { DEFAULT_CREDIT_COSTS, type CreditCostKey } from "@/lib/credits/costs";
import { veoClient } from "@/lib/ai/veo-client";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { generateVoice } from "@/lib/voice/voice-engine";
import {
  ACT_LABELS,
  CAMERA_LABELS,
  NEGATIVE_TEXT_PROMPT,
  SHOT_LABELS,
  STYLE_LABELS,
  STYLE_VISUAL_LANGUAGE,
  clipsForDuration,
  emptyCampaignState,
  type ActPosition,
  type CameraMovement,
  type CampaignAspectRatio,
  type CampaignCharacter,
  type CampaignClipLength,
  type CampaignClipSlot,
  type ClipDialogueLine,
  type CampaignDurationSeconds,
  type NarratorVoice,
  type CampaignProvider,
  type CampaignState,
  type CampaignStyle,
  type ShotType,
} from "./types";

export type { CampaignState, CampaignClipSlot, CampaignCharacter, CampaignStyle } from "./types";

const ANIMATION_TYPE = "story_ad_campaign";

interface BrandSnapshot {
  name: string;
  tagline?: string | null;
  description?: string | null;
  industry?: string | null;
  targetAudience?: string | null;
  voiceTone?: string | null;
  website?: string | null;
  logo?: string | null;
  uniqueValue?: string | null;
  personality: string[];
  products: string[];
}

function parseArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

// =============================================================
// Credit deduction for every AI call in this pipeline
// =============================================================

export interface ChargeResult {
  ok: boolean;
  /** Credits the user has after this charge. */
  remaining: number;
  /** When ok=false: how many were required vs available. */
  required?: number;
  available?: number;
}

/**
 * Centralised credit charge for every Story Ad Campaign AI call.
 * Returns { ok: false } when the user can't afford it — callers should
 * surface a 402 with INSUFFICIENT_CREDITS. Admins are exempt.
 */
export async function chargeStoryAdCampaignUsage(input: {
  userId: string;
  isAdmin: boolean;
  costKey: CreditCostKey;
  multiplier?: number; // e.g. number of dialogue lines voiced
  campaignId: string;
  description: string;
}): Promise<ChargeResult> {
  const unit = DEFAULT_CREDIT_COSTS[input.costKey] || 0;
  const amount = Math.max(0, Math.round(unit * (input.multiplier ?? 1)));

  if (input.isAdmin || amount === 0) {
    return { ok: true, remaining: 0 };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { aiCredits: true },
  });
  const available = user?.aiCredits ?? 0;
  if (available < amount) {
    return { ok: false, remaining: available, required: amount, available };
  }

  const charge = await creditService.deductCredits({
    userId: input.userId,
    type: TRANSACTION_TYPES.USAGE,
    amount,
    referenceType: "story_ad_campaign",
    referenceId: input.campaignId,
    description: input.description,
    metadata: { feature: input.costKey },
  });
  if (!charge.success) {
    return { ok: false, remaining: available, required: amount, available };
  }
  return { ok: true, remaining: charge.transaction?.balanceAfter ?? available - amount };
}

export async function refundStoryAdCampaignUsage(input: {
  userId: string;
  amount: number;
  campaignId: string;
  reason: string;
}): Promise<void> {
  if (input.amount <= 0) return;
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { aiCredits: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { aiCredits: { increment: input.amount } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        type: TRANSACTION_TYPES.REFUND,
        amount: input.amount,
        balanceAfter: (user?.aiCredits || 0) + input.amount,
        referenceType: "story_ad_campaign",
        referenceId: input.campaignId,
        description: input.reason,
      },
    });
  });
}

export async function getBrandSnapshot(userId: string): Promise<BrandSnapshot> {
  const brand =
    (await prisma.brandKit.findFirst({ where: { userId, isDefault: true } })) ||
    (await prisma.brandKit.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } }));
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });

  if (!brand) {
    return {
      name: user?.name || user?.username || "Your brand",
      personality: [],
      products: [],
    };
  }

  return {
    name: brand.name,
    tagline: brand.tagline,
    description: brand.description,
    industry: brand.industry,
    targetAudience: brand.targetAudience,
    voiceTone: brand.voiceTone,
    website: brand.website,
    logo: brand.logo,
    uniqueValue: brand.uniqueValue,
    personality: parseArray(brand.personality),
    products: parseArray(brand.products),
  };
}

export function readCampaign(metadata: string | null | undefined): CampaignState {
  try {
    const parsed = JSON.parse(metadata || "{}");
    if (parsed && parsed.campaign) {
      return { ...emptyCampaignState(), ...parsed.campaign };
    }
  } catch {
    // fall through
  }
  return emptyCampaignState();
}

export function writeCampaign(state: CampaignState, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ product: ANIMATION_TYPE, ...extra, campaign: state });
}

export async function createCampaignRecord(input: {
  userId: string;
  state: CampaignState;
  creditsBudget: number;
}) {
  return prisma.cartoonVideo.create({
    data: {
      userId: input.userId,
      storyPrompt: input.state.brief || "Story ad campaign",
      style: input.state.style || "cinematic",
      animationType: ANIMATION_TYPE,
      duration: input.state.durationSeconds,
      captionStyle: "cinematic",
      status: "PENDING",
      progress: 0,
      currentStep: "Campaign created",
      creditsCost: input.creditsBudget,
      metadata: writeCampaign(input.state),
    },
  });
}

export async function listCampaigns(userId: string, limit = 20) {
  const rows = await prisma.cartoonVideo.findMany({
    where: { userId, animationType: ANIMATION_TYPE },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 50),
    select: {
      id: true,
      storyPrompt: true,
      status: true,
      progress: true,
      currentStep: true,
      videoUrl: true,
      thumbnailUrl: true,
      createdAt: true,
      completedAt: true,
      metadata: true,
    },
  });

  return rows.map((row) => {
    const campaign = readCampaign(row.metadata);
    return {
      id: row.id,
      title: row.storyPrompt.slice(0, 120),
      status: row.status,
      progress: row.progress,
      currentStep: row.currentStep,
      videoUrl: row.videoUrl,
      thumbnailUrl: row.thumbnailUrl,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      phase: campaign.phase,
      style: campaign.style,
      clipCount: campaign.clips.length,
    };
  });
}

export async function getCampaign(id: string, userId: string) {
  const row = await prisma.cartoonVideo.findFirst({
    where: { id, userId, animationType: ANIMATION_TYPE },
  });
  if (!row) return null;
  return { row, state: readCampaign(row.metadata) };
}

export async function updateCampaignState(
  id: string,
  userId: string,
  patch: Partial<CampaignState>,
) {
  const current = await getCampaign(id, userId);
  if (!current) throw new Error("Campaign not found");
  const merged: CampaignState = { ...current.state, ...patch };
  await prisma.cartoonVideo.update({
    where: { id },
    data: {
      metadata: writeCampaign(merged),
      style: merged.style || current.row.style,
      duration: merged.durationSeconds,
      storyPrompt: merged.brief || current.row.storyPrompt,
    },
  });
  return merged;
}

// =============================================================
// Stage 1 — Character catalog generation
// =============================================================

interface PlannedCharacter {
  name: string;
  role: string;
  visualDescription: string;
  voiceCriteria: CampaignCharacter["voiceCriteria"];
}

const FORBIDDEN_NAME_PATTERNS: RegExp[] = [
  /^the\s+\w+/i, // "The System", "The Algorithm", "The Voice"
  /^\w+\s+ai$/i, // "Acme AI"
  /\bbot\b|\bagent\b|\bplatform\b|\bapp\b|\bsystem\b|\balgorithm\b|\binterface\b/i,
  /\bhologram\b|\borb\b|\bmascot\b|\bavatar\b/i,
];

const FORBIDDEN_DESCRIPTION_PATTERNS: RegExp[] = [
  /\bglowing\b|\bgeometric\b|\babstract\b|\bnon-?humanoid\b/i,
  /\bembodiment\b|\bpersonification\b|\binterface\b/i,
  /\bsoftware\s+(character|figure|entity)\b/i,
];

function isRealHumanCharacter(c: PlannedCharacter, brand: BrandSnapshot): boolean {
  const name = String(c?.name || "").trim();
  if (!name) return false;

  const brandWords = brand.name
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .map((w) => w.toLowerCase());
  const lowerName = name.toLowerCase();
  if (brandWords.some((w) => lowerName === w || lowerName.includes(w))) {
    return false; // character named after the brand
  }

  for (const pattern of FORBIDDEN_NAME_PATTERNS) {
    if (pattern.test(name)) return false;
  }

  const description = String(c?.visualDescription || "");
  for (const pattern of FORBIDDEN_DESCRIPTION_PATTERNS) {
    if (pattern.test(description)) return false;
  }

  return true;
}

export interface CharacterCatalogPlan {
  storyOutline: string;
  characters: CampaignCharacter[];
  /** Set when style="narrated": AI-recommended narrator voice for the documentary-style narration */
  narratorVoice?: NarratorVoice;
}

export async function planCharacterCatalog(
  state: CampaignState,
  brand: BrandSnapshot,
  count = 3,
): Promise<CharacterCatalogPlan> {
  if (!state.style) throw new Error("Campaign style must be selected first");

  const styleLabel = STYLE_LABELS[state.style];
  const visualLanguage = STYLE_VISUAL_LANGUAGE[state.style];

  const prompt = `You are a screenwriter casting a ${styleLabel} short film. You design REAL HUMAN CHARACTERS — the people whose lives are dramatized in the story.

🚨 TOP PRIORITY — DRAMATIZE THE USER'S BRIEF LITERALLY 🚨

USER'S BRIEF (this is THE story; everything else serves it):
"""
${state.brief}
"""

The brief is the LAW. Your story outline must follow the EXACT sequence of scenes the user described — in the order they described them. If the brief opens with combat, your outline opens with combat. If the brief says "first show X, then Y, then Z", you show X, then Y, then Z. Do NOT skip ahead to the brand. Do NOT invent a generic problem the brand happens to solve when the user has already told you the story.

EXAMPLES OF WHAT NOT TO DO:
- Brief: "veteran at war, returns home to family, then catches up with business" → BAD outline: "Marcus returns home and his business has stalled..." (skipped the war + the homecoming entirely). GOOD outline: "Marcus is a soldier under fire overseas. After his tour ends, he returns to a tearful family welcome. Days later he begins reopening his stalled business..."
- Brief: "single mom with crying baby, two jobs" → BAD: "Maya looks at her phone and feels overwhelmed." GOOD: open ON the crying baby, the two-job chaos — show the world the user described.

THE STORY OUTLINE you write must:
- Open on the FIRST scene from the brief (whatever the user wrote first).
- Honor every scene/transition the user described, in order.
- Save any brand mention for the FINAL beat of the outline — never in the opening sentence.
- Read like a film synopsis, not a product pitch. The brand at most appears as "later, [character] discovers [brand]" near the end.

BRAND (background context only — appears at most ONCE near the very end of the outline):
- Name: ${brand.name}
${brand.tagline ? `- Tagline: ${brand.tagline}` : ""}
${brand.industry ? `- Industry: ${brand.industry}` : ""}
${brand.targetAudience ? `- Audience: ${brand.targetAudience}` : ""}
${brand.uniqueValue ? `- Unique value: ${brand.uniqueValue}` : ""}

DESIRED FEELING (tone): ${state.goal}

CAMPAIGN STYLE (locked for whole campaign): ${styleLabel} — ${visualLanguage}

ABSOLUTE RULE — WHAT A CHARACTER IS:
- A character is a REAL HUMAN BEING (or, for the "${styleLabel === "3D Animation" ? "3D Animation" : "live-action"}" style, a human portrayed accordingly).
- Every character has a first name (and optionally a last name), a real age, a profession, and a real human appearance.
- NEVER create:
  · personifications of the product (no "The System", "The Algorithm", "The App", "The Platform", "The AI", "The Brand").
  · brand mascots, holograms, glowing orbs, voices-of-god, narrators, robots-that-represent-the-software, abstract embodiments, or interfaces with personalities.
  · any character whose name starts with "The " followed by a noun.
- The brand is a TOOL that human characters use inside the story. It is NEVER a character.

Cast exactly ${count} HUMAN characters. The protagonist is the person at the center of the brief; the rest are people they encounter in the brief's described scenes (family, enemies, friends, colleagues, etc. — whoever the user mentioned or whoever logically belongs there).

For each character output:
- name: a real human first (or first + last) name. Examples: "Marcus Reyes", "Elena", "Aisha Patel". Never "The X", never a product name.
- role: their function in the story (e.g. "Returning veteran", "His wife waiting at home", "Old army buddy").
- visualDescription: 2–3 sentences describing the HUMAN's appearance — age, build, hair, clothing, palette, identifying features. Real human anatomy. Tuned for ${styleLabel}. If the brief implies a setting (e.g. combat), reflect it in the wardrobe.
- voiceCriteria: age (e.g. "early 30s"), tone (warm/authoritative/weary/playful), pace, texture, delivery — a real human's speaking voice.

Return strict JSON only:
{
  "storyOutline": "3–5 sentence synopsis that opens with the FIRST scene from the brief and honors the user's described sequence. Brand only in the final sentence at most.",
  "characters": [
    {
      "name": "Real Human Name",
      "role": "...",
      "visualDescription": "...",
      "voiceCriteria": { "age": "...", "tone": "...", "pace": "...", "texture": "...", "delivery": "..." }
    }
  ]
}`;

  const result = await ai.generateJSON<{ storyOutline?: string; characters: PlannedCharacter[] }>(prompt, {
    maxTokens: 2000,
    temperature: 0.7,
    systemPrompt:
      "You are a screenwriter who DRAMATIZES THE USER'S BRIEF LITERALLY. The story outline must open on the first scene described in the brief and follow the user's sequence in order — you do not invent generic alternatives or skip ahead to the brand. Characters are REAL HUMANS — brands are never characters. Return valid JSON only.",
  });

  const raw = Array.isArray(result?.characters) ? result.characters : [];
  const filtered = raw.filter((c) => isRealHumanCharacter(c, brand));
  if (!filtered.length && raw.length) {
    throw new Error(
      "AI returned only non-human personifications (e.g. 'The System'). Regenerate the catalog — characters must be real humans.",
    );
  }
  const characters: CampaignCharacter[] = filtered.slice(0, count).map((c) => ({
    id: nanoid(8),
    name: String(c.name || "").trim().slice(0, 60) || "Character",
    role: String(c.role || "").trim().slice(0, 120) || "Story character",
    visualDescription: String(c.visualDescription || "").trim().slice(0, 700),
    voiceCriteria: {
      age: String(c.voiceCriteria?.age || "adult").trim().slice(0, 60),
      tone: String(c.voiceCriteria?.tone || "warm").trim().slice(0, 60),
      pace: String(c.voiceCriteria?.pace || "medium").trim().slice(0, 60),
      texture: String(c.voiceCriteria?.texture || "smooth").trim().slice(0, 60),
      delivery: String(c.voiceCriteria?.delivery || "conversational").trim().slice(0, 60),
    },
    referenceImageUrl: null,
    previewStatus: "idle",
    previewError: null,
    approved: false,
  }));

  const plan: CharacterCatalogPlan = {
    storyOutline: String(result?.storyOutline || "").trim().slice(0, 900),
    characters,
  };

  // Narrated style: AI also picks a narrator voice for the documentary-style narration.
  if (state.style === "narrated") {
    try {
      plan.narratorVoice = await recommendNarratorVoice(state, brand, plan.storyOutline);
    } catch (err) {
      console.warn("[StoryAdCampaign] narrator recommendation failed, using default:", err);
      plan.narratorVoice = {
        gender: "male",
        tone: "warm documentary, grounded",
        pace: "measured, deliberate",
      };
    }
  }

  return plan;
}

/**
 * Recommend a narrator voice for the narrated style. AI picks gender + tone + pace
 * matched to the story's emotional weight, brand voice, and outline.
 */
async function recommendNarratorVoice(
  state: CampaignState,
  brand: BrandSnapshot,
  storyOutline: string,
): Promise<NarratorVoice> {
  const prompt = `Pick the right narrator voice for this short film.

STORY OUTLINE: ${storyOutline}
BRIEF: ${state.brief}
BRAND TONE: ${brand.voiceTone || "professional"}

The narrator is the voice that carries this documentary-style narrated film over still images and a few animated moments. Match their voice to the emotional weight of the story.

Return strict JSON only:
{
  "gender": "male" or "female",
  "tone": "2-4 words like 'warm documentary, intimate' or 'epic cinematic, urgent'",
  "pace": "2-3 words like 'measured, deliberate' or 'energetic, building'"
}`;

  const result = await ai.generateJSON<{ gender: string; tone: string; pace: string }>(prompt, {
    maxTokens: 200,
    temperature: 0.6,
    systemPrompt: "You cast narrator voices for short films. Return valid JSON only.",
  });

  const gender = result?.gender === "female" ? "female" : "male";
  return {
    gender,
    tone: String(result?.tone || "warm documentary").trim().slice(0, 80),
    pace: String(result?.pace || "measured").trim().slice(0, 60),
  };
}

// =============================================================
// Stage 1b — Character preview image generation
// =============================================================

function buildCharacterImagePrompt(
  character: CampaignCharacter,
  style: CampaignStyle,
  brand: BrandSnapshot,
): string {
  const styleBlock =
    style === "3d"
      ? "Premium Pixar / Disney-grade 3D animation render. Stylized but expressive character rig, soft global illumination, subsurface scattering on skin, polished CGI surfaces, cinematic 3D lighting."
      : "Photoreal cinematic portrait. ARRI Alexa look, 50mm anamorphic lens, shallow depth of field, naturalistic lighting, photoreal skin texture, real production wardrobe. NOT 3D animation, NOT illustration — a real human photograph aesthetic.";

  return `Character reference portrait for an ad campaign — used to anchor visual continuity across every clip.

CHARACTER
- Name: ${character.name}
- Role: ${character.role}
- Description: ${character.visualDescription}

STYLE
${styleBlock}

FRAMING
- Three-quarter body shot, head to mid-thigh visible.
- Character facing slightly toward camera with confident neutral expression.
- Centered composition, soft neutral backdrop, plain studio lighting.

HARD RULES
- No text, no captions, no watermark, no UI elements, no logo.
- No other people or props beyond the character themselves.
- Brand context (for tonal consistency only — do NOT draw the logo): ${brand.name}${brand.industry ? ` (${brand.industry})` : ""}.
- The character must read as authentic to the ${style === "3d" ? "3D animation" : "live-action cinematic"} world.`;
}

export async function generateCharacterPreviewImage(
  character: CampaignCharacter,
  state: CampaignState,
  brand: BrandSnapshot,
  campaignId: string,
): Promise<string> {
  if (!state.style) throw new Error("Campaign style must be selected first");
  const prompt = buildCharacterImagePrompt(character, state.style, brand);
  const result = await generateImageXaiFirst(prompt, 1024, 1280, {
    quality: "high",
    transparent: false,
  });
  if (!result.base64) {
    throw new Error("Image provider returned no image");
  }
  const buffer = Buffer.from(result.base64, "base64");
  const ext = result.format === "jpeg" ? "jpg" : result.format;
  const safe = character.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "character";
  const key = `story-ad-campaigns/${campaignId}/characters/${safe}-${nanoid(6)}.${ext}`;
  const contentType = result.format === "jpeg" ? "image/jpeg" : `image/${result.format}`;
  return uploadToS3(key, buffer, contentType);
}

// =============================================================
// AI Suggest — fill any single field on demand
// =============================================================

export async function suggestField(input: {
  field: string;
  state: CampaignState;
  brand: BrandSnapshot;
  characterId?: string | null;
  clipId?: string | null;
  hint?: string | null;
}): Promise<string> {
  const character = input.characterId
    ? input.state.characters.find((c) => c.id === input.characterId)
    : null;
  const clip = input.clipId ? input.state.clips.find((c) => c.id === input.clipId) : null;

  const targetDescriptor: Record<string, string> = {
    brief: "The campaign brief — a vivid 2–4 sentence pitch of what the ad will dramatize.",
    goal: "The campaign goal — one short sentence on the outcome we want viewers to feel/do.",
    "character.name": "A short memorable first name (or first + last) that fits the character role.",
    "character.role": "Their function in the story (e.g. 'Skeptical buyer', 'Trusted advisor').",
    "character.visualDescription":
      "2–3 sentences describing exact appearance: age, build, hair, clothing, palette, identifying features.",
    "character.voice.age": "Age band, e.g. 'late 30s'.",
    "character.voice.tone": "Tone descriptor, e.g. 'warm, reassuring'.",
    "character.voice.pace": "Pace descriptor, e.g. 'medium, deliberate'.",
    "character.voice.texture": "Voice texture, e.g. 'smooth with slight grain'.",
    "character.voice.delivery": "Delivery style, e.g. 'intimate, conversational'.",
    "clip.sceneAction": "One sentence on what physically happens in this clip (acting, blocking).",
    "clip.moodLighting": "Mood + lighting + color grade in a single line.",
    "clip.dialogue": `Suggest the full dialogue exchange for this clip — characters speaking ON CAMERA to each other (NOT voiceover). Output a JSON array of lines in the value field, formatted like: [{"characterId":"...","line":"...","emotion":"..."}]. Total ~${input.state.clipLength === 8 ? 22 : 28} words.`,
    "clip.dialogueLine": "A single replacement line for one speaker in this clip — naturalistic, in-character dialogue.",
  };

  const target = targetDescriptor[input.field] || "A short text suggestion.";
  const styleLabel = input.state.style ? STYLE_LABELS[input.state.style] : "Cinematic";

  const prompt = `You are filling ONE field for a ${styleLabel} ad campaign.

BRAND: ${input.brand.name}${input.brand.tagline ? ` — ${input.brand.tagline}` : ""}
${input.brand.industry ? `INDUSTRY: ${input.brand.industry}` : ""}
CAMPAIGN BRIEF: ${input.state.brief}
CAMPAIGN GOAL: ${input.state.goal}
${input.state.storyOutline ? `STORY OUTLINE: ${input.state.storyOutline}` : ""}
${character ? `CHARACTER CONTEXT: ${character.name} — ${character.role} — ${character.visualDescription}` : ""}
${clip ? `CLIP CONTEXT: Clip ${clip.index} (${clip.act}). Action: ${clip.sceneAction}. Mood: ${clip.moodLighting}.` : ""}
${input.hint ? `USER HINT: ${input.hint}` : ""}

Write the FIELD: ${target}

Return strict JSON only:
{ "value": "the field text" }`;

  const result = await ai.generateJSON<{ value: string }>(prompt, {
    maxTokens: 400,
    temperature: 0.8,
    systemPrompt: "You fill a single field with concise on-brand copy. Return valid JSON only.",
  });

  return String(result?.value || "").trim().slice(0, 700);
}

// =============================================================
// Stage 2 — Scene grid (act assignment, shot, camera, voiceover)
// =============================================================

interface PlannedDialogueLine {
  characterId: string;
  line: string;
  emotion?: string;
}

interface PlannedClip {
  act: ActPosition;
  shotType: ShotType;
  cameraMovement: CameraMovement;
  sceneAction: string;
  moodLighting: string;
  characterIds?: string[];
  dialogue?: PlannedDialogueLine[];
  /** @deprecated tolerated for legacy outputs */
  characterId?: string | null;
  /** @deprecated tolerated for legacy outputs */
  voiceoverLine?: string;
}

function normalizeAct(value: unknown): ActPosition {
  const v = String(value || "").toUpperCase();
  const valid: ActPosition[] = ["HOOK", "PROBLEM", "DISCOVERY", "TRANSFORM", "RESOLUTION", "CTA"];
  return valid.includes(v as ActPosition) ? (v as ActPosition) : "TRANSFORM";
}
function normalizeShot(value: unknown): ShotType {
  const v = String(value || "").toUpperCase().replace(/[-\s]+/g, "_");
  const valid: ShotType[] = ["WIDE", "CLOSE_UP", "POV", "DRONE", "MACRO", "OVER_SHOULDER", "MEDIUM"];
  return valid.includes(v as ShotType) ? (v as ShotType) : "MEDIUM";
}
function normalizeCamera(value: unknown): CameraMovement {
  const v = String(value || "").toUpperCase().replace(/[-\s]+/g, "_");
  const valid: CameraMovement[] = ["PUSH_IN", "PULL_BACK", "PAN", "STATIC", "ORBIT", "HANDHELD", "TRACK"];
  return valid.includes(v as CameraMovement) ? (v as CameraMovement) : "STATIC";
}

export async function planSceneGrid(
  state: CampaignState,
  brand: BrandSnapshot,
): Promise<CampaignClipSlot[]> {
  if (!state.style) throw new Error("Campaign style must be selected first");
  if (!state.characters.length) throw new Error("Generate the character catalog first");

  const clipCount = clipsForDuration(state.durationSeconds, state.clipLength);
  const styleLabel = STYLE_LABELS[state.style];
  const charactersBlock = state.characters
    .map((c) => `- ${c.id} | ${c.name} (${c.role})`)
    .join("\n");

  const totalSeconds = clipCount * state.clipLength;
  // Natural English at conversational pace is ~2.5 words/second. Aim for ~75% speech coverage per clip
  // to leave room for breath, reactions, and silence. Anything below 60% feels sparse and ad-like.
  const wordsPerSecond = 2.5;
  const targetCoverage = 0.75;
  const minCoverage = 0.6;
  const targetWordsPerClip = Math.round(state.clipLength * wordsPerSecond * targetCoverage);
  const minWordsPerClip = Math.round(state.clipLength * wordsPerSecond * minCoverage);
  const targetSecondsPerClip = Math.round(state.clipLength * targetCoverage);
  const totalWords = Math.round(totalSeconds * wordsPerSecond * targetCoverage);

  const lastTwo = Math.max(1, Math.min(2, Math.floor(clipCount * 0.15)));

  const prompt = `You are a screenwriter writing ONE continuous ${totalSeconds}-second short film. It will be SHOT in ${clipCount} consecutive ${state.clipLength}-second clips that play back-to-back as a single movie.

🚨 ABSOLUTE TOP PRIORITY — DRAMATIZE THE USER'S BRIEF LITERALLY 🚨

USER'S BRIEF (this is THE story you must tell, in the order described):
"""
${state.brief}
"""

The brief above is the LAW. Read it carefully and identify the sequence of scenes/settings the user described. Your screenplay must show those EXACT scenes in that EXACT order. If the brief says "first show X, then Y, then Z" — you show X, then Y, then Z. Do NOT invent generic alternative scenes. Do NOT skip ahead to the brand. The first ${clipCount - lastTwo} clips entertain the viewer with the human story; the brand only appears in the LAST ${lastTwo} clip(s).

EXAMPLES OF WHAT NOT TO DO:
- Brief says "veteran at war, returns home, then catches up with business" → BAD: opening on him at a desk struggling with business. GOOD: opening with combat scenes, returning home, family welcome, THEN business catch-up, THEN brand fits in at the end.
- Brief says "single mom juggling two jobs with crying baby" → BAD: opening with her smiling about a new tool. GOOD: open with the chaos described, real overwhelm, brand only enters near the end.

THIS IS NOT AN ADVERTISEMENT. It is a real-life dramatic short film. The audience should be EMOTIONALLY INVESTED in the human story before they even know there's a product. Characters speak to EACH OTHER on camera. NO narrator, NO voiceover, NO ad copy.

CHARACTER ROSTER (use the id verbatim when referencing speakers — DO NOT invent new character ids):
${charactersBlock}

BRAND (background context only — only mentioned in the last ${lastTwo} clip(s)): ${brand.name}${brand.tagline ? ` — ${brand.tagline}` : ""}
${brand.industry ? `INDUSTRY: ${brand.industry}` : ""}
${brand.uniqueValue ? `WHAT IT SOLVES: ${brand.uniqueValue}` : ""}
DESIRED FEELING (tone): ${state.goal}
${state.storyOutline ? `\nSTORY OUTLINE (reference if helpful — but the BRIEF above takes priority):\n${state.storyOutline}` : ""}

HOW TO MAP THE USER'S BRIEF ONTO ${clipCount} CLIPS:
1. Pre-read the brief. Identify the scenes/settings the user mentioned, IN ORDER.
2. Distribute those scenes across clips 1 through ${clipCount - lastTwo} (the first ~${Math.round(((clipCount - lastTwo) / clipCount) * 100)}% of the film). Each scene gets enough clips to feel real, not rushed.
3. RESERVE the FINAL ${lastTwo} clip(s) for the brand moment: a natural turning point where the protagonist discovers, uses, or recommends the brand. NEVER mention the brand before then.
4. The act labels (HOOK / PROBLEM / DISCOVERY / TRANSFORM / RESOLUTION / CTA) are ANNOTATIONS for what's happening — don't let them override the brief. If clip 3 is still "PROBLEM" because the brief's middle section is intense, that's fine.

CONTINUITY RULES:
- Treat the whole film as ONE scene flow. Dialogue across clip boundaries must connect — clip N+1 picks up from clip N.
- If a clip ends mid-conversation, clip N+1 continues that conversation.
- Characters remember what was said earlier; they don't suddenly know things they haven't learned.
- Re-use the same locations and characters across consecutive clips when the conversation continues.
- Within ONE scene from the brief (e.g. "at war"), give it MULTIPLE consecutive clips so it feels lived-in, not a flash card.

For each clip output:
- act: HOOK | PROBLEM | DISCOVERY | TRANSFORM | RESOLUTION | CTA — labels the emotional function; the SCENE itself comes from the brief.
- shotType: WIDE | MEDIUM | CLOSE_UP | POV | DRONE | MACRO | OVER_SHOULDER
- cameraMovement: PUSH_IN | PULL_BACK | PAN | STATIC | ORBIT | HANDHELD | TRACK
- sceneAction: ONE sentence describing what physically happens. Must be one of the user's described scenes (or a connecting beat between them). Reference the previous clip's moment so flow is continuous. CRITICAL: include scene-specific wardrobe + props + environment if they differ from the character's reference look. Example: 'Marcus (in dusty combat fatigues, helmet, M4 rifle slung) crouches behind a Humvee while tracer rounds streak overhead.' NOT just 'Marcus crouches behind cover.'
- moodLighting: lighting + color grade, single line. Tailored to the specific scene from the brief.
- characterIds: array of character ids visible on-camera (1 to 3). [] for pure environment/product shots.
- dialogue: array of spoken lines in order. Characters TALK TO EACH OTHER on camera. Each line: { "characterId": "...", "line": "...", "emotion": "..." }. For a silent visual moment use dialogue: [].

DURATION-FILL RULE:
- Every ${state.clipLength}-second clip with dialogue must contain AT LEAST ${minWordsPerClip} words (≈${Math.round(state.clipLength * minCoverage)}s) and target ~${targetWordsPerClip} words (≈${targetSecondsPerClip}s).
- If one character speaks a short line, ADD a reply to fill the time. Real conversations have back-and-forth.
- Silent visual beats (dialogue: []) are allowed but limited to 2 per film, never adjacent — useful for action-heavy scenes from the brief (e.g. a combat moment) where dialogue would feel forced.

HARD RULES:
- The BRIEF is the law. Follow its scene order literally.
- Brand named ONLY in the final ${lastTwo} clip(s). Never before.
- One continuous screenplay; never isolated vignettes.
- NEVER write narrator/voiceover. All speech is on-camera dialogue.
- NEVER write ad copy. Brand fits the conversation organically.
- No on-screen text overlays.
- Dialogue must sound like real people, not actors performing.

Return strict JSON with exactly ${clipCount} clips:
{
  "clips": [
    {
      "act": "HOOK",
      "shotType": "WIDE",
      "cameraMovement": "PUSH_IN",
      "sceneAction": "...",
      "moodLighting": "...",
      "characterIds": ["${state.characters[0]?.id || ""}"${state.characters[1] ? `, "${state.characters[1].id}"` : ""}],
      "dialogue": [
        { "characterId": "${state.characters[0]?.id || ""}", "line": "...", "emotion": "..." }
      ]
    }
  ]
}`;

  const result = await ai.generateJSON<{ clips: PlannedClip[] }>(prompt, {
    maxTokens: 5500,
    temperature: 0.75,
    systemPrompt:
      "You are a screenwriter who DRAMATIZES THE USER'S BRIEF LITERALLY. Their described scenes and sequence are the LAW — you do not invent generic alternatives. The brand only appears in the final 1–2 clips; before that, you tell the human story the user described. Clips are camera cuts in ONE continuous scene flow; dialogue runs across clip boundaries; characters remember prior lines. Entertain first, brand last. Return valid JSON only.",
  });

  const characterIds = new Set(state.characters.map((c) => c.id));
  const raw = Array.isArray(result?.clips) ? result.clips : [];
  const trimmed = raw.slice(0, clipCount);

  const clips: CampaignClipSlot[] = trimmed.map((c, index) => {
    const slot: CampaignClipSlot = {
      id: nanoid(8),
      index: index + 1,
      act: normalizeAct(c.act),
      shotType: normalizeShot(c.shotType),
      cameraMovement: normalizeCamera(c.cameraMovement),
      sceneAction: String(c.sceneAction || "").trim().slice(0, 360),
      moodLighting: String(c.moodLighting || "").trim().slice(0, 200),
      characterIds: normalizeCharacterIds(c, characterIds),
      dialogue: normalizeDialogue(c, characterIds),
      prompt: "",
      status: "PENDING",
      videoUrl: null,
      error: null,
    };
    slot.prompt = buildClipPrompt(slot, state, brand);
    return slot;
  });

  // pad if AI under-delivered
  while (clips.length < clipCount) {
    const index = clips.length + 1;
    const slot: CampaignClipSlot = {
      id: nanoid(8),
      index,
      act: index <= 2 ? "HOOK" : index >= clipCount - 1 ? "CTA" : "TRANSFORM",
      shotType: "MEDIUM",
      cameraMovement: "STATIC",
      sceneAction: "Continue the story.",
      moodLighting: "Natural cinematic lighting.",
      characterIds: state.characters[0] ? [state.characters[0].id] : [],
      dialogue: [],
      prompt: "",
      status: "PENDING",
      videoUrl: null,
      error: null,
    };
    slot.prompt = buildClipPrompt(slot, state, brand);
    clips.push(slot);
  }

  return clips;
}

function normalizeCharacterIds(c: PlannedClip, valid: Set<string>): string[] {
  const fromArray = Array.isArray(c.characterIds)
    ? c.characterIds.filter((id): id is string => typeof id === "string" && valid.has(id))
    : [];
  if (fromArray.length) return [...new Set(fromArray)].slice(0, 4);
  if (typeof c.characterId === "string" && valid.has(c.characterId)) return [c.characterId];
  // fall back to inferring from dialogue speakers
  const fromDialogue = Array.isArray(c.dialogue)
    ? c.dialogue
        .map((d) => (typeof d?.characterId === "string" ? d.characterId : null))
        .filter((id): id is string => !!id && valid.has(id))
    : [];
  return [...new Set(fromDialogue)].slice(0, 4);
}

function normalizeDialogue(c: PlannedClip, valid: Set<string>): ClipDialogueLine[] {
  if (Array.isArray(c.dialogue) && c.dialogue.length) {
    return c.dialogue
      .filter((d) => d && typeof d.line === "string" && d.line.trim())
      .filter((d) => typeof d.characterId === "string" && valid.has(d.characterId))
      .slice(0, 6)
      .map((d) => ({
        id: nanoid(6),
        characterId: d.characterId,
        line: d.line.trim().slice(0, 260),
        emotion: typeof d.emotion === "string" ? d.emotion.trim().slice(0, 60) : undefined,
      }));
  }
  // Legacy migration: single voiceoverLine + characterId → one dialogue line
  if (c.voiceoverLine && c.characterId && valid.has(c.characterId)) {
    return [{
      id: nanoid(6),
      characterId: c.characterId,
      line: c.voiceoverLine.trim().slice(0, 260),
    }];
  }
  return [];
}

// =============================================================
// Stage 3 — Per-clip prompt assembly
// =============================================================

export function buildClipPrompt(
  clip: CampaignClipSlot,
  state: CampaignState,
  brand: BrandSnapshot,
): string {
  if (!state.style) return clip.sceneAction;
  const styleLabel = STYLE_LABELS[state.style];
  const visualLanguage = STYLE_VISUAL_LANGUAGE[state.style];

  const onCamera = clip.characterIds
    .map((id) => state.characters.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const characterBlock = onCamera.length
    ? `CHARACTERS ON CAMERA (face + body continuity matches their reference portraits — see below):
${onCamera.map((c) => `- ${c.name}: ${c.visualDescription}`).join("\n")}

WARDROBE + STATE OVERRIDE: The reference portraits show each character's baseline look. For THIS clip, follow what the SCENE ACTION says — if the scene calls for combat fatigues, scrubs, formal wear, post-rain wet clothes, exhausted dirty face, etc., wear THAT for this clip. Keep the FACE/HAIR/BUILD identical to the portrait, but treat wardrobe and physical state as scene-specific. Example: portrait shows a man in t-shirt and jeans, but scene action says "in combat fatigues" → render him in fatigues, same face.`
    : "No on-camera character — focus on environment or product.";

  // Build a precise dialogue script with a clearly marked speaker per line so the
  // model lip-syncs the right person and other on-camera characters stay silent.
  const dialogueBlock = clip.dialogue.length
    ? `IN-SCENE DIALOGUE (characters speak ON CAMERA — naturalistic acting, precise lip-sync, NOT voiceover):
${clip.dialogue
  .map((d, idx) => {
    const speaker = state.characters.find((c) => c.id === d.characterId);
    const name = speaker?.name || "Character";
    const emotion = d.emotion ? ` [${d.emotion}]` : "";
    return `LINE ${idx + 1} — SPEAKER: ${name}${emotion}\n   "${d.line}"`;
  })
  .join("\n")}

LIP-SYNC + ACTING RULES (CRITICAL):
- ONLY the named SPEAKER moves their lips and speaks their line. Other on-camera characters LISTEN silently; their mouths stay closed during another character's line.
- Lip movements must precisely match the spoken words — no extra speech, no garbled mouthing, no improvisation beyond the script.
- Match each character's voice to a consistent persona across the campaign. Do not swap voices mid-clip.
- During silence beats, characters should react naturally (eye contact, micro-expressions) — no idle muttering or random speech.`
    : "No dialogue in this clip — pure visual storytelling. All on-camera characters remain silent.";

  return [
    `${styleLabel} narrative short film — clip ${clip.index} of ${state.clips.length || "the campaign"}. Act: ${ACT_LABELS[clip.act]}.`,
    `This is a real-life dramatic scene, NOT an advertisement. No narrator, no voiceover, no on-screen text.`,
    `Visual language: ${visualLanguage}.`,
    `Shot: ${SHOT_LABELS[clip.shotType]}, camera ${CAMERA_LABELS[clip.cameraMovement]}.`,
    `Scene action: ${clip.sceneAction}`,
    `Mood + lighting: ${clip.moodLighting}`,
    characterBlock,
    dialogueBlock,
    `Context (do not advertise — story-only): brand ${brand.name}${brand.tagline ? ` (${brand.tagline})` : ""} may appear organically if the dialogue mentions it.`,
    `Duration: ${state.clipLength}s. Aspect: ${state.aspectRatio}.`,
    "QUALITY RULES (HARD):",
    "- Human anatomy must be correct: TWO hands per person, FIVE fingers per hand, no extra/fused/missing limbs, no warped or floating body parts.",
    "- Faces: symmetric, normal eye count + shape, no morphing or melting between frames, no extra teeth, no doubled mouths.",
    "- Each character must look IDENTICAL to their reference portrait across every clip — same face, hair, wardrobe, build.",
    "- No background characters speaking, no random crowd dialogue, no off-screen narration.",
    "- Smooth, continuous motion within the clip — no jump-cuts, no time skips, no scene resets mid-clip.",
    `Hard negative: ${NEGATIVE_TEXT_PROMPT}, no narrator voiceover, no ad slate, no logo overlay, no commercial framing, no extra hands, no extra fingers, no fused fingers, no warped faces, no doubled mouths, no characters mouthing lines that aren't theirs, no background dialogue, no jump cuts.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function rebuildAllPrompts(state: CampaignState, brand: BrandSnapshot): CampaignClipSlot[] {
  return state.clips.map((clip) => ({
    ...clip,
    prompt: buildClipPrompt(clip, state, brand),
  }));
}

// =============================================================
// Stage 4 — Voice preview (no credit cost, internal only)
// =============================================================

function detectGender(tone: string, delivery: string): "male" | "female" {
  const hay = `${tone} ${delivery}`.toLowerCase();
  if (/\b(female|feminine|woman|she|her)\b/.test(hay)) return "female";
  if (/\b(male|masculine|man|he|him)\b/.test(hay)) return "male";
  // default rotates by tone hint
  if (/warm|soft|gentle|playful/.test(hay)) return "female";
  return "male";
}

function detectAccent(): "american" | "british" {
  return "american";
}

function detectStyle(tone: string, delivery: string): "professional" | "warm" | "dramatic" | "energetic" {
  const hay = `${tone} ${delivery}`.toLowerCase();
  if (/dramatic|intimate|cinematic/.test(hay)) return "dramatic";
  if (/energetic|fast|excited|punchy/.test(hay)) return "energetic";
  if (/warm|friendly|conversational|gentle/.test(hay)) return "warm";
  return "professional";
}

export interface VoicePreviewLineResult {
  characterId: string | null;
  characterName: string | null;
  line: string;
  audioBase64: string;
  mimeType: string;
  estimatedDurationMs: number;
  /** Set when this line came from the full-screenplay pass */
  clipIndex?: number;
  /** Set when this line came from the full-screenplay pass */
  clipAct?: ActPosition;
  /** Optional emotion note (for UI display) */
  emotion?: string;
}

async function generateOneVoiceLine(text: string, character: CampaignCharacter | null): Promise<VoicePreviewLineResult> {
  const gender = character
    ? detectGender(character.voiceCriteria.tone, character.voiceCriteria.delivery)
    : "female";
  const accent = detectAccent();
  const style = character
    ? detectStyle(character.voiceCriteria.tone, character.voiceCriteria.delivery)
    : "professional";

  const result = await generateVoice({ text, gender, accent, style, speed: 1.0 });
  return {
    characterId: character?.id || null,
    characterName: character?.name || null,
    line: text,
    audioBase64: result.audioBuffer.toString("base64"),
    mimeType: "audio/mpeg",
    estimatedDurationMs: result.estimatedDurationMs,
  };
}

export async function generateClipVoicePreview(options: {
  clip?: CampaignClipSlot;
  characters: CampaignCharacter[];
  /** Single-line fallback (used when previewing a manually-typed line) */
  text?: string;
  character?: CampaignCharacter | null;
}): Promise<{ lines: VoicePreviewLineResult[]; totalDurationMs: number }> {
  if (options.clip && options.clip.dialogue.length) {
    const lines: VoicePreviewLineResult[] = [];
    for (const d of options.clip.dialogue) {
      if (!d.line.trim()) continue;
      const character = options.characters.find((c) => c.id === d.characterId) || null;
      const result = await generateOneVoiceLine(d.line, character);
      lines.push({ ...result, emotion: d.emotion });
    }
    return { lines, totalDurationMs: lines.reduce((s, l) => s + l.estimatedDurationMs, 0) };
  }

  if (options.text) {
    const result = await generateOneVoiceLine(options.text, options.character || null);
    return { lines: [result], totalDurationMs: result.estimatedDurationMs };
  }

  return { lines: [], totalDurationMs: 0 };
}

/**
 * Voice the entire campaign as ONE continuous screenplay. Generates a flat array
 * of dialogue lines across every clip in order, each tagged with its clipIndex
 * and clipAct so the UI can play the whole movie back-to-back with no gaps.
 */
export async function generateFullScreenplayPreview(options: {
  clips: CampaignClipSlot[];
  characters: CampaignCharacter[];
}): Promise<{ lines: VoicePreviewLineResult[]; totalDurationMs: number }> {
  const lines: VoicePreviewLineResult[] = [];
  for (const clip of options.clips) {
    if (!clip.dialogue.length) continue;
    for (const d of clip.dialogue) {
      if (!d.line.trim()) continue;
      const character = options.characters.find((c) => c.id === d.characterId) || null;
      const result = await generateOneVoiceLine(d.line, character);
      lines.push({
        ...result,
        clipIndex: clip.index,
        clipAct: clip.act,
        emotion: d.emotion,
      });
    }
  }
  return { lines, totalDurationMs: lines.reduce((s, l) => s + l.estimatedDurationMs, 0) };
}

// =============================================================
// Stage 5 — Batch render
// =============================================================

function normalizeVeoAspect(aspect: CampaignAspectRatio): "16:9" | "9:16" {
  return aspect === "16:9" ? "16:9" : "9:16";
}

function normalizeXaiAspect(aspect: CampaignAspectRatio): "16:9" | "9:16" | "1:1" {
  return aspect === "9:16" ? "9:16" : aspect === "1:1" ? "1:1" : "16:9";
}

async function renderClipViaVeo(
  clip: CampaignClipSlot,
  state: CampaignState,
): Promise<string> {
  // Veo 3.1 generate-preview supports 4/6/8s. Cap requested length at 8.
  const capped = Math.min(8, state.clipLength);
  const duration = (capped === 4 ? "4" : capped === 6 ? "6" : "8") as "4" | "6" | "8";
  const result = await veoClient.generateVideoBuffer(clip.prompt, {
    durationSeconds: duration,
    resolution: "720p",
    aspectRatio: normalizeVeoAspect(state.aspectRatio),
    negativePrompt: NEGATIVE_TEXT_PROMPT,
  });
  const url = await uploadToS3(
    `story-ad-campaigns/clips/${clip.id}-${nanoid(6)}.mp4`,
    result.videoBuffer,
    "video/mp4",
  );
  return url;
}

async function renderClipViaXai(
  clip: CampaignClipSlot,
  state: CampaignState,
): Promise<string> {
  // Grok Imagine Video supports 1–15s. Pass through, clamping just in case.
  const duration = Math.min(15, Math.max(1, state.clipLength));
  const result = await grokVideoClient.generateVideo(clip.prompt, {
    duration,
    aspectRatio: normalizeXaiAspect(state.aspectRatio),
    resolution: "720p",
    timeoutMs: 900000,
  });
  const url = await uploadToS3(
    `story-ad-campaigns/clips/${clip.id}-${nanoid(6)}.mp4`,
    result.videoBuffer,
    "video/mp4",
  );
  return url;
}

/**
 * Seamless xAI render: render clip 1 fresh, then chain extend() calls so every
 * subsequent clip continues directly from the last frame. The output is ONE
 * continuous video with zero hard cuts — no ffmpeg concat needed.
 *
 * Each clip's status updates incrementally so the UI shows progress per clip.
 * Each clip's videoUrl is set to the CUMULATIVE reel up to that point — so the
 * UI player on the most-recent READY clip is always the latest preview of the reel.
 */
async function renderXaiSeamless(input: {
  campaignId: string;
  userId: string;
  state: CampaignState;
}): Promise<void> {
  const { campaignId, userId, state } = input;
  const clips = [...state.clips];
  const total = clips.length;

  await prisma.cartoonVideo.update({
    where: { id: campaignId },
    data: {
      status: "COMPOSITING",
      progress: 5,
      currentStep: "Starting seamless reel (xAI extension mode)...",
    },
  });

  // Find the first non-READY clip so a re-send picks up where it left off.
  let startIndex = clips.findIndex((c) => c.status !== "READY" || !c.videoUrl);
  if (startIndex === -1) startIndex = clips.length; // nothing to do

  // The seed URL is the most recent READY clip's reel URL (or null if none).
  let reelUrl: string | null = startIndex > 0 ? clips[startIndex - 1].videoUrl || null : null;

  for (let i = startIndex; i < clips.length; i++) {
    const clip = clips[i];
    clips[i] = { ...clip, status: "RENDERING", error: null };
    await persistClipsProgress(campaignId, clips, i, total);

    try {
      // Retry with backoff so transient API errors don't break the chain.
      const SEAMLESS_ATTEMPTS = 5;
      const backoffs = [5000, 15000, 45000, 90000];
      let attempted = 0;
      let lastErr: unknown = null;
      let succeeded = false;
      while (attempted < SEAMLESS_ATTEMPTS) {
        attempted++;
        try {
          if (i === 0 || !reelUrl) {
            // xAI's extension API caps the INPUT video at ~8.7s ("Video is too long. Maximum duration is 8.7 sec"),
            // even though fresh generation allows 15s. Render the seed clip at 8s so every subsequent extension call succeeds.
            const seedState: CampaignState = { ...state, clipLength: 8 };
            const fresh = await renderClipViaXai(clip, seedState);
            reelUrl = fresh;
          } else {
            const extDuration = Math.min(10, state.clipLength);
            const result = await grokVideoClient.extendVideo(reelUrl, clip.prompt, {
              duration: extDuration,
              timeoutMs: 900000,
            });
            reelUrl = await uploadToS3(
              `story-ad-campaigns/reel/${campaignId}/seg-${String(i + 1).padStart(2, "0")}-${nanoid(6)}.mp4`,
              result.videoBuffer,
              "video/mp4",
            );
          }
          succeeded = true;
          break;
        } catch (error) {
          lastErr = error;
          const message = error instanceof Error ? error.message : String(error);
          const canRetry = attempted < SEAMLESS_ATTEMPTS;
          console.warn(
            `[StoryAdCampaign] seamless clip ${clip.index} attempt ${attempted}/${SEAMLESS_ATTEMPTS} failed${canRetry ? " — retrying" : ""}:`,
            message,
          );
          if (!canRetry) break;
          const wait = backoffs[Math.min(attempted - 1, backoffs.length - 1)];
          await prisma.cartoonVideo.update({
            where: { id: campaignId },
            data: { currentStep: `Retrying clip ${clip.index} in ${Math.round(wait / 1000)}s (attempt ${attempted}/${SEAMLESS_ATTEMPTS})...` },
          });
          await new Promise((r) => setTimeout(r, wait));
        }
      }
      if (succeeded) {
        clips[i] = { ...clips[i], status: "READY", videoUrl: reelUrl, error: null };
      } else {
        const message = lastErr instanceof Error ? lastErr.message : String(lastErr || "Render failed");
        clips[i] = { ...clips[i], status: "FAILED", error: message };
        await persistClipsProgress(campaignId, clips, i + 1, total);
        break;
      }
    } catch (error) {
      // Fallback for any error not caught inside the retry loop
      const message = error instanceof Error ? error.message : "Render failed";
      clips[i] = { ...clips[i], status: "FAILED", error: message };
      await persistClipsProgress(campaignId, clips, i + 1, total);
      break;
    }
    await persistClipsProgress(campaignId, clips, i + 1, total);
  }

  const allOk = clips.every((c) => c.status === "READY");

  let finalVideoUrl: string | null = reelUrl;
  let publishCaption: string | undefined;
  let publishHashtags: string[] | undefined;

  if (allOk && reelUrl) {
    try {
      await prisma.cartoonVideo.update({
        where: { id: campaignId },
        data: { progress: 92, currentStep: "Adding brand logo..." },
      });
      const brand = await getBrandSnapshot(userId);
      if (brand.logo) {
        try {
          finalVideoUrl = await overlayBrandLogo({
            campaignId,
            videoUrl: reelUrl,
            logoUrl: brand.logo,
          });
        } catch (e) {
          console.warn("[StoryAdCampaign] seamless logo overlay failed:", e);
        }
      }
      try {
        await prisma.cartoonVideo.update({
          where: { id: campaignId },
          data: { progress: 97, currentStep: "Writing social caption..." },
        });
        const caption = await generateCampaignCaption(state, brand);
        publishCaption = caption.caption;
        publishHashtags = caption.hashtags;
      } catch (e) {
        console.warn("[StoryAdCampaign] seamless caption failed:", e);
      }

      // Save final seamless reel to user's media library
      if (finalVideoUrl) {
        try {
          await saveCampaignReelToLibrary({
            userId,
            campaignId,
            title: state.brief?.slice(0, 80) || "Story Ad Campaign",
            videoUrl: finalVideoUrl,
            thumbnailUrl: clips.find((c) => c.videoUrl)?.videoUrl || null,
          });
        } catch (e) {
          console.warn("[StoryAdCampaign] seamless media library save failed:", e);
        }
      }
    } catch (error) {
      console.error("[StoryAdCampaign] seamless post-assembly failed:", error);
    }
  }

  const finalState: CampaignState = {
    ...state,
    clips,
    phase: allOk ? "DONE" : "FAILED",
    finalVideoUrl,
    finalVideoThumbnailUrl: clips.find((c) => c.videoUrl)?.videoUrl || null,
    ...(publishCaption ? { campaignCaption: publishCaption } : {}),
    ...(publishHashtags ? { hashtags: publishHashtags } : {}),
  };

  await prisma.cartoonVideo.update({
    where: { id: campaignId },
    data: {
      status: allOk ? "COMPLETED" : "FAILED",
      progress: 100,
      currentStep: allOk ? "Seamless reel ready" : "Chain broken — review and re-run from failed clip",
      metadata: writeCampaign(finalState),
      videoUrl: finalVideoUrl,
      completedAt: allOk ? new Date() : null,
    },
  });

  if (!allOk) {
    await refundFailedClips(campaignId, userId, clips, creditsPerClip(state.clipLength));
  }
}

/**
 * Re-render a single clip in place. Used for the "Retry" button on failed clip cards.
 * Skips the final concat/logo/caption steps — those re-run from the next full batch send.
 */
export async function retrySingleClip(input: {
  campaignId: string;
  userId: string;
  clipId: string;
}): Promise<{ status: "READY" | "FAILED"; videoUrl?: string; error?: string }> {
  const current = await getCampaign(input.campaignId, input.userId);
  if (!current) throw new Error("Campaign not found");
  const { row, state } = current;

  const idx = state.clips.findIndex((c) => c.id === input.clipId);
  if (idx === -1) throw new Error("Clip not found");

  if (state.provider === "veo3" && !veoClient.isAvailable()) {
    throw new Error("Veo 3 is not configured. Switch provider.");
  }
  if (state.provider === "xai" && !grokVideoClient.isAvailable()) {
    throw new Error("xAI video is not configured. Switch provider.");
  }

  const clips = [...state.clips];
  clips[idx] = { ...clips[idx], status: "RENDERING", error: null };
  await updateCampaignState(input.campaignId, input.userId, { clips });

  const renderOne = state.provider === "veo3" ? renderClipViaVeo : renderClipViaXai;

  try {
    const url = await renderOne(clips[idx], state);
    clips[idx] = { ...clips[idx], status: "READY", videoUrl: url, error: null };
    await updateCampaignState(input.campaignId, input.userId, { clips });
    return { status: "READY", videoUrl: url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";
    clips[idx] = { ...clips[idx], status: "FAILED", error: message };
    await updateCampaignState(input.campaignId, input.userId, { clips });
    return { status: "FAILED", error: message };
  } finally {
    // Don't change overall campaign status — that's owned by batch render
    void row;
  }
}

export async function batchRenderCampaign(input: { campaignId: string; userId: string }): Promise<void> {
  const current = await getCampaign(input.campaignId, input.userId);
  if (!current) throw new Error("Campaign not found");
  const { row, state } = current;

  if (!state.clips.length) throw new Error("No clips to render");

  if (state.provider === "veo3" && !veoClient.isAvailable()) {
    throw new Error("Veo 3 is not configured. Set GEMINI_API_KEY or switch to xAI.");
  }
  if (state.provider === "xai" && !grokVideoClient.isAvailable()) {
    throw new Error("xAI video is not configured. Switch to Veo 3.");
  }

  // xAI supports video extension → chain extensions for one seamless reel with no cuts.
  // Veo's extension is only ~7s per call which would need too many calls, so it stays parallel.
  if (state.provider === "xai") {
    await renderXaiSeamless({ campaignId: row.id, userId: row.userId, state });
    return;
  }

  await prisma.cartoonVideo.update({
    where: { id: row.id },
    data: { status: "COMPOSITING", progress: 5, currentStep: "Sending clips to provider..." },
  });

  const clips = [...state.clips];
  const renderOne = renderClipViaVeo;

  // Parallel-ish but capped to avoid quota burst
  const CONCURRENCY = 3;
  const MAX_ATTEMPTS = 5; // initial + 4 retries with longer backoff so users don't have to babysit
  let cursor = 0;
  let completed = 0;
  const total = clips.length;

  // Some provider errors are worth retrying — empty response (safety filter blip),
  // quota throttles, timeouts, transient network issues.
  function isRetryable(message: string): boolean {
    const m = message.toLowerCase();
    return (
      m.includes("no videos returned") ||
      m.includes("no video") ||
      m.includes("timed out") ||
      m.includes("timeout") ||
      m.includes("rate limit") ||
      m.includes("429") ||
      m.includes("503") ||
      m.includes("502") ||
      m.includes("network") ||
      m.includes("etimedout") ||
      m.includes("econnreset")
    );
  }

  async function renderWithRetry(clip: CampaignClipSlot): Promise<string> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await renderOne(clip, state);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const canRetry = attempt < MAX_ATTEMPTS && isRetryable(message);
        console.warn(
          `[StoryAdCampaign] clip ${clip.index} attempt ${attempt}/${MAX_ATTEMPTS} failed${canRetry ? " — retrying" : ""}:`,
          message,
        );
        if (!canRetry) break;
        // Exponential backoff: 4s, 12s, 30s, 90s. Caps under 3 min so the chain doesn't stall forever.
        const delays = [4000, 12000, 30000, 90000];
        const wait = delays[Math.min(attempt - 1, delays.length - 1)];
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Render failed");
  }

  async function worker() {
    while (cursor < clips.length) {
      const myIndex = cursor++;
      const clip = clips[myIndex];
      // SKIP already-rendered clips so resending after a partial failure doesn't wipe their videos.
      if (clip.status === "READY" && clip.videoUrl) {
        completed++;
        continue;
      }
      clips[myIndex] = { ...clip, status: "RENDERING", error: null };
      await persistClipsProgress(row.id, clips, completed, total);
      try {
        const url = await renderWithRetry(clip);
        clips[myIndex] = { ...clips[myIndex], status: "READY", videoUrl: url, error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Render failed";
        clips[myIndex] = { ...clips[myIndex], status: "FAILED", error: message };
      }
      completed++;
      await persistClipsProgress(row.id, clips, completed, total);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, clips.length) }, () => worker()));

  const allOk = clips.every((c) => c.status === "READY");

  let finalVideoUrl: string | null = null;
  let publishCaption: string | undefined;
  let publishHashtags: string[] | undefined;
  if (allOk) {
    const finalized = await runFinalAssembly({
      campaignId: input.campaignId,
      userId: row.userId,
      state,
      clips,
    });
    finalVideoUrl = finalized.finalVideoUrl;
    publishCaption = finalized.caption;
    publishHashtags = finalized.hashtags;
  }

  const finalState: CampaignState = {
    ...state,
    clips,
    phase: allOk ? "DONE" : "FAILED",
    finalVideoUrl,
    finalVideoThumbnailUrl: clips.find((c) => c.videoUrl)?.videoUrl || null,
    ...(publishCaption ? { campaignCaption: publishCaption } : {}),
    ...(publishHashtags ? { hashtags: publishHashtags } : {}),
  };
  await prisma.cartoonVideo.update({
    where: { id: row.id },
    data: {
      status: allOk ? "COMPLETED" : "FAILED",
      progress: 100,
      currentStep: allOk ? "Campaign reel ready" : "Some clips failed — review and re-run",
      metadata: writeCampaign(finalState),
      videoUrl: finalVideoUrl,
      completedAt: allOk ? new Date() : null,
    },
  });

  if (!allOk) {
    await refundFailedClips(row.id, row.userId, clips, creditsPerClip(state.clipLength));
  }
}

// =============================================================
// Final reel — ffmpeg concat all clips into one MP4
// =============================================================

function runFFmpeg(args: string[], timeoutMs = 900000): Promise<void> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) throw new Error("FFmpeg is not available on this server.");
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("FFmpeg timed out while assembling the reel."));
    }, timeoutMs);
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-600)}`));
    });
  });
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Shared "final assembly" step: stitch ready clips, overlay brand logo, generate caption.
 * Called automatically at the end of batchRenderCampaign AND on demand by /finalize.
 */
async function runFinalAssembly(input: {
  campaignId: string;
  userId: string;
  state: CampaignState;
  clips: CampaignClipSlot[];
}): Promise<{ finalVideoUrl: string | null; caption?: string; hashtags?: string[] }> {
  let finalVideoUrl: string | null = null;
  let caption: string | undefined;
  let hashtags: string[] | undefined;

  try {
    await prisma.cartoonVideo.update({
      where: { id: input.campaignId },
      data: { progress: 94, currentStep: "Stitching final reel..." },
    });
    const stitchedUrl = await concatClipsIntoReel(input.campaignId, input.clips);

    const brand = await getBrandSnapshot(input.userId);
    if (brand.logo) {
      try {
        await prisma.cartoonVideo.update({
          where: { id: input.campaignId },
          data: { progress: 96, currentStep: "Adding brand logo..." },
        });
        finalVideoUrl = await overlayBrandLogo({
          campaignId: input.campaignId,
          videoUrl: stitchedUrl,
          logoUrl: brand.logo,
        });
      } catch (e) {
        console.warn("[StoryAdCampaign] logo overlay failed, using un-stamped reel:", e);
        finalVideoUrl = stitchedUrl;
      }
    } else {
      finalVideoUrl = stitchedUrl;
    }

    try {
      await prisma.cartoonVideo.update({
        where: { id: input.campaignId },
        data: { progress: 98, currentStep: "Writing social caption..." },
      });
      const c = await generateCampaignCaption(input.state, brand);
      caption = c.caption;
      hashtags = c.hashtags;
    } catch (e) {
      console.warn("[StoryAdCampaign] caption generation failed:", e);
    }

    // Save the final reel into the user's media library so it appears in /media.
    if (finalVideoUrl) {
      try {
        await saveCampaignReelToLibrary({
          userId: input.userId,
          campaignId: input.campaignId,
          title: input.state.brief?.slice(0, 80) || "Story Ad Campaign",
          videoUrl: finalVideoUrl,
          thumbnailUrl: input.clips.find((c) => c.videoUrl)?.videoUrl || null,
        });
      } catch (e) {
        console.warn("[StoryAdCampaign] media library save failed:", e);
      }
    }
  } catch (error) {
    console.error("[StoryAdCampaign] final assembly failed:", error);
  }

  return { finalVideoUrl, caption, hashtags };
}

async function ensureStoryAdCampaignFolder(userId: string): Promise<string> {
  const name = "Story Ad Campaigns";
  const existing = await prisma.mediaFolder.findFirst({
    where: { userId, name, parentId: null },
    select: { id: true },
  });
  if (existing) return existing.id;
  const folder = await prisma.mediaFolder.create({ data: { userId, name } });
  return folder.id;
}

async function saveCampaignReelToLibrary(input: {
  userId: string;
  campaignId: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
}): Promise<void> {
  // Avoid duplicate entries if finalize re-runs (e.g. user clicks Re-stitch)
  const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campaign"}-${input.campaignId.slice(-6)}`;
  const filename = `${slug}.mp4`;
  const existing = await prisma.mediaFile.findFirst({
    where: { userId: input.userId, filename },
    select: { id: true },
  });
  const folderId = await ensureStoryAdCampaignFolder(input.userId);
  const payload = {
    userId: input.userId,
    filename,
    originalName: `${input.title} – Story Ad Campaign`,
    url: input.videoUrl,
    type: "video",
    mimeType: "video/mp4",
    size: 0,
    folderId,
    tags: JSON.stringify(["story-ad-campaign", "ai-generated"]),
    metadata: JSON.stringify({
      campaignId: input.campaignId,
      source: "story-ad-campaign",
      thumbnail: input.thumbnailUrl || null,
    }),
  };
  if (existing) {
    await prisma.mediaFile.update({ where: { id: existing.id }, data: { url: input.videoUrl } });
  } else {
    await prisma.mediaFile.create({ data: payload });
  }
}

/**
 * On-demand finalize: stitch the current READY clips into a fresh reel.
 * Used when a user retried failed clips after the initial batch render, or
 * when they want to regenerate the composite manually.
 */
export async function finalizeCampaign(input: {
  campaignId: string;
  userId: string;
}): Promise<{ finalVideoUrl: string | null }> {
  const current = await getCampaign(input.campaignId, input.userId);
  if (!current) throw new Error("Campaign not found");

  const readyClips = current.state.clips.filter((c) => c.status === "READY" && c.videoUrl);
  if (!readyClips.length) {
    throw new Error("No rendered clips yet — render before stitching.");
  }

  const result = await runFinalAssembly({
    campaignId: input.campaignId,
    userId: input.userId,
    state: current.state,
    clips: current.state.clips, // pass full clips so order/index is preserved
  });

  const merged: CampaignState = {
    ...current.state,
    phase: "DONE",
    finalVideoUrl: result.finalVideoUrl ?? current.state.finalVideoUrl ?? null,
    finalVideoThumbnailUrl:
      current.state.clips.find((c) => c.videoUrl)?.videoUrl ||
      current.state.finalVideoThumbnailUrl ||
      null,
    ...(result.caption ? { campaignCaption: result.caption } : {}),
    ...(result.hashtags ? { hashtags: result.hashtags } : {}),
  };

  await prisma.cartoonVideo.update({
    where: { id: input.campaignId },
    data: {
      metadata: writeCampaign(merged),
      status: "COMPLETED",
      progress: 100,
      currentStep: "Campaign reel ready",
      videoUrl: merged.finalVideoUrl,
      completedAt: new Date(),
    },
  });

  return { finalVideoUrl: merged.finalVideoUrl ?? null };
}

async function concatClipsIntoReel(
  campaignId: string,
  clips: CampaignClipSlot[],
): Promise<string> {
  const ready = clips.filter((c) => c.videoUrl && c.status === "READY");
  if (!ready.length) throw new Error("No ready clips to concatenate");
  if (ready.length === 1 && ready[0].videoUrl) return ready[0].videoUrl;

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "story-ad-campaign-"));
  const outputPath = path.join(tempDir, "reel.mp4");
  const listPath = path.join(tempDir, "concat.txt");

  try {
    const clipPaths: string[] = [];
    for (let i = 0; i < ready.length; i++) {
      const clipPath = path.join(tempDir, `clip-${String(i + 1).padStart(2, "0")}.mp4`);
      const buffer = await downloadToBuffer(ready[i].videoUrl as string);
      await writeFile(clipPath, buffer);
      clipPaths.push(clipPath);
    }

    const list = clipPaths
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listPath, list);

    try {
      await runFFmpeg([
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c", "copy",
        "-movflags", "+faststart",
        "-y", outputPath,
      ]);
    } catch {
      await runFFmpeg([
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        "-y", outputPath,
      ]);
    }

    const finalBuffer = await readFile(outputPath);
    const key = `story-ad-campaigns/${campaignId}/final-${nanoid(8)}.mp4`;
    return await uploadToS3(key, finalBuffer, "video/mp4");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

// =============================================================
// Brand logo overlay on the final reel
// =============================================================

async function overlayBrandLogo(input: {
  campaignId: string;
  videoUrl: string;
  logoUrl: string;
}): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "story-ad-logo-"));
  const inputVideoPath = path.join(tempDir, "input.mp4");
  const logoPath = path.join(tempDir, "logo.png");
  const outputPath = path.join(tempDir, "stamped.mp4");

  try {
    const [videoBuf, logoBuf] = await Promise.all([
      downloadToBuffer(input.videoUrl),
      downloadToBuffer(input.logoUrl),
    ]);
    await writeFile(inputVideoPath, videoBuf);
    await writeFile(logoPath, logoBuf);

    // Overlay logo in top-right with 24px margin, scaled to ~12% of video width, semi-transparent.
    // Filter chain: scale logo → set alpha → overlay.
    const filter =
      "[1:v]scale=iw*0.5:-1,format=rgba,colorchannelmixer=aa=0.85[lg];" +
      "[0:v][lg]overlay=W-w-24:24:format=auto";

    await runFFmpeg([
      "-i", inputVideoPath,
      "-i", logoPath,
      "-filter_complex", filter,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-c:a", "copy",
      "-movflags", "+faststart",
      "-y", outputPath,
    ]);

    const finalBuffer = await readFile(outputPath);
    const key = `story-ad-campaigns/${input.campaignId}/final-branded-${nanoid(8)}.mp4`;
    return await uploadToS3(key, finalBuffer, "video/mp4");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

// =============================================================
// Campaign caption + hashtags for social posting
// =============================================================

async function generateCampaignCaption(
  state: CampaignState,
  brand: BrandSnapshot,
): Promise<{ caption: string; hashtags: string[] }> {
  const dialogueSummary = state.clips
    .slice(0, 3)
    .map((c) =>
      c.dialogue
        .map((d) => {
          const speaker = state.characters.find((ch) => ch.id === d.characterId);
          return `${speaker?.name || "?"}: "${d.line}"`;
        })
        .join(" / "),
    )
    .filter(Boolean)
    .join(" — ");

  const prompt = `Write a social caption for this short-film ad campaign.

BRAND: ${brand.name}${brand.tagline ? ` — ${brand.tagline}` : ""}
${brand.industry ? `INDUSTRY: ${brand.industry}` : ""}
${brand.targetAudience ? `AUDIENCE: ${brand.targetAudience}` : ""}
${brand.voiceTone ? `VOICE: ${brand.voiceTone}` : ""}

CAMPAIGN BRIEF: ${state.brief}
GOAL: ${state.goal}
${state.storyOutline ? `STORY OUTLINE: ${state.storyOutline}` : ""}
${dialogueSummary ? `OPENING DIALOGUE: ${dialogueSummary}` : ""}

Write a social post caption that introduces the video to the audience. Conversational, NOT salesy. 2–3 short sentences max. End with a soft CTA (e.g. "Watch the story →" or "See how it plays out."). NO emojis. NO "Buy now". Sound like a person sharing a short film, not a brand pushing an ad.

Also propose 4–6 clean, business-appropriate hashtags (no spammy/generic tags).

Return strict JSON only:
{ "caption": "...", "hashtags": ["#example"] }`;

  const result = await ai.generateJSON<{ caption: string; hashtags: string[] }>(prompt, {
    maxTokens: 500,
    temperature: 0.75,
    systemPrompt:
      "You write social captions that feel human, not like ads. Return valid JSON only.",
  });

  return {
    caption: String(result?.caption || "").trim().slice(0, 700),
    hashtags: Array.isArray(result?.hashtags)
      ? result.hashtags
          .map((t) => String(t).trim())
          .filter(Boolean)
          .map((t) => (t.startsWith("#") ? t : `#${t}`))
          .slice(0, 8)
      : [],
  };
}

async function persistClipsProgress(
  id: string,
  clips: CampaignClipSlot[],
  completed: number,
  total: number,
) {
  const progress = total ? Math.round((completed / total) * 95) + 5 : 5;
  const current = await prisma.cartoonVideo.findUnique({
    where: { id },
    select: { metadata: true },
  });
  const state = readCampaign(current?.metadata);
  state.clips = clips;
  await prisma.cartoonVideo.update({
    where: { id },
    data: {
      progress,
      currentStep: `Rendering ${completed}/${total} clips...`,
      metadata: writeCampaign(state),
    },
  });
}

export function creditsPerClip(clipLength: CampaignClipLength): number {
  // Linear: 10 credits/second. 8s=80, 10s=100, 12s=120, 15s=150.
  return clipLength * 10;
}

export function totalCreditsForCampaign(durationSeconds: CampaignDurationSeconds, clipLength: CampaignClipLength): number {
  return creditsPerClip(clipLength) * clipsForDuration(durationSeconds, clipLength);
}

async function refundFailedClips(
  campaignId: string,
  userId: string,
  clips: CampaignClipSlot[],
  perClipCredits: number,
) {
  const failed = clips.filter((c) => c.status === "FAILED").length;
  if (!failed) return;
  const refund = failed * perClipCredits;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aiCredits: true } });
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { aiCredits: { increment: refund } },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        type: TRANSACTION_TYPES.REFUND,
        amount: refund,
        balanceAfter: (user?.aiCredits || 0) + refund,
        referenceType: ANIMATION_TYPE,
        referenceId: campaignId,
        description: `Refund for ${failed} failed campaign clips`,
      },
    });
  });
}

