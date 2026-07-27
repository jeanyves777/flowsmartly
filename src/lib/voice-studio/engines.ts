/**
 * Voice Studio — ENGINES.
 *
 * The narration is the spine. Every shot carries one beat of it, and a shot's HOLD is
 * whatever that beat takes to read. Because shots are cut (never cross-faded) their
 * holds are additive, so laying the concatenated narration over the finished cut keeps
 * voice and picture locked without any forced alignment.
 *
 * Cast are DEPICTED, never speakers — so nothing lip-syncs and a cloned voice can
 * narrate a film full of people. Their anchor sheets ride along as reference images
 * so the same subject shows up the same way in every shot. [[voice-studio]]
 */
import {
  getNarration, saveNarration, patchShot, patchTake, patchNarrationFinal, patchNarrationPresenter,
} from "./store";
import { draftNarration } from "./draft";
import {
  narrationDims, holdForLine, MAX_HOLD_SEC,
  type NarrationProject, type NarrationShot, type NarrationVoice,
} from "./types";
import { buildCastAnchor } from "@/lib/video-director/cast";
import { normalizeCharacter, type FilmCharacter } from "@/lib/video-director/types";
import {
  imageToKenBurnsClip, imageToClip, fitClipTo, buildNarrationTrack, narrateOver, mixMusicUnder,
  compositeTimedText, silentAudio, overlayTopBand,
} from "@/lib/video-director/clip-helpers";
import { concatenateVideoBuffers } from "@/lib/video/concat-videos";
import { renderExplainerGraphic } from "./explainer-graphic";
import { getUserBrand } from "@/lib/brand/get-brand";
import { overlayBrandLogoOnVideo } from "@/lib/video/overlay-brand-logo";
import { isCreditExhaustion, creditExhaustionUserMessage, alertAdminsCreditExhaustion } from "@/lib/ops/provider-credit-alert";
import sharp from "sharp";
import { generateImageXaiFirst, editImagesXaiFirst } from "@/lib/ai/image-router";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { heygenClient } from "@/lib/ai/heygen-client";
import { generateVoice } from "@/lib/voice/voice-engine";
import { generateWithClonedVoice as generateWithElevenLabs } from "@/lib/voice/elevenlabs-client";
import { generateWithClonedVoice as generateWithOpenAiClone } from "@/lib/voice/openai-voice-client";
import { uploadToS3, downloadS3ObjectToBuffer, isS3Url } from "@/lib/utils/s3-client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsAvailable, type CreditCostKey } from "@/lib/credits/costs";
import { prisma } from "@/lib/db/client";
import { sanitizeUserError } from "@/lib/ai/user-error";

const VOICE_COST_KEY: CreditCostKey = "AI_VOICE_GENERATION";
const IMAGE_COST_KEY: CreditCostKey = "AI_VISUAL_DESIGN";
const VIDEO_COST_KEY: CreditCostKey = "AI_VIDEO_LITE";
const PRESENTER_COST_KEY: CreditCostKey = "AI_AVATAR_VIDEO_PREMIUM"; // Avatar IV, per 30s

const MAX_CONCURRENT_SHOTS = 3;
/** Reference-to-video is capped at 10s upstream; longer holds freeze-pad the tail. */
const GROK_REF_MAX_SEC = 10;

const SHOT_STALE_MS = 90_000;
const DRAFT_STALE_MS = 120_000;   // a "drafting" older than this ⇒ its worker died
const DRAFT_MAX_TRIES = 2;        // then fail honestly rather than loop
const FINAL_BEAT_MS = 20_000;
const FINAL_STALE_MS = 90_000;
const FINAL_MAX_TRIES = 3;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function toBuffer(url: string): Promise<Buffer> {
  // Our OWN S3 objects (cast refs, shot media, audio, music) — pull by key via the
  // authed client. A stored presigned URL can 403 after its 1h TTL even though the
  // object is still there, so never fetch() it. [[presigned-urls-expire-read-by-key]]
  if (isS3Url(url)) {
    try {
      return await downloadS3ObjectToBuffer(url);
    } catch {
      /* fall through to a plain fetch (e.g. a public object without list perms) */
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The raw provider reason, truncated — stored on the shot for diagnosis, never shown. */
function rawReason(err: unknown, max = 400): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, max);
}

const isUrl = (u?: string | null): u is string => !!u && /^https?:\/\//i.test(u);

// ─────────────────────────────── narration (voice)

/**
 * Read `text` in the project's voice. A cloned profile wins over the preset knobs —
 * that's the whole point of the studio.
 */
export async function narrate(
  text: string,
  voice: NarrationVoice,
  userId: string,
): Promise<{ buffer: Buffer; durationMs: number }> {
  const clean = text.trim();
  if (!clean) throw new Error("Nothing to narrate.");
  const speed = Math.max(0.5, Math.min(2, voice.speed || 1));

  if (voice.profileId) {
    const profile = await prisma.voiceProfile.findFirst({ where: { id: voice.profileId, userId } });
    if (!profile) throw new Error("That cloned voice is no longer available.");
    let buffer: Buffer | null = null;
    if (profile.openaiVoiceId) {
      buffer = await generateWithOpenAiClone({ text: clean, voiceId: profile.openaiVoiceId, speed });
    } else if (profile.elevenLabsVoiceId) {
      buffer = await generateWithElevenLabs({ text: clean, voiceId: profile.elevenLabsVoiceId });
    }
    if (!buffer) throw new Error("That cloned voice is missing its voice id — re-clone it.");
    const words = (clean.match(/\S+/g) || []).length;
    return { buffer, durationMs: Math.round(((words / 150) * 60 * 1000) / speed) };
  }

  // A library ElevenLabs voice the user picked but didn't save as a profile.
  if (voice.elevenLabsVoiceId) {
    const buffer = await generateWithElevenLabs({ text: clean, voiceId: voice.elevenLabsVoiceId });
    const words = (clean.match(/\S+/g) || []).length;
    return { buffer, durationMs: Math.round(((words / 150) * 60 * 1000) / speed) };
  }

  const res = await generateVoice({
    text: clean,
    gender: voice.gender as never,
    accent: voice.accent as never,
    style: voice.style as never,
    speed,
  });
  return { buffer: res.audioBuffer, durationMs: res.estimatedDurationMs };
}

async function charge(userId: string, key: CreditCostKey, ref: string, description: string, meta: Record<string, unknown>): Promise<string | null> {
  const cost = await getDynamicCreditCost(key).catch(() => 0);
  if (cost <= 0) return null;
  const block = await checkCreditsAvailable(userId, cost, false, false);
  if (block) return block.message;
  const res = await creditService.deductCredits({
    userId, type: TRANSACTION_TYPES.USAGE, amount: cost,
    referenceType: "narration", referenceId: ref,
    description, metadata: { feature: key, ...meta },
  });
  return res.success ? null : (res.error || "Could not charge credits.");
}

async function refund(userId: string, key: CreditCostKey, ref: string, why: string): Promise<void> {
  const amount = await getDynamicCreditCost(key).catch(() => 0);
  if (amount <= 0) return;
  await creditService.addCredits({
    userId, type: TRANSACTION_TYPES.REFUND, amount,
    referenceType: "narration", referenceId: `${ref}:refund`,
    description: `Refund — ${why}`,
  }).catch(() => {});
}

// ─────────────────────────────── cast

/** Build a subject's portrait + turnaround sheet. Shares the Director's anchor pipeline. */
export async function generateNarrationCast(
  id: string, userId: string, characterId: string, opts: { baseImageUrl?: string | null } = {},
): Promise<NarrationProject | null> {
  const p = await getNarration(id, userId);
  if (!p) return null;
  const idx = p.characters.findIndex((c) => c.id === characterId);
  if (idx < 0) return p;

  const setChar = async (patch: Partial<FilmCharacter>) => {
    const fresh = await getNarration(id, userId);
    if (!fresh) return;
    const i = fresh.characters.findIndex((c) => c.id === characterId);
    if (i < 0) return;
    fresh.characters[i] = normalizeCharacter({ ...fresh.characters[i], ...patch }, i);
    await saveNarration(id, userId, fresh);
  };

  await setChar({ previewStatus: "generating", previewError: null });
  try {
    const anchor = await buildCastAnchor(p.characters[idx], id, opts);
    await setChar({ ...anchor, previewStatus: "ready", previewError: null, approved: false });
  } catch (err) {
    console.error("[voice-studio] cast anchor failed:", err);
    await setChar({ previewStatus: "failed", previewError: sanitizeUserError(err, "image") });
  }
  return getNarration(id, userId);
}

/** The anchor images for the subjects in a shot — what keeps them the same person shot to shot. */
function castRefsFor(p: NarrationProject, shot: NarrationShot): string[] {
  return shot.cast
    .map((cid) => p.characters.find((c) => c.id === cid))
    .map((c) => c?.characterSheetUrl || c?.referenceImageUrl)
    .filter(isUrl)
    .slice(0, 4);
}

/** Name the cast in-prompt so the model ties the reference to the right person. */
function identityLine(p: NarrationProject, shot: NarrationShot): string {
  const names = shot.cast.map((cid) => p.characters.find((c) => c.id === cid)?.name).filter(Boolean);
  if (names.length === 0) return "";
  return `\n\nIDENTITY (critical)\n- The reference image(s) define exactly how ${names.join(" and ")} look. Reproduce ${names.length > 1 ? "each of them" : "them"} EXACTLY — same face, hair, build and clothing.\n- Nobody in this shot speaks or addresses the camera. This is observed footage under a narrator.`;
}

// ─────────────────────────────── shots

/**
 * Render ONE shot: its beat of narration, plus the picture. Never throws — a failure
 * lands on the shot so the canvas can show it and offer a redo.
 */
export async function renderShot(id: string, userId: string, shotId: string): Promise<void> {
  const p = await getNarration(id, userId);
  if (!p) return;
  const shot = p.shots.find((s) => s.id === shotId);
  if (!shot) return;

  const { w, h } = narrationDims(p.aspect);
  const beat = Date.now();
  await patchShot(id, userId, shotId, { status: "rendering", progress: 6, error: null, errorDebug: null, renderHeartbeatAt: beat });

  // 1) The read. Do this first: its true length decides how long the picture holds,
  //    so a long line can never be clipped mid-sentence by a too-short shot.
  try {
    if (!isUrl(shot.audioUrl)) {
      const err = await charge(userId, VOICE_COST_KEY, `${id}:${shotId}:vo`, "Voice Studio — narration beat", { narrationId: id, shotId });
      if (err) { await patchShot(id, userId, shotId, { status: "failed", error: err }); return; }
      const { buffer, durationMs } = await narrate(shot.line, p.voice, userId);
      const url = await uploadToS3(`narration/${id}/vo-${shotId}-${uid()}.mp3`, buffer, "audio/mpeg");
      const spoken = Math.max(1, durationMs / 1000);
      const hold = Math.max(shot.holdSec, Math.min(MAX_HOLD_SEC, Math.round((spoken + 0.6) * 10) / 10));
      await patchShot(id, userId, shotId, { audioUrl: url, audioMs: durationMs, holdSec: hold, progress: 28, renderHeartbeatAt: Date.now() });
      shot.audioUrl = url; shot.audioMs = durationMs; shot.holdSec = hold;
    }
  } catch (err) {
    console.error(`[voice-studio] shot ${shotId} narration failed:`, err);
    await refund(userId, VOICE_COST_KEY, `${id}:${shotId}:vo`, "narration failed");
    await patchShot(id, userId, shotId, { status: "failed", error: sanitizeUserError(err, "generic"), errorDebug: rawReason(err) });
    return;
  }

  // 2) The picture. A user-supplied file is already the picture — don't overwrite it.
  if (shot.source === "upload" && (isUrl(shot.imageUrl) || isUrl(shot.videoUrl))) {
    await patchShot(id, userId, shotId, { status: "ready", progress: 100, renderHeartbeatAt: Date.now() });
    return;
  }

  // On-camera-explainer graphic beat: RENDER the designed graphic now → imageUrl, so it
  // shows as a live preview (beat card + main player) and the stitch reuses it.
  if (shot.graphic) {
    try {
      const brand = await getUserBrand(userId).catch(() => null);
      const png = await renderExplainerGraphic(shot.graphic, {
        width: w, height: h, presenterPct: 0.44,
        brand: { name: brand?.name || undefined, accent: brand?.colors?.accent || brand?.colors?.primary || undefined, accent2: brand?.colors?.secondary || undefined },
      });
      const url = await uploadToS3(`narration/${id}/beat-${shotId}-${uid()}.png`, png, "image/png");
      await patchShot(id, userId, shotId, { imageUrl: url, source: "ai", status: "ready", progress: 100, renderHeartbeatAt: Date.now() });
    } catch (err) {
      console.error(`[voice-studio] graphic beat ${shotId} failed:`, err);
      await patchShot(id, userId, shotId, { status: "failed", error: sanitizeUserError(err, "image"), errorDebug: rawReason(err) });
    }
    return;
  }

  const refs = castRefsFor(p, shot);
  const prompt = `${shot.prompt}${identityLine(p, shot)}`;

  try {
    if (shot.kind === "image") {
      const costErr = await charge(userId, IMAGE_COST_KEY, `${id}:${shotId}:img`, "Voice Studio — narration shot", { narrationId: id, shotId });
      if (costErr) { await patchShot(id, userId, shotId, { status: "failed", error: costErr }); return; }
      try {
        const res = refs.length
          ? await editImagesXaiFirst(prompt, await Promise.all(refs.map(toBuffer)), w, h, { intent: "identity", quality: "high" })
          : await generateImageXaiFirst(prompt, w, h, { quality: "high", transparent: false });
        if (!res.base64) throw new Error("no image returned");
        const url = await uploadToS3(
          `narration/${id}/shot-${shotId}-${uid()}.${res.format === "jpeg" ? "jpg" : res.format}`,
          Buffer.from(res.base64, "base64"),
          res.format === "jpeg" ? "image/jpeg" : `image/${res.format}`,
        );
        await patchShot(id, userId, shotId, { imageUrl: url, videoUrl: null, source: "ai", status: "ready", progress: 100, renderHeartbeatAt: Date.now() });
      } catch (err) {
        await refund(userId, IMAGE_COST_KEY, `${id}:${shotId}:img`, "shot failed");
        throw err;
      }
      return;
    }

    // video / character — a REAL generated video, anchored to the cast when there is any.
    const costErr = await charge(userId, VIDEO_COST_KEY, `${id}:${shotId}:vid`, "Voice Studio — narration video shot", { narrationId: id, shotId });
    if (costErr) { await patchShot(id, userId, shotId, { status: "failed", error: costErr }); return; }
    try {
      const seconds = Math.max(4, Math.min(refs.length ? GROK_REF_MAX_SEC : 15, Math.ceil(shot.holdSec)));
      const res = await grokVideoClient.generateVideo(prompt, {
        duration: seconds,
        aspectRatio: p.aspect as never,
        referenceImageUrls: refs.length ? refs : undefined,
        // Persist the provider handle BEFORE the long poll: a deploy mid-render must
        // resume the job xAI is already billing us for, not lose it.
        onJobId: async (requestId) => {
          await patchShot(id, userId, shotId, { refKind: "grok", refId: requestId, renderHeartbeatAt: Date.now() }).catch(() => {});
        },
        onStatus: () => { void patchShot(id, userId, shotId, { renderHeartbeatAt: Date.now() }).catch(() => {}); },
      });
      const url = await uploadToS3(`narration/${id}/shot-${shotId}-${uid()}.mp4`, res.videoBuffer, "video/mp4");
      await patchShot(id, userId, shotId, { videoUrl: url, imageUrl: null, source: "ai", status: "ready", progress: 100, renderHeartbeatAt: Date.now() });
    } catch (err) {
      await refund(userId, VIDEO_COST_KEY, `${id}:${shotId}:vid`, "shot failed");
      throw err;
    }
  } catch (err) {
    console.error(`[voice-studio] shot ${shotId} (${shot.kind}) failed:`, err);
    await patchShot(id, userId, shotId, {
      status: "failed",
      error: sanitizeUserError(err, shot.kind === "image" ? "image" : "video"),
      errorDebug: rawReason(err),
    });
  } finally {
    void drainShots(id, userId).catch(() => {});
  }
}

/** Start queued shots up to the concurrency cap. Returns how many it started. */
export async function drainShots(id: string, userId: string, max = MAX_CONCURRENT_SHOTS): Promise<number> {
  const p = await getNarration(id, userId);
  if (!p) return 0;
  const live = p.shots.filter((s) => s.status === "rendering").length;
  const free = Math.max(0, max - live);
  if (free === 0) return 0;
  const next = p.shots.filter((s) => s.status === "queued").slice(0, free);
  for (const s of next) {
    await patchShot(id, userId, s.id, { status: "rendering", progress: 4, renderHeartbeatAt: Date.now() }).catch(() => {});
    void renderShot(id, userId, s.id).catch(() => {});
  }
  return next.length;
}

/** Queue every shot that isn't ready, then start the first batch. */
export async function generateAllShots(id: string, userId: string): Promise<{ ok: boolean; queued: number; message?: string }> {
  const p = await getNarration(id, userId);
  if (!p) return { ok: false, queued: 0, message: "Not found" };
  const pending = p.shots.filter((s) => s.status !== "ready" && s.status !== "rendering");
  if (pending.length === 0) return { ok: true, queued: 0, message: "Every shot is already done." };
  for (const s of pending) {
    const i = p.shots.findIndex((x) => x.id === s.id);
    p.shots[i] = { ...p.shots[i], status: "queued", progress: 0, error: null };
  }
  await saveNarration(id, userId, p);
  await drainShots(id, userId);
  return { ok: true, queued: pending.length };
}

// ─────────────────────────────── on-camera explainer: the presenter take

/**
 * Render the CONTINUOUS presenter (top layer) for an on-camera-explainer project.
 * Concatenate every beat's cloned-voice read into ONE track (so its timing matches
 * the composite exactly), then drive an audio-driven HeyGen Avatar IV from the
 * project's clone image + that track — the person talks + gestures to our EXACT
 * audio. Because the same track times the explainer beats below, the two layers
 * stay locked. Never throws — a failure lands on the project so the canvas can
 * show it and offer a redo. [[voice-oncam-explainer-feature]]
 */
export async function renderPresenter(id: string, userId: string): Promise<void> {
  const p0 = await getNarration(id, userId);
  if (!p0 || p0.mode !== "oncam") return;

  const beat = setInterval(() => {
    void patchNarrationPresenter(id, userId, { presenterHeartbeatAt: Date.now() }).catch(() => {});
  }, FINAL_BEAT_MS);

  let charged = 0;
  try {
    await patchNarrationPresenter(id, userId, { presenterStatus: "rendering", presenterError: null, presenterHeartbeatAt: Date.now() });
    const p = await getNarration(id, userId);
    if (!p) return;
    const presenterImageUrl = p.presenterImageUrl;
    if (!isUrl(presenterImageUrl)) throw new Error("Add a presenter photo (your clone) before rendering.");

    // 1) Every beat's read, in order → one continuous track (same timing as the composite).
    const ordered = p.shots.filter((s) => s.line.trim()).sort((a, b) => a.order - b.order);
    if (ordered.length === 0) throw new Error("Write at least one beat before rendering the presenter.");

    const segments: { buf: Buffer; holdSec: number }[] = [];
    for (const s of ordered) {
      if (isUrl(s.audioUrl)) {
        segments.push({ buf: await toBuffer(s.audioUrl), holdSec: s.holdSec });
        continue;
      }
      // Beat not read yet — read it now (charge voice per beat, same as a shot read).
      const vErr = await charge(userId, VOICE_COST_KEY, `${id}:${s.id}:vo`, "Voice Studio — narration beat", { narrationId: id, shotId: s.id });
      if (vErr) throw new Error(vErr);
      const { buffer, durationMs } = await narrate(s.line, p.voice, userId);
      const url = await uploadToS3(`narration/${id}/vo-${s.id}-${uid()}.mp3`, buffer, "audio/mpeg");
      const hold = Math.max(s.holdSec, Math.min(MAX_HOLD_SEC, Math.round((durationMs / 1000 + 0.6) * 10) / 10));
      await patchShot(id, userId, s.id, { audioUrl: url, audioMs: durationMs, holdSec: hold });
      segments.push({ buf: buffer, holdSec: hold });
    }

    const track = await buildNarrationTrack(segments);
    const audioUrl = await uploadToS3(`narration/${id}/presenter-audio-${uid()}.mp3`, track, "audio/mpeg");
    const durationSec = Math.max(1, segments.reduce((n, s) => n + s.holdSec, 0));

    // 2) Charge the Avatar IV take (per 30s).
    const unit = await getDynamicCreditCost(PRESENTER_COST_KEY).catch(() => 0);
    const amount = unit * Math.max(1, Math.ceil(durationSec / 30));
    if (amount > 0) {
      const block = await checkCreditsAvailable(userId, amount, false, false);
      if (block) throw new Error(block.message);
      const res = await creditService.deductCredits({
        userId, type: TRANSACTION_TYPES.USAGE, amount,
        referenceType: "narration", referenceId: `${id}:presenter`,
        description: "Voice Studio — on-camera presenter (Avatar IV)",
        metadata: { feature: PRESENTER_COST_KEY, narrationId: id, seconds: durationSec },
      });
      if (!res.success) throw new Error(res.error || "Could not charge credits.");
      charged = amount;
    }

    // 3) Frame the clone photo like the Training presenter does — resize COVER + TOP so
    //    the head is never cut off, at high quality, sized to the presenter band — then
    //    drive audio-driven Avatar IV. [[training-presenter-talking-video]]
    const { w: pw, h: ph } = narrationDims(p.aspect);
    const bandH = Math.max(2, Math.round(ph * 0.44));
    let presenterSrc = presenterImageUrl;
    try {
      const framed = await sharp(await toBuffer(presenterImageUrl))
        .resize(pw, bandH, { fit: "cover", position: "top" })
        .jpeg({ quality: 92 })
        .toBuffer();
      presenterSrc = await uploadToS3(`narration/${id}/presenter-src-${uid()}.jpg`, framed, "image/jpeg");
    } catch (e) {
      console.error("[voice-studio] presenter reframe skipped:", e instanceof Error ? e.message : e);
    }

    const heygen = await heygenClient.generateImageToVideo({
      imageUrl: presenterSrc,
      audioUrl,
      title: p.title,
      estimatedSeconds: durationSec,
      onStatus: () => { void patchNarrationPresenter(id, userId, { presenterHeartbeatAt: Date.now() }).catch(() => {}); },
    });
    const url = await uploadToS3(`narration/${id}/presenter-${uid()}.mp4`, heygen.videoBuffer, "video/mp4");
    await patchNarrationPresenter(id, userId, { presenterVideoUrl: url, presenterStatus: "ready", presenterHeartbeatAt: Date.now() });
  } catch (err) {
    console.error(`[voice-studio] presenter render failed for ${id}:`, err);
    if (charged > 0) {
      await creditService.addCredits({
        userId, type: TRANSACTION_TYPES.REFUND, amount: charged,
        referenceType: "narration", referenceId: `${id}:presenter:refund`,
        description: "Refund — presenter render failed",
      }).catch(() => {});
    }
    // Guardrail: a provider out-of-credits failure can never succeed on retry, so tell
    // the user it's paused (not "try again"), and alert admins to top the provider up.
    const exhausted = isCreditExhaustion(err);
    if (exhausted) void alertAdminsCreditExhaustion("HeyGen (Avatar IV presenter)", rawReason(err, 600));
    await patchNarrationPresenter(id, userId, {
      presenterStatus: "failed",
      presenterError: exhausted ? creditExhaustionUserMessage("Your presenter") : sanitizeUserError(err, "video"),
      presenterErrorDebug: rawReason(err, 500),
      presenterHeartbeatAt: Date.now(),
    }).catch(() => {});
  } finally {
    clearInterval(beat);
  }
}

// ─────────────────────────────── voiceover takes

/** Read the whole script N times (voiceover mode). Each take lands on the canvas. */
export async function generateTakes(id: string, userId: string): Promise<{ ok: boolean; message?: string }> {
  const p = await getNarration(id, userId);
  if (!p) return { ok: false, message: "Not found" };
  const script = (p.script || p.brief).trim();
  if (!script) return { ok: false, message: "Write the script first." };

  const takes = Array.from({ length: Math.max(1, Math.min(4, p.takeCount)) }, () => ({
    id: `take_${uid()}`, status: "queued" as const, audioUrl: null, durationMs: null, error: null,
  }));
  p.takes = takes;
  await saveNarration(id, userId, p);

  for (const t of takes) {
    void (async () => {
      await patchTake(id, userId, t.id, { status: "rendering", renderHeartbeatAt: Date.now() }).catch(() => {});
      const err = await charge(userId, VOICE_COST_KEY, `${id}:${t.id}`, "Voice Studio — voiceover take", { narrationId: id });
      if (err) { await patchTake(id, userId, t.id, { status: "failed", error: err }).catch(() => {}); return; }
      try {
        const { buffer, durationMs } = await narrate(script, p.voice, userId);
        const url = await uploadToS3(`narration/${id}/take-${t.id}.mp3`, buffer, "audio/mpeg");
        await patchTake(id, userId, t.id, { status: "ready", audioUrl: url, durationMs, renderHeartbeatAt: Date.now() });
      } catch (e) {
        await refund(userId, VOICE_COST_KEY, `${id}:${t.id}`, "take failed");
        await patchTake(id, userId, t.id, { status: "failed", error: sanitizeUserError(e, "generic") }).catch(() => {});
      }
    })().catch(() => {});
  }
  return { ok: true };
}

// ─────────────────────────────── stitch

/**
 * Stitch the narrated film: every shot cut to its exact hold, the narration laid over
 * the whole thing, then music and captions. Fire-and-forget; poll finalStatus.
 */
export async function composeNarration(id: string, userId: string): Promise<void> {
  const beat = setInterval(() => {
    void patchNarrationFinal(id, userId, { finalHeartbeatAt: Date.now() }).catch(() => {});
  }, FINAL_BEAT_MS);
  try {
    await patchNarrationFinal(id, userId, { finalHeartbeatAt: Date.now() }).catch(() => {});
    const p = await getNarration(id, userId);
    if (!p) return;
    const { w, h } = narrationDims(p.aspect);
    const ordered = p.shots
      .filter((s) => s.status === "ready" && (isUrl(s.imageUrl) || isUrl(s.videoUrl)))
      .sort((a, b) => a.order - b.order);
    if (ordered.length === 0) throw new Error("Render at least one shot before stitching.");

    // 1) Picture: each shot fitted to EXACTLY its hold, so holds stay additive.
    const clips: Buffer[] = [];
    const segments: { buf: Buffer; holdSec: number }[] = [];
    for (const s of ordered) {
      try {
        const media = await toBuffer((s.videoUrl || s.imageUrl) as string);
        const clip = isUrl(s.videoUrl)
          ? await fitClipTo(media, w, h, s.holdSec)
          : await imageToKenBurnsClip(media, s.holdSec, w, h, s.move);
        clips.push(clip);
        // Silence for a beat with no read keeps the track aligned to the picture.
        segments.push({
          buf: isUrl(s.audioUrl) ? await toBuffer(s.audioUrl) : await silentAudio(s.holdSec),
          holdSec: s.holdSec,
        });
      } catch (e) {
        console.error(`[voice-studio] shot ${s.id} skipped in stitch:`, e instanceof Error ? e.message : e);
      }
    }
    if (clips.length === 0) throw new Error("Could not assemble any shots.");

    let film = clips.length === 1 ? clips[0] : await concatenateVideoBuffers(clips);

    // 2) The voice, over the whole cut.
    try {
      film = await narrateOver(film, await buildNarrationTrack(segments));
    } catch (e) {
      console.error(`[voice-studio] narration lay-down failed for ${id}:`, e instanceof Error ? e.message : e);
    }

    // 3) Music bed (best-effort — never lose the film over it).
    if (isUrl(p.music)) {
      try { film = await mixMusicUnder(film, await toBuffer(p.music), p.musicVolume ?? 0.22); }
      catch (e) { console.error(`[voice-studio] music skipped for ${id}:`, e instanceof Error ? e.message : e); }
    }

    // 4) Captions burned from the very lines that were read.
    if (p.captionsOn) {
      let cue = 0;
      for (const s of ordered) {
        if (s.line.trim()) {
          try {
            film = await compositeTimedText(film, w, h, {
              text: wrapText(s.line.trim(), p.aspect === "9:16" ? 28 : 46),
              x: "center", y: "bottom", font: "sans", fontSize: p.aspect === "9:16" ? 34 : 40,
              color: "#ffffff", backgroundColor: "#000000", opacity: 1,
              startSec: cue, endSec: cue + s.holdSec, boxed: true,
            });
          } catch (e) {
            console.error(`[voice-studio] caption skipped for ${s.id}:`, e instanceof Error ? e.message : e);
          }
        }
        cue += s.holdSec;
      }
    }

    const url = await uploadToS3(`narration/${id}/final-${uid()}.mp4`, film, "video/mp4");
    const fresh = await getNarration(id, userId);
    if (!fresh) return;
    fresh.finalVideoUrl = url; fresh.finalStatus = "ready"; fresh.finalProgress = 100;
    fresh.finalHeartbeatAt = Date.now(); fresh.finalTries = 0;
    await saveNarration(id, userId, fresh);
  } catch (err) {
    console.error(`[voice-studio] stitch failed for ${id}:`, err instanceof Error ? err.message : err);
    await patchNarrationFinal(id, userId, { finalStatus: "failed", finalProgress: 0 }).catch(() => {});
  } finally {
    clearInterval(beat);
  }
}

function wrapText(text: string, maxChars: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let row = "";
  for (const word of words) {
    if (row && `${row} ${word}`.length > maxChars) { rows.push(row); row = word; }
    else row = row ? `${row} ${word}` : word;
  }
  if (row) rows.push(row);
  return rows.join("\n");
}

// ─────────────────────────────── on-camera explainer: the stitch

/**
 * Stitch an ON-CAMERA EXPLAINER. Each beat's bottom layer — a designed graphic
 * (rendered) or b-roll (AI image/video) — is laid to its exact hold; then the
 * continuous Avatar IV presenter is overlaid into the TOP band. The presenter clip
 * already carries the shared narration audio, so voice, presenter motion and the
 * per-beat reveals stay locked. Fire-and-forget; poll finalStatus.
 * [[voice-oncam-explainer-feature]]
 */
export async function composeOnCam(id: string, userId: string): Promise<void> {
  const beat = setInterval(() => {
    void patchNarrationFinal(id, userId, { finalHeartbeatAt: Date.now() }).catch(() => {});
  }, FINAL_BEAT_MS);
  try {
    await patchNarrationFinal(id, userId, { finalStatus: "rendering", finalProgress: 5, finalHeartbeatAt: Date.now() }).catch(() => {});
    const p = await getNarration(id, userId);
    if (!p) return;
    if (!isUrl(p.presenterVideoUrl)) throw new Error("Render the presenter before stitching.");
    const { w, h } = narrationDims(p.aspect);
    const presenterPct = 0.44;
    const bandH = Math.round(h * presenterPct);

    // Brand: neon accent + logo come from the user's Brand Kit (best-effort).
    const brand = await getUserBrand(userId).catch(() => null);
    const gBrand = {
      name: brand?.name || undefined,
      accent: brand?.colors?.accent || brand?.colors?.primary || undefined,
      accent2: brand?.colors?.secondary || undefined,
    };

    const ordered = p.shots
      .filter((s) => s.line.trim() || s.graphic || isUrl(s.imageUrl) || isUrl(s.videoUrl))
      .sort((a, b) => a.order - b.order);
    if (ordered.length === 0) throw new Error("Add at least one beat before stitching.");

    // 1) Bottom layer, per beat, cut to its exact hold (holds stay additive).
    const clips: Buffer[] = [];
    for (const s of ordered) {
      let clip: Buffer | null = null;
      try {
        if (s.graphic) {
          // Reuse the graphic already rendered at beat time (imageUrl); render fresh only if missing.
          const png = isUrl(s.imageUrl) ? await toBuffer(s.imageUrl) : await renderExplainerGraphic(s.graphic, { width: w, height: h, presenterPct, brand: gBrand });
          clip = await imageToClip(png, s.holdSec, w, h);
        } else if (isUrl(s.videoUrl)) {
          clip = await fitClipTo(await toBuffer(s.videoUrl), w, h, s.holdSec);
        } else if (isUrl(s.imageUrl)) {
          clip = await imageToKenBurnsClip(await toBuffer(s.imageUrl), s.holdSec, w, h, s.move);
        } else {
          // No bottom asset — a branded title/caption frame so the beat still reads.
          const png = await renderExplainerGraphic(
            { kind: "title", headline: p.title, caption: s.line },
            { width: w, height: h, presenterPct, brand: gBrand },
          );
          clip = await imageToClip(png, s.holdSec, w, h);
        }
        // Designed graphics already carry their caption; burn one on b-roll beats.
        if (clip && p.captionsOn && !s.graphic && s.line.trim()) {
          try {
            clip = await compositeTimedText(clip, w, h, {
              text: wrapText(s.line.trim(), p.aspect === "9:16" ? 28 : 46),
              x: "center", y: "bottom", font: "sans", fontSize: p.aspect === "9:16" ? 34 : 40,
              color: "#ffffff", backgroundColor: "#000000", opacity: 1, startSec: 0, endSec: s.holdSec, boxed: true,
            });
          } catch (e) {
            console.error(`[voice-studio] oncam caption skipped for ${s.id}:`, e instanceof Error ? e.message : e);
          }
        }
      } catch (e) {
        console.error(`[voice-studio] oncam beat ${s.id} skipped:`, e instanceof Error ? e.message : e);
      }
      if (clip) clips.push(clip);
    }
    if (clips.length === 0) throw new Error("Could not assemble any beats.");

    // 2) Concatenate the bottom track, then overlay the continuous presenter on top.
    const bg = clips.length === 1 ? clips[0] : await concatenateVideoBuffers(clips);
    let film = await overlayTopBand(bg, await toBuffer(p.presenterVideoUrl), w, h, bandH);

    // 3) Music bed (best-effort — never lose the film over it).
    if (isUrl(p.music)) {
      try { film = await mixMusicUnder(film, await toBuffer(p.music), p.musicVolume ?? 0.18); }
      catch (e) { console.error(`[voice-studio] oncam music skipped for ${id}:`, e instanceof Error ? e.message : e); }
    }

    // 4) Brand logo watermark over the presenter (best-effort; the graphic's own logo
    //    sits under the presenter band, so stamp the real logo on top here).
    if (brand?.logo) {
      try { film = await overlayBrandLogoOnVideo(film, brand.logo); }
      catch (e) { console.error(`[voice-studio] oncam logo skipped for ${id}:`, e instanceof Error ? e.message : e); }
    }

    const url = await uploadToS3(`narration/${id}/final-${uid()}.mp4`, film, "video/mp4");
    const fresh = await getNarration(id, userId);
    if (!fresh) return;
    fresh.finalVideoUrl = url; fresh.finalStatus = "ready"; fresh.finalProgress = 100;
    fresh.finalHeartbeatAt = Date.now(); fresh.finalTries = 0;
    await saveNarration(id, userId, fresh);
  } catch (err) {
    console.error(`[voice-studio] oncam stitch failed for ${id}:`, err instanceof Error ? err.message : err);
    await patchNarrationFinal(id, userId, { finalStatus: "failed", finalProgress: 0 }).catch(() => {});
  } finally {
    clearInterval(beat);
  }
}

// ─────────────────────────────── resume

/**
 * Pull shots + stitches orphaned by a restart. A video shot holds an xAI job we can
 * poll; an image shot or a stitch has no handle, so a dead one is simply re-run.
 */
export async function syncNarration(p: NarrationProject, userId: string): Promise<NarrationProject> {
  const now = Date.now();
  let changed = false;

  // A draft orphaned by a deploy/crash: the storyboard worker died, so "drafting"
  // sticks forever with nothing to heal it. Re-run it (drafting is free), or fail
  // honestly after a couple of tries so the UI can't spin indefinitely.
  if (p.draftStatus === "drafting" && now - (p.draftStartedAt || 0) >= DRAFT_STALE_MS) {
    if ((p.draftTries || 0) >= DRAFT_MAX_TRIES) {
      p.draftStatus = "failed";
      p.draftError = "The studio couldn't storyboard that. Edit the brief and try again.";
      await saveNarration(p.id, userId, p).catch(() => {});
    } else {
      p.draftTries = (p.draftTries || 0) + 1;
      p.draftStartedAt = now;
      await saveNarration(p.id, userId, p).catch(() => {});
      console.log(`[voice-studio] resuming orphaned draft for ${p.id} on open (try ${p.draftTries})`);
      void draftNarration(p.id, userId);
    }
    return p; // nothing else to reconcile until the draft lands
  }

  for (const s of p.shots) {
    if (s.status !== "rendering") continue;
    if (now - (s.renderHeartbeatAt || 0) < SHOT_STALE_MS) continue;
    if (s.refKind === "grok" && s.refId) {
      // The provider kept rendering (and billing us) — pull it rather than fail.
      try {
        const res = await grokVideoClient.pollOnce(s.refId);
        if (res?.state === "done" && res.url) {
          const buf = await grokVideoClient.fetchVideoBuffer(res.url);
          s.videoUrl = await uploadToS3(`narration/${p.id}/shot-${s.id}-${uid()}.mp4`, buf, "video/mp4");
          s.status = "ready"; s.progress = 100; changed = true;
          continue;
        }
        if (res?.state === "failed") { s.status = "failed"; s.error = "That shot didn't render. Try again."; changed = true; continue; }
        s.renderHeartbeatAt = now; changed = true; // still going — keep it alive
        continue;
      } catch { /* fall through to re-queue */ }
    }
    s.status = "queued"; s.progress = 0; changed = true;
  }
  if (changed) await saveNarration(p.id, userId, p).catch(() => {});
  if (p.shots.some((s) => s.status === "queued")) void drainShots(p.id, userId).catch(() => {});

  // A stitch has no provider job — a quiet heartbeat means it died, so re-run it.
  if (p.finalStatus === "rendering" && now - (p.finalHeartbeatAt || 0) >= FINAL_STALE_MS) {
    if ((p.finalTries || 0) >= FINAL_MAX_TRIES) {
      p.finalStatus = "failed"; p.finalProgress = 0;
      await saveNarration(p.id, userId, p).catch(() => {});
    } else {
      p.finalHeartbeatAt = now;
      await saveNarration(p.id, userId, p).catch(() => {});
      console.log(`[voice-studio] resuming orphaned stitch for ${p.id} on open`);
      void composeNarration(p.id, userId);
    }
  }
  return p;
}

/** Cron sweep for narrations nobody has open. */
export async function resumeStuckNarrations(): Promise<{ scanned: number; changed: number }> {
  const now = Date.now();
  let changed = 0;
  const rows = await prisma.design
    .findMany({
      where: { type: "narration_project", updatedAt: { lt: new Date(now - SHOT_STALE_MS) } },
      select: { id: true, userId: true, canvasData: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    })
    .catch(() => [] as { id: string; userId: string; canvasData: string | null }[]);

  for (const row of rows) {
    if (!row.canvasData) continue;
    if (!row.canvasData.includes('"rendering"') && !row.canvasData.includes('"queued"') && !row.canvasData.includes('"drafting"')) continue;
    const p = await getNarration(row.id, row.userId).catch(() => null);
    if (!p) continue;

    // A stuck draft: syncNarration re-runs or fails it (bounded).
    if (p.draftStatus === "drafting") { await syncNarration(p, row.userId).catch(() => {}); changed++; continue; }

    if (p.finalStatus === "rendering" && now - (p.finalHeartbeatAt || 0) >= FINAL_STALE_MS) {
      const tries = (p.finalTries || 0) + 1;
      if (tries > FINAL_MAX_TRIES) {
        await patchNarrationFinal(row.id, row.userId, { finalStatus: "failed", finalProgress: 0 }).catch(() => {});
      } else {
        await patchNarrationFinal(row.id, row.userId, { finalTries: tries, finalHeartbeatAt: now }).catch(() => {});
        void composeNarration(row.id, row.userId);
      }
      changed++;
      continue;
    }
    await syncNarration(p, row.userId).catch(() => {});
    changed++;
  }
  if (changed) console.log(`[voice-studio] resumeStuckNarrations: touched ${changed}`);
  return { scanned: rows.length, changed };
}

/** Re-time every shot from its line — used after a bulk script edit. */
export function retimeShots(p: NarrationProject): NarrationProject {
  p.shots = p.shots.map((s) => (isUrl(s.audioUrl) ? s : { ...s, holdSec: holdForLine(s.line) }));
  return p;
}
