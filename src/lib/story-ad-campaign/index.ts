import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { nanoid } from "nanoid";
import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { TRANSACTION_TYPES, creditService } from "@/lib/credits";
import { DEFAULT_CREDIT_COSTS, type CreditCostKey } from "@/lib/credits/costs";
import { veoClient } from "@/lib/ai/veo-client";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { generateImageXaiFirst, generateImageForRole } from "@/lib/ai/image-router";
import { generateMusicClip, isLyriaEnabled } from "@/lib/ai/lyria-client";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { generateVoice } from "@/lib/voice/voice-engine";
import { generateSoundEffect, generateWithClonedVoice, isElevenLabsEnabled } from "@/lib/voice/elevenlabs-client";
import { VOICE_CLEANUP_FILTER, AMBIENT_BED_FILTER, AMBIENT_BED_MAX_GAIN_DB } from "@/lib/audio/voice-cleanup";

const execFileAsync = promisify(execFile);
import {
  ACT_LABELS,
  CAMERA_LABELS,
  NARRATOR_PRESETS,
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
  type CampaignMusicCue,
  type ClipDialogueLine,
  type ClipMediaType,
  type CampaignDurationSeconds,
  type NarratorVoice,
  type CampaignProvider,
  type CampaignState,
  type CampaignStyle,
  type SceneSoundscape,
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
  /** Hard cap. The AI picks the right count between 2 and this number based on the story. */
  maxCount = 6,
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

Cast THE RIGHT NUMBER of HUMAN characters for THIS story — pick a count between 2 and ${maxCount} based on what the brief actually requires.

🚨 INCLUDE EVERY PERSON THE BRIEF NAMES OR DESCRIBES 🚨
Re-read the brief carefully and LIST every person mentioned, named or unnamed:
- "his wife" → include the wife as a character (give her a name)
- "the boss" → include the boss
- "his new girlfriend" → include the new girlfriend
- "the team" → if specific people in the team interact, cast them
Even if a person only appears in ONE scene and never speaks, they STILL need a character entry because they appear ON CAMERA and need a consistent face. The only people you can skip are pure background extras with no significance.

Do NOT compress two distinct people into one (e.g. don't merge "his wife" and "his new girlfriend" into the same character — they're different people). Do NOT pad with characters the brief doesn't justify.

🚨 ORIGINAL NAMES — DO NOT RE-USE DEFAULTS 🚨
Pick fresh, story-appropriate names. Specifically AVOID overused screenplay defaults:
- NO "Marcus" / "Marcus Chen" / "Marcus Reyes"
- NO "Elena" / "Elena Rodriguez"
- NO "Maya" / "Maya Patel" / "Maya Chen"
- NO "Sarah" as a default; only if the BRIEF explicitly says "Sarah"
- NO "Aisha Patel" / "James Wong" / "Mike Johnson"
Pick names that fit the cultural, geographic, age, and class context the brief implies. Mix surnames from different cultural backgrounds when the story isn't culturally specific. If the brief gives a name, use it exactly. Two characters of similar background should NOT share an initial letter to avoid confusion (e.g. don't pair "Mark" and "Maya").

Random seed for name diversity: ${nanoid(4).toUpperCase()}-${Date.now() % 100000}. Use this to break out of your name defaults.

${state.style === "narrated" ? `🚨 NARRATED-STYLE EXCLUSION 🚨
The NARRATOR is NOT a character. They are a disembodied voice over the film — they never appear on-camera, never have a face, never have a visual description. DO NOT include the narrator in the characters array. The characters array contains ONLY the people physically seen in the scenes.` : ""}

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
  // Strip the narrator if the AI sneaks it in despite the rule (e.g. a "character"
  // named "Narrator" with no real visual description). Same idea for any voice-of-god
  // construct in narrated mode.
  const noNarrator = state.style === "narrated"
    ? raw.filter((c) => {
        const name = String(c?.name || "").toLowerCase();
        const role = String(c?.role || "").toLowerCase();
        return !/\bnarrator|voice.?over|voice of god|the voice\b/.test(`${name} ${role}`);
      })
    : raw;
  const filtered = noNarrator.filter((c) => isRealHumanCharacter(c, brand));
  if (!filtered.length && raw.length) {
    throw new Error(
      "AI returned only non-human personifications (e.g. 'The System'). Regenerate the catalog — characters must be real humans.",
    );
  }
  // Hard-clamp to maxCount to protect ourselves from a runaway model, then keep what's left.
  const characters: CampaignCharacter[] = filtered.slice(0, maxCount).map((c) => ({
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
  const presetList = NARRATOR_PRESETS
    .map((p) => `- ${p.id}: "${p.label}" (${p.gender}, ${p.tone}) — ${p.description}`)
    .join("\n");

  const prompt = `Pick the best narrator voice for this short film FROM THE PRESET LIST.

STORY OUTLINE: ${storyOutline}
BRIEF: ${state.brief}
BRAND TONE: ${brand.voiceTone || "professional"}

PRESET LIST:
${presetList}

Pick the SINGLE id from the list that best fits the story's emotional weight and brand tone. For example: a war veteran's quiet return → 'noir-male' or 'documentary-male'. A heartwarming family story → 'warm-storyteller'. An upbeat brand launch → 'energetic-host'.

Return strict JSON only:
{ "presetId": "<one of the ids above>" }`;

  const result = await ai.generateJSON<{ presetId: string }>(prompt, {
    maxTokens: 100,
    temperature: 0.4,
    systemPrompt: "You pick the right narrator preset for short films. Return valid JSON with one of the listed preset ids.",
  });

  const preset =
    NARRATOR_PRESETS.find((p) => p.id === result?.presetId) ||
    NARRATOR_PRESETS.find((p) => p.id === "documentary-male") ||
    NARRATOR_PRESETS[0];

  return {
    gender: preset.gender,
    tone: preset.tone,
    pace: preset.pace,
    presetId: preset.id,
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

/**
 * Multi-angle character TURNAROUND SHEET — the same person rendered three times
 * (front, three-quarter, profile) plus a face close-up, on one neutral seamless
 * backdrop with identical wardrobe + lighting. This is the cast anchor we feed into
 * Veo Quality's `referenceImages`: seeing the character from multiple angles lets the
 * video model hold the SAME identity across wide / close / over-shoulder / profile
 * shots — which is exactly where a single front portrait drifts. Landscape framing.
 */
function buildCharacterSheetPrompt(
  character: CampaignCharacter,
  style: CampaignStyle,
  brand: BrandSnapshot,
): string {
  const styleBlock =
    style === "3d"
      ? "Premium Pixar / Disney-grade 3D animation render. Stylized but expressive character rig, soft global illumination, subsurface scattering on skin, polished CGI surfaces, cinematic 3D lighting."
      : "Photoreal cinematic look. ARRI Alexa, naturalistic studio lighting, photoreal skin texture, real production wardrobe. NOT 3D animation, NOT illustration — a real human photograph aesthetic.";

  return `Character model TURNAROUND SHEET for an ad campaign — the reference used to lock visual continuity across every shot.

CHARACTER (the SAME person in every pose — identical face, hair, build, wardrobe, palette)
- Name: ${character.name}
- Role: ${character.role}
- Description: ${character.visualDescription}

STYLE
${styleBlock}

LAYOUT (one image, landscape)
- A clean character-reference sheet: the SAME character shown in THREE full-body poses left-to-right — front view, three-quarter view, and side profile — all standing, neutral confident posture.
- Plus ONE head-and-shoulders face close-up in a corner.
- Even, flat studio lighting; plain seamless light-grey backdrop; consistent scale across poses.
- Absolutely identical clothing, hairstyle, and proportions in every pose — this is a turnaround of one person, not different people.

HARD RULES
- No text, no labels, no captions, no measurement lines, no grid, no watermark, no UI, no logo.
- No other people. No props beyond what the character wears.
- Brand context (tonal only — do NOT draw the logo): ${brand.name}${brand.industry ? ` (${brand.industry})` : ""}.
- The character must read as authentic to the ${style === "3d" ? "3D animation" : "live-action cinematic"} world.`;
}

async function uploadCharacterImage(
  result: { base64?: string; format: string },
  campaignId: string,
  character: CampaignCharacter,
  suffix: string,
): Promise<string> {
  if (!result.base64) throw new Error("Image provider returned no image");
  const buffer = Buffer.from(result.base64, "base64");
  const ext = result.format === "jpeg" ? "jpg" : result.format;
  const safe = character.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "character";
  const key = `story-ad-campaigns/${campaignId}/characters/${safe}-${suffix}-${nanoid(6)}.${ext}`;
  const contentType = result.format === "jpeg" ? "image/jpeg" : `image/${result.format}`;
  return uploadToS3(key, buffer, contentType);
}

/**
 * Generate the character anchor images:
 *  - `portraitUrl`  — single clean three-quarter portrait (used as the Veo-Lite
 *    first-frame anchor and shown in the UI / saved to the library).
 *  - `sheetUrl`     — multi-angle turnaround sheet fed into Veo Quality
 *    `referenceImages` for the strongest cross-shot consistency. Best-effort: if the
 *    sheet generation fails we still return the portrait so the flow never breaks.
 */
export async function generateCharacterPreviewImage(
  character: CampaignCharacter,
  state: CampaignState,
  brand: BrandSnapshot,
  campaignId: string,
): Promise<{ portraitUrl: string; sheetUrl: string | null }> {
  if (!state.style) throw new Error("Campaign style must be selected first");
  // For narrated style, characters should match the chosen sub-style (3d illustrations vs cinematic stills).
  const effectiveStyle: CampaignStyle =
    state.style === "narrated" ? state.narratedSubStyle || "cinematic" : state.style;

  const portraitPrompt = buildCharacterImagePrompt(character, effectiveStyle, brand);
  const sheetPrompt = buildCharacterSheetPrompt(character, effectiveStyle, brand);

  // Portrait (1024x1280) is required; sheet (1536x1024 landscape) is best-effort.
  const [portraitResult, sheetResult] = await Promise.all([
    generateImageXaiFirst(portraitPrompt, 1024, 1280, { quality: "high", transparent: false }),
    generateImageXaiFirst(sheetPrompt, 1536, 1024, { quality: "high", transparent: false }).catch(
      (err) => {
        console.warn(
          `[StoryAdCampaign] Character sheet generation failed for ${character.name}; falling back to portrait-only anchor: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      },
    ),
  ]);

  const portraitUrl = await uploadCharacterImage(portraitResult, campaignId, character, "portrait");
  let sheetUrl: string | null = null;
  if (sheetResult?.base64) {
    try {
      sheetUrl = await uploadCharacterImage(sheetResult, campaignId, character, "sheet");
    } catch (err) {
      console.warn(
        `[StoryAdCampaign] Character sheet upload failed for ${character.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return { portraitUrl, sheetUrl };
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

/**
 * Pre-creation "give me an idea" suggester. Works at Stage 0 when no campaign exists
 * yet — generates fresh, on-brand ideas for the Brief or Goal field using only the
 * user's BrandKit + an optional current value as the seed.
 *
 * Each call uses a random seed (nanoid + timestamp) injected into the prompt so the
 * model doesn't lock into one of its memorized defaults.
 */
export async function suggestDraftField(input: {
  field: "brief" | "goal";
  brand: BrandSnapshot;
  currentValue?: string;
  hint?: string;
}): Promise<string> {
  const seed = `${nanoid(4).toUpperCase()}-${Date.now() % 100000}`;
  const fieldDescriptor =
    input.field === "brief"
      ? `A CATCHY STORY IDEA the ad will dramatize. 2–4 vivid sentences. Describe a real human moment that connects to ${input.brand.name}'s offer WITHOUT sounding like a pitch. Open on the scene, not on the product. Make it feel like the opening of a short film — surprising, emotional, specific. Pick something different from typical "before/after transformation" tropes.`
      : `A short campaign GOAL — one sentence on what we want viewers to FEEL when the reel ends. Something like "Build envy", "Show possibility", "Land a quiet truth". Not "drive sign-ups" or "boost sales" — that's the campaign metric, not the goal.`;

  const prompt = `You are writing a fresh, catchy idea for an ad campaign.

BRAND: ${input.brand.name}${input.brand.tagline ? ` — ${input.brand.tagline}` : ""}
${input.brand.industry ? `INDUSTRY: ${input.brand.industry}` : ""}
${input.brand.uniqueValue ? `UNIQUE VALUE: ${input.brand.uniqueValue}` : ""}
${input.brand.targetAudience ? `AUDIENCE: ${input.brand.targetAudience}` : ""}
${input.brand.voiceTone ? `VOICE: ${input.brand.voiceTone}` : ""}
${input.currentValue ? `\nCURRENT VALUE (improve or replace — feel free to pivot completely):\n"""\n${input.currentValue}\n"""` : ""}
${input.hint ? `\nUSER HINT: ${input.hint}` : ""}

RANDOMNESS SEED (so you don't repeat your defaults — vary the idea per request): ${seed}

WRITE THE FIELD: ${fieldDescriptor}

Return strict JSON only:
{ "value": "the field text" }`;

  const result = await ai.generateJSON<{ value: string }>(prompt, {
    maxTokens: 500,
    temperature: 0.95,
    systemPrompt:
      "You are a short-form video creative director. Generate fresh, original ideas that AVOID generic ad-speak. Each output should feel unique — don't repeat phrasing across requests. Return valid JSON only.",
  });

  return String(result?.value || "").trim().slice(0, 1200);
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

/**
 * Returned by `planSceneGrid`. For narrated style we also plan campaign-level music
 * cues (Lyria 3) — these aren't per-scene, so they live on the state, not on a clip.
 */
export interface PlannedSceneGrid {
  clips: CampaignClipSlot[];
  musicCues?: CampaignMusicCue[];
}

export async function planSceneGrid(
  state: CampaignState,
  brand: BrandSnapshot,
): Promise<PlannedSceneGrid> {
  if (!state.style) throw new Error("Campaign style must be selected first");
  if (!state.characters.length) throw new Error("Generate the character catalog first");

  // Narrated style uses a different planner — many image scenes + a few video highlights,
  // narrator-driven with optional character dialogue moments. Only narrated produces music cues.
  if (state.style === "narrated") {
    return planNarratedScenes(state, brand);
  }

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
- Brand named ONLY in the final ${lastTwo} clip(s). Never before. No fake brand mocks, packaging, or signs in earlier clips.
- One continuous screenplay; never isolated vignettes.
- NEVER write narrator/voiceover. All speech is on-camera dialogue.
- NEVER write ad copy. Brand fits the conversation organically.
- No on-screen text overlays. No readable signs, no readable phone/laptop screens, no fake app UI.
- Characters interact with PROPS NATURALLY — phones/laptops/tablets face the user holding them, NOT the camera. The audience sees props from a real bystander's angle.
- Every speaker must be one of the listed character ids. Extras visible in the scene stay silent, generic, and out-of-focus.
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

  return { clips };
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

/**
 * Narrated-story planner. Generates ~N scenes (mostly stills with narrator,
 * 15–25% animated as 8-second xAI video clips), each with narratorLine + optional
 * character dialogue moments.
 */
async function planNarratedScenes(
  state: CampaignState,
  brand: BrandSnapshot,
): Promise<PlannedSceneGrid> {
  // Target ~10 seconds per scene; user picks duration up to 600s.
  const targetSecondsPerScene = 10;
  const sceneCount = Math.max(6, Math.min(60, Math.round(state.durationSeconds / targetSecondsPerScene)));
  // Narrated style = exactly ONE 8-second video clip as the opening hook, then still images.
  // Cheaper than the prior ~20% video budget, and animated images carry the rest.
  const charactersBlock = state.characters
    .map((c) => `- ${c.id} | ${c.name} (${c.role})`)
    .join("\n");

  const prompt = `You are writing a ${state.durationSeconds}-second narrated short film. It plays as a sequence of cinematic illustrations with a NARRATOR voicing the story, plus IN-SCENE CHARACTER DIALOGUE on top of those stills, plus a layered SOUND DESIGN (ambient bed + spot SFX). Exactly ONE moment (the very first scene) is a real 8-second video clip — the hook that grabs the viewer. Everything after is a still image animated programmatically.

🚨 ABSOLUTE TOP PRIORITY — DRAMATIZE THE USER'S BRIEF LITERALLY 🚨

USER'S BRIEF (this is THE story; everything else serves it):
"""
${state.brief}
"""

The brief is the LAW. Follow the user's described scenes in their EXACT order. If the brief opens with combat, open with combat. Do NOT skip ahead to the brand. The first ~80% of scenes is the human story; the brand only fits in at the very end if at all.

${state.storyOutline ? `STORY OUTLINE (reference): ${state.storyOutline}` : ""}
GOAL (tone): ${state.goal}
${brand.name ? `BRAND CONTEXT (background, last scene at most): ${brand.name}${brand.tagline ? ` — ${brand.tagline}` : ""}` : ""}

CHARACTERS (use ids verbatim — do NOT invent new ones):
${charactersBlock}

Plan exactly ${sceneCount} scenes. Scene 1 is the HOOK and MUST be mediaType: "video" (8 seconds, the most kinetic / visceral moment of the story). Scenes 2..${sceneCount} are ALL mediaType: "image".

For each scene:
- act: HOOK | PROBLEM | DISCOVERY | TRANSFORM | RESOLUTION | CTA
- shotType: WIDE | MEDIUM | CLOSE_UP | POV | DRONE | MACRO | OVER_SHOULDER
- cameraMovement: PUSH_IN | PULL_BACK | PAN | STATIC | ORBIT | HANDHELD | TRACK
- sceneAction: ONE sentence describing what we see. Include scene-specific wardrobe / props / environment if different from the character's default.
- moodLighting: lighting + color grade, single line.
- mediaType: "video" ONLY for scene 1. "image" for every other scene.
- characterIds: array of character ids on camera (0–3). Use [] for pure environment / object shots.
- narratorLine: 1–3 sentences (~15–35 words) — the narrator's voice over this scene. Detached, documentary-style; advances the story emotionally instead of describing what we see.
- dialogue: 0–3 short in-scene character lines (~5–15 words each). Characters can speak ON the still image — we'll hear their voice while we look at them. Roughly 40–60% of scenes SHOULD have at least one line of dialogue; the rest are narrator-only. Each line: { "characterId": "...", "line": "...", "emotion": "..." }. The narrator and dialogue work together — they don't overlap; the narrator pauses while a character speaks, then resumes.
- soundscape: cinematic sound design for this scene. Provide:
    - ambient: { description: "...natural environment sound description, e.g. 'distant city traffic with light rain on pavement'..." } — plays at low volume under everything for the full scene.
    - spot: an array of 0–3 short cues, each { description, atSec } — e.g. { description: "wooden door creaking open", atSec: 1.5 }. These give the scene physicality. Pick the obvious diegetic sounds the scene action calls for (footsteps, glass, wind, car engine, gunfire, applause, etc.).
  Keep it diegetic — what the characters in the scene would actually hear. Avoid music cues; music is handled separately. Avoid clichés that don't fit. If a scene is silent by design, omit the spot array.

NARRATIVE FLOW (CRITICAL — read carefully):
- The narrator's voice runs continuously across scenes. Each narratorLine PICKS UP EXACTLY where the previous scene's narrator left off — same voice, same paragraph, same emotional thread. Do NOT restart the topic in each scene.
- Read the story aloud in your head: the narrator lines, in order, should sound like ONE continuous documentary script, not a list of disconnected captions. Avoid "X is a ..." restatements after the first scene.
- Each narratorLine should be 2–4 sentences (~25–50 words) — substantial enough to feel like real narration, not a one-line caption.
- Dialogue happens IN the scene; the narrator goes quiet for that beat, then resumes the SAME continuous voice in the next.
- Open scene 1 (the hook video) with a strong narrator opening line that pulls the viewer in. Close the final scene with a quiet, emotionally landed line — never a sales pitch.

HARD RULES:
- Follow the BRIEF's scene order literally — scenes must appear in the chronological order the user described.
- ONLY scene 1 is mediaType "video". Every other scene MUST be mediaType "image".
- Brand named only in the FINAL scene at most. Never before. No fake brand mocks or logos in earlier scenes.
- No on-screen text overlays. No visible store signs, no readable phone/laptop screens, no fake app UI.
- Phone/laptop/tablet props are angled toward the character USING them, not the camera. Show props from a natural bystander's angle.
- ${state.characters.length} characters total — every speaker must be one of them by id. Do NOT invent new named characters; if you need an extra they remain silent, generic, out-of-focus.
- DIALOGUE LINES NEVER CONTAIN THE BRAND NAME until the final scene at most. Earlier scenes are about the human story, not the product.

MUSIC CUES — use it SMARTLY, the way a skilled film editor does:

Music in a short film is NOT a background score. It's a tool you use SURGICALLY to
enhance a specific emotional moment, then GET OUT OF THE WAY. Most of the reel should
have NO music — just narrator + dialogue + ambient SFX. Silence is what makes the
moments WITH music actually land.

How to think about it:
- Picture a documentary you respect. The composer scores one or two key beats — a
  revelation, a turning point, the final emotional landing — and the rest is voice +
  ambient. They didn't write a continuous bed. They chose moments.
- Music ENTERS for a specific reason (a quiet truth, a transformation, an arrival) and
  EXITS as soon as that moment is over. It does NOT underscore every scene of narration.
- A reel with music constantly playing under the narrator feels amateur and exhausting.
  Audiences feel manipulated. Empty space is part of the score.

Smart picks (give 0–3 cues total — EMPTY is often the right answer):
- A reel about loss might get ONE quiet piano swell on the revelation scene. That's it.
- A transformation story might get a single building cue at the turning point + a
  brief warm exhale on the resolution. Two cues, total.
- A dialogue-heavy comedic piece probably warrants ZERO music.
- A 30-second hook might get a single 5-second sting at the open and nothing else.

DON'T:
- Plan 3 cues that together cover most of the reel (that's a continuous bed in disguise).
- Plan music underneath heavy character dialogue — it competes with the voice.
- Plan music on the very first AND very last scenes simultaneously — let one breathe.

Each cue: { "startSceneIndex": int, "endSceneIndex": int, "description":
"specific instrument + tempo + feeling, e.g. 'single piano note swell, slow, 6 seconds, melancholy'" }

Return strict JSON with exactly ${sceneCount} scenes AND the optional music plan:
{
  "clips": [
    {
      "act": "HOOK",
      "shotType": "WIDE",
      "cameraMovement": "HANDHELD",
      "sceneAction": "...",
      "moodLighting": "...",
      "mediaType": "video",
      "characterIds": ["${state.characters[0]?.id || ""}"],
      "narratorLine": "...",
      "dialogue": [],
      "soundscape": { "ambient": { "description": "..." }, "spot": [ { "description": "...", "atSec": 0.5 } ] }
    }
  ],
  "musicCues": [
    { "startSceneIndex": 0, "endSceneIndex": 2, "description": "soft solo piano, melancholy, slow build" }
  ]
}`;

  const result = await ai.generateJSON<{ clips: PlannedNarratedClip[]; musicCues?: PlannedMusicCue[] }>(prompt, {
    maxTokens: 10000,
    temperature: 0.72,
    systemPrompt:
      "You are a screenwriter + sound designer + composer for narrated documentary-style short films. The narrator carries the story; the user's brief is the law. Music is sparse and intentional. Return valid JSON only.",
  });

  const characterIds = new Set(state.characters.map((c) => c.id));
  const raw = Array.isArray(result?.clips) ? result.clips : [];
  const trimmed = raw.slice(0, sceneCount);

  // Pick mediaType for every narrated scene:
  // - fullAnimation=true  → every scene is "video" (Veo Lite no-audio, ~$0.24 / 8s clip)
  // - fullAnimation=false → every scene is "image" (still + Ken Burns, no video gen at all)
  // The legacy "1 xAI hook + stills" pattern is gone — Veo Lite is now cheap enough that
  // a real all-video reel is viable, and stills-only is even cheaper when the user doesn't
  // need the motion.
  const fullAnim = state.fullAnimation === true;
  const narratedMediaType: ClipMediaType = fullAnim ? "video" : "image";

  const clips: CampaignClipSlot[] = trimmed.map((c, index) => {
    const mediaType: ClipMediaType = narratedMediaType;
    const slot: CampaignClipSlot = {
      id: nanoid(8),
      index: index + 1,
      act: normalizeAct(c.act),
      shotType: normalizeShot(c.shotType),
      cameraMovement: normalizeCamera(c.cameraMovement),
      sceneAction: String(c.sceneAction || "").trim().slice(0, 400),
      moodLighting: String(c.moodLighting || "").trim().slice(0, 200),
      characterIds: normalizeCharacterIds(c, characterIds),
      dialogue: normalizeDialogue(c, characterIds),
      narratorLine: String(c.narratorLine || "").trim().slice(0, 480),
      soundscape: normalizeSoundscape(c),
      mediaType,
      imageUrl: null,
      audioUrl: null,
      mixedAudioUrl: undefined,
      segmentDuration: mediaType === "video" ? 8 : targetSecondsPerScene,
      prompt: "",
      status: "PENDING",
      videoUrl: null,
      error: null,
    };
    slot.prompt = buildClipPrompt(slot, state, brand);
    return slot;
  });

  while (clips.length < sceneCount) {
    const index = clips.length + 1;
    const mediaType: ClipMediaType = narratedMediaType;
    const slot: CampaignClipSlot = {
      id: nanoid(8),
      index,
      act: "TRANSFORM",
      shotType: "WIDE",
      cameraMovement: "STATIC",
      sceneAction: "Continue the story.",
      moodLighting: "Natural cinematic lighting.",
      characterIds: state.characters[0] ? [state.characters[0].id] : [],
      dialogue: [],
      narratorLine: "",
      soundscape: undefined,
      mediaType,
      imageUrl: null,
      audioUrl: null,
      mixedAudioUrl: undefined,
      segmentDuration: mediaType === "video" ? 8 : targetSecondsPerScene,
      prompt: "",
      status: "PENDING",
      videoUrl: null,
      error: null,
    };
    slot.prompt = buildClipPrompt(slot, state, brand);
    clips.push(slot);
  }

  const musicCues = normalizeMusicCues(result?.musicCues, clips.length);
  return { clips, musicCues };
}

interface PlannedMusicCue {
  startSceneIndex?: number;
  endSceneIndex?: number;
  description?: string;
  start_scene_index?: number;
  end_scene_index?: number;
}

function normalizeMusicCues(raw: PlannedMusicCue[] | undefined, sceneCount: number): CampaignMusicCue[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  // We trust the AI's judgment on count + range + when to use music. No hardcoded
  // "max N cues" or "max X% coverage" guards — the prompt teaches taste, the model decides.
  // We only sanity-clamp the indices to valid scene bounds + ensure each cue has a description.
  const out: CampaignMusicCue[] = [];
  for (const item of raw) {
    if (!item) continue;
    const startRaw = typeof item.startSceneIndex === "number" ? item.startSceneIndex : item.start_scene_index;
    const endRaw = typeof item.endSceneIndex === "number" ? item.endSceneIndex : item.end_scene_index;
    const description = String(item.description || "").trim().slice(0, 220);
    if (!description) continue;
    const start = Math.max(0, Math.min(sceneCount - 1, Number.isFinite(startRaw) ? Math.floor(startRaw as number) : 0));
    const end = Math.max(start, Math.min(sceneCount - 1, Number.isFinite(endRaw) ? Math.floor(endRaw as number) : start));
    out.push({
      id: nanoid(6),
      startSceneIndex: start,
      endSceneIndex: end,
      description,
      // Volume default sits well below the voice. The AI decides WHERE music belongs;
      // this gain is just what keeps it from competing with the narrator when it plays.
      gainDb: -28,
      model: "clip",
    });
  }
  // Stable order (start ascending) so the overlay step can compose timing predictably.
  out.sort((a, b) => a.startSceneIndex - b.startSceneIndex);
  return out.length ? out : undefined;
}

interface PlannedSoundscapeSpot {
  description?: string;
  atSec?: number;
  at_sec?: number;
}
interface PlannedSoundscape {
  ambient?: { description?: string } | string;
  spot?: PlannedSoundscapeSpot[];
}

type SpotCue = NonNullable<SceneSoundscape["spot"]>[number];

function normalizeSoundscape(c: PlannedNarratedClip): SceneSoundscape | undefined {
  const raw = (c as unknown as { soundscape?: PlannedSoundscape }).soundscape;
  if (!raw || typeof raw !== "object") return undefined;
  const out: SceneSoundscape = {};
  if (raw.ambient) {
    const ambientDesc = typeof raw.ambient === "string" ? raw.ambient : raw.ambient.description;
    const desc = String(ambientDesc || "").trim().slice(0, 220);
    if (desc) out.ambient = { description: desc, gainDb: -20 };
  }
  if (Array.isArray(raw.spot) && raw.spot.length) {
    const spots: SpotCue[] = raw.spot
      .slice(0, 4)
      .map((s, idx) => {
        const desc = String(s?.description || "").trim().slice(0, 160);
        const atRaw = typeof s?.atSec === "number" ? s.atSec : (typeof s?.at_sec === "number" ? s.at_sec : NaN);
        const cue: SpotCue = {
          id: nanoid(6),
          description: desc,
          atSec: Number.isFinite(atRaw) ? Math.max(0, atRaw) : idx * 1.5,
          gainDb: -8,
        };
        return cue;
      })
      .filter((s) => !!s.description);
    if (spots.length) out.spot = spots;
  }
  return out.ambient || out.spot?.length ? out : undefined;
}

interface PlannedNarratedClip extends PlannedClip {
  mediaType?: string;
  narratorLine?: string;
}

export function buildClipPrompt(
  clip: CampaignClipSlot,
  state: CampaignState,
  brand: BrandSnapshot,
): string {
  if (!state.style) return clip.sceneAction;
  const styleLabel = STYLE_LABELS[state.style];

  // For narrated style the user picks a SUB-STYLE for the visual treatment (3D vs cinematic stills).
  // Scene 1 is a real video — we need the sub-style's visual language, not the default narrated
  // "documentary stills" description (which would make a 3D-selected campaign open with photoreal humans).
  let visualLanguage: string;
  if (state.style === "narrated") {
    const sub = state.narratedSubStyle || "cinematic";
    visualLanguage =
      sub === "3d"
        ? STYLE_VISUAL_LANGUAGE["3d"]
        : STYLE_VISUAL_LANGUAGE["cinematic"];
  } else {
    visualLanguage = STYLE_VISUAL_LANGUAGE[state.style];
  }

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
- During silence beats, characters react naturally (eye contact, micro-expressions) — no idle muttering or random speech.

EYELINE + BLOCKING (CRITICAL — they are talking TO EACH OTHER, not to the audience):
- Characters FACE and LOOK AT each other while talking — natural eye contact between the people in the conversation. The speaker looks at the listener; the listener looks back.
- They DO NOT look into the camera lens, do NOT address the viewer, do NOT break the fourth wall. This is a fly-on-the-wall scene the camera happens to observe — like overhearing a real conversation.
- Stage them facing each other: use two-shots, over-the-shoulder angles, or profile/three-quarter framing so we read it as a real exchange between two people. Avoid both characters standing flat, facing the lens like a news anchor.
- Body language is conversational: angled toward each other, gestures directed at the other person, reactions on the listener's face. Never a presenter pose toward camera.
- The ONLY time a character may look at the lens is if the SCENE ACTION explicitly says they address the camera (direct testimonial). Otherwise eyelines stay between the characters.`
    : "No dialogue in this clip — pure visual storytelling. Characters stay in the world, never looking at or addressing the camera.";

  // Continuity block: each clip is generated as an independent video (no provider extension chain),
  // so we LEAN HARD on textual continuity so the standalone outputs feel like one continuous film.
  // For tiers where the model supports a reference image (Veo + xAI image-to-video) we also
  // anchor the visual to the character's portrait — this block reinforces that the portrait is
  // the EXACT person we want, not "inspired by".
  const continuityBlock = `MULTI-CLIP CONTINUITY (THIS IS CRITICAL):
This clip is part ${clip.index} of a ${state.clips.length || "multi-part"}-part film. Each part is generated
independently but they all play back-to-back as ONE continuous short film. The reference image you receive
(when provided) is THE EXACT person in this scene — render the same face, hairstyle, ethnicity, build, and
age that the reference shows. The wardrobe + environment can change per scene action; the FACE cannot.

Match the surrounding clips on:
- Exact same visual style and color grade as ${visualLanguage}
- Exact same characters (same face, hair, build, wardrobe family) — see character reference portraits below
- Same world / time-of-day / weather / setting unless the scene action explicitly says we cut elsewhere
- Same lens character (anamorphic feel, same depth-of-field language, same shot composition density)
- Treat this clip as a single shot inside a longer film, not a standalone ad
- DO NOT introduce new on-camera characters who weren't in the listed roster. Crowds + passersby stay generic, blurred, out-of-focus.`;

  return [
    `${styleLabel} narrative short film — clip ${clip.index} of ${state.clips.length || "the campaign"}. Act: ${ACT_LABELS[clip.act]}.`,
    `This is a real-life dramatic scene, NOT an advertisement. No narrator, no voiceover, no on-screen text.`,
    `Visual language: ${visualLanguage}.`,
    `Shot: ${SHOT_LABELS[clip.shotType]}, camera ${CAMERA_LABELS[clip.cameraMovement]}.`,
    `Scene action: ${clip.sceneAction}`,
    `Mood + lighting: ${clip.moodLighting}`,
    continuityBlock,
    characterBlock,
    dialogueBlock,
    `Context (story-only — do NOT advertise): the brand "${brand.name}" exists in the story's world but is NEVER named or shown until the FINAL clip at the earliest. Until then, no brand logos, no brand-named props, no banner ads in the scene. If a phone or laptop is visible its screen stays blank or shows abstract generic UI, never our brand's interface.`,
    `Duration: ${state.clipLength}s. Aspect: ${state.aspectRatio}.`,
    "QUALITY RULES (HARD):",
    "- Human anatomy must be correct: TWO hands per person, FIVE fingers per hand, no extra/fused/missing limbs, no warped or floating body parts.",
    "- Faces: symmetric, normal eye count + shape, no morphing or melting between frames, no extra teeth, no doubled mouths.",
    "- Each character must look IDENTICAL to their reference portrait across every clip — same face, hair, wardrobe, build.",
    "- PROP ORIENTATION: phones, laptops, tablets, books, papers, screens, and any handheld device must FACE THE CHARACTER USING IT — not the camera. A person scrolling on their phone holds it tilted toward their own eyes; a person reading a book has the open pages facing themselves; a laptop user faces the screen with the back of the laptop visible to other angles. Show props from the angle a real bystander would see them, never head-on to camera unless the character is intentionally showing the camera what's on the screen.",
    "- NO TEXT, LOGOS, OR BRAND MARKS ON ANY PROP: phone screens, laptop screens, tablet screens, t-shirts, mugs, billboards, store signs, packaging, posters — all blank or generic shapes. No fictional app icons, no fictional company names, no fake URLs, no UI mockups of our product. Logos are composited onto the final reel separately; the AI never draws one.",
    "- NO TEXT IN THE WORLD: street signs, license plates, screens, paperwork visible to camera must be illegible or omitted. If text MUST exist (e.g. a passport), keep it small and unreadable.",
    "- NO NAMED EXTRAS: every visible person matches one of the listed reference portraits. Background characters (passersby, crowds) stay generic, out-of-focus, and silent — no improvised speaking lines, no acting beats.",
    "- No background characters speaking, no random crowd dialogue, no off-screen narration.",
    "- Smooth, continuous motion within the clip — no jump-cuts, no time skips, no scene resets mid-clip.",
    "- COHERENT TIME-OF-DAY + WEATHER: don't switch from sunny to rainy or day to night mid-clip unless the scene action specifies a transition. Match the established palette.",
    "- EYELINES: when characters talk to each other they LOOK AT each other, not the camera. No fourth-wall breaks, no addressing the viewer, no presenter/news-anchor pose facing the lens — unless the scene action explicitly calls for a direct-to-camera testimonial.",
    `Hard negative: ${NEGATIVE_TEXT_PROMPT}, no narrator voiceover, no ad slate, no logo overlay, no commercial framing, no extra hands, no extra fingers, no fused fingers, no warped faces, no doubled mouths, no characters mouthing lines that aren't theirs, no background dialogue, no jump cuts, no readable text on screens or signs, no fake brand logos or app icons, no fake product packaging, no breaking the fourth wall, no characters looking into the camera, no characters facing the lens while talking, no direct address to the viewer, no news-anchor framing, no extra characters who weren't cast.`,
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

/**
 * Maps user-facing campaign provider → Veo 3.1 tier (only for Veo-backed tiers).
 * - "veo3" → Veo Quality (Premium)
 * - "xai"  → Veo Lite    (Standard)
 * Cheap tier doesn't go through Veo at all — `pickRenderer` routes it directly to xAI.
 */
function veoTierForProvider(provider: CampaignProvider): "quality" | "lite" {
  return provider === "veo3" ? "quality" : "lite";
}

/**
 * Pick the renderer for the campaign's selected tier.
 * Premium + Standard go Veo-first with xAI fallback. Cheap goes direct to xAI (no Veo).
 */
function pickClipRenderer(
  provider: CampaignProvider,
): (clip: CampaignClipSlot, state: CampaignState) => Promise<string> {
  if (provider === "cheap") return renderClipViaXai;
  return renderClipVeoFirstWithXaiFallback;
}

/**
 * Collect EVERY on-camera character's reference portrait for a clip. Veo 3.1's
 * `referenceImages` supports up to 3 — we pass all of them so multi-character
 * scenes (e.g. clip 4 in your reel had two people) stay anchored to the cast
 * instead of generating new faces.
 *
 * Returns just the URLs (the client resolves to bytes). One image is fine; zero
 * means "no anchor available" and Veo runs prompt-only.
 */
function collectClipReferenceImages(clip: CampaignClipSlot, state: CampaignState): string[] {
  const urls: string[] = [];
  for (const id of clip.characterIds || []) {
    const character = state.characters.find((c) => c.id === id);
    // Prefer the multi-angle turnaround sheet (strongest identity lock); fall back to
    // the single portrait for characters whose sheet is missing (e.g. user-uploaded image).
    const anchor = character?.characterSheetUrl || character?.referenceImageUrl;
    if (anchor) urls.push(anchor);
    if (urls.length >= 3) break;
  }
  return urls;
}

/**
 * Single-image picker for providers that use ONE reference as the FIRST VIDEO FRAME
 * (Veo Lite image-to-video, xAI). This MUST be the clean portrait — never the
 * turnaround sheet — otherwise the clip would literally open on a character grid.
 */
function pickClipReferenceImage(clip: CampaignClipSlot, state: CampaignState): string | null {
  for (const id of clip.characterIds || []) {
    const character = state.characters.find((c) => c.id === id);
    if (character?.referenceImageUrl) return character.referenceImageUrl;
  }
  return null;
}

/**
 * Render one narrated-style video scene. Routes through the SAME tier-aware renderer
 * the cinematic/3D pipeline uses, so narrated full-animation respects the user's tier
 * choice:
 *   - Premium  (veo3)  → Veo Quality (referenceImages + negativePrompt, top fidelity)
 *   - Standard (xai)   → Veo Lite (first-frame anchor, no referenceImages/negativePrompt)
 *   - Cheap    (cheap) → xAI Imagine direct
 *
 * Was previously hardcoded to Veo Lite which gave narrated reels worse character
 * consistency than the cheaper cinematic path got. Now narrated benefits from whatever
 * tier the user paid for.
 *
 * Audio: Veo always generates native audio on the Gemini API path (no `generateAudio: false`
 * support); the downstream mixer overlays narrator + dialogue + SFX + music separately,
 * effectively replacing the native track.
 */
async function renderNarratedVideoScene(
  clip: CampaignClipSlot,
  state: CampaignState,
): Promise<string> {
  // 8s is Veo's hard cap; xAI also clamps to 8s for fallback so the final concat
  // stays uniform across narrated scenes.
  const renderOne = pickClipRenderer(state.provider);
  return renderOne(clip, { ...state, clipLength: 8 });
}

async function renderClipViaVeo(
  clip: CampaignClipSlot,
  state: CampaignState,
): Promise<string> {
  // Veo 3.1 generate-preview supports 4/6/8s. Cap requested length at 8.
  const capped = Math.min(8, state.clipLength);
  const duration = (capped === 4 ? "4" : capped === 6 ? "6" : "8") as "4" | "6" | "8";
  const tier = veoTierForProvider(state.provider);

  // Character anchoring depends on the tier:
  //   - Quality → `characterReferenceUrls` (Veo's `config.referenceImages`, up to 3,
  //     anchors face/build WITHOUT locking the first frame).
  //   - Lite    → Lite doesn't support referenceImages. We fall back to first-frame
  //     image-to-video using the primary character's portrait. Less ideal (the opening
  //     looks like the portrait) but better than no anchor at all.
  let characterReferenceUrls: string[] = [];
  let firstFrameImage: string | null = null;
  if (tier === "lite") {
    firstFrameImage = pickClipReferenceImage(clip, state);
  } else {
    characterReferenceUrls = collectClipReferenceImages(clip, state);
  }

  const result = await veoClient.generateVideoBuffer(clip.prompt, {
    durationSeconds: duration,
    resolution: "720p",
    aspectRatio: normalizeVeoAspect(state.aspectRatio),
    negativePrompt: NEGATIVE_TEXT_PROMPT,
    tier,
    characterReferenceUrls,
    referenceImageUrl: firstFrameImage,
  });
  const url = await uploadToS3(
    `story-ad-campaigns/clips/${clip.id}-${nanoid(6)}.mp4`,
    result.videoBuffer,
    "video/mp4",
  );
  return url;
}

/**
 * Render one clip with Veo as the primary path, falling back to xAI Imagine Video on
 * Veo failure. Used by the cinematic + 3D pipelines for BOTH Premium and Standard tiers
 * (Premium → Veo Quality, Standard → Veo Lite). xAI is never the primary anymore — it
 * only catches Veo outages, quota throttles, and content-safety rejections.
 */
async function renderClipVeoFirstWithXaiFallback(
  clip: CampaignClipSlot,
  state: CampaignState,
): Promise<string> {
  try {
    return await renderClipViaVeo(clip, state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[StoryAdCampaign] Veo render failed for clip ${clip.index} (${veoTierForProvider(state.provider)}) — falling back to xAI: ${msg.slice(0, 200)}`,
    );
    if (!grokVideoClient.isAvailable()) {
      // No fallback available — rethrow the original error so the retry loop can decide.
      throw err;
    }
    return await renderClipViaXai(clip, state);
  }
}

/**
 * Augment a clip prompt with xAI-specific instructions. xAI's Grok Imagine Video
 * has NO separate "asset reference" mode — it routes everything through one unified
 * API (prompt + first-frame image upload). To compensate, we:
 *   1. Inject a verbal CHARACTER SHEET describing each on-camera character's face/build
 *      in case xAI doesn't fully extract identity from the first-frame image alone.
 *   2. Explicitly tell xAI the first-frame image is a LIKENESS reference, NOT the
 *      starting pose — render the scene action below, don't hold the portrait pose.
 */
function augmentPromptForXai(clip: CampaignClipSlot, state: CampaignState, hasImage: boolean): string {
  const onCamera = clip.characterIds
    .map((id) => state.characters.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const characterSheet = onCamera.length
    ? `\n\nCHARACTER SHEET (match each person's face + body type exactly across all clips):\n${onCamera
        .map((c) => `• ${c.name}: ${c.visualDescription}`)
        .join("\n")}`
    : "";

  const imageNote = hasImage
    ? `\n\nREFERENCE IMAGE: The uploaded image is a CHARACTER LIKENESS reference (face, hair, build, ethnicity). DO NOT treat it as the starting pose or freeze on its background. RENDER THE SCENE ACTION BELOW with that person's face. The character should be acting, moving, and inhabiting the scene described — not standing in a studio backdrop.`
    : "";

  return `${clip.prompt}${characterSheet}${imageNote}`;
}

async function renderClipViaXai(
  clip: CampaignClipSlot,
  state: CampaignState,
): Promise<string> {
  // Grok Imagine Video supports 1–15s.
  // - Cheap tier  → ALWAYS uses xAI's full 15s window so the user gets what they paid for,
  //                 regardless of stale state.clipLength values on older rows.
  // - Fallback    → 8s so the clip matches the surrounding Veo clips in concat.
  const isCheapPrimary = state.provider === "cheap";
  const duration = isCheapPrimary ? 15 : Math.min(8, Math.max(1, state.clipLength));

  // xAI's `image` parameter is its only character-anchor mechanism (it acts as the
  // first frame of image-to-video). The augmentPromptForXai() addendum tells xAI to
  // use that image for LIKENESS only — render the scene action instead of holding
  // the portrait pose.
  const imageUrl = pickClipReferenceImage(clip, state) || undefined;
  const augmentedPrompt = augmentPromptForXai(clip, state, !!imageUrl);

  const result = await grokVideoClient.generateVideo(augmentedPrompt, {
    duration,
    aspectRatio: normalizeXaiAspect(state.aspectRatio),
    resolution: "720p",
    timeoutMs: 900000,
    imageUrl,
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
/**
 * Narrated story render: parallel image gen for image scenes + 8s xAI video for video scenes,
 * parallel narrator TTS per scene, ffmpeg image+audio compose per segment, concat all into final reel.
 * Brand logo overlay + caption + media-library save reuse runFinalAssembly logic at the end.
 */
async function renderNarratedStory(input: {
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
      currentStep: "Starting narrated render (images + narrator)...",
    },
  });

  const brand = await getBrandSnapshot(userId);

  // Stage A — render media for each scene (parallel-ish, capped concurrency)
  const MEDIA_CONCURRENCY = 4;
  let cursor = 0;
  let completed = 0;

  async function mediaWorker() {
    while (cursor < clips.length) {
      const i = cursor++;
      const clip = clips[i];
      if (clip.status === "READY" && (clip.imageUrl || clip.videoUrl)) {
        completed++;
        continue;
      }
      clips[i] = { ...clip, status: "RENDERING", error: null };
      await persistClipsProgress(campaignId, clips, completed, total);
      try {
        if (clip.mediaType === "video") {
          // Narrated video scene: ALWAYS Veo Lite, audio disabled. Drops to ~$0.03/sec.
          // Audio is mixed separately downstream (narrator + dialogue + SFX + music).
          // This replaces the legacy "1 xAI hook + stills" pattern.
          const url = await renderNarratedVideoScene(clip, { ...state, clipLength: 8 });
          clips[i] = { ...clips[i], status: "READY", videoUrl: url, error: null };
        } else {
          const url = await generateNarratedSceneImage(clip, state, brand);
          clips[i] = { ...clips[i], status: "READY", imageUrl: url, error: null };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Render failed";
        clips[i] = { ...clips[i], status: "FAILED", error: message };
      }
      completed++;
      await persistClipsProgress(campaignId, clips, completed, total);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MEDIA_CONCURRENCY, clips.length) }, () => mediaWorker()));

  // Stage B — per-scene LAYERED audio:
  //   narrator + in-scene character dialogue + ambient SFX bed + spot SFX
  // built into a single mixed mp3 per scene. This is what turns the reel from
  // "slideshow with voiceover" into a cinematic short film.
  await prisma.cartoonVideo.update({
    where: { id: campaignId },
    data: { progress: 65, currentStep: "Building cinematic audio mix (narrator + dialogue + SFX)..." },
  });

  const characterMap = new Map<string, CampaignCharacter>(state.characters.map((c) => [c.id, c]));
  const audioTempDir = await mkdtemp(path.join(os.tmpdir(), "narrated-audio-"));
  try {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (clip.status !== "READY") continue;
      if (clip.mixedAudioUrl) continue;

      try {
        const mix = await buildSceneMixedAudio({
          clip,
          characterMap,
          narratorVoice: state.narratorVoice,
          tempDir: audioTempDir,
          index: i + 1,
        });
        if (!mix) continue;

        const mixBuf = await readFile(mix.audioPath);
        const mixedAudioUrl = await uploadToS3(
          `story-ad-campaigns/${campaignId}/audio/seg-${String(i + 1).padStart(2, "0")}-mix-${nanoid(6)}.mp3`,
          mixBuf,
          "audio/mpeg",
        );
        clips[i] = {
          ...clips[i],
          mixedAudioUrl,
          // Persist the actual audio length so the segment composer matches it exactly.
          segmentDuration: Math.max(4, Math.round(mix.durationMs / 1000)),
        };
        // Persist progress incrementally so the user sees the build advance per scene
        // and the work isn't lost if the worker is killed mid-stage.
        await persistClipsProgress(campaignId, clips, i + 1, total);
      } catch (error) {
        console.warn(`[StoryAdCampaign] scene ${i + 1} audio mix failed:`, error);
      }
    }
  } finally {
    await rm(audioTempDir, { recursive: true, force: true });
  }

  // Gate: stop at clips-ready for manual review unless automation auto-composites.
  // The user reviews each scene (approve / regenerate / remove / reorder / add) then
  // explicitly triggers composeNarratedFinal via the finalize endpoint.
  if (!state.autoComposite) {
    const reviewState: CampaignState = {
      ...state,
      clips,
      phase: "BATCH",
      finalVideoUrl: null,
      finalVideoThumbnailUrl: clips.find((c) => c.imageUrl)?.imageUrl || clips.find((c) => c.videoUrl)?.videoUrl || null,
    };
    await prisma.cartoonVideo.update({
      where: { id: campaignId },
      data: {
        status: "CLIPS_READY",
        progress: 100,
        currentStep: "All scenes rendered — review them, then compose the final reel.",
        metadata: writeCampaign(reviewState),
      },
    });
    return;
  }

  await composeNarratedFinal({ campaignId, userId, clips, state });
}

/**
 * Stage C–D for narrated reels: ffmpeg compose per-scene segments → concat → Lyria
 * music overlay → brand logo → caption → media library save → final state update.
 * Extracted so both the auto-render path AND the manual finalize endpoint can run it.
 */
async function composeNarratedFinal(input: {
  campaignId: string;
  userId: string;
  clips: CampaignClipSlot[];
  state: CampaignState;
}): Promise<{ finalVideoUrl: string | null }> {
  const { campaignId, userId, clips, state } = input;
  const brand = await getBrandSnapshot(userId);

  await prisma.cartoonVideo.update({
    where: { id: campaignId },
    data: { status: "COMPOSITING", progress: 85, currentStep: "Composing the final reel..." },
  });
  let finalVideoUrl: string | null = null;
  try {
    finalVideoUrl = await composeNarratedReel(campaignId, clips, state);
  } catch (error) {
    console.error("[StoryAdCampaign] narrated compose failed:", error);
  }

  let musicCues = Array.isArray(state.musicCues) ? state.musicCues : [];
  if (finalVideoUrl && musicCues.length) {
    try {
      await prisma.cartoonVideo.update({
        where: { id: campaignId },
        data: { progress: 90, currentStep: "Composing musical score..." },
      });
      const result = await overlayMusicTracks({ campaignId, reelUrl: finalVideoUrl, cues: musicCues, clips });
      if (result.reelUrl) {
        finalVideoUrl = result.reelUrl;
        musicCues = result.cues;
      }
    } catch (error) {
      console.warn("[StoryAdCampaign] music overlay failed, shipping reel without music:", error);
    }
  }

  let publishCaption: string | undefined;
  let publishHashtags: string[] | undefined;
  if (finalVideoUrl) {
    if (brand.logo) {
      try {
        await prisma.cartoonVideo.update({
          where: { id: campaignId },
          data: { progress: 94, currentStep: "Adding brand logo..." },
        });
        finalVideoUrl = await overlayBrandLogo({ campaignId, videoUrl: finalVideoUrl, logoUrl: brand.logo });
      } catch (e) {
        console.warn("[StoryAdCampaign] narrated logo overlay failed:", e);
      }
    }
    try {
      await prisma.cartoonVideo.update({
        where: { id: campaignId },
        data: { progress: 97, currentStep: "Writing social caption..." },
      });
      const c = await generateCampaignCaption(state, brand);
      publishCaption = c.caption;
      publishHashtags = c.hashtags;
    } catch (e) {
      console.warn("[StoryAdCampaign] narrated caption failed:", e);
    }
    try {
      await saveCampaignReelToLibrary({
        userId,
        campaignId,
        title: state.brief?.slice(0, 80) || "Narrated Story",
        videoUrl: finalVideoUrl,
        thumbnailUrl: clips.find((c) => c.imageUrl)?.imageUrl || clips.find((c) => c.videoUrl)?.videoUrl || null,
      });
    } catch (e) {
      console.warn("[StoryAdCampaign] narrated media library save failed:", e);
    }
  }

  const allOk = !!finalVideoUrl;
  const finalState: CampaignState = {
    ...state,
    clips,
    phase: allOk ? "DONE" : "FAILED",
    finalVideoUrl,
    finalVideoThumbnailUrl: clips.find((c) => c.imageUrl)?.imageUrl || clips.find((c) => c.videoUrl)?.videoUrl || null,
    musicCues: musicCues.length ? musicCues : undefined,
    ...(publishCaption ? { campaignCaption: publishCaption } : {}),
    ...(publishHashtags ? { hashtags: publishHashtags } : {}),
  };
  await prisma.cartoonVideo.update({
    where: { id: campaignId },
    data: {
      status: allOk ? "COMPLETED" : "FAILED",
      progress: 100,
      currentStep: allOk ? "Narrated reel ready" : "Compose failed — review and re-run",
      metadata: writeCampaign(finalState),
      videoUrl: finalVideoUrl,
      completedAt: allOk ? new Date() : null,
    },
  });
  return { finalVideoUrl };
}

/** Generate a still illustration for an image scene using the same image router as character previews. */
async function generateNarratedSceneImage(
  clip: CampaignClipSlot,
  state: CampaignState,
  brand: BrandSnapshot,
): Promise<string> {
  const onCamera = clip.characterIds
    .map((id) => state.characters.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);
  const characterBlock = onCamera.length
    ? onCamera.map((c) => `${c.name} (${c.visualDescription})`).join(". ")
    : "";

  const aspect = state.aspectRatio;
  const [w, h] = aspect === "9:16" ? [768, 1344] : aspect === "1:1" ? [1024, 1024] : [1344, 768];

  // The narrated sub-style determines visual treatment: photoreal cinematic stills vs 3D illustrations.
  const subStyle = state.narratedSubStyle || "cinematic";
  const visualLanguage =
    subStyle === "3d"
      ? "Pixar/Disney-grade 3D illustration, soft global illumination, expressive stylized characters, polished CGI render, painterly storyboard frame"
      : "photoreal cinematic still, ARRI Alexa look, anamorphic composition, naturalistic lighting, real production design, atmospheric film grain";

  const prompt = `Narrated-story scene illustration. ${clip.sceneAction}
Mood + lighting: ${clip.moodLighting}.
${characterBlock ? `Characters in frame: ${characterBlock}.` : ""}
Visual style: ${visualLanguage}. Film-still quality. No text overlays. No watermarks. No logos.
Brand context (do NOT draw the logo): ${brand.name}.
Aspect ratio: ${aspect}.`;

  const result = await generateImageForRole("bulk_multi", prompt, w, h, { quality: "medium" });
  if (!result.base64) throw new Error("Image provider returned no image");
  const buf = Buffer.from(result.base64, "base64");
  const ext = result.format === "jpeg" ? "jpg" : result.format;
  const contentType = result.format === "jpeg" ? "image/jpeg" : `image/${result.format}`;
  const key = `story-ad-campaigns/${nanoid(6)}/scene-${String(clip.index).padStart(2, "0")}.${ext}`;
  return uploadToS3(key, buf, contentType);
}

/** Synthesize narrator audio for one line using the campaign's narrator voice. */
/**
 * Stable ElevenLabs stock-voice IDs that ship with every EL account. We use these as
 * the default narrator + character voices when the user hasn't picked a specific one,
 * so EL is the primary TTS path for the campaign even on fresh runs.
 * - Adam:    deep male voice, well-suited for documentary narration
 * - Rachel:  calm female voice, balanced for narration + dialogue
 * - Antoni:  warm male voice for dialogue
 * - Bella:   soft female voice for dialogue
 */
const DEFAULT_ELEVENLABS_VOICES = {
  narratorMale: "pNInz6obpgDQGcFmaJgB",   // Adam
  narratorFemale: "21m00Tcm4TlvDq8ikWAM", // Rachel
  dialogueMale: "ErXwobaYiN019PkySvjV",   // Antoni
  dialogueFemale: "EXAVITQu4vr4xnSDxMaL", // Bella
};

/**
 * Run TTS through ElevenLabs first, fall back to the xAI/OpenAI voice-engine on any EL
 * failure (quota exhausted, voice deleted, network issues). This keeps the user-facing
 * promise — "all TTS through ElevenLabs by default" — while never breaking the reel.
 */
async function generateTtsElevenLabsFirst(params: {
  text: string;
  preferredVoiceId?: string;
  defaultVoiceId: string;
  fallbackOptions: { gender: "male" | "female"; style: "professional" | "warm" | "dramatic" | "energetic"; speed: number };
}): Promise<Buffer> {
  const { text, preferredVoiceId, defaultVoiceId, fallbackOptions } = params;
  if (isElevenLabsEnabled()) {
    try {
      const voiceId = preferredVoiceId || defaultVoiceId;
      return await generateWithClonedVoice({ voiceId, text });
    } catch (e) {
      console.warn(
        `[StoryAdCampaign] ElevenLabs TTS failed, falling back to xAI/OpenAI:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
  const result = await generateVoice({
    text,
    gender: fallbackOptions.gender,
    accent: "american",
    style: fallbackOptions.style,
    speed: fallbackOptions.speed,
  });
  return result.audioBuffer;
}

async function synthesizeNarratorAudio(text: string, narratorVoice?: NarratorVoice): Promise<Buffer> {
  const gender = narratorVoice?.gender || "male";
  const toneText = (narratorVoice?.tone || "").toLowerCase();
  const style: "professional" | "warm" | "dramatic" | "energetic" =
    /dramatic|epic|cinematic|intense/.test(toneText)
      ? "dramatic"
      : /warm|gentle|intimate|documentary/.test(toneText)
        ? "warm"
        : /energetic|excited|punchy/.test(toneText)
          ? "energetic"
          : "professional";

  return generateTtsElevenLabsFirst({
    text,
    preferredVoiceId: narratorVoice?.elevenlabsVoiceId,
    defaultVoiceId:
      gender === "female"
        ? DEFAULT_ELEVENLABS_VOICES.narratorFemale
        : DEFAULT_ELEVENLABS_VOICES.narratorMale,
    fallbackOptions: { gender, style, speed: 0.95 },
  });
}

/**
 * Synthesize a single character's dialogue line using their voice criteria.
 * The character's gender + tone keywords map onto our voice-engine style buckets.
 * `emotion` (from the planner — "concerned", "skeptical", "warm") nudges style + speed.
 */
async function synthesizeCharacterDialogueAudio(
  line: ClipDialogueLine,
  character: CampaignCharacter,
): Promise<{ buffer: Buffer; estimatedDurationMs: number }> {
  const text = (line.line || "").trim();
  if (!text) throw new Error("Empty dialogue line");

  const tone = (character.voiceCriteria?.tone || "").toLowerCase();
  const texture = (character.voiceCriteria?.texture || "").toLowerCase();
  const emotion = (line.emotion || "").toLowerCase();
  const combined = `${tone} ${texture} ${emotion}`;

  // Gender heuristic: voiceCriteria.age sometimes encodes gender ("young woman"). Fall back to neutral male.
  const age = (character.voiceCriteria?.age || "").toLowerCase();
  const gender: "male" | "female" =
    /\b(woman|female|girl|she|her)\b/.test(age) || /\b(woman|female|girl)\b/.test(tone) ? "female" : "male";

  // Style bucket — emotion takes priority over base tone so an angry line still sounds angry
  // even if the character's baseline voice is "warm".
  const style: "professional" | "warm" | "dramatic" | "energetic" =
    /(angry|furious|intense|dramatic|fierce|desperate|urgent|epic|harsh)/.test(combined)
      ? "dramatic"
      : /(warm|gentle|tender|soft|loving|kind|caring|intimate)/.test(combined)
        ? "warm"
        : /(excited|energetic|cheerful|upbeat|enthusiastic|bright)/.test(combined)
          ? "energetic"
          : "professional";

  // Pace from voiceCriteria — slow=0.88, fast=1.08, default 0.98 (slightly slower than realtime
  // so lines read clear on top of a still image).
  const paceText = `${(character.voiceCriteria?.pace || "").toLowerCase()} ${combined}`;
  const speed = /(slow|measured|deliberate|relaxed|calm)/.test(paceText)
    ? 0.9
    : /(fast|quick|rapid|punchy|urgent)/.test(paceText)
      ? 1.06
      : 0.98;

  // Route through ElevenLabs first (per platform default) and fall back to xAI/OpenAI TTS.
  const buffer = await generateTtsElevenLabsFirst({
    text,
    defaultVoiceId:
      gender === "female"
        ? DEFAULT_ELEVENLABS_VOICES.dialogueFemale
        : DEFAULT_ELEVENLABS_VOICES.dialogueMale,
    fallbackOptions: { gender, style, speed },
  });
  // Word-rate estimate so the mixer can size silence gaps without a probe round-trip.
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const estimatedDurationMs = Math.round((wordCount / 150) * 60 * 1000 / speed);
  return { buffer, estimatedDurationMs };
}

/**
 * Run ffprobe to read the exact duration (ms) of an audio file.
 * Falls back to a word-count estimate when ffprobe is unavailable.
 */
async function probeAudioDurationMs(filePath: string, fallbackMs: number): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const sec = Number.parseFloat(String(stdout).trim());
    if (Number.isFinite(sec) && sec > 0) return Math.round(sec * 1000);
  } catch (e) {
    // ffprobe missing or failed — fall back
  }
  return fallbackMs;
}

/**
 * Build a movie-grade audio mix for one narrated scene:
 *   narrator line  -->  gap  -->  character dialogue line 1  -->  gap  -->  ...
 *   underneath:  ambient bed (low volume) + spot SFX at specified times
 *
 * Returns the local path to the mixed mp3 + measured duration, or null if there's
 * nothing to mix (no narrator, no dialogue, no soundscape).
 *
 * Why this exists: the prior pipeline only played the narrator. Customers building
 * storytelling YouTube channels need narrator + in-scene character voices + cinematic
 * sound design all layered on top of a still image to feel like a real short film.
 */
async function buildSceneMixedAudio(params: {
  clip: CampaignClipSlot;
  characterMap: Map<string, CampaignCharacter>;
  narratorVoice?: NarratorVoice;
  tempDir: string;
  index: number;
}): Promise<{ audioPath: string; durationMs: number } | null> {
  const { clip, characterMap, narratorVoice, tempDir, index } = params;
  const narratorText = (clip.narratorLine || "").trim();
  const dialogueLines = (clip.dialogue || []).filter((l) => (l.line || "").trim());
  const hasSoundscape = !!(clip.soundscape && (clip.soundscape.ambient || (clip.soundscape.spot && clip.soundscape.spot.length)));
  if (!narratorText && !dialogueLines.length && !hasSoundscape) return null;

  // ---------------------------------------------------------------------------
  // 1) Synthesize narrator + character dialogue (parallel where safe)
  // ---------------------------------------------------------------------------
  const voiceFiles: { path: string; durationMs: number }[] = [];

  if (narratorText) {
    try {
      const buf = await synthesizeNarratorAudio(narratorText, narratorVoice);
      const p = path.join(tempDir, `narr-${index}-${nanoid(4)}.mp3`);
      await writeFile(p, buf);
      const wordCount = narratorText.split(/\s+/).filter(Boolean).length;
      const fallbackMs = Math.round((wordCount / 150) * 60 * 1000);
      const dur = await probeAudioDurationMs(p, fallbackMs);
      voiceFiles.push({ path: p, durationMs: dur });
    } catch (e) {
      console.warn(`[StoryAdCampaign] narrator TTS failed scene ${index}:`, e);
    }
  }

  for (const line of dialogueLines) {
    const character = characterMap.get(line.characterId);
    if (!character) continue;
    try {
      const r = await synthesizeCharacterDialogueAudio(line, character);
      const p = path.join(tempDir, `dlg-${index}-${nanoid(4)}.mp3`);
      await writeFile(p, r.buffer);
      const dur = await probeAudioDurationMs(p, r.estimatedDurationMs);
      voiceFiles.push({ path: p, durationMs: dur });
    } catch (e) {
      console.warn(`[StoryAdCampaign] dialogue TTS failed scene ${index} (${character.name}):`, e);
    }
  }

  if (!voiceFiles.length && !hasSoundscape) return null;

  // ---------------------------------------------------------------------------
  // 2) Build the voice chain: 0.4s lead-in | voice1 | 0.3s gap | voice2 | ... | 0.6s tail
  //    Use the concat demuxer for clean joins.
  // ---------------------------------------------------------------------------
  const leadInMs = 400;
  const gapMs = 300;
  const tailMs = 600;

  let voicePath: string | null = null;
  let voiceDurationMs = 0;

  if (voiceFiles.length) {
    const silenceLead = path.join(tempDir, `sil-lead-${index}.mp3`);
    const silenceGap = path.join(tempDir, `sil-gap-${index}.mp3`);
    const silenceTail = path.join(tempDir, `sil-tail-${index}.mp3`);
    await runFFmpeg([
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-t", `${leadInMs / 1000}`, "-q:a", "9", "-y", silenceLead,
    ]);
    await runFFmpeg([
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-t", `${gapMs / 1000}`, "-q:a", "9", "-y", silenceGap,
    ]);
    await runFFmpeg([
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-t", `${tailMs / 1000}`, "-q:a", "9", "-y", silenceTail,
    ]);

    const items: string[] = [silenceLead];
    voiceFiles.forEach((vf, i) => {
      items.push(vf.path);
      if (i < voiceFiles.length - 1) items.push(silenceGap);
    });
    items.push(silenceTail);

    voiceDurationMs = leadInMs + tailMs;
    voiceFiles.forEach((vf, i) => {
      voiceDurationMs += vf.durationMs;
      if (i < voiceFiles.length - 1) voiceDurationMs += gapMs;
    });

    const listPath = path.join(tempDir, `vlist-${index}.txt`);
    await writeFile(listPath, items.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
    voicePath = path.join(tempDir, `voice-${index}.mp3`);
    await runFFmpeg([
      "-f", "concat", "-safe", "0", "-i", listPath,
      "-c:a", "libmp3lame", "-b:a", "192k",
      "-y", voicePath,
    ]);
  }

  // Scene total duration = voice chain (min 4s so an SFX-only/short-voice scene still breathes)
  const sceneDurationMs = Math.max(voiceDurationMs, 4000);
  const sceneDurationSec = sceneDurationMs / 1000;

  // ---------------------------------------------------------------------------
  // 3) Generate SFX (ambient + spot cues) via ElevenLabs if available.
  //    If SFX gen fails, the scene still plays — just without that layer.
  // ---------------------------------------------------------------------------
  const sfxInputs: { path: string; filter: string }[] = [];
  const sfxEnabled = isElevenLabsEnabled() && !!clip.soundscape;

  if (sfxEnabled && clip.soundscape?.ambient?.description) {
    try {
      const ambDurSec = Math.max(2, Math.min(22, sceneDurationSec));
      const ambBuf = await generateSoundEffect({
        description: clip.soundscape.ambient.description,
        durationSeconds: ambDurSec,
        promptInfluence: 0.3,
      });
      const ambPath = path.join(tempDir, `amb-${index}.mp3`);
      await writeFile(ambPath, ambBuf);
      // Keep the room-tone bed FAR under the voice so speech doesn't sound
      // "recorded in a room": band-limit the bed + cap its loudness when a voice
      // is present (the AI still chooses WHEN/relative level; this is only a ceiling).
      const rawGain = clip.soundscape.ambient.gainDb ?? -26;
      const gain = voicePath ? Math.min(rawGain, AMBIENT_BED_MAX_GAIN_DB) : rawGain;
      // Loop ambient if generated shorter than scene, then trim to scene duration.
      const filter = `aloop=loop=-1:size=2e9,atrim=duration=${sceneDurationSec.toFixed(2)},asetpts=PTS-STARTPTS,${AMBIENT_BED_FILTER},volume=${gain}dB`;
      sfxInputs.push({ path: ambPath, filter });
    } catch (e) {
      console.warn(`[StoryAdCampaign] ambient SFX failed scene ${index}:`, e);
    }
  }

  if (sfxEnabled && clip.soundscape?.spot?.length) {
    for (let s = 0; s < clip.soundscape.spot.length; s++) {
      const cue = clip.soundscape.spot[s];
      if (!cue?.description) continue;
      try {
        const dur = Math.max(0.5, Math.min(22, cue.durationSec || 2));
        const spotBuf = await generateSoundEffect({ description: cue.description, durationSeconds: dur });
        const spotPath = path.join(tempDir, `spot-${index}-${s}.mp3`);
        await writeFile(spotPath, spotBuf);
        const delayMs = Math.max(0, Math.round((cue.atSec || 0) * 1000));
        const gain = cue.gainDb ?? -10;
        const filter = `adelay=${delayMs}|${delayMs},volume=${gain}dB`;
        sfxInputs.push({ path: spotPath, filter });
      } catch (e) {
        console.warn(`[StoryAdCampaign] spot SFX ${s} failed scene ${index}:`, e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4) Final mix
  //    - If no SFX, just return the voice track.
  //    - If no voice, mix SFX only against silent base of sceneDurationSec.
  //    - Otherwise amix voice + every SFX layer with normalize=0.
  // ---------------------------------------------------------------------------
  if (!sfxInputs.length) {
    if (!voicePath) return null;
    // No SFX layers — still run the voice through the cleanup chain so it sounds
    // close-mic/clean rather than roomy (filters preserve duration).
    try {
      const cleanedPath = path.join(tempDir, `voice-clean-${index}.mp3`);
      await runFFmpeg([
        "-i", voicePath,
        "-af", VOICE_CLEANUP_FILTER,
        "-c:a", "libmp3lame", "-b:a", "192k",
        "-y", cleanedPath,
      ]);
      return { audioPath: cleanedPath, durationMs: voiceDurationMs };
    } catch (e) {
      console.warn(`[StoryAdCampaign] voice cleanup failed scene ${index}, using raw voice:`, e);
      return { audioPath: voicePath, durationMs: voiceDurationMs };
    }
  }

  const mixedPath = path.join(tempDir, `mix-${index}.mp3`);
  const ffArgs: string[] = [];

  // Input 0 is the voice track (or a silent base if no voice)
  if (voicePath) {
    ffArgs.push("-i", voicePath);
  } else {
    ffArgs.push("-f", "lavfi", "-i", `anullsrc=r=44100:cl=stereo:d=${sceneDurationSec.toFixed(2)}`);
  }

  // SFX inputs
  sfxInputs.forEach((sfx) => {
    ffArgs.push("-i", sfx.path);
  });

  // Filter graph — clean the voice (close-mic presence + even level) before mixing.
  const filterParts: string[] = [];
  filterParts.push(`[0:a]${voicePath ? VOICE_CLEANUP_FILTER : "volume=1.0"}[v0]`);
  const mixLabels = ["[v0]"];
  sfxInputs.forEach((sfx, i) => {
    const inputIdx = i + 1;
    filterParts.push(`[${inputIdx}:a]${sfx.filter}[sfx${i}]`);
    mixLabels.push(`[sfx${i}]`);
  });
  filterParts.push(`${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:normalize=0[mix]`);

  ffArgs.push("-filter_complex", filterParts.join(";"));
  ffArgs.push("-map", "[mix]");
  ffArgs.push("-c:a", "libmp3lame", "-b:a", "192k");
  ffArgs.push("-y", mixedPath);

  await runFFmpeg(ffArgs);
  const finalDur = await probeAudioDurationMs(mixedPath, sceneDurationMs);
  return { audioPath: mixedPath, durationMs: finalDur };
}

/**
 * Compose the narrated reel: per scene make a video segment (image+audio for image scenes,
 * original video+audio overlay for video scenes), then ffmpeg-concat all segments.
 */
/**
 * Pick a Ken Burns motion (zoom + pan path) per scene index so the reel doesn't feel
 * like the same push-in repeated. Cycles through 5 patterns: push-in, pull-back, pan-left,
 * pan-right, slow-zoom-center.
 */
function pickKenBurns(index: number): { z: string; x: string; y: string } {
  const patterns: Array<{ z: string; x: string; y: string }> = [
    // push in toward center
    { z: "min(zoom+0.0010,1.20)", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
    // pull back from center (start zoomed in)
    { z: "if(eq(on,0),1.20,max(zoom-0.0010,1.0))", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
    // slow push toward upper-right
    { z: "min(zoom+0.0010,1.15)", x: "iw-(iw/zoom)", y: "0" },
    // slow push toward lower-left
    { z: "min(zoom+0.0010,1.15)", x: "0", y: "ih-(ih/zoom)" },
    // gentle pan left to right while slightly zooming in
    { z: "min(zoom+0.0008,1.12)", x: "(iw-(iw/zoom))*(on/300)", y: "ih/2-(ih/zoom/2)" },
  ];
  return patterns[index % patterns.length];
}

async function composeNarratedReel(
  campaignId: string,
  clips: CampaignClipSlot[],
  state: CampaignState,
): Promise<string> {
  const ready = clips.filter((c) => c.status === "READY" && (c.imageUrl || c.videoUrl));
  if (!ready.length) throw new Error("No ready scenes to compose");

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "narrated-reel-"));
  const outputPath = path.join(tempDir, "reel.mp4");
  const listPath = path.join(tempDir, "list.txt");
  const aspect = state.aspectRatio;
  // ffmpeg scale/crop use W:H (colon). zoompan's s= uses WxH (no colon).
  const [tw, th] = aspect === "9:16" ? [768, 1344] : aspect === "1:1" ? [1024, 1024] : [1344, 768];
  const scaleSize = `${tw}:${th}`;
  const zoomSize = `${tw}x${th}`;

  try {
    const segmentPaths: string[] = [];

    for (let i = 0; i < ready.length; i++) {
      const clip = ready[i];
      const segPath = path.join(tempDir, `seg-${String(i + 1).padStart(2, "0")}.mp4`);

      // Download the scene's audio track. Prefer the new layered mix (narrator + dialogue + SFX)
      // and fall back to the legacy narrator-only track for older campaigns mid-flight.
      let audioPath: string | null = null;
      const audioSource = clip.mixedAudioUrl || clip.audioUrl;
      if (audioSource) {
        const audioBuf = await downloadToBuffer(audioSource);
        audioPath = path.join(tempDir, `audio-${i + 1}.mp3`);
        await writeFile(audioPath, audioBuf);
      }

      if (clip.mediaType === "video" && clip.videoUrl) {
        // Video scene: download video, RE-SCALE to match image segments' resolution,
        // and replace audio with narrator if available. Re-encoding is required so the
        // final concat doesn't drop the segment due to dimension mismatch with image scenes.
        const videoBuf = await downloadToBuffer(clip.videoUrl);
        const inPath = path.join(tempDir, `in-${i + 1}.mp4`);
        await writeFile(inPath, videoBuf);
        if (audioPath) {
          await runFFmpeg([
            "-i", inPath,
            "-i", audioPath,
            "-filter_complex",
            `[0:v]scale=${scaleSize}:force_original_aspect_ratio=increase,crop=${scaleSize},format=yuv420p,fps=30[v]`,
            "-map", "[v]",
            "-map", "1:a",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            "-pix_fmt", "yuv420p",
            "-y", segPath,
          ]);
        } else {
          await runFFmpeg([
            "-i", inPath,
            "-vf", `scale=${scaleSize}:force_original_aspect_ratio=increase,crop=${scaleSize},format=yuv420p,fps=30`,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-y", segPath,
          ]);
        }
      } else {
        // Image scene: hold image for narrator duration (or default 6s) with Ken Burns motion.
        // Motion type varies per scene index so the reel feels alive instead of one repeated push-in.
        const imagePath = path.join(tempDir, `img-${i + 1}.png`);
        const imageBuf = await downloadToBuffer(clip.imageUrl as string);
        await writeFile(imagePath, imageBuf);
        const duration = audioPath ? "" : `${clip.segmentDuration || 6}`;
        // ~900 frames at 30fps = 30 seconds of generated motion. `-shortest` pins to audio length.
        const motion = pickKenBurns(i);
        if (audioPath) {
          await runFFmpeg([
            "-loop", "1",
            "-i", imagePath,
            "-i", audioPath,
            "-filter_complex",
            `[0:v]scale=${scaleSize}:force_original_aspect_ratio=increase,crop=${scaleSize},format=yuv420p,zoompan=z='${motion.z}':x='${motion.x}':y='${motion.y}':d=900:s=${zoomSize}:fps=30[v]`,
            "-map", "[v]",
            "-map", "1:a",
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-preset", "veryfast",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            "-pix_fmt", "yuv420p",
            "-y", segPath,
          ]);
        } else {
          await runFFmpeg([
            "-loop", "1",
            "-i", imagePath,
            "-t", duration,
            "-vf",
            `scale=${scaleSize}:force_original_aspect_ratio=increase,crop=${scaleSize},format=yuv420p,zoompan=z='${motion.z}':x='${motion.x}':y='${motion.y}':d=900:s=${zoomSize}:fps=30`,
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-preset", "veryfast",
            "-pix_fmt", "yuv420p",
            "-y", segPath,
          ]);
        }
      }
      segmentPaths.push(segPath);
    }

    const list = segmentPaths
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listPath, list);

    // Re-encode on concat since segments may have differing audio params from per-segment encodes
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

    const finalBuf = await readFile(outputPath);
    const key = `story-ad-campaigns/${campaignId}/narrated-${nanoid(8)}.mp4`;
    return uploadToS3(key, finalBuf, "video/mp4");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Overlay Lyria-generated music tracks onto the already-composed reel.
 *
 * For each music cue:
 *   1. Generate a 30s Lyria clip (or reuse `audioUrl` if already rendered)
 *   2. Compute the cue's start time in the final reel from per-scene durations
 *   3. Compute the cue's total length from those same durations
 *   4. ffmpeg amixes all delayed/trimmed music tracks onto the reel's existing audio
 *
 * Music sits under voice at -16dB (default — the cue can override via `gainDb`). If
 * a cue is longer than the 30s Lyria clip, the clip is looped with a short crossfade
 * via `aloop` + `atrim` so it covers the full span.
 *
 * Returns the new reel URL + the cues with `audioUrl`/`durationSec` filled in. If
 * Lyria isn't configured we throw — the caller wraps this in try/catch and ships the
 * reel without music.
 */
async function overlayMusicTracks(params: {
  campaignId: string;
  reelUrl: string;
  cues: CampaignMusicCue[];
  clips: CampaignClipSlot[];
}): Promise<{ reelUrl: string; cues: CampaignMusicCue[] }> {
  const { campaignId, reelUrl, cues, clips } = params;
  if (!isLyriaEnabled()) {
    throw new Error("Lyria (GEMINI_API_KEY) is not configured — skipping music overlay");
  }
  if (!cues.length) return { reelUrl, cues };

  const sceneDurations = clips.map((c) => Math.max(2, c.segmentDuration || 8));
  // Cumulative start time (in seconds) for each scene index. cumStart[i] = total before scene i.
  const cumStart: number[] = [0];
  for (let i = 0; i < sceneDurations.length; i++) {
    cumStart.push(cumStart[i] + sceneDurations[i]);
  }
  const totalReelSec = cumStart[cumStart.length - 1];

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "narrated-music-"));
  try {
    // Stage 1: generate each cue's audio with Lyria
    const resolvedCues: Array<{
      cue: CampaignMusicCue;
      localPath: string;
      startSec: number;
      durationSec: number;
      gainDb: number;
    }> = [];

    for (const cue of cues) {
      if (cue.startSceneIndex >= sceneDurations.length) continue;
      const endIdx = Math.min(cue.endSceneIndex, sceneDurations.length - 1);
      const startSec = cumStart[cue.startSceneIndex];
      const endSec = cumStart[endIdx + 1];
      const durationSec = Math.max(2, Math.min(totalReelSec - startSec, endSec - startSec));

      // Generate (or reuse) the music clip
      let buf: Buffer | null = null;
      let mime = "audio/wav";
      if (cue.audioUrl) {
        try {
          buf = await downloadToBuffer(cue.audioUrl);
        } catch (e) {
          console.warn(`[StoryAdCampaign] couldn't reuse existing music ${cue.id}, regenerating:`, e);
        }
      }
      if (!buf) {
        const result = await generateMusicClip({
          prompt: cue.description,
          model: cue.model === "pro" ? "pro" : "clip",
        });
        buf = result.audioBuffer;
        mime = result.mimeType;

        // Upload so future renders can reuse / preview without recharging
        const ext = mime.includes("wav") ? "wav" : mime.includes("mp3") || mime.includes("mpeg") ? "mp3" : "audio";
        try {
          const key = `story-ad-campaigns/${campaignId}/music/${cue.id}-${nanoid(6)}.${ext}`;
          cue.audioUrl = await uploadToS3(key, buf, mime);
          cue.durationSec = durationSec;
        } catch (e) {
          console.warn(`[StoryAdCampaign] upload of music ${cue.id} failed, continuing locally:`, e);
        }
      }

      const localPath = path.join(tempDir, `music-${cue.id}.${mime.includes("wav") ? "wav" : "mp3"}`);
      await writeFile(localPath, buf);

      resolvedCues.push({
        cue,
        localPath,
        startSec,
        durationSec,
        gainDb: typeof cue.gainDb === "number" ? cue.gainDb : -16,
      });
    }

    if (!resolvedCues.length) return { reelUrl, cues };

    // Stage 2: build the ffmpeg amix command
    //
    // Reel = input 0. Each music file is input 1..N.
    // For each music input, the filter chain:
    //   - aloop+atrim guarantees the clip covers its full intended span (Lyria clips are
    //     30s; if a cue spans 45s we loop and trim)
    //   - adelay shifts it to the right start time
    //   - volume gains it down to sit under voice
    //
    // Then we amix the reel's audio with every music track (normalize=0 to preserve gains).
    const ffArgs: string[] = ["-i", reelUrl];
    for (const r of resolvedCues) {
      ffArgs.push("-i", r.localPath);
    }

    const filterParts: string[] = [];
    const musicLabels: string[] = [];
    resolvedCues.forEach((r, i) => {
      const inputIdx = i + 1;
      const delayMs = Math.round(r.startSec * 1000);
      filterParts.push(
        `[${inputIdx}:a]aloop=loop=-1:size=2e9,atrim=duration=${r.durationSec.toFixed(2)},asetpts=PTS-STARTPTS,volume=${r.gainDb}dB,adelay=${delayMs}|${delayMs}[m${i}]`,
      );
      musicLabels.push(`[m${i}]`);
    });
    // Mix voice (input 0:a) + every music track
    filterParts.push(`[0:a]${musicLabels.join("")}amix=inputs=${1 + musicLabels.length}:duration=first:normalize=0[mixed]`);

    const outputPath = path.join(tempDir, "reel-with-music.mp4");
    ffArgs.push(
      "-filter_complex",
      filterParts.join(";"),
      "-map", "0:v",
      "-map", "[mixed]",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-shortest",
      "-y", outputPath,
    );

    await runFFmpeg(ffArgs);

    const finalBuf = await readFile(outputPath);
    const key = `story-ad-campaigns/${campaignId}/narrated-music-${nanoid(8)}.mp4`;
    const newReelUrl = await uploadToS3(key, finalBuf, "video/mp4");
    return { reelUrl: newReelUrl, cues };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

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
/** Re-number clips 1..N after add/remove/reorder so index stays contiguous. */
function reindexClips(clips: CampaignClipSlot[]): CampaignClipSlot[] {
  return clips.map((c, i) => ({ ...c, index: i + 1 }));
}

/** Toggle a clip's reviewed/approved flag. No render — just state. */
export async function setClipApproval(input: {
  campaignId: string;
  userId: string;
  clipId: string;
  approved: boolean;
}): Promise<CampaignState> {
  const current = await getCampaign(input.campaignId, input.userId);
  if (!current) throw new Error("Campaign not found");
  const clips = current.state.clips.map((c) =>
    c.id === input.clipId ? { ...c, approved: input.approved } : c,
  );
  return updateCampaignState(input.campaignId, input.userId, { clips });
}

/** Remove a clip entirely (e.g. user doesn't want this beat). Re-indexes the rest. */
export async function removeClip(input: {
  campaignId: string;
  userId: string;
  clipId: string;
}): Promise<CampaignState> {
  const current = await getCampaign(input.campaignId, input.userId);
  if (!current) throw new Error("Campaign not found");
  const remaining = current.state.clips.filter((c) => c.id !== input.clipId);
  if (remaining.length === current.state.clips.length) throw new Error("Clip not found");
  if (!remaining.length) throw new Error("Cannot remove the last clip.");
  return updateCampaignState(input.campaignId, input.userId, { clips: reindexClips(remaining) });
}

/** Reorder clips to match the given ordered list of clip ids. Re-indexes. */
export async function reorderClips(input: {
  campaignId: string;
  userId: string;
  orderedIds: string[];
}): Promise<CampaignState> {
  const current = await getCampaign(input.campaignId, input.userId);
  if (!current) throw new Error("Campaign not found");
  const byId = new Map(current.state.clips.map((c) => [c.id, c]));
  const reordered: CampaignClipSlot[] = [];
  for (const id of input.orderedIds) {
    const clip = byId.get(id);
    if (clip) { reordered.push(clip); byId.delete(id); }
  }
  // Append any clips the client didn't mention (safety) so none are lost.
  for (const leftover of byId.values()) reordered.push(leftover);
  return updateCampaignState(input.campaignId, input.userId, { clips: reindexClips(reordered) });
}

/**
 * Insert a NEW clip after a given clip (or at the end) and render it immediately.
 * The user can supply a sceneAction/description; we build the full prompt + render.
 */
export async function addAndRenderClip(input: {
  campaignId: string;
  userId: string;
  afterClipId?: string | null;
  sceneAction?: string;
  act?: ActPosition;
}): Promise<{ state: CampaignState; clipId: string; status: "READY" | "FAILED"; error?: string }> {
  const current = await getCampaign(input.campaignId, input.userId);
  if (!current) throw new Error("Campaign not found");
  const { state } = current;
  const brand = await getBrandSnapshot(input.userId);

  // Build a new slot. Inherit shot/camera defaults; user can edit + re-render later.
  const baseChars = state.clips[0]?.characterIds || (state.characters[0] ? [state.characters[0].id] : []);
  const newClip: CampaignClipSlot = {
    id: nanoid(8),
    index: state.clips.length + 1,
    act: input.act || "TRANSFORM",
    shotType: "MEDIUM",
    cameraMovement: "STATIC",
    sceneAction: (input.sceneAction || "A new beat in the story.").trim().slice(0, 400),
    moodLighting: "Natural cinematic lighting.",
    characterIds: baseChars,
    dialogue: [],
    mediaType: state.style === "narrated" ? (state.fullAnimation ? "video" : "image") : "video",
    imageUrl: null,
    videoUrl: null,
    audioUrl: null,
    mixedAudioUrl: undefined,
    segmentDuration: state.style === "narrated" && !state.fullAnimation ? 10 : 8,
    prompt: "",
    status: "PENDING",
    error: null,
  };
  newClip.prompt = buildClipPrompt(newClip, state, brand);

  // Splice into position
  const clips = [...state.clips];
  const afterIdx = input.afterClipId ? clips.findIndex((c) => c.id === input.afterClipId) : clips.length - 1;
  const insertAt = afterIdx === -1 ? clips.length : afterIdx + 1;
  clips.splice(insertAt, 0, newClip);
  const reindexed = reindexClips(clips);
  await updateCampaignState(input.campaignId, input.userId, { clips: reindexed });

  // Render the new clip in place via the same retry path.
  const result = await retrySingleClip({
    campaignId: input.campaignId,
    userId: input.userId,
    clipId: newClip.id,
  });
  const after = await getCampaign(input.campaignId, input.userId);
  return {
    state: after?.state || current.state,
    clipId: newClip.id,
    status: result.status,
    error: result.error,
  };
}

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
  // Re-build the prompt from the (possibly edited) scene action before rendering, so a
  // user who tweaked the script gets a fresh clip matching the new text.
  const brand = await getBrandSnapshot(input.userId);
  clips[idx] = { ...clips[idx], prompt: buildClipPrompt(clips[idx], state, brand), status: "RENDERING", error: null, approved: false };
  await updateCampaignState(input.campaignId, input.userId, { clips });

  try {
    const clip = clips[idx];
    if (state.style === "narrated" && clip.mediaType === "image") {
      // Narrated still scene → regenerate the illustration.
      const imageUrl = await generateNarratedSceneImage(clip, state, brand);
      clips[idx] = { ...clips[idx], status: "READY", imageUrl, error: null };
      await updateCampaignState(input.campaignId, input.userId, { clips });
      return { status: "READY" };
    }
    // Video scene (cinematic/3D clip OR narrated full-animation/hook).
    const renderOne =
      state.style === "narrated"
        ? renderNarratedVideoScene
        : pickClipRenderer(state.provider);
    const url = await renderOne(clip, state);
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

/**
 * Cron-driven batch worker. Picks up campaigns in status "BATCH_QUEUED" and runs them
 * through the normal render pipeline. Called by /api/cron/story-ad-batch-poll every 5 min.
 *
 * We process one campaign per tick to keep provider load smooth. Lazily promoting each
 * one out of BATCH_QUEUED before rendering means a second concurrent tick won't pick the
 * same campaign up.
 */
export async function processQueuedBatchCampaigns(opts: { maxPerTick?: number } = {}): Promise<{ processed: number; promotedIds: string[] }> {
  const limit = Math.max(1, Math.min(5, opts.maxPerTick ?? 1));
  const promotedIds: string[] = [];

  for (let i = 0; i < limit; i++) {
    // Fetch + atomic-promote the oldest queued campaign so concurrent cron ticks
    // don't race on the same row.
    const queued = await prisma.cartoonVideo.findFirst({
      where: { animationType: ANIMATION_TYPE, status: "BATCH_QUEUED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true },
    });
    if (!queued) break;

    // Flip the flag IMMEDIATELY so a parallel cron run skips this row.
    const claim = await prisma.cartoonVideo.updateMany({
      where: { id: queued.id, status: "BATCH_QUEUED" },
      data: { status: "COMPOSITING", currentStep: "Batch worker picking up the render..." },
    });
    if (claim.count === 0) continue; // another tick already grabbed it

    promotedIds.push(queued.id);

    // Reset state.batchMode to false on the in-flight render so batchRenderCampaign
    // does NOT re-queue it — we explicitly want the sync render path now.
    const current = await getCampaign(queued.id, queued.userId);
    if (!current) continue;
    const syncState: CampaignState = { ...current.state, batchMode: false };
    await updateCampaignState(queued.id, queued.userId, { batchMode: false } as Partial<CampaignState>);

    try {
      // Reuse the existing render dispatcher in sync mode.
      await batchRenderCampaign({ campaignId: queued.id, userId: queued.userId });
    } catch (error) {
      console.error(`[StoryAdCampaign] batch worker failed for ${queued.id}:`, error);
      await prisma.cartoonVideo.update({
        where: { id: queued.id },
        data: {
          status: "FAILED",
          currentStep: "Batch render failed — review and retry.",
        },
      });
    }
    void syncState; // silence unused warning; we already persisted batchMode via updateCampaignState
  }

  return { processed: promotedIds.length, promotedIds };
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

  // Batch mode: defer the actual render to the cron-driven batch worker. We persist
  // BATCH_QUEUED status + return immediately; /api/cron/story-ad-batch-poll picks the
  // campaign up later and runs it through the normal pipeline. Users pay the discounted
  // batch price (already applied in estimateCampaignRenderCost).
  // TODO: swap the deferred-cron approach for native Vertex AI Batch Prediction once
  // a service-account credential is configured. The user-facing UX stays the same.
  if (state.batchMode) {
    await prisma.cartoonVideo.update({
      where: { id: row.id },
      data: {
        status: "BATCH_QUEUED",
        progress: 0,
        currentStep:
          "Queued for batch render — results land within 24h. You can leave this page.",
      },
    });
    return;
  }

  // Narrated style has its own pipeline: image gen + narrator TTS + ffmpeg compose.
  // The single hook video inside that pipeline is rendered Veo-first with xAI fallback.
  if (state.style === "narrated") {
    await renderNarratedStory({ campaignId: row.id, userId: row.userId, state });
    return;
  }

  // Cinematic + 3D: every clip is generated INDEPENDENTLY (no extension chain).
  // BOTH tiers go through Veo:
  //   - Premium  → Veo 3.1 Quality
  //   - Standard → Veo 3.1 Lite
  // xAI is purely a fallback when Veo fails (quota, safety filter, transient error).
  // The buildClipPrompt continuity block does the heavy lifting on character/style
  // consistency since we render each clip independently.
  await prisma.cartoonVideo.update({
    where: { id: row.id },
    data: { status: "COMPOSITING", progress: 5, currentStep: "Sending clips to provider..." },
  });

  const clips = [...state.clips];
  // Tier dispatch: Premium/Standard → Veo-first with xAI fallback. Cheap → xAI direct.
  const renderOne = pickClipRenderer(state.provider);

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

  // Auto-composite ONLY in automation mode. In the interactive default, stop at
  // "clips ready" so the user can review / approve / regenerate / remove / reorder /
  // add clips before explicitly triggering the final compose (StitchReelBar → finalize).
  if (allOk && !state.autoComposite) {
    const reviewState: CampaignState = {
      ...state,
      clips,
      phase: "BATCH",
      finalVideoUrl: null,
      finalVideoThumbnailUrl: clips.find((c) => c.videoUrl)?.videoUrl || null,
    };
    await prisma.cartoonVideo.update({
      where: { id: row.id },
      data: {
        status: "CLIPS_READY",
        progress: 100,
        currentStep: "All clips rendered — review them, then compose the final reel.",
        metadata: writeCampaign(reviewState),
      },
    });
    return;
  }

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

/**
 * Per-campaign subfolder under the user's "Story Ad Campaigns" library folder.
 * Characters, scene images, and the final reel for one campaign all land here so
 * users can find + reuse them later (or upload their own custom characters in).
 */
async function ensureCampaignSubfolder(
  userId: string,
  campaignId: string,
  campaignTitle: string,
): Promise<string> {
  const parentId = await ensureStoryAdCampaignFolder(userId);
  // Name + campaign id suffix so two campaigns with the same brief slug don't collide.
  const slug = (campaignTitle || "campaign")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "campaign";
  const folderName = `${slug}-${campaignId.slice(-6)}`;
  const existing = await prisma.mediaFolder.findFirst({
    where: { userId, parentId, name: folderName },
    select: { id: true },
  });
  if (existing) return existing.id;
  const folder = await prisma.mediaFolder.create({
    data: { userId, parentId, name: folderName },
  });
  return folder.id;
}

/**
 * Drop a character portrait into the per-campaign media-library subfolder so the
 * user can find it later and reuse the same character across campaigns.
 */
export async function saveCharacterPreviewToLibrary(input: {
  userId: string;
  campaignId: string;
  campaignTitle: string;
  characterName: string;
  characterRole: string;
  imageUrl: string;
}): Promise<void> {
  try {
    const folderId = await ensureCampaignSubfolder(
      input.userId,
      input.campaignId,
      input.campaignTitle,
    );
    const safe = (input.characterName || "character")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30) || "character";
    const filename = `${safe}.png`;
    // Mime type is inferred from URL extension for the library — actual image bytes
    // are already in S3, we just record a pointer.
    const ext = (input.imageUrl.split("?")[0].split(".").pop() || "png").toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    const existing = await prisma.mediaFile.findFirst({
      where: { userId: input.userId, folderId, filename },
      select: { id: true },
    });
    const payload = {
      userId: input.userId,
      filename,
      originalName: `${input.characterName} — ${input.characterRole || "character"}`,
      url: input.imageUrl,
      type: "image",
      mimeType: mime,
      size: 0,
      folderId,
      tags: JSON.stringify(["story-ad-campaign", "character", "ai-generated"]),
      metadata: JSON.stringify({
        campaignId: input.campaignId,
        source: "story-ad-campaign-character",
        characterName: input.characterName,
        characterRole: input.characterRole,
      }),
    };
    if (existing) {
      await prisma.mediaFile.update({
        where: { id: existing.id },
        data: { url: input.imageUrl, originalName: payload.originalName },
      });
    } else {
      await prisma.mediaFile.create({ data: payload });
    }
  } catch (e) {
    // Library-save failures must NEVER break the character preview generation.
    console.warn("[StoryAdCampaign] saving character to library failed:", e);
  }
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

  // Narrated reels need their own compose tail (per-scene image+audio segments,
  // music overlay, logo, caption). Branch to composeNarratedFinal.
  if (current.state.style === "narrated") {
    const readyScenes = current.state.clips.filter(
      (c) => c.status === "READY" && (c.imageUrl || c.videoUrl),
    );
    if (!readyScenes.length) throw new Error("No rendered scenes yet — render before composing.");
    return composeNarratedFinal({
      campaignId: input.campaignId,
      userId: input.userId,
      clips: current.state.clips,
      state: current.state,
    });
  }

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

/**
 * A breakdown of WHAT the render will charge the user, in credits, by category.
 * Markup is already baked into each cost key in `DEFAULT_CREDIT_COSTS` — this is
 * the user-facing total, not the raw provider cost.
 */
export interface CampaignRenderCost {
  total: number;
  videoCredits: number;
  imageCredits: number;
  voiceCredits: number;
  sfxCredits: number;
  /** Lyria 3 music tracks (narrated style only) */
  musicCredits: number;
  captionCredits: number;
  // Plain-language label hiding raw provider names from the user.
  qualityLabel: string;
}

/**
 * Estimate the credit cost to render the campaign in its current state.
 * Covers: video generation, scene images (narrated), narrator + dialogue TTS,
 * ambient + spot SFX (narrated), and the final social caption.
 *
 * What's deliberately NOT included: the catalog plan + scenes plan + per-field
 * suggest calls + character preview images. Those are charged separately as
 * the user progresses through the stages (so they're not double-counted here).
 */
export function estimateCampaignRenderCost(state: CampaignState): CampaignRenderCost {
  const C = DEFAULT_CREDIT_COSTS;
  const clipCount = state.clips.length || clipsForDuration(state.durationSeconds, state.clipLength);

  let videoCredits = 0;
  let imageCredits = 0;
  let voiceCredits = 0;
  let sfxCredits = 0;
  let musicCredits = 0;

  if (state.style === "narrated") {
    // Narrated reels — two layouts:
    //   fullAnimation=true  → EVERY scene is a Veo Lite no-audio video clip (~$0.24 / 8s)
    //   fullAnimation=false → EVERY scene is a still image with Ken Burns motion (no video gen)
    // The legacy "1 xAI hook + stills" pattern is gone.
    if (state.fullAnimation) {
      videoCredits = clipCount * C.AI_VIDEO_LITE_NO_AUDIO;
      imageCredits = 0;
    } else {
      videoCredits = 0;
      imageCredits = clipCount * C.AI_STORY_CAMPAIGN_SCENE_IMAGE;
    }

    // Voice: one narrator line per scene + sum of all dialogue lines
    let narratorLineCount = 0;
    let dialogueLineCount = 0;
    let ambientCount = 0;
    let spotCount = 0;
    for (const clip of state.clips) {
      if ((clip.narratorLine || "").trim()) narratorLineCount++;
      dialogueLineCount += (clip.dialogue || []).filter((l) => (l.line || "").trim()).length;
      if (clip.soundscape?.ambient?.description) ambientCount++;
      if (clip.soundscape?.spot?.length) spotCount += clip.soundscape.spot.length;
    }
    // If the plan hasn't been generated yet (clipCount > 0 from duration but state.clips is empty)
    // assume the typical narrated shape so the preview still shows a meaningful number.
    if (!state.clips.length) {
      narratorLineCount = clipCount;
      dialogueLineCount = Math.round(clipCount * 1.2); // ~50% of scenes have 1-3 dialogue lines
      ambientCount = clipCount;
      spotCount = Math.round(clipCount * 1.5); // average ~1.5 spot cues / scene
    }
    voiceCredits = (narratorLineCount + dialogueLineCount) * C.AI_STORY_CAMPAIGN_VOICE_LINE;
    sfxCredits = ambientCount * C.AI_STORY_CAMPAIGN_AMBIENT_SFX + spotCount * C.AI_STORY_CAMPAIGN_SPOT_SFX;

    // Music: ONE Lyria call per planned cue. Pre-plan default = 2 cues (sensible mid-range guess
    // so the cost preview shows realistic value before the AI plans them out).
    const musicCueCount = state.musicCues?.length ?? (state.clips.length ? 0 : 2);
    musicCredits = musicCueCount * C.AI_STORY_CAMPAIGN_MUSIC_CLIP;
  } else {
    // 3D / cinematic: every clip is a real video. Three tiers:
    //   - Premium  (veo3)  → Veo Quality @ 60 credits / 8s clip
    //   - Standard (xai)   → Veo Lite    @ 30 credits / 8s clip  (xAI fallback on Veo failure)
    //   - Cheap    (cheap) → xAI direct  @ 25 credits / 15s clip — fewer scenes, more dialogue
    const perClip =
      state.provider === "veo3"
        ? C.AI_VIDEO_STUDIO
        : state.provider === "cheap"
          ? C.AI_VIDEO_CHEAP
          : C.AI_VIDEO_LITE;
    videoCredits = clipCount * perClip;
    // Dialogue TTS per line (cinematic + 3D still use the per-line voice preview)
    let lineCount = 0;
    for (const clip of state.clips) {
      lineCount += (clip.dialogue || []).filter((l) => (l.line || "").trim()).length;
    }
    if (!state.clips.length) lineCount = Math.round(clipCount * 1.5);
    voiceCredits = lineCount * C.AI_STORY_CAMPAIGN_VOICE_LINE;
  }

  const captionCredits = C.AI_STORY_CAMPAIGN_CAPTION;
  let subtotal = videoCredits + imageCredits + voiceCredits + sfxCredits + musicCredits + captionCredits;
  // Batch mode: ~50% discount on video calls. Two paths:
  //   - Interim: render is deferred to the batch worker (cron-driven, low-priority) and we
  //     absorb the cost difference until Vertex Batch service-account auth is configured.
  //   - Future: renderClipViaVeo will route through Vertex AI Batch Prediction API which
  //     returns 50% off natively. Switch is transparent — the cost calc stays the same.
  if (state.batchMode && videoCredits > 0) {
    const batchSavings = Math.round(videoCredits * 0.5);
    subtotal -= batchSavings;
  }
  // +2% safety buffer so the cost preview reflects the full trip (catalog plan, scenes plan,
  // per-field AI suggestions, character preview images), not only the final render. Those
  // ancillary AI calls are charged at their own stages but the user expects ONE upfront number.
  const total = Math.ceil(subtotal * 1.02);

  const qualityLabel = (() => {
    let label: string;
    if (state.style === "narrated") {
      label = state.fullAnimation
        ? "Narrated · full animation"
        : "Narrated · illustrated stills";
    } else if (state.provider === "veo3") {
      label = "Premium quality";
    } else if (state.provider === "cheap") {
      label = "Cheap (15s/clip)";
    } else {
      label = "Standard quality";
    }
    return state.batchMode ? `${label} · batch 50% off (24h turnaround)` : label;
  })();

  return { total, videoCredits, imageCredits, voiceCredits, sfxCredits, musicCredits, captionCredits, qualityLabel };
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

