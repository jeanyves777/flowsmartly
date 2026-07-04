/**
 * Avatar Studio — HeyGen talking-avatar videos, avatar/voice cloning.
 *
 * Reuses the CartoonVideo table with animationType "avatar_video" (no schema
 * change — deploy has no db push [[campaign-studio-playground]]). One HeyGen
 * render per record; state lives in CartoonVideo.metadata (JSON).
 *
 * Credits: charged up-front on create, refunded if the render fails — same
 * contract as the Story-Ad flow. Finished MP4 is uploaded to S3 and mirrored
 * into the user's Media Library.
 */

import { prisma } from "@/lib/db/client";
import { heygenClient, type HeyGenAvatar, type HeyGenVoice } from "@/lib/ai/heygen-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { saveToMediaLibrary } from "@/lib/ai/flow-agent/save-media";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsAvailable } from "@/lib/credits/costs";
import { emptyAvatarState, type AvatarVideoState, type AvatarQuality } from "./types";

export const ANIMATION_TYPE = "avatar_video";

// -------------------------------------------------------------------------
// State (de)serialisation on the CartoonVideo.metadata blob
// -------------------------------------------------------------------------

export function writeAvatarState(state: AvatarVideoState): string {
  return JSON.stringify(state);
}

export function readAvatarState(metadata: string | null): AvatarVideoState {
  if (!metadata) return emptyAvatarState();
  try {
    return { ...emptyAvatarState(), ...(JSON.parse(metadata) as Partial<AvatarVideoState>) };
  } catch {
    return emptyAvatarState();
  }
}

// -------------------------------------------------------------------------
// Cost
// -------------------------------------------------------------------------

/** Credits for one avatar render — base cost per 30s, scaled by length. */
export async function estimateAvatarVideoCost(quality: AvatarQuality, lengthSeconds: number): Promise<number> {
  const key = quality === "avatar_iv" ? "AI_AVATAR_VIDEO_PREMIUM" : "AI_AVATAR_VIDEO";
  const per30 = await getDynamicCreditCost(key);
  const blocks = Math.max(1, Math.ceil((lengthSeconds || 30) / 30));
  return per30 * blocks;
}

// -------------------------------------------------------------------------
// Record CRUD (CartoonVideo, animationType = avatar_video)
// -------------------------------------------------------------------------

export async function createAvatarVideoRecord(input: {
  userId: string;
  state: AvatarVideoState;
  creditsCost: number;
}) {
  return prisma.cartoonVideo.create({
    data: {
      userId: input.userId,
      storyPrompt: input.state.brief || input.state.script.slice(0, 120) || "Avatar video",
      style: input.state.quality,
      animationType: ANIMATION_TYPE,
      duration: input.state.lengthSeconds,
      captionStyle: "avatar",
      status: "PENDING",
      progress: 0,
      currentStep: "Queued",
      creditsCost: input.creditsCost,
      metadata: writeAvatarState(input.state),
    },
  });
}

export async function listAvatarVideos(userId: string, limit = 24) {
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
    const state = readAvatarState(row.metadata);
    return {
      id: row.id,
      title: (row.storyPrompt || "Avatar video").slice(0, 120),
      status: row.status,
      progress: row.progress,
      currentStep: row.currentStep,
      videoUrl: row.videoUrl,
      thumbnailUrl: row.thumbnailUrl,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      quality: state.quality,
      aspect: state.aspect,
      avatarName: state.avatarName,
      lengthSeconds: state.lengthSeconds,
    };
  });
}

export async function getAvatarVideo(id: string, userId: string) {
  const row = await prisma.cartoonVideo.findFirst({
    where: { id, userId, animationType: ANIMATION_TYPE },
  });
  if (!row) return null;
  return { row, state: readAvatarState(row.metadata) };
}

export async function deleteAvatarVideo(id: string, userId: string): Promise<boolean> {
  const res = await prisma.cartoonVideo.deleteMany({
    where: { id, userId, animationType: ANIMATION_TYPE },
  });
  return res.count > 0;
}

async function patchState(id: string, patch: Partial<AvatarVideoState>) {
  const row = await prisma.cartoonVideo.findUnique({ where: { id }, select: { metadata: true } });
  const merged = { ...readAvatarState(row?.metadata ?? null), ...patch };
  await prisma.cartoonVideo.update({ where: { id }, data: { metadata: writeAvatarState(merged) } });
  return merged;
}

// -------------------------------------------------------------------------
// Credits
// -------------------------------------------------------------------------

export async function refundAvatarUsage(userId: string, amount: number, referenceId: string, reason: string) {
  if (amount <= 0) return;
  await creditService.addCredits({
    userId,
    type: TRANSACTION_TYPES.REFUND,
    amount,
    referenceType: "avatar_video",
    referenceId,
    description: reason,
  });
}

// -------------------------------------------------------------------------
// Render worker — fire-and-forget from the create route/tool (VPS is long-lived)
// -------------------------------------------------------------------------

/**
 * Render a queued avatar video: call HeyGen, upload the MP4 to S3, mirror it
 * into the Library, and mark the record COMPLETED. On failure, mark FAILED and
 * refund the credits charged at create time. Never throws.
 */
export async function renderAvatarVideo(id: string, userId: string): Promise<void> {
  const found = await getAvatarVideo(id, userId);
  if (!found) return;
  const { row, state } = found;

  try {
    await prisma.cartoonVideo.update({
      where: { id },
      data: { status: "PROCESSING", progress: 10, currentStep: "Rendering with HeyGen…" },
    });

    if (!heygenClient.isAvailable()) {
      throw new Error("HeyGen is not configured (HEYGEN_API_KEY missing).");
    }

    const result = await heygenClient.generateAvatarVideo({
      avatarId: state.avatarId,
      voiceId: state.voiceId,
      script: state.script,
      aspect: state.aspect,
      quality: state.quality,
      onJobId: (videoId) => { void patchState(id, { heygenVideoId: videoId }); },
      onStatus: (message) => {
        void prisma.cartoonVideo.update({ where: { id }, data: { currentStep: message } }).catch(() => {});
      },
    });

    const key = `heygen/avatar-videos/${id}.mp4`;
    const url = await uploadToS3(key, result.videoBuffer, "video/mp4");

    // Best-effort: store the HeyGen thumbnail in our bucket so the card poster is stable.
    let thumbnailUrl: string | null = null;
    if (result.thumbnailUrl) {
      try {
        const thumbRes = await fetch(result.thumbnailUrl);
        if (thumbRes.ok) {
          const buf = Buffer.from(await thumbRes.arrayBuffer());
          thumbnailUrl = await uploadToS3(`heygen/avatar-videos/${id}-thumb.jpg`, buf, "image/jpeg");
        }
      } catch { /* thumbnail is optional */ }
    }

    await saveToMediaLibrary({
      userId,
      url,
      type: "video",
      mimeType: "video/mp4",
      size: result.videoBuffer.length,
      originalName: `${(row.storyPrompt || "avatar-video").slice(0, 60)}.mp4`,
      tags: ["heygen", "avatar", "ai-generated"],
      metadata: { source: "heygen", avatarVideoId: id, avatarName: state.avatarName },
    });

    await prisma.cartoonVideo.update({
      where: { id },
      data: {
        status: "COMPLETED",
        progress: 100,
        currentStep: "Ready",
        videoUrl: url,
        thumbnailUrl,
        completedAt: new Date(),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Avatar render failed";
    console.error(`[avatar-studio] render failed for ${id}:`, message);
    await patchState(id, { error: message });
    await prisma.cartoonVideo.update({
      where: { id },
      data: { status: "FAILED", currentStep: message.slice(0, 200) },
    }).catch(() => {});
    await refundAvatarUsage(userId, row.creditsCost || 0, id, "Refund: avatar render failed").catch(() => {});
  }
}

// -------------------------------------------------------------------------
// Start — pre-check credits, create the record, charge, fire the render.
// Shared by the HTTP create route AND the create_avatar_video agent tool.
// -------------------------------------------------------------------------

export type StartAvatarResult =
  | { ok: true; id: string; creditsCost: number }
  | { ok: false; code: string; message: string };

export async function startAvatarVideo(input: {
  userId: string;
  isAdmin?: boolean;
  state: AvatarVideoState;
}): Promise<StartAvatarResult> {
  const { userId, isAdmin = false } = input;
  const state = { ...emptyAvatarState(), ...input.state };

  if (!state.script.trim()) return { ok: false, code: "missing_script", message: "A script is required to render the avatar video." };
  if (!state.avatarId) return { ok: false, code: "missing_avatar", message: "Pick an avatar to render with." };
  if (!state.voiceId) return { ok: false, code: "missing_voice", message: "Pick a voice to speak the script." };

  const creditsCost = await estimateAvatarVideoCost(state.quality, state.lengthSeconds);
  const block = await checkCreditsAvailable(userId, creditsCost, false, isAdmin);
  if (block) return { ok: false, code: block.code, message: block.message };

  const record = await createAvatarVideoRecord({ userId, state, creditsCost });

  if (!isAdmin && creditsCost > 0) {
    const charge = await creditService.deductCredits({
      userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditsCost,
      referenceType: "avatar_video",
      referenceId: record.id,
      description: `Avatar video (${state.quality})`,
      metadata: { feature: state.quality === "avatar_iv" ? "AI_AVATAR_VIDEO_PREMIUM" : "AI_AVATAR_VIDEO" },
    });
    if (!charge.success) {
      await deleteAvatarVideo(record.id, userId).catch(() => {});
      return { ok: false, code: "insufficient_credits", message: charge.error || "Could not charge credits." };
    }
  }

  // Fire-and-forget render. The VPS runtime is long-lived; a recovery cron can
  // resume an interrupted job via the persisted heygenVideoId.
  void renderAvatarVideo(record.id, userId);
  return { ok: true, id: record.id, creditsCost };
}

// -------------------------------------------------------------------------
// Avatars & voices (HeyGen, with a small dev fallback when the key is absent)
// -------------------------------------------------------------------------

const FALLBACK_AVATARS: HeyGenAvatar[] = [
  { id: "Daisy-inskirt-20220818", name: "Daisy", isCustom: false },
  { id: "Tyler-incasualsuit-20220721", name: "Tyler", isCustom: false },
  { id: "Anna_public_3_20240108", name: "Anna", isCustom: false },
];
const FALLBACK_VOICES: HeyGenVoice[] = [
  { id: "1bd001e7e50f421d891986aad5158bc8", name: "Aria — warm female", language: "English" },
  { id: "d7bbcdd6964c47bdaae26decade4a933", name: "Bill — narrator male", language: "English" },
];

export async function listAvatarsForUser(): Promise<HeyGenAvatar[]> {
  if (!heygenClient.isAvailable()) return FALLBACK_AVATARS;
  const list = await heygenClient.listAvatars();
  return list.length ? list : FALLBACK_AVATARS;
}

export async function listVoicesForUser(): Promise<HeyGenVoice[]> {
  if (!heygenClient.isAvailable()) return FALLBACK_VOICES;
  const list = await heygenClient.listVoices();
  return list.length ? list.slice(0, 60) : FALLBACK_VOICES;
}
