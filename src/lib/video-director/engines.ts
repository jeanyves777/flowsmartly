/**
 * Engine bridges — a Director scene renders on the engine it already uses today.
 * Nothing here reimplements a generator; it dispatches to the existing avatar /
 * AI-video pipelines, then reconciles their status back onto the scene, and
 * stitches the ready clips into one film with the shared concat primitive.
 */

import { getFilm, saveFilm, patchScene, patchOverlay, patchVideoEdit } from "./store";
import { continuityText } from "./types";
import type { FilmProject, FilmScene, FilmOverlay, FilmAspect, FilmCharacter, FilmVideoEdit } from "./types";
import { startAvatarVideo, getAvatarVideo } from "@/lib/avatar-studio";
import { emptyAvatarState } from "@/lib/avatar-studio/types";
import { generateVideoForRole } from "@/lib/ai/video-router";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { veoClient } from "@/lib/ai/veo-client";
import { concatenateVideoBuffers } from "@/lib/video/concat-videos";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsAvailable } from "@/lib/credits/costs";
import { prisma } from "@/lib/db/client";
import { overlayBrandLogoOnVideo } from "@/lib/video/overlay-brand-logo";
import { buildBrandOutroClip } from "@/lib/video/brand-outro";
import { generateImageXaiFirst, editImagesXaiFirst } from "@/lib/ai/image-router";
import { sanitizeUserError } from "@/lib/ai/user-error";
import { filmDims, imageToClip, normalizeClip, crossfadePair, mixMusicUnder, xfadeName, compositeOverlay, compositeTimedMedia, compositeTimedText, mixTimedAudio, preserveSourceAudio } from "./clip-helpers";

const isVideoUrl = (u?: string | null): u is string => !!u && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
const isImageUrl = (u?: string | null): u is string => !!u && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u);
const AI_SCENE_COST_KEY = "AI_VIDEO_LITE";
const MAX_VIDEO_EDIT_SECONDS = 8.7;

/** A short unique token so every (re)render writes a NEW S3 object + URL. A fixed
 *  key gets OVERWRITTEN but keeps the same URL, so the browser/CDN keeps serving
 *  the STALE clip after a regenerate ("still shows the old video" bug). A fresh
 *  URL forces the player to reload the new render. */
const uid = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Anti-leak guard appended to every AI shot prompt. The director used to pass
// the raw scene script to Grok/Veo with NO guard, so the same artifacts we
// fixed for images leaked into video — burned-in captions/subtitles, watermarks,
// "AI-generated" badges, warped gibberish text on signs/screens, morphing faces.
// Grok has no negativePrompt param, so the guard lives in the POSITIVE prompt
// (it also constrains the Veo fallback). Kept short so it never crowds the shot.
const VIDEO_ANTI_LEAK =
  "Clean live-action footage: absolutely NO on-screen text, subtitles, captions, title cards, lower-thirds, or watermark; " +
  "no logos or brand marks on props/screens/signage, no readable gibberish text anywhere, no date or year stamp; " +
  "no AI-tool watermark or 'AI-generated' badge. Photoreal, natural continuous motion with correct anatomy — " +
  "no distorted or morphing faces, no extra or fused fingers, no warping.";

/** Append the anti-leak guard to a shot prompt (once), plus a leading style
 *  directive so an AI shot honours the film's chosen look (live-action vs 3D)
 *  instead of drifting to the model's default CGI. */
type CastVisualMode = "cinematic" | "3d" | "mixed";

function withVideoGuard(prompt: string, style?: string, castVisualMode?: CastVisualMode): string {
  const base = (prompt || "").trim();
  const mode = castVisualMode || (style === "3d" ? "3d" : "cinematic");
  const lead = mode === "mixed"
    ? "MIXED-MEDIA cinematic shot: preserve the real environment and cinematic live-action cast as photoreal, while characters explicitly identified as 3D remain polished stylized 3D figures composited naturally into the same frame. Do not turn the whole scene into animation and do not turn the 3D character into a human. "
    : mode === "3d"
      ? "3D-ANIMATED shot — premium Pixar/Disney-grade CGI, stylized characters. "
      : "PHOTOREAL LIVE-ACTION cinematic shot — real people and real footage shot on a cinema camera; NOT 3D, NOT CGI, NOT animation, NOT a cartoon. ";
  if (!base) return `${lead}\n\n${VIDEO_ANTI_LEAK}`;
  return `${lead}${base}\n\n${VIDEO_ANTI_LEAK}`;
}

// A single AI shot is a ≤15s clip, but an image-to-video render (Grok) can take
// several minutes — its own client waits up to 10 min. Bound the in-process wait
// ABOVE that so a legitimately slow render isn't killed prematurely, while a truly
// stuck provider still fails + refunds with a friendly message.
const AI_SCENE_TIMEOUT_MS = 12 * 60 * 1000;
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

/** For a movie scene: the identity references for EVERY cast member present
 *  (speakers first, so the primary anchor is who the shot is on) + the spoken
 *  dialogue block, so the AI shot shows the same people saying their lines. */
function sceneCastData(film: FilmProject, scene: FilmScene): { refs: string[]; dialogue?: string; present: string[]; speakerCount: number; visualMode: CastVisualMode } {
  const chars = film.characters || [];
  const lines = scene.cast || [];
  const charFor = (l: { characterId?: string; name?: string }): FilmCharacter | undefined =>
    chars.find((x) => x.id === l.characterId) || chars.find((x) => x.name.toLowerCase() === (l.name || "").toLowerCase());
  // ONE clean PORTRAIT per person for reference-to-video. Feeding the multi-pose
  // turnaround SHEET as a reference makes the model read the repeated poses as several
  // people and render the SAME person two or three times (the "duplicated cast" bug) —
  // a single clean subject per person avoids the clones. Sheet is the fallback only.
  const imgFor = (l: { characterId?: string; name?: string }): string | undefined => {
    const c = charFor(l);
    return c?.referenceImageUrl || c?.characterSheetUrl || undefined;
  };
  const shortDesc = (c?: FilmCharacter): string => {
    if (!c) return "";
    const d = (c.wardrobe?.trim() || c.description || "").replace(/\s+/g, " ").trim();
    if (!d) return c.role || "";
    // Trim to ~14 words WITHOUT ending on a dangling connector (…"wearing", …"in") so the
    // descriptor doesn't read as "Amara (…wearing)" with nothing after it.
    const words = d.split(" ").slice(0, 14);
    while (words.length && /^(wearing|in|with|and|a|an|the|of|to|dressed)$/i.test(words[words.length - 1])) words.pop();
    return words.join(" ");
  };
  // Who is actually in this shot — speakers first (that's who the shot is on), then any
  // silent cast — DE-DUPED PER PERSON so the same person can never be listed (or
  // referenced) twice. A shot with no cast lines (an establishing beat) forces no one in.
  const seen = new Set<string>();
  const styles = new Set<"cinematic" | "3d">();
  const present: string[] = [];
  const refs: string[] = [];
  const addPerson = (l: { characterId?: string; name?: string }) => {
    const c = charFor(l);
    const key = c?.id || (l.name || "").toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    const nm = c?.name || l.name || "";
    const dsc = shortDesc(c);
    const renderStyle = c?.renderStyle === "3d" ? "3d" : "cinematic";
    styles.add(renderStyle);
    const styleTag = renderStyle === "3d" ? "3D animated identity" : "cinematic live-action identity";
    present.push(dsc ? `${nm} [${styleTag}] (${dsc})` : `${nm} [${styleTag}]`);
    const u = imgFor(l);
    if (u) refs.push(u);
  };
  for (const l of lines.filter((l) => (l.dialogue || "").trim())) addPerson(l);
  for (const l of lines) addPerson(l);
  const spoken = lines.filter((l) => (l.dialogue || "").trim());
  // Tag each speaker with a SHORT visual descriptor so the model can tell who's who on
  // screen and lip-sync the right line to the right person (fixes "the wrong character
  // says someone else's line" in multi-person shots).
  const tag = (c?: FilmCharacter): string => { const d = shortDesc(c); return d ? ` (${d})` : ""; };
  const dialogue = spoken.length
    ? spoken.map((l) => `${l.name}${tag(charFor(l))} says: "${(l.dialogue || "").trim()}"`).join("\n")
    : undefined;
  const visualMode: CastVisualMode = styles.size > 1
    ? "mixed"
    : styles.has("3d") || (styles.size === 0 && scene.style === "3d") ? "3d" : "cinematic";
  return { refs: refs.slice(0, 6), dialogue, present, speakerCount: spoken.length, visualMode };
}

/** The continuity bible scoped to the cast actually in THIS scene (so the shot's
 *  keyframe + prompt only carry the wardrobe of people who appear). */
function continuityForScene(film: FilmProject, scene: FilmScene): string {
  const c = film.continuity;
  if (!c) return "";
  const names = new Set((scene.cast || []).map((l) => (l.name || "").toLowerCase()).filter(Boolean));
  const wardrobe = names.size
    ? (c.wardrobe || []).filter((w) => names.has((w.name || "").toLowerCase()))
    : (c.wardrobe || []);
  return continuityText({ location: c.location, timePalette: c.timePalette, wardrobe });
}

/** Prompt for a scene's OPENING KEYFRAME — a real, full scene composition (NOT a
 *  studio portrait / turnaround sheet), identity-locked from the cast sheets and
 *  bound to the film's continuity, so the animated clip starts IN the scene and
 *  inherits the shared location + wardrobe. */
function keyframePrompt(scene: FilmScene, continuity: string, hasCast: boolean, castVisualMode?: CastVisualMode): string {
  const mode = castVisualMode || (scene.style === "3d" ? "3d" : "cinematic");
  const look = mode === "mixed"
    ? "MIXED-MEDIA cinematic film still: a photoreal live-action environment and real human cast, with only the explicitly 3D cast identities rendered as premium stylized 3D figures naturally composited into the scene."
    : mode === "3d"
      ? "Premium Pixar/Disney-grade 3D-ANIMATED film still — stylized characters, cinematic 3D lighting."
      : "PHOTOREAL LIVE-ACTION cinematic film still, shot on a professional cinema camera (shallow depth of field, natural film lighting) — a real photograph of a real scene; NOT 3D, NOT CGI, NOT a cartoon.";
  const shot = (scene.script || scene.title || "").trim();
  const castLine = hasCast
    ? "PEOPLE IN FRAME — recreate the EXACT people from the reference image(s): identical faces, hair, skin tone and build, wearing their established wardrobe. Do NOT invent new faces and do NOT change their clothes.\n"
    : "";
  return `The OPENING FRAME of a film shot — a full scene composition set in a real environment.
${look}

SHOT (what is on screen): ${shot}

${castLine}${continuity ? `CONTINUITY — match the rest of the film EXACTLY: ${continuity}\n` : ""}Frame it as the shot describes (wide / medium / close as written), with the people placed naturally IN the environment and mid-action.

HARD RULES:
- A real scene in a real location — absolutely NOT a studio backdrop, NOT a grey/seamless background, NOT a character turnaround sheet, NOT a posed portrait, NOT multiple copies of one person side by side.
- No on-screen text, captions, subtitles, watermark, logo or UI. Correct human anatomy; no warped, duplicated or morphing faces.`;
}

/** Compose a scene's opening keyframe still (best-effort). Identity-preserving
 *  edit from the cast sheets when we have them, else a plain scene still. Returns
 *  the uploaded URL, or null so the caller falls back gracefully. */
async function buildSceneKeyframe(
  filmId: string,
  userId: string,
  sceneId: string,
  scene: FilmScene,
  aspect: FilmAspect,
  castRefs: string[],
  continuity: string,
  castVisualMode?: CastVisualMode,
): Promise<string | null> {
  const [w, h] = aspect === "9:16" ? [768, 1344] : aspect === "16:9" ? [1344, 768] : [1024, 1024];
  const prompt = keyframePrompt(scene, continuity, castRefs.length > 0, castVisualMode);
  try {
    let res;
    // Pull up to 2 cast sheets to anchor identity in the still.
    const buffers: Buffer[] = [];
    for (const url of castRefs.slice(0, 2)) {
      try {
        const r = await fetch(url);
        if (r.ok) buffers.push(Buffer.from(await r.arrayBuffer()));
      } catch { /* skip a broken ref */ }
    }
    if (buffers.length) {
      res = await editImagesXaiFirst(prompt, buffers, w, h, { intent: "identity", quality: "high" });
    } else {
      res = await generateImageXaiFirst(prompt, w, h, { quality: "high" });
    }
    if (!res?.base64) return null;
    const ext = res.format === "jpeg" ? "jpg" : res.format;
    return await uploadToS3(
      `director/${filmId}/${sceneId}-key-${uid()}.${ext}`,
      Buffer.from(res.base64, "base64"),
      res.format === "jpeg" ? "image/jpeg" : `image/${res.format}`,
    );
  } catch (e) {
    console.warn(`[video-director] scene keyframe gen failed for ${sceneId}:`, e instanceof Error ? e.message : e);
    return null;
  }
}
const XFADE_DUR = 0.7; // seconds of overlap for a scene transition — a touch longer so cuts blend, not snap
const playedLenOf = (s: FilmScene) =>
  typeof s.clipStart === "number" && typeof s.clipEnd === "number" && s.clipEnd > s.clipStart ? s.clipEnd - s.clipStart : s.durationSec || 4;

async function restoreEditedClipAudio(editedVideo: Buffer, sourceVideoUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(sourceVideoUrl);
    if (!response.ok) return editedVideo;
    return await preserveSourceAudio(editedVideo, Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.warn("[video-director] could not restore source audio after edit:", e instanceof Error ? e.message : e);
    return editedVideo;
  }
}

async function prepareContinuationSource(film: FilmProject, source: FilmScene): Promise<string> {
  const sourceDuration = playedLenOf(source);
  if (sourceDuration < 2 || sourceDuration > 15) {
    throw new Error("Exact continuation requires a source clip between 2 and 15 seconds.");
  }
  if (!isVideoUrl(source.videoUrl) || !/^https:\/\//i.test(source.videoUrl)) {
    throw new Error("Generate the preceding scene as a public MP4 before extending it.");
  }
  const hasTrim = typeof source.clipStart === "number" && typeof source.clipEnd === "number" && source.clipEnd > source.clipStart;
  if (!hasTrim) return source.videoUrl;

  const response = await fetch(source.videoUrl);
  if (!response.ok) throw new Error("The preceding scene could not be opened for continuation.");
  const { w, h } = filmDims(film.aspect);
  const trimmed = await normalizeClip(Buffer.from(await response.arrayBuffer()), w, h, {
    preferSourceAudio: true,
    trim: { start: source.clipStart as number, end: source.clipEnd as number },
  });
  return uploadToS3(`director/${film.id}/${source.id}-continuation-source-${uid()}.mp4`, trimmed, "video/mp4");
}

async function extractContinuationSegment(
  combined: Buffer,
  aspect: FilmAspect,
  extensionSeconds: number,
  sourceSeconds: number,
  providerDuration?: number,
): Promise<Buffer> {
  const extension = Math.min(10, Math.max(2, Math.round(extensionSeconds)));
  const total = providerDuration && providerDuration > extension
    ? providerDuration
    : sourceSeconds + extension;
  const { w, h } = filmDims(aspect);
  return normalizeClip(combined, w, h, {
    preferSourceAudio: true,
    trim: { start: Math.max(0, total - extension), end: total },
  });
}

export interface GenerateResult { ok: boolean; film?: FilmProject; message?: string }

/** Start an xAI edit of a ready AI clip. The current clip remains ready and
 * playable until the edited MP4 has finished and been saved. */
export async function startSceneVideoEdit(
  filmId: string,
  userId: string,
  sceneId: string,
  prompt: string,
): Promise<GenerateResult> {
  const film = await getFilm(filmId, userId);
  if (!film) return { ok: false, message: "Film not found." };
  const scene = film.scenes.find((s) => s.id === sceneId);
  if (!scene) return { ok: false, message: "Scene not found." };
  if (scene.engine !== "ai" || scene.status !== "ready" || !isVideoUrl(scene.videoUrl)) {
    return { ok: false, message: "Generate this AI scene before editing its video." };
  }
  if (scene.videoEdit?.status === "queued" || scene.videoEdit?.status === "rendering") {
    return { ok: false, message: "This video already has an edit in progress." };
  }
  const cleanPrompt = prompt.trim().slice(0, 3900);
  if (cleanPrompt.length < 3) return { ok: false, message: "Describe the glitch or change to fix." };

  const editDuration = playedLenOf(scene);
  if (editDuration > MAX_VIDEO_EDIT_SECONDS + 0.01) {
    return { ok: false, message: `xAI can edit up to ${MAX_VIDEO_EDIT_SECONDS}s at once. Split this scene into shorter clips on the timeline first.` };
  }

  let sourceVideoUrl = scene.videoUrl;
  const hasTrim = typeof scene.clipStart === "number" && typeof scene.clipEnd === "number" && scene.clipEnd > scene.clipStart;
  if (hasTrim) {
    try {
      const source = await fetch(scene.videoUrl);
      if (!source.ok) return { ok: false, message: "The source video could not be opened for editing." };
      const { w, h } = filmDims(film.aspect);
      const trimmed = await normalizeClip(Buffer.from(await source.arrayBuffer()), w, h, {
        preferSourceAudio: true,
        trim: { start: scene.clipStart as number, end: scene.clipEnd as number },
      });
      sourceVideoUrl = await uploadToS3(`director/${film.id}/${scene.id}-edit-source-${uid()}.mp4`, trimmed, "video/mp4");
    } catch (e) {
      console.error(`[video-director] edit source prep failed for ${sceneId}:`, e instanceof Error ? e.message : e);
      return { ok: false, message: "The selected clip could not be prepared for editing." };
    }
  }
  if (!/^https:\/\//i.test(sourceVideoUrl) || !/\.mp4(?:\?|$)/i.test(sourceVideoUrl)) {
    return { ok: false, message: "xAI editing requires a public MP4 source video." };
  }

  const cost = await getDynamicCreditCost(AI_SCENE_COST_KEY).catch(() => 0);
  const block = await checkCreditsAvailable(userId, cost, false, false);
  if (block) return { ok: false, message: block.message };
  const editId = uid();
  if (cost > 0) {
    const charge = await creditService.deductCredits({
      userId, type: TRANSACTION_TYPES.USAGE, amount: cost,
      referenceType: "director_scene", referenceId: `${sceneId}:edit:${editId}`,
      description: "Video Director — xAI video edit",
      metadata: { feature: AI_SCENE_COST_KEY, filmId, operation: "video_edit" },
    });
    if (!charge.success) return { ok: false, message: charge.error || "Could not charge credits." };
  }

  const startedAt = Date.now();
  const videoEdit: FilmVideoEdit = {
    id: editId,
    prompt: cleanPrompt,
    sourceVideoUrl,
    durationSec: editDuration,
    cost,
    status: "queued",
    progress: 5,
    startedAt,
    heartbeatAt: startedAt,
    error: null,
  };
  const queued = await patchScene(filmId, userId, sceneId, { videoEdit });
  if (!queued) {
    await refundVideoEdit(userId, sceneId, videoEdit);
    return { ok: false, message: "The scene changed before the video edit could start." };
  }
  void renderSceneVideoEdit(filmId, userId, sceneId, editId);
  return { ok: true, film: queued };
}

/**
 * Kick a scene's render on its engine. Avatar → the HeyGen pipeline (charged +
 * fire-and-forget, reconciled by syncFilmScenes). AI → the video router (fire-
 * and-forget in-process). Media/Design → already-materialised assets, marked
 * ready. Reel → deferred to the reel bridge. Returns the updated film.
 */
export async function generateSceneRender(filmId: string, userId: string, sceneId: string): Promise<GenerateResult> {
  const film = await getFilm(filmId, userId);
  if (!film) return { ok: false, message: "Film not found." };
  const scene = film.scenes.find((s) => s.id === sceneId);
  if (!scene) return { ok: false, message: "Scene not found." };
  // Idempotency: never double-charge / double-fire a scene that's already rendering
  // (matters for the batch drainer, whose kicks can otherwise race).
  if (scene.status === "rendering") return { ok: true, film };

  switch (scene.engine) {
    case "media": {
      if (!scene.sourceUrl) return { ok: false, message: "Attach a media clip to this scene first." };
      const f = await patchScene(filmId, userId, sceneId, { status: "ready", progress: 100, videoUrl: scene.sourceUrl, thumbnailUrl: scene.thumbnailUrl || scene.sourceUrl });
      return { ok: true, film: f ?? undefined };
    }
    case "design": {
      const img = scene.thumbnailUrl || scene.sourceUrl;
      if (!img) return { ok: false, message: "Attach a design still to this scene first." };
      // A still is held for its duration by the compositor; store it as the poster + source.
      const f = await patchScene(filmId, userId, sceneId, { status: "ready", progress: 100, videoUrl: img, thumbnailUrl: img });
      return { ok: true, film: f ?? undefined };
    }
    case "avatar": {
      if (!scene.script?.trim()) return { ok: false, message: "Write the avatar's script first." };
      if (!scene.avatarId || !scene.voiceId) return { ok: false, message: "Pick an avatar and a voice for this scene." };
      const res = await startAvatarVideo({
        userId,
        state: {
          ...emptyAvatarState(),
          mode: "talking",
          script: scene.script,
          avatarId: scene.avatarId,
          avatarName: scene.avatarName || "",
          voiceId: scene.voiceId,
          voiceName: scene.voiceName || "",
          quality: scene.quality === "avatar_iv" ? "avatar_iv" : "standard",
          aspect: film.aspect,
          lengthSeconds: scene.durationSec || 30,
          captionsOn: !!scene.captionsOn,
          voiceEmotion: scene.voiceEmotion ?? null,
          voiceSpeed: scene.voiceSpeed ?? null,
          motionPrompt: scene.motionPrompt ?? null,
          background: scene.background ?? null,
        },
      });
      if (!res.ok) return { ok: false, message: res.message };
      const f = await patchScene(filmId, userId, sceneId, { status: "rendering", progress: 8, refKind: "avatar_video", refId: res.id });
      return { ok: true, film: f ?? undefined };
    }
    case "ai": {
      if (!scene.script?.trim()) return { ok: false, message: "Write the shot prompt first." };
      let continuationSource: FilmScene | undefined;
      let continuationSourceUrl: string | undefined;
      if (scene.continuationMode === "exact") {
        continuationSource = film.scenes.find((s) => s.id === scene.continuationOf);
        if (!continuationSource || continuationSource.status !== "ready") {
          return { ok: false, message: "Generate the preceding scene before creating its exact continuation." };
        }
        try {
          continuationSourceUrl = await prepareContinuationSource(film, continuationSource);
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : "The preceding scene could not be prepared." };
        }
      }
      // Charge up-front (refunded in renderAiScene on failure), like the avatar path.
      const cost = await getDynamicCreditCost(AI_SCENE_COST_KEY).catch(() => 0);
      const block = await checkCreditsAvailable(userId, cost, false, false);
      if (block) return { ok: false, message: block.message };
      if (cost > 0) {
        const charge = await creditService.deductCredits({
          userId, type: TRANSACTION_TYPES.USAGE, amount: cost,
          referenceType: "director_scene", referenceId: sceneId, description: "Video Director — AI scene",
          metadata: { feature: AI_SCENE_COST_KEY, filmId },
        });
        if (!charge.success) return { ok: false, message: charge.error || "Could not charge credits." };
      }
      await patchScene(filmId, userId, sceneId, { status: "rendering", progress: 6, error: null });
      const { refs: castRefs, dialogue, present, visualMode } = sceneCastData(film, scene);
      const continuity = continuityForScene(film, scene);
      if (continuationSource && continuationSourceUrl) {
        void renderAiContinuation(
          filmId, userId, sceneId, scene, continuationSource, continuationSourceUrl,
          film.aspect, cost, dialogue, continuity,
        );
      } else {
        void renderAiScene(filmId, userId, sceneId, scene, film.aspect, cost, castRefs, dialogue, continuity, present, visualMode); // fire-and-forget (VPS is long-lived)
      }
      const f = await getFilm(filmId, userId);
      return { ok: true, film: f ?? undefined };
    }
    case "reel": {
      // Lightweight reel bridge: a source video URL (+ optional trim) becomes the
      // clip; the trim + reframe happen at stitch time via normalizeClip.
      if (!scene.sourceUrl && !isVideoUrl(scene.videoUrl)) {
        return { ok: false, message: "Paste a source video URL (and set the trim) for this reel clip first." };
      }
      const url = scene.sourceUrl || scene.videoUrl!;
      const f = await patchScene(filmId, userId, sceneId, { status: "ready", progress: 100, videoUrl: url, thumbnailUrl: scene.thumbnailUrl || null });
      return { ok: true, film: f ?? undefined };
    }
  }
  return { ok: false, message: "Unknown engine." };
}

// ── Batch "Generate all" ──────────────────────────────────────────────────────
// Films can have 20-30 scenes. Firing them ALL at once would (a) hammer the 1-req/sec
// xAI gate and (b) have 20+ in-process renders racing to write the same film JSON and
// clobbering each other. So a batch QUEUES every pending scene and a bounded drainer
// keeps only a few rendering at a time, refilling as each one finishes — event-driven
// (a completing render pulls the next) with the reconcile cron as a persistence safety
// net, so the batch survives the user leaving the page or a deploy restart.
const MAX_CONCURRENT_DIRECTOR_RENDERS = 4;

/** Statuses that mean "not started / retriable" — a batch should (re)generate these. */
function sceneAwaitsRender(s: FilmScene): boolean {
  if (s.status === "ready" || s.status === "rendering" || s.status === "queued") return false;
  if (s.continuationMode === "exact") return false; // needs the prior scene's FINISHED video — do individually
  return true; // draft / failed / anything else renderable
}

/**
 * Kick up to the concurrency cap of QUEUED scenes into rendering. Re-reads fresh film
 * state so it's safe to call from a render's completion, the film poll, and the cron.
 * Returns how many it started this pass.
 */
export async function drainDirectorRenders(filmId: string, userId: string, max = MAX_CONCURRENT_DIRECTOR_RENDERS): Promise<number> {
  const film = await getFilm(filmId, userId);
  if (!film) return 0;
  let active = film.scenes.filter((s) => s.status === "rendering").length;
  const queued = film.scenes.filter((s) => s.status === "queued").sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let started = 0;
  for (const s of queued) {
    if (active >= max) break;
    const res = await generateSceneRender(filmId, userId, s.id);
    if (res.ok) { active++; started++; }
    else if (/credit|insufficient|balance/i.test(res.message || "")) break; // out of credits — leave the rest queued
    // any other failure: the scene is marked failed by the renderer; keep draining the rest
  }
  return started;
}

/**
 * BATCH generate — queue every not-yet-ready scene, then start the first few. The
 * client shows a global loader driven by the scene stats (queued + rendering + ready)
 * and the drainer refills the pipeline as renders finish.
 */
export async function generateAllScenes(filmId: string, userId: string): Promise<{ ok: boolean; queued: number; started: number; message?: string; film?: FilmProject }> {
  const film = await getFilm(filmId, userId);
  if (!film) return { ok: false, queued: 0, started: 0, message: "Film not found." };
  const pending = film.scenes.filter(sceneAwaitsRender);
  if (!pending.length) return { ok: true, queued: 0, started: 0, film };
  // Mark them all queued in ONE save so the whole batch shows immediately.
  for (const s of film.scenes) if (sceneAwaitsRender(s)) { s.status = "queued"; s.progress = 0; s.error = null; }
  await saveFilm(filmId, userId, film);
  const started = await drainDirectorRenders(filmId, userId);
  const fresh = await getFilm(filmId, userId);
  return { ok: true, queued: pending.length, started, film: fresh ?? film };
}

/**
 * Render a scene's PiP OVERLAY on its own engine (avatar presenter / media / AI).
 * Mirrors generateSceneRender but targets scene.overlay; the overlay is composited
 * onto the base at stitch time. Returns the updated film.
 */
export async function generateSceneOverlay(filmId: string, userId: string, sceneId: string): Promise<GenerateResult> {
  const film = await getFilm(filmId, userId);
  if (!film) return { ok: false, message: "Film not found." };
  const scene = film.scenes.find((s) => s.id === sceneId);
  if (!scene?.overlay) return { ok: false, message: "This scene has no overlay." };
  const ov = scene.overlay;

  switch (ov.engine) {
    case "media":
    case "reel":
    case "design": {
      if (!ov.sourceUrl) return { ok: false, message: "Attach a source for the overlay first." };
      const f = await patchOverlay(filmId, userId, sceneId, { status: "ready", progress: 100, videoUrl: ov.sourceUrl, thumbnailUrl: ov.thumbnailUrl || ov.sourceUrl });
      return { ok: true, film: f ?? undefined };
    }
    case "avatar": {
      if (!ov.script?.trim()) return { ok: false, message: "Write the overlay avatar's script first." };
      if (!ov.avatarId || !ov.voiceId) return { ok: false, message: "Pick an avatar and voice for the overlay." };
      const res = await startAvatarVideo({
        userId,
        state: {
          ...emptyAvatarState(), mode: "talking", script: ov.script,
          avatarId: ov.avatarId, avatarName: ov.avatarName || "", voiceId: ov.voiceId, voiceName: ov.voiceName || "",
          quality: ov.quality === "avatar_iv" ? "avatar_iv" : "standard", aspect: film.aspect, lengthSeconds: scene.durationSec || 30,
          captionsOn: false, voiceEmotion: ov.voiceEmotion ?? null, voiceSpeed: ov.voiceSpeed ?? null, motionPrompt: ov.motionPrompt ?? null,
        },
      });
      if (!res.ok) return { ok: false, message: res.message };
      const f = await patchOverlay(filmId, userId, sceneId, { status: "rendering", progress: 8, refKind: "avatar_video", refId: res.id });
      return { ok: true, film: f ?? undefined };
    }
    case "ai": {
      if (!ov.script?.trim()) return { ok: false, message: "Write the overlay shot prompt first." };
      const cost = await getDynamicCreditCost(AI_SCENE_COST_KEY).catch(() => 0);
      const block = await checkCreditsAvailable(userId, cost, false, false);
      if (block) return { ok: false, message: block.message };
      if (cost > 0) {
        const charge = await creditService.deductCredits({ userId, type: TRANSACTION_TYPES.USAGE, amount: cost, referenceType: "director_scene", referenceId: `${sceneId}:overlay`, description: "Video Director — overlay AI", metadata: { feature: AI_SCENE_COST_KEY, filmId } });
        if (!charge.success) return { ok: false, message: charge.error || "Could not charge credits." };
      }
      await patchOverlay(filmId, userId, sceneId, { status: "rendering", progress: 6, error: null });
      void renderAiOverlay(filmId, userId, sceneId, ov, film.aspect, cost);
      const f = await getFilm(filmId, userId);
      return { ok: true, film: f ?? undefined };
    }
  }
  return { ok: false, message: "Unknown overlay engine." };
}

/** Fire-and-forget AI overlay render → upload → mark the overlay ready. Refunds on failure. */
async function renderAiOverlay(filmId: string, userId: string, sceneId: string, ov: FilmOverlay, aspect: FilmAspect, cost: number): Promise<void> {
  try {
    const result = await generateVideoForRole("video_standard", {
      prompt: withVideoGuard(ov.script || ov.title || "overlay"),
      durationSeconds: 8,
      aspectRatio: aspect,
      onStatus: () => { void patchOverlay(filmId, userId, sceneId, { status: "rendering", progress: 55 }).catch(() => {}); },
    });
    const url = await uploadToS3(`director/${filmId}/${sceneId}-overlay-${uid()}.mp4`, result.videoBuffer, "video/mp4");
    await patchOverlay(filmId, userId, sceneId, { status: "ready", progress: 100, videoUrl: url });
  } catch (e) {
    if (cost > 0) await creditService.addCredits({ userId, type: TRANSACTION_TYPES.REFUND, amount: cost, referenceType: "director_scene", referenceId: `${sceneId}:overlay`, description: "Refund: Director overlay failed" }).catch(() => {});
    await patchOverlay(filmId, userId, sceneId, { status: "failed", error: sanitizeUserError(e, "video") }).catch(() => {});
  }
}

/** Fire-and-forget AI shot render → upload → mark ready. Refunds on failure. Never throws. */
async function renderAiScene(filmId: string, userId: string, sceneId: string, scene: FilmScene, aspect: FilmAspect, cost: number, castRefs: string[] = [], dialogue?: string, continuity = "", present: string[] = [], castVisualMode?: CastVisualMode): Promise<void> {
  try {
    let p = 8;
    // Stamp the render start so the watchdog can fail this scene if the worker
    // dies mid-render (e.g. a deploy) and leaves it stuck "rendering".
    await patchScene(filmId, userId, sceneId, { status: "rendering", progress: p, renderStartedAt: Date.now(), renderHeartbeatAt: Date.now() }).catch(() => {});
    // Fold the cast's spoken lines into the shot prompt as AUDIBLE dialogue (Veo
    // does native speech) — not on-screen captions, which the leak guard forbids.
    // The continuity bible keeps the shot in the film's shared world (location/wardrobe).
    const shot = scene.script || scene.title;
    // WHO is on screen — an exact, de-duped roster so the model renders each person ONCE
    // (kills the "duplicated/cloned cast" bug) and never invents extra speakers or lets a
    // background face answer the cast (kills the "someone unrelated responds" bug).
    const stagingLine = present.length
      ? `\n\nCAST ON SCREEN — exactly ${present.length} ${present.length === 1 ? "person appears" : "people appear"} in this shot: ${present.join("; ")}. Render EACH of them EXACTLY ONCE — never duplicate, clone, mirror or split a person into two. NO other speaking characters; any people in the background are out of focus, silent, and never react to or answer the cast.`
      : "";
    // Blocking + eyelines + action attribution — only when 2+ people talk, so nobody
    // talks to empty space and every gesture (a handshake) has a clear doer and receiver.
    const blockingLine = present.length >= 2 && dialogue
      ? `\n\nBLOCKING & EYELINES — stage the speakers in a clear two-shot FACING EACH OTHER; each person LOOKS AT the one they address (never at the camera, never into empty space) and the listener visibly reacts before replying. Every physical action is performed by a NAMED person toward a NAMED person (if hands are shaken, show WHO offers and WHO takes) — no ambiguous or unattributed gestures, no floating hands.`
      : "";
    // The DIALOGUE is the single most important instruction — the EXACT words spoken — so it
    // goes EARLY (right after who's-on-screen + blocking) and NEVER at the tail, where the
    // provider's prompt-length clamp could slice it off. That clamp is the real bug behind
    // "Amara said something completely different": her line was cut at "Th" before it ever
    // reached the model, so she improvised the rest.
    const dialogueBlock = dialogue
      ? `\n\nDIALOGUE — a real spoken exchange between the people on screen. Each line is spoken ALOUD and lip-synced by the EXACT named person (identify each speaker by the description in parentheses), addressing the OTHER named person present — the listener reacts, then replies, a natural back-and-forth. Each person speaks ONLY the exact words in quotes below, in this order — no invented or extra lines, nobody speaking another's line, and no voice from anyone off screen. Fill the shot with this conversation — no long silent pauses or dead air. Spoken audio on camera, NOT subtitles or on-screen text:\n${dialogue}`
      : "";
    // When we anchor on cast reference images, hard-lock face + WARDROBE so the model
    // doesn't restyle the clothes (the "clothing changed" drift of reference-to-video).
    const usingRefs = !scene.referenceImageUrl && castRefs.length > 0;
    const identityLine = usingRefs
      ? `\n\nIDENTITY — keep every person's face, hair, skin tone, build AND their clothing/wardrobe EXACTLY as established: the same individuals throughout, do NOT restyle, change, swap, or remove anyone's outfit.`
      : "";
    // A single generated clip must read as ONE unbroken take — otherwise, the moment the
    // implied camera angle shifts, the model re-imagines the whole environment (the "3
    // different backgrounds in one 15s scene" bug). Lock the location + camera for the clip.
    const singleTakeLine = `\n\nSINGLE CONTINUOUS TAKE — one unbroken shot in ONE fixed location. The camera may move GENTLY (a slow push-in or small pan) but must NEVER cut, jump, or switch to a different angle, room or background — the setting, walls, furniture, props and lighting stay EXACTLY the same first frame to last. No hard cuts, no scene changes, no montage.`;
    // Continuity bible = the film's shared world (location / palette / wardrobe). It's the
    // LONGEST and least-critical-per-shot block, so cap it and place it LAST — a length clamp
    // can then only ever trim the tail of THIS, never the dialogue or who's on screen.
    const contShort = !continuity ? "" : continuity.length <= 520 ? continuity : continuity.slice(0, 520).replace(/\s+\S*$/, "").trim() + "…";
    const continuityLine = contShort ? `\n\nCONTINUITY — keep the same place, lighting and clothes across the film: ${contShort}` : "";
    // Priority order: shot → who's on screen → blocking → DIALOGUE → camera → identity →
    // continuity. The most important instructions are first so a clamp only nibbles the tail.
    const shotWithDialogue = `${shot}${stagingLine}${blockingLine}${dialogueBlock}${singleTakeLine}${identityLine}${continuityLine}`;

    // How much clip does the dialogue need? Natural speech is ~2.2 words/sec, so a line
    // needs at least words/2.2 seconds — we grow the shot to fit so it isn't rushed (the
    // "10s clip swallowing ~50 words" defect).
    const REF2VID_MAX_SECONDS = 10;   // reference-to-video (natural motion) clip cap
    const IMG2VID_MAX_SECONDS = 15;   // scene-keyframe → image-to-video clip cap
    const spokenWords = (dialogue ? dialogue.match(/"([^"]*)"/g) || [] : [])
      .reduce((n, q) => n + q.replace(/"/g, "").trim().split(/\s+/).filter(Boolean).length, 0);
    const neededForSpeech = spokenWords ? Math.ceil(spokenWords / 2.2) : 0;
    const plannedSec = scene.durationSec || 9;

    // HYBRID render path. Default = REFERENCE-to-video (cast SHEETS anchor identity while
    // the model generates NATURAL, un-posed motion from scratch), which caps at ~10s. A
    // PIVOTAL beat — one the storyboard planned >10s, or whose dialogue simply needs >10s —
    // instead renders from a generated SCENE keyframe → IMAGE-to-video, confirmed to hold
    // 15s: 50% more room for the exchange, at the cost of a fixed first frame + slightly
    // more posed motion. An explicit product reference on the scene always wins as a first
    // frame; a scene with NO cast renders as a clean text-to-video clip.
    let firstFrameUrl: string | undefined = scene.referenceImageUrl || undefined;
    let refImages: string[] = [];
    if (!firstFrameUrl && castRefs.length) {
      const wantsPivotal = plannedSec > REF2VID_MAX_SECONDS || neededForSpeech > REF2VID_MAX_SECONDS;
      if (wantsPivotal) {
        // Build a real SCENE keyframe (the people IN the scene — NOT a headshot) that
        // carries cast identity, and use it as the first frame so the clip can run 15s.
        // AWAITED (unlike the poster path) because it IS the first frame; if it fails we
        // fall back to the natural 10s reference path rather than block the render.
        const key = await buildSceneKeyframe(filmId, userId, sceneId, scene, aspect, castRefs, continuity, castVisualMode);
        if (key) {
          firstFrameUrl = key;
          await patchScene(filmId, userId, sceneId, { thumbnailUrl: key }).catch(() => {});
        } else {
          refImages = castRefs;
        }
      } else {
        refImages = castRefs;
        // Keyframe still = a nice node POSTER only — best-effort, does NOT gate the render
        // (the video starts immediately from the reference images) and is NOT the first
        // frame. Starting the xAI job right away also means a restart during setup can
        // resume it (no keyframe-stage gap).
        void buildSceneKeyframe(filmId, userId, sceneId, scene, aspect, castRefs, continuity, castVisualMode)
          .then((key) => { if (key) void patchScene(filmId, userId, sceneId, { thumbnailUrl: key }).catch(() => {}); })
          .catch(() => {});
      }
    }

    // Clip ceiling for the chosen mode: image-to-video (a first frame) → 15s;
    // reference-to-video (cast sheets) → 10s; text-to-video (no anchors) → 15s.
    const modeMax = firstFrameUrl ? IMG2VID_MAX_SECONDS : refImages.length ? REF2VID_MAX_SECONDS : IMG2VID_MAX_SECONDS;
    const dialogueAwareSec = Math.min(modeMax, Math.max(plannedSec, neededForSpeech || plannedSec));
    if (neededForSpeech > modeMax) {
      console.warn(`[video-director] scene ${sceneId} dialogue overflows: ${spokenWords} words need ~${neededForSpeech}s but this clip caps at ${modeMax}s — it will rush. Split this beat across scenes.`);
    }

    // Time-based progress so the bar keeps MOVING while a slow provider works,
    // instead of freezing at a hard cap (the "stuck at 90%" complaint). Eases
    // smoothly toward ~96% and never quite lands until the ready patch snaps to 100.
    const videoStart = Date.now();
    const result = await withTimeout(
      generateVideoForRole("video_standard", {
        prompt: withVideoGuard(shotWithDialogue, scene.style, castVisualMode),
        // Reference-to-video renders one ≤10s clip; text-to-video one ≤15s clip (the
        // router caps per mode). durationSeconds is grown to fit the spoken dialogue so
        // the line isn't rushed, then capped by the router.
        durationSeconds: dialogueAwareSec,
        aspectRatio: aspect,
        // (1080p is not available for grok-imagine-video — verified; router defaults to 720p.)
        referenceImageUrl: firstFrameUrl,
        // Cast sheets → reference-to-video on Grok (natural motion + identity) / referenceImages on Veo.
        characterReferenceUrls: refImages,
        // Persist the provider job handle so a restart RESUMES this render (polls the
        // job, pulls the finished clip) instead of killing it. AWAITED (not fire-and-
        // forget) because the provider client awaits this callback BEFORE it begins its
        // 2-3 min poll — so the request id is committed to the DB before any long wait.
        // Fire-and-forget here RACED a restart and dropped the handle, so the resume had
        // nothing to poll and declared "interrupted" even though Grok finished the video.
        onJobId: async (info) => { await patchScene(filmId, userId, sceneId, { refKind: info.provider, refId: info.jobId }).catch(() => {}); },
        onStatus: () => {
          const elapsed = Date.now() - videoStart;
          const est = 22 + Math.round((1 - Math.exp(-elapsed / (3 * 60 * 1000))) * 74); // 22 → ~96 asymptote
          void patchScene(filmId, userId, sceneId, { status: "rendering", progress: Math.min(96, Math.max(p, est)), renderHeartbeatAt: Date.now() }).catch(() => {});
        },
      }),
      AI_SCENE_TIMEOUT_MS,
      "This shot took too long and timed out.",
    );
    const url = await uploadToS3(`director/${filmId}/${sceneId}-${uid()}.mp4`, result.videoBuffer, "video/mp4");
    await patchScene(filmId, userId, sceneId, { status: "ready", progress: 100, videoUrl: url });
  } catch (e) {
    if (cost > 0) {
      await creditService.addCredits({
        userId, type: TRANSACTION_TYPES.REFUND, amount: cost,
        referenceType: "director_scene", referenceId: sceneId, description: "Refund: Director AI scene failed",
      }).catch(() => {});
    }
    console.error("[video-director] AI scene render failed:", e);
    await patchScene(filmId, userId, sceneId, { status: "failed", error: sanitizeUserError(e, "video") }).catch(() => {});
  } finally {
    // This render freed a slot — pull the next QUEUED scene of a batch (if any).
    void drainDirectorRenders(filmId, userId).catch(() => {});
  }
}

/** Extend a ready AI scene from its actual last frame, then keep only the new
 * segment so the continuation remains an independent node on the timeline. */
async function renderAiContinuation(
  filmId: string,
  userId: string,
  sceneId: string,
  scene: FilmScene,
  source: FilmScene,
  sourceVideoUrl: string,
  aspect: FilmAspect,
  cost: number,
  dialogue?: string,
  continuity = "",
): Promise<void> {
  try {
    const started = Date.now();
    await patchScene(filmId, userId, sceneId, {
      status: "rendering", progress: 8, renderStartedAt: started, renderHeartbeatAt: started, error: null,
    });
    const extensionSeconds = Math.min(10, Math.max(2, Math.round(scene.durationSec || 6)));
    const dialogueLine = dialogue
      ? `\n\nSpoken dialogue in the continuation, exactly as written and lip-synced by the named speaker:\n${dialogue}`
      : "";
    const continuityLine = continuity
      ? `\n\nKeep the established film continuity: ${continuity.slice(0, 700)}`
      : "";
    const prompt =
      `Continue seamlessly from the source video's final frame. ${scene.script || scene.title}` +
      dialogueLine + continuityLine +
      "\n\nThis is the immediate next moment of the same shot. Preserve the exact people, faces, wardrobe, location, props, lighting, camera direction, visual style, and audio character already present. Do not repeat the previous action, restart the scene, cut to a new location, add captions, or introduce unrequested people.";

    const result = await withTimeout(
      grokVideoClient.extendVideo(sourceVideoUrl, prompt, {
        duration: extensionSeconds,
        timeoutMs: AI_SCENE_TIMEOUT_MS,
        onJobId: async (requestId) => {
          await patchScene(filmId, userId, sceneId, {
            refKind: "grok", refId: requestId, status: "rendering", renderHeartbeatAt: Date.now(),
          }).catch(() => {});
        },
        onStatus: () => {
          const elapsed = Date.now() - started;
          const progress = 18 + Math.round((1 - Math.exp(-elapsed / (3 * 60 * 1000))) * 78);
          void patchScene(filmId, userId, sceneId, {
            status: "rendering", progress: Math.min(96, progress), renderHeartbeatAt: Date.now(),
          }).catch(() => {});
        },
      }),
      AI_SCENE_TIMEOUT_MS,
      "This continuation took too long and timed out.",
    );
    const segment = await extractContinuationSegment(
      result.videoBuffer, aspect, extensionSeconds, playedLenOf(source), result.duration,
    );
    const url = await uploadToS3(`director/${filmId}/${sceneId}-continuation-${uid()}.mp4`, segment, "video/mp4");
    await patchScene(filmId, userId, sceneId, {
      status: "ready", progress: 100, durationSec: extensionSeconds, videoUrl: url, error: null,
    });
  } catch (e) {
    if (cost > 0) {
      await creditService.addCredits({
        userId, type: TRANSACTION_TYPES.REFUND, amount: cost,
        referenceType: "director_scene", referenceId: sceneId,
        description: "Refund: Director exact continuation failed",
      }).catch(() => {});
    }
    console.error(`[video-director] continuation failed for ${sceneId}:`, e);
    await patchScene(filmId, userId, sceneId, {
      status: "failed", error: sanitizeUserError(e, "video"),
    }).catch(() => {});
  }
}

/** Fire-and-forget xAI edit. The scene's current videoUrl is not touched until
 * the edited result has been downloaded and durably uploaded to our storage. */
async function renderSceneVideoEdit(filmId: string, userId: string, sceneId: string, editId: string): Promise<void> {
  const initial = await getFilm(filmId, userId);
  const scene = initial?.scenes.find((s) => s.id === sceneId);
  const edit = scene?.videoEdit;
  if (!scene || !edit || edit.id !== editId) return;

  try {
    await patchVideoEdit(filmId, userId, sceneId, { status: "rendering", progress: 8, heartbeatAt: Date.now(), error: null });
    const started = Date.now();
    const providerPrompt =
      `Make only this targeted correction to the existing video: ${edit.prompt}\n\n` +
      "Preserve everything else exactly: the same people and identity, wardrobe, dialogue and audio, timing, camera movement, framing, lighting, background, and duration. Do not add text, captions, logos, new people, new dialogue, or a new shot.";
    const result = await grokVideoClient.editVideo(edit.sourceVideoUrl, providerPrompt, {
      timeoutMs: AI_SCENE_TIMEOUT_MS,
      onJobId: async (requestId) => {
        await patchVideoEdit(filmId, userId, sceneId, { refId: requestId, status: "rendering", heartbeatAt: Date.now() }).catch(() => {});
      },
      onStatus: () => {
        const elapsed = Date.now() - started;
        const progress = 18 + Math.round((1 - Math.exp(-elapsed / (3 * 60 * 1000))) * 78);
        void patchVideoEdit(filmId, userId, sceneId, {
          status: "rendering",
          progress: Math.min(96, progress),
          heartbeatAt: Date.now(),
        }).catch(() => {});
      },
    });
    const finalBuffer = await restoreEditedClipAudio(result.videoBuffer, edit.sourceVideoUrl);
    const editedUrl = await uploadToS3(`director/${filmId}/${sceneId}-edit-${uid()}.mp4`, finalBuffer, "video/mp4");
    const fresh = await getFilm(filmId, userId);
    const current = fresh?.scenes.find((s) => s.id === sceneId);
    if (!current?.videoEdit || current.videoEdit.id !== editId) return;
    await patchScene(filmId, userId, sceneId, {
      videoUrl: editedUrl,
      durationSec: edit.durationSec || current.durationSec,
      clipStart: undefined,
      clipEnd: undefined,
      videoEdit: { ...current.videoEdit, status: "ready", progress: 100, refId: undefined, error: null },
    });
  } catch (e) {
    const fresh = await getFilm(filmId, userId).catch(() => null);
    const current = fresh?.scenes.find((s) => s.id === sceneId)?.videoEdit;
    if (!current || current.id !== editId) return;
    await refundVideoEdit(userId, sceneId, current);
    console.error(`[video-director] xAI edit failed for ${sceneId}:`, e instanceof Error ? e.message : e);
    await patchVideoEdit(filmId, userId, sceneId, { status: "failed", error: sanitizeUserError(e, "video") }).catch(() => {});
  }
}

/**
 * Reconcile scenes whose render lives in another table (avatar → CartoonVideo)
 * back onto the film. Called on each GET poll so the canvas reflects live status.
 * AI/media/design update themselves in-process, so only external refs need this.
 */
// Resume tuning. A live AI render beats a heartbeat every ~15s (onStatus), so no
// beat for STALE_MS ⇒ the in-process worker died (deploy/restart). We then RESUME
// from the persisted provider job instead of failing — the provider kept rendering
// (and billing us). Only give up after RESUME_MAX_MS, or right away if there's no
// job handle to resume (it died before/at submit, or the keyframe hung).
const AI_SCENE_STALE_MS = 60_000;        // 4 missed 15s heartbeats ⇒ dead worker
const AI_SCENE_REPOLL_MS = 20_000;       // once resuming, re-poll the provider every ~20s
const AI_SCENE_RESUME_MAX_MS = 25 * 60 * 1000; // provider still not done ⇒ give up + refund
const AI_SCENE_NO_HANDLE_MS = 3 * 60 * 1000;   // dead with no job to resume ⇒ unrecoverable

async function refundAiScene(userId: string, filmId: string, sceneId: string): Promise<void> {
  const refund = await getDynamicCreditCost(AI_SCENE_COST_KEY).catch(() => 0);
  if (refund > 0) {
    await creditService.addCredits({
      userId, type: TRANSACTION_TYPES.REFUND, amount: refund,
      referenceType: "director_scene", referenceId: sceneId, description: "Refund: Director AI scene interrupted",
    }).catch(() => {});
  }
}

async function refundVideoEdit(userId: string, sceneId: string, edit: FilmVideoEdit): Promise<void> {
  const refund = typeof edit.cost === "number" ? edit.cost : await getDynamicCreditCost(AI_SCENE_COST_KEY).catch(() => 0);
  if (refund > 0) {
    await creditService.addCredits({
      userId, type: TRANSACTION_TYPES.REFUND, amount: refund,
      referenceType: "director_scene", referenceId: `${sceneId}:edit:${edit.id}`,
      description: "Refund: Director xAI video edit failed",
    }).catch(() => {});
  }
}

/**
 * RESUME (or fail) a Director AI scene whose in-process worker died on a restart.
 * Polls the persisted provider job: done → pull the finished clip + mark ready;
 * failed / genuinely-stuck / no-handle → fail + refund; still pending → leave it
 * rendering (re-checked on a later poll). Mutates the scene in place and returns
 * the recovery outcome. Never resumes a LIVE render (fresh heartbeat ⇒ left alone).
 */
type AiSceneRecoveryState = "unchanged" | "processing" | "ready" | "failed" | "unavailable";

async function resumeOrphanedAiScene(
  film: FilmProject,
  s: FilmScene,
  userId: string,
  now: number,
  force = false,
): Promise<AiSceneRecoveryState> {
  const lastBeat = s.renderHeartbeatAt || s.renderStartedAt || 0;
  if (!force && now - lastBeat < AI_SCENE_STALE_MS) return "unchanged"; // a live worker is still on it
  const startedAgo = s.renderStartedAt ? now - s.renderStartedAt : Infinity;
  const wasAlreadyFailed = s.status === "failed";
  const failRefund = async (msg: string, terminalProviderJob = false) => {
    s.status = "failed";
    s.error = msg;
    // A terminal provider result cannot ever become downloadable. Dropping the
    // handle stops the open-project poller from checking it forever.
    if (terminalProviderJob) { s.refKind = undefined; s.refId = undefined; }
    if (!wasAlreadyFailed) await refundAiScene(userId, film.id, s.id);
  };

  // No resumable provider handle ⇒ died before/at submit (or the keyframe hung).
  if (!s.refId || (s.refKind !== "grok" && s.refKind !== "veo3")) {
    if (startedAgo > AI_SCENE_NO_HANDLE_MS) { await failRefund("This shot was interrupted — please try again."); return "failed"; }
    return "unavailable"; // give the submit a little more grace
  }

  try {
    const done = async (buf: Buffer, providerDuration?: number) => {
      let finalBuffer = buf;
      let keySuffix = "";
      if (s.continuationMode === "exact") {
        const extensionSeconds = Math.min(10, Math.max(2, Math.round(s.durationSec || 6)));
        const source = film.scenes.find((candidate) => candidate.id === s.continuationOf);
        const sourceSeconds = source
          ? playedLenOf(source)
          : Math.max(2, (providerDuration || extensionSeconds + 2) - extensionSeconds);
        finalBuffer = await extractContinuationSegment(buf, film.aspect, extensionSeconds, sourceSeconds, providerDuration);
        s.durationSec = extensionSeconds;
        keySuffix = "-continuation";
      }
      const url = await uploadToS3(`director/${film.id}/${s.id}${keySuffix}-${uid()}.mp4`, finalBuffer, "video/mp4");
      s.status = "ready"; s.progress = 100; s.videoUrl = url; s.error = null;
    };
    if (s.refKind === "grok") {
      const st = await grokVideoClient.pollOnce(s.refId);
      if (st.state === "failed") {
        // Rate limits and provider 5xx responses are temporary status-check
        // failures, not proof that the saved video job itself failed.
        if (/^status (429|5\d\d)$/i.test(st.error || "")) throw new Error(st.error);
        await failRefund(`This shot couldn't finish${st.error ? ` (${st.error})` : ""} — please try again.`, true);
        return "failed";
      }
      if (st.state === "done" && st.url) { await done(await grokVideoClient.fetchVideoBuffer(st.url), st.duration); return "ready"; }
    } else {
      const st = await veoClient.pollOnceByName(s.refId);
      if (st.state === "failed") { await failRefund(`This shot couldn't finish${st.error ? ` (${st.error})` : ""} — please try again.`, true); return "failed"; }
      if (st.state === "done" && st.uri) { await done(await veoClient.fetchVideoByUri(st.uri)); return "ready"; }
    }
    // Still pending (or an unknown Veo poll) — keep waiting, age-bounded.
    if (startedAgo > AI_SCENE_RESUME_MAX_MS) { await failRefund("This shot took too long — please try again.", true); return "failed"; }
    s.renderHeartbeatAt = now - (AI_SCENE_STALE_MS - AI_SCENE_REPOLL_MS); // re-poll in ~20s, not every tick
    return "processing";
  } catch (e) {
    console.error(`[video-director] scene resume failed for ${s.id}:`, e instanceof Error ? e.message : e);
    if (startedAgo > AI_SCENE_RESUME_MAX_MS) { await failRefund("This shot couldn't be recovered — please try again.", true); return "failed"; }
    return "unavailable"; // transient provider error — a later poll retries
  }
}

/** Resume a saved xAI edit job independently from the base scene render. */
async function resumeOrphanedVideoEdit(
  film: FilmProject,
  scene: FilmScene,
  userId: string,
  now: number,
): Promise<AiSceneRecoveryState> {
  const edit = scene.videoEdit;
  if (!edit || (edit.status !== "queued" && edit.status !== "rendering" && !(edit.status === "failed" && edit.refId))) {
    return "unchanged";
  }
  const lastBeat = edit.heartbeatAt || edit.startedAt || 0;
  if (now - lastBeat < AI_SCENE_STALE_MS) return "unchanged";
  const startedAgo = edit.startedAt ? now - edit.startedAt : Infinity;
  const wasAlreadyFailed = edit.status === "failed";
  const failRefund = async (message: string, terminalProviderJob = false) => {
    edit.status = "failed";
    edit.error = message;
    if (terminalProviderJob) edit.refId = undefined;
    if (!wasAlreadyFailed) await refundVideoEdit(userId, scene.id, edit);
  };

  if (!edit.refId) {
    if (startedAgo > AI_SCENE_NO_HANDLE_MS) {
      await failRefund("This video edit was interrupted before xAI returned a job ID.");
      return "failed";
    }
    return "unavailable";
  }

  try {
    const status = await grokVideoClient.pollOnce(edit.refId);
    if (status.state === "failed") {
      if (/^status (429|5\d\d)$/i.test(status.error || "")) throw new Error(status.error);
      await failRefund(`xAI could not finish this video edit${status.error ? ` (${status.error})` : ""}.`, true);
      return "failed";
    }
    if (status.state === "done" && status.url) {
      const buffer = await grokVideoClient.fetchVideoBuffer(status.url);
      const finalBuffer = await restoreEditedClipAudio(buffer, edit.sourceVideoUrl);
      const editedUrl = await uploadToS3(`director/${film.id}/${scene.id}-edit-${uid()}.mp4`, finalBuffer, "video/mp4");
      scene.videoUrl = editedUrl;
      scene.durationSec = edit.durationSec || scene.durationSec;
      scene.clipStart = undefined;
      scene.clipEnd = undefined;
      edit.status = "ready";
      edit.progress = 100;
      edit.refId = undefined;
      edit.error = null;
      return "ready";
    }
    if (startedAgo > AI_SCENE_RESUME_MAX_MS) {
      await failRefund("This video edit took too long to finish.", true);
      return "failed";
    }
    edit.status = "rendering";
    edit.progress = Math.max(12, edit.progress || 0);
    edit.heartbeatAt = now - (AI_SCENE_STALE_MS - AI_SCENE_REPOLL_MS);
    return "processing";
  } catch (e) {
    console.error(`[video-director] edit resume failed for ${scene.id}:`, e instanceof Error ? e.message : e);
    if (startedAgo > AI_SCENE_RESUME_MAX_MS) {
      await failRefund("This video edit could not be recovered.", true);
      return "failed";
    }
    return "unavailable";
  }
}

export interface RecoverSceneResult extends GenerateResult {
  state?: Exclude<AiSceneRecoveryState, "unchanged">;
}

/** Force one status check against the scene's saved Grok/Veo job. This never
 * creates or charges for a new render; it only pulls the existing provider job. */
export async function recoverSceneRender(filmId: string, userId: string, sceneId: string): Promise<RecoverSceneResult> {
  const film = await getFilm(filmId, userId);
  if (!film) return { ok: false, message: "Film not found." };
  const scene = film.scenes.find((s) => s.id === sceneId);
  if (!scene) return { ok: false, message: "Scene not found." };
  if (scene.engine !== "ai") return { ok: false, message: "Only AI scenes have a provider render to pull." };
  if (!scene.refId || (scene.refKind !== "grok" && scene.refKind !== "veo3")) {
    return { ok: false, message: "No saved provider request is attached to this render. Generate starts a new render." };
  }

  const state = await resumeOrphanedAiScene(film, scene, userId, Date.now(), true);
  if (state !== "unchanged" && state !== "unavailable") await saveFilm(film.id, userId, film);
  return {
    ok: true,
    film,
    state: state === "unchanged" ? "processing" : state,
    message: state === "ready"
      ? "The finished video was pulled into this scene."
      : state === "failed"
        ? scene.error || "The provider could not finish this render."
        : state === "unavailable"
          ? "The provider could not be reached. Try pulling again in a moment."
          : "The provider is still rendering this video.",
  };
}

export async function syncFilmScenes(film: FilmProject, userId: string): Promise<FilmProject> {
  let changed = false;

  // An AI scene stuck "rendering" with a stale heartbeat means its in-process worker
  // died (a deploy pm2-reloads the app). Instead of just failing it, RESUME from the
  // persisted xAI/Veo job — the provider kept rendering — and only fail if it's truly
  // gone. This is why a deploy mid-render no longer loses the shot.
  const now = Date.now();
  for (const s of film.scenes) {
    const canResumeFailed = s.status === "failed" && !!s.refId && (s.refKind === "grok" || s.refKind === "veo3");
    if (s.engine === "ai" && (s.status === "rendering" || canResumeFailed)) {
      const state = await resumeOrphanedAiScene(film, s, userId, now);
      if (state !== "unchanged" && state !== "unavailable") changed = true;
    }
  }
  for (const s of film.scenes) {
    const state = await resumeOrphanedVideoEdit(film, s, userId, now);
    if (state !== "unchanged" && state !== "unavailable") changed = true;
  }

  const syncAvatarRef = async (t: { refKind?: string; refId?: string; status: string; progress?: number; videoUrl?: string | null; thumbnailUrl?: string | null; error?: string | null }, failMsg: string): Promise<boolean> => {
    if (t.refKind !== "avatar_video" || !t.refId || (t.status !== "rendering" && t.status !== "queued")) return false;
    const av = await getAvatarVideo(t.refId, userId).catch(() => null);
    if (!av) return false;
    const st = (av.row.status || "").toUpperCase();
    if (st === "COMPLETED" && av.row.videoUrl) { t.status = "ready"; t.progress = 100; t.videoUrl = av.row.videoUrl; t.thumbnailUrl = av.row.thumbnailUrl || t.thumbnailUrl; return true; }
    if (st === "FAILED") { t.status = "failed"; t.error = av.row.errorMessage || failMsg; return true; }
    const p = Math.max(8, av.row.progress || 10);
    if (p !== t.progress) { t.progress = p; t.status = "rendering"; return true; }
    return false;
  };
  for (const s of film.scenes) {
    if (await syncAvatarRef(s, "Avatar render failed")) changed = true;
    if (s.overlay && (await syncAvatarRef(s.overlay, "Overlay render failed"))) changed = true;
  }
  if (changed) await saveFilm(film.id, userId, film);
  // Batch safety net: if scenes are QUEUED and a slot is free (e.g. an event-driven
  // refill was lost to a restart), pull the next one now. Fire-and-forget, fresh read.
  if (film.scenes.some((s) => s.status === "queued")) void drainDirectorRenders(film.id, userId).catch(() => {});
  return film;
}

/**
 * Cron entry (recover-tasks, every ~3 min): resume orphaned Director AI scenes even
 * for films NOT currently open in a browser — syncFilmScenes only runs while the
 * canvas is being polled. Scans recently-touched director films for a stale
 * "rendering" AI scene and resumes/fails it from the persisted provider job. Never throws.
 */
export async function resumeStuckDirectorScenes(): Promise<{ scanned: number; changed: number }> {
  const now = Date.now();
  const cutoff = new Date(now - AI_SCENE_STALE_MS);
  let changed = 0;
  const rows = await prisma.design
    .findMany({
      where: { type: "director_film", updatedAt: { lt: cutoff } },
      select: { id: true, userId: true, canvasData: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    })
    .catch(() => [] as { id: string; userId: string; canvasData: string | null }[]);
  for (const row of rows) {
    // Cheap pre-filter: parse live renders, plus failed scenes that still have a
    // provider handle we may be able to pull.
    if (!row.canvasData || (!row.canvasData.includes('"rendering"') && !row.canvasData.includes('"queued"') && !(row.canvasData.includes('"failed"') && row.canvasData.includes('"refId"')))) continue;
    const film = await getFilm(row.id, row.userId).catch(() => null);
    if (!film) continue;
    let touched = false;
    for (const s of film.scenes) {
      const canResumeFailed = s.status === "failed" && !!s.refId && (s.refKind === "grok" || s.refKind === "veo3");
      if (s.engine === "ai" && (s.status === "rendering" || canResumeFailed)) {
        const state = await resumeOrphanedAiScene(film, s, row.userId, now);
        if (state !== "unchanged" && state !== "unavailable") touched = true;
      }
      const editState = await resumeOrphanedVideoEdit(film, s, row.userId, now);
      if (editState !== "unchanged" && editState !== "unavailable") touched = true;
    }
    if (touched) { await saveFilm(row.id, row.userId, film).catch(() => {}); changed++; }
    // Persistence net for the batch: keep a queued film's pipeline flowing even when
    // no browser is open (e.g. all renders died on a deploy) — pull the next queued scenes.
    if (film.scenes.some((s) => s.status === "queued")) { await drainDirectorRenders(row.id, row.userId).catch(() => {}); changed++; }
  }
  if (changed) console.log(`[video-director] resumeStuckDirectorScenes: touched ${changed} film(s)`);
  return { scanned: rows.length, changed };
}

/**
 * Stitch the ready scenes (in order) into one film. Every scene is normalised to
 * the film's exact dimensions with a uniform audio track first — stills → held
 * clips, reel sources → trimmed clips, AI/avatar MP4s → reframed (VO kept) — so
 * the mixed-provider outputs concat cleanly. Fire-and-forget; poll finalStatus.
 * Never throws.
 */
/** A branded outro clip: a REAL on-brand (AI-generated) background + the
 *  animated logo. Best-effort — returns null if image-gen / ffmpeg is
 *  unavailable, so composition never breaks on the outro. */
interface OutroBrand {
  primary?: string | null; secondary?: string | null; accent?: string | null;
  name?: string | null; industry?: string | null; filmStyle?: string | null;
}
async function buildDirectorOutro(logoSource: string, aspect: FilmAspect, brand: OutroBrand): Promise<Buffer | null> {
  const brandColor = typeof brand.primary === "string" ? brand.primary : null;
  let bgImage: Buffer | null = null;
  try {
    const [iw, ih] = aspect === "9:16" ? [1024, 1536] : aspect === "16:9" ? [1536, 1024] : [1024, 1024];
    // Brand the backdrop on the CLIENT's identity — their palette, industry and
    // the film's look — so the outro feels like an extension of the brand.
    const palette = [
      brand.primary ? `primary ${brand.primary}` : null,
      brand.secondary ? `secondary ${brand.secondary}` : null,
      brand.accent ? `accent ${brand.accent}` : null,
    ].filter(Boolean).join(", ");
    const mood = brand.filmStyle === "3d"
      ? "clean stylized 3D-render lighting, glossy surfaces"
      : "soft cinematic photographic light with elegant out-of-focus bokeh";
    const prompt =
      `A premium ABSTRACT brand end-card background for ${brand.name || "a brand"}${brand.industry ? ` (${brand.industry})` : ""}: ${mood}, tasteful depth, unmistakably on-brand` +
      `${palette ? `, built entirely from the brand palette — ${palette}` : ", in deep tasteful brand tones"}, with a calmer darker area toward the centre for a logo. ` +
      `Absolutely NO text, NO letters, NO numbers, NO logo, NO watermark, NO people, NO products — only an atmospheric on-brand backdrop.`;
    const res = await generateImageXaiFirst(prompt, iw, ih, { quality: "high" });
    if (res.base64) bgImage = Buffer.from(res.base64, "base64");
  } catch (e) {
    console.warn("[video-director] outro background gen failed; using colour card:", e instanceof Error ? e.message : e);
  }
  return buildBrandOutroClip({ logoSource, aspectRatio: aspect, brandColor, durationSec: 3, backgroundImage: bgImage });
}

export async function composeFilm(filmId: string, userId: string): Promise<void> {
  try {
    const film = await getFilm(filmId, userId);
    if (!film) return;
    const { w, h } = filmDims(film.aspect);
    const ordered = [...film.scenes].sort((a, b) => a.order - b.order).filter((s) => s.status === "ready" && (isVideoUrl(s.videoUrl) || isImageUrl(s.videoUrl)));
    if (ordered.length === 0) throw new Error("Generate at least one scene before stitching.");

    const built: { buf: Buffer; dur: number; transition?: string }[] = [];
    for (const s of ordered) {
      const res = await fetch(s.videoUrl as string).catch(() => null);
      if (!res?.ok) continue;
      const raw = Buffer.from(await res.arrayBuffer());
      try {
        let buf: Buffer;
        if (isImageUrl(s.videoUrl)) {
          buf = await imageToClip(raw, s.durationSec || 3, w, h);
        } else {
          // Keep the avatar/AI voiceover; reel/media b-roll gets a uniform silent track.
          const preferSourceAudio = s.engine === "avatar" || s.engine === "ai";
          const trim = typeof s.clipStart === "number" && typeof s.clipEnd === "number" && s.clipEnd > s.clipStart
            ? { start: s.clipStart, end: s.clipEnd } : undefined;
          buf = await normalizeClip(raw, w, h, { preferSourceAudio, trim });
        }
        // PiP overlay — composite a ready presenter/media inset on top of the base.
        if (s.overlay?.status === "ready" && s.overlay.videoUrl && /^https?:\/\//i.test(s.overlay.videoUrl)) {
          try {
            const ores = await fetch(s.overlay.videoUrl);
            if (ores.ok) buf = await compositeOverlay(buf, Buffer.from(await ores.arrayBuffer()), s.overlay.corner, s.overlay.scale);
          } catch (e) {
            console.error(`[video-director] overlay composite skipped for scene ${s.id}:`, e instanceof Error ? e.message : e);
          }
        }
        built.push({ buf, dur: playedLenOf(s), transition: s.transitionIn });
      } catch (e) {
        console.error(`[video-director] clip build failed for scene ${s.id}:`, e instanceof Error ? e.message : e);
      }
    }
    if (built.length === 0) throw new Error("Could not assemble any scene clips.");

    let finalBuffer = built.length === 1 ? built[0].buf : await assembleClips(built);

    // Film-level visual stack from the inline composer. Layers are applied in
    // z-order after scene assembly so their normalized coordinates match the
    // final output frame exactly, regardless of source clip dimensions.
    const composer = film.composer;
    const visualLayers = [...(composer?.layers || [])]
      .filter((layer) => layer.type !== "audio")
      .sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of visualLayers) {
      try {
        if (layer.type === "text" && layer.text?.trim()) {
          finalBuffer = await compositeTimedText(finalBuffer, w, h, {
            text: layer.text.trim(), x: layer.x, y: layer.y, font: layer.font || "sans",
            fontSize: layer.fontSize || 44, color: layer.color || "#ffffff",
            backgroundColor: layer.backgroundColor || "#000000", opacity: layer.opacity,
            startSec: layer.startSec, endSec: layer.endSec,
          });
        } else if (layer.sourceUrl && (layer.type === "image" || layer.type === "logo" || layer.type === "video")) {
          const source = await fetch(layer.sourceUrl);
          if (!source.ok) continue;
          finalBuffer = await compositeTimedMedia(finalBuffer, Buffer.from(await source.arrayBuffer()), w, h, {
            kind: layer.type === "video" ? "video" : "image", x: layer.x, y: layer.y,
            width: layer.width, opacity: layer.opacity, startSec: layer.startSec,
            endSec: layer.endSec, volume: layer.volume,
          });
        }
      } catch (e) {
        console.error(`[video-director] composer layer ${layer.id} skipped:`, e instanceof Error ? e.message : e);
      }
    }

    // Generated captions use the approved screenplay dialogue and scene timing,
    // then burn the chosen font/style into the final film.
    if (composer?.captions.enabled) {
      let cueStart = 0;
      for (const scene of ordered) {
        const duration = playedLenOf(scene);
        const caption = scene.captionsOn
          ? (scene.cast || []).filter((line) => line.dialogue?.trim()).map((line) => `${line.name}: ${line.dialogue!.trim()}`).join("\n")
          : "";
        if (caption) {
          try {
            finalBuffer = await compositeTimedText(finalBuffer, w, h, {
              text: wrapComposerText(caption, film.aspect === "9:16" ? 28 : 46),
              x: "center", y: composer.captions.position, font: composer.captions.font,
              fontSize: composer.captions.fontSize, color: composer.captions.color,
              backgroundColor: composer.captions.backgroundColor, opacity: 1,
              startSec: cueStart, endSec: cueStart + duration,
              boxed: composer.captions.style === "boxed",
              shadow: composer.captions.style === "cinematic",
            });
          } catch (e) {
            console.error(`[video-director] caption for ${scene.id} skipped:`, e instanceof Error ? e.message : e);
          }
        }
        cueStart += duration;
      }
    }

    // Additional uploaded audio tracks are timed independently of the music bed.
    for (const layer of (composer?.layers || []).filter((candidate) => candidate.type === "audio" && candidate.sourceUrl)) {
      try {
        const source = await fetch(layer.sourceUrl!);
        if (source.ok) finalBuffer = await mixTimedAudio(finalBuffer, Buffer.from(await source.arrayBuffer()), layer.startSec, layer.endSec, layer.volume);
      } catch (e) {
        console.error(`[video-director] audio layer ${layer.id} skipped:`, e instanceof Error ? e.message : e);
      }
    }

    // Music bed — mix the film-level track under everything (best-effort).
    if (film.music && /^https?:\/\//i.test(film.music)) {
      try {
        const mres = await fetch(film.music);
        if (mres.ok) finalBuffer = await mixMusicUnder(finalBuffer, Buffer.from(await mres.arrayBuffer()), composer?.musicVolume ?? 0.28);
      } catch (e) {
        console.error(`[video-director] music mix skipped for ${filmId}:`, e instanceof Error ? e.message : e);
      }
    }

    // Brand logo overlay + a proper branded OUTRO — a REAL on-brand (AI) backdrop
    // with the animated logo, so the film ends on the brand, not a flat colour
    // card. All best-effort: any failure leaves the film unchanged.
    if (film.brandLogo !== false) {
      try {
        const bk = await prisma.brandKit.findFirst({ where: { userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: { logo: true, iconLogo: true, colors: true, name: true, industry: true } });
        const logo = bk?.iconLogo || bk?.logo || null;
        if (logo) {
          finalBuffer = await overlayBrandLogoOnVideo(finalBuffer, logo);
          try {
            let colors: { primary?: string; secondary?: string; accent?: string } = {};
            try { const c = bk?.colors ? JSON.parse(bk.colors) : null; if (c && typeof c === "object") colors = c as typeof colors; } catch { /* ignore */ }
            const outro = await buildDirectorOutro(logo, film.aspect, {
              primary: colors.primary ?? null, secondary: colors.secondary ?? null, accent: colors.accent ?? null,
              name: bk?.name ?? null, industry: bk?.industry ?? null, filmStyle: film.style ?? null,
            });
            if (outro) {
              const outroFit = await normalizeClip(outro, w, h, { preferSourceAudio: false });
              finalBuffer = await concatenateVideoBuffers([finalBuffer, outroFit]);
            }
          } catch (e) {
            console.error(`[video-director] outro skipped for ${filmId}:`, e instanceof Error ? e.message : e);
          }
        }
      } catch (e) {
        console.error(`[video-director] brand-logo overlay skipped for ${filmId}:`, e instanceof Error ? e.message : e);
      }
    }

    const url = await uploadToS3(`director/${filmId}/final-${uid()}.mp4`, finalBuffer, "video/mp4");

    const fresh = await getFilm(filmId, userId);
    if (!fresh) return;
    fresh.finalVideoUrl = url; fresh.finalStatus = "ready"; fresh.finalProgress = 100;
    await saveFilm(filmId, userId, fresh);
  } catch (e) {
    console.error(`[video-director] compose failed for ${filmId}:`, e instanceof Error ? e.message : e);
    const fresh = await getFilm(filmId, userId);
    if (fresh) { fresh.finalStatus = "failed"; await saveFilm(filmId, userId, fresh); }
  }
}

function wrapComposerText(text: string, maxChars: number): string {
  return text.split("\n").flatMap((line) => {
    const words = line.split(/\s+/).filter(Boolean);
    const rows: string[] = [];
    let row = "";
    for (const word of words) {
      if (row && `${row} ${word}`.length > maxChars) { rows.push(row); row = word; }
      else row = row ? `${row} ${word}` : word;
    }
    if (row) rows.push(row);
    return rows;
  }).join("\n");
}

/**
 * Join clips in order, cross-fading where a scene requests a transition and hard-
 * cutting otherwise. Built pairwise (accumulate + xfade/concat each next clip) so
 * one bad step can't corrupt a giant filter graph. Falls back to a plain concat if
 * a transition step fails, so the film always renders.
 */
async function assembleClips(built: { buf: Buffer; dur: number; transition?: string }[]): Promise<Buffer> {
  try {
    let acc = built[0].buf;
    let accDur = built[0].dur;
    for (let i = 1; i < built.length; i++) {
      const c = built[i];
      if (c.transition && c.transition !== "cut") {
        acc = await crossfadePair(acc, c.buf, accDur, XFADE_DUR, xfadeName(c.transition));
        accDur = accDur + c.dur - XFADE_DUR;
      } else {
        acc = await concatenateVideoBuffers([acc, c.buf]);
        accDur = accDur + c.dur;
      }
    }
    return acc;
  } catch (e) {
    console.error("[video-director] transition assembly failed — falling back to hard cuts:", e instanceof Error ? e.message : e);
    return concatenateVideoBuffers(built.map((b) => b.buf));
  }
}
