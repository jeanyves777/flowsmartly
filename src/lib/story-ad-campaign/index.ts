import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { nanoid } from "nanoid";
import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { TRANSACTION_TYPES } from "@/lib/credits";
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
  type CampaignDurationSeconds,
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

export interface CharacterCatalogPlan {
  storyOutline: string;
  characters: CampaignCharacter[];
}

export async function planCharacterCatalog(
  state: CampaignState,
  brand: BrandSnapshot,
  count = 3,
): Promise<CharacterCatalogPlan> {
  if (!state.style) throw new Error("Campaign style must be selected first");

  const styleLabel = STYLE_LABELS[state.style];
  const visualLanguage = STYLE_VISUAL_LANGUAGE[state.style];

  const prompt = `You are a senior creative director for a ${styleLabel} ad campaign.

BRAND
- Name: ${brand.name}
${brand.tagline ? `- Tagline: ${brand.tagline}` : ""}
${brand.industry ? `- Industry: ${brand.industry}` : ""}
${brand.targetAudience ? `- Audience: ${brand.targetAudience}` : ""}
${brand.voiceTone ? `- Voice: ${brand.voiceTone}` : ""}
${brand.uniqueValue ? `- Unique value: ${brand.uniqueValue}` : ""}

CAMPAIGN BRIEF
${state.brief}

GOAL
${state.goal}

CAMPAIGN STYLE (locked for whole campaign)
${styleLabel} — ${visualLanguage}

First, write a 3–5 sentence STORY OUTLINE summarizing what the campaign will dramatize from hook to call-to-action. Then design ${count} core characters that fit that story. Each character must be visually consistent across all clips and have explicit voice criteria so we can prompt TTS.

For each character output:
- name: short, memorable
- role: their function in the story (e.g. "Hero buyer", "Trusted advisor", "Skeptical friend")
- visualDescription: 2–3 sentences describing exact appearance — age, build, hair, clothing, palette, identifying features. Tuned for ${styleLabel}.
- voiceCriteria: age (e.g. "early 30s"), tone (warm/authoritative/playful), pace (slow/medium/fast), texture (smooth/raspy/clear), delivery (conversational/dramatic/intimate)

Return strict JSON only:
{
  "storyOutline": "3-5 sentence synopsis",
  "characters": [
    {
      "name": "...",
      "role": "...",
      "visualDescription": "...",
      "voiceCriteria": {
        "age": "...",
        "tone": "...",
        "pace": "...",
        "texture": "...",
        "delivery": "..."
      }
    }
  ]
}`;

  const result = await ai.generateJSON<{ storyOutline?: string; characters: PlannedCharacter[] }>(prompt, {
    maxTokens: 2000,
    temperature: 0.7,
    systemPrompt:
      "You design ad campaign characters with a locked visual style. Return valid JSON only.",
  });

  const raw = Array.isArray(result?.characters) ? result.characters : [];
  const characters: CampaignCharacter[] = raw.slice(0, count).map((c) => ({
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

  return {
    storyOutline: String(result?.storyOutline || "").trim().slice(0, 900),
    characters,
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
    "clip.sceneAction": "One sentence on what physically happens in this clip.",
    "clip.moodLighting": "Mood + lighting + color grade in a single line.",
    "clip.voiceoverLine": `A VO line for this clip (max ~${input.state.clipLength === 8 ? 18 : 22} words).`,
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

interface PlannedClip {
  act: ActPosition;
  shotType: ShotType;
  cameraMovement: CameraMovement;
  sceneAction: string;
  moodLighting: string;
  characterId?: string | null;
  voiceoverLine: string;
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

  const wordsPerClip = state.clipLength === 8 ? 18 : 22;

  const prompt = `You are storyboarding a ${styleLabel} ad campaign as ${clipCount} sequential ${state.clipLength}-second clips.

BRAND: ${brand.name}${brand.tagline ? ` — ${brand.tagline}` : ""}
BRIEF: ${state.brief}
GOAL: ${state.goal}
PLATFORMS: ${state.platforms.join(", ") || "social"}

CHARACTER ROSTER (use the id verbatim when assigning):
${charactersBlock}

Lay out a complete story arc:
1. Clips 1–2: HOOK — establish world, emotional anchor
2. Clips 3–5: PROBLEM — pain point, stakes raised, breaking point
3. Clips 6–7: DISCOVERY — shift moment, first contact with solution
4. Clips 8–10: TRANSFORM — using it, progress visible, emotional payoff
5. Last 2 clips: RESOLUTION + CTA — new world contrast, strong brand moment

For each clip output:
- act: one of HOOK | PROBLEM | DISCOVERY | TRANSFORM | RESOLUTION | CTA
- shotType: one of WIDE | CLOSE_UP | POV | DRONE | MACRO | OVER_SHOULDER | MEDIUM
- cameraMovement: one of PUSH_IN | PULL_BACK | PAN | STATIC | ORBIT | HANDHELD | TRACK
- sceneAction: one sentence on what physically happens
- moodLighting: lighting + color grade + mood in a single line
- characterId: id of the character on camera (or null for product/environment-only shots)
- voiceoverLine: VO only, max ${wordsPerClip} words, natural pace, no on-screen text

HARD RULES:
- Never put any text in the video — visuals only.
- Final CTA clip: strong brand moment, character to camera or product close-up. NO text overlay in the video. CTA copy is added in post.
- Voiceover total reading time per clip must fit ${state.clipLength} seconds.

Return strict JSON with exactly ${clipCount} clips:
{
  "clips": [
    {
      "act": "HOOK",
      "shotType": "WIDE",
      "cameraMovement": "PUSH_IN",
      "sceneAction": "...",
      "moodLighting": "...",
      "characterId": "${state.characters[0]?.id || "null"}",
      "voiceoverLine": "..."
    }
  ]
}`;

  const result = await ai.generateJSON<{ clips: PlannedClip[] }>(prompt, {
    maxTokens: 3200,
    temperature: 0.72,
    systemPrompt:
      "You are a senior storyboard artist. Produce complete clip-by-clip story arcs. Return valid JSON only.",
  });

  const characterIds = new Set(state.characters.map((c) => c.id));
  const raw = Array.isArray(result?.clips) ? result.clips : [];
  const trimmed = raw.slice(0, clipCount);

  const clips: CampaignClipSlot[] = trimmed.map((c, index) => {
    const characterId = c.characterId && characterIds.has(String(c.characterId)) ? String(c.characterId) : null;
    const slot: CampaignClipSlot = {
      id: nanoid(8),
      index: index + 1,
      act: normalizeAct(c.act),
      shotType: normalizeShot(c.shotType),
      cameraMovement: normalizeCamera(c.cameraMovement),
      sceneAction: String(c.sceneAction || "").trim().slice(0, 360),
      moodLighting: String(c.moodLighting || "").trim().slice(0, 200),
      characterId,
      voiceoverLine: String(c.voiceoverLine || "").trim().slice(0, 280),
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
      characterId: state.characters[0]?.id || null,
      voiceoverLine: "",
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
  const character = state.characters.find((c) => c.id === clip.characterId);
  const characterBlock = character
    ? `CHARACTER ON CAMERA: ${character.name} — ${character.visualDescription} Maintain exact visual continuity with previous clips.`
    : "No on-camera character — focus on product, environment, or brand moment.";
  const voiceBlock = character
    ? `If voice is generated: ${character.voiceCriteria.age}, ${character.voiceCriteria.tone} tone, ${character.voiceCriteria.pace} pace, ${character.voiceCriteria.texture} texture, ${character.voiceCriteria.delivery} delivery.`
    : "";

  return [
    `${styleLabel} ad clip ${clip.index} — Act: ${ACT_LABELS[clip.act]}.`,
    `Visual language: ${visualLanguage}.`,
    `Shot: ${SHOT_LABELS[clip.shotType]}, camera ${CAMERA_LABELS[clip.cameraMovement]}.`,
    `Scene action: ${clip.sceneAction}`,
    `Mood + lighting: ${clip.moodLighting}`,
    characterBlock,
    clip.voiceoverLine ? `Voiceover: "${clip.voiceoverLine}"` : "",
    voiceBlock,
    `Brand: ${brand.name}${brand.tagline ? ` — ${brand.tagline}` : ""}.`,
    `Duration: ${state.clipLength}s. Aspect: ${state.aspectRatio}.`,
    `Hard negative: ${NEGATIVE_TEXT_PROMPT}.`,
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

export async function generateClipVoicePreview(options: {
  text: string;
  character: CampaignCharacter | null;
}): Promise<{ audioBase64: string; mimeType: string; estimatedDurationMs: number }> {
  const gender = options.character
    ? detectGender(options.character.voiceCriteria.tone, options.character.voiceCriteria.delivery)
    : "female";
  const accent = detectAccent();
  const style = options.character
    ? detectStyle(options.character.voiceCriteria.tone, options.character.voiceCriteria.delivery)
    : "professional";

  const result = await generateVoice({
    text: options.text,
    gender,
    accent,
    style,
    speed: 1.0,
  });

  return {
    audioBase64: result.audioBuffer.toString("base64"),
    mimeType: "audio/mpeg",
    estimatedDurationMs: result.estimatedDurationMs,
  };
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
  const duration = state.clipLength === 8 ? "8" : "8"; // Veo3 supports up to 8s per generation
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
  const result = await grokVideoClient.generateVideo(clip.prompt, {
    duration: state.clipLength,
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

  await prisma.cartoonVideo.update({
    where: { id: row.id },
    data: { status: "COMPOSITING", progress: 5, currentStep: "Sending clips to provider..." },
  });

  const clips = [...state.clips];
  const renderOne = state.provider === "veo3" ? renderClipViaVeo : renderClipViaXai;

  // Parallel-ish but capped to avoid quota burst
  const CONCURRENCY = 3;
  let cursor = 0;
  let completed = 0;
  const total = clips.length;

  async function worker() {
    while (cursor < clips.length) {
      const myIndex = cursor++;
      const clip = clips[myIndex];
      clips[myIndex] = { ...clip, status: "RENDERING", error: null };
      await persistClipsProgress(row.id, clips, completed, total);
      try {
        const url = await renderOne(clip, state);
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
  if (allOk) {
    try {
      await prisma.cartoonVideo.update({
        where: { id: row.id },
        data: { progress: 96, currentStep: "Stitching final reel..." },
      });
      finalVideoUrl = await concatClipsIntoReel(input.campaignId, clips);
    } catch (error) {
      console.error("[StoryAdCampaign] final concat failed:", error);
    }
  }

  const finalState: CampaignState = {
    ...state,
    clips,
    phase: allOk ? "DONE" : "FAILED",
    finalVideoUrl,
    finalVideoThumbnailUrl: clips.find((c) => c.videoUrl)?.videoUrl || null,
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
  return clipLength === 8 ? 80 : 100;
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

