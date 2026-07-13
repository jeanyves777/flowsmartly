/**
 * Engine bridges — a Director scene renders on the engine it already uses today.
 * Nothing here reimplements a generator; it dispatches to the existing avatar /
 * AI-video pipelines, then reconciles their status back onto the scene, and
 * stitches the ready clips into one film with the shared concat primitive.
 */

import { getFilm, saveFilm, patchScene, patchOverlay } from "./store";
import { continuityText } from "./types";
import type { FilmProject, FilmScene, FilmOverlay, FilmAspect, FilmCharacter } from "./types";
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
import { filmDims, imageToClip, normalizeClip, crossfadePair, mixMusicUnder, xfadeName, compositeOverlay } from "./clip-helpers";

const isVideoUrl = (u?: string | null): u is string => !!u && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
const isImageUrl = (u?: string | null): u is string => !!u && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u);
const AI_SCENE_COST_KEY = "AI_VIDEO_LITE";

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
function withVideoGuard(prompt: string, style?: string): string {
  const base = (prompt || "").trim();
  const lead = style === "3d"
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
function sceneCastData(film: FilmProject, scene: FilmScene): { refs: string[]; dialogue?: string } {
  const chars = film.characters || [];
  const lines = scene.cast || [];
  const charFor = (l: { characterId?: string; name?: string }): FilmCharacter | undefined =>
    chars.find((x) => x.id === l.characterId) || chars.find((x) => x.name.toLowerCase() === (l.name || "").toLowerCase());
  // BOTH the clean portrait AND the turnaround sheet per person — more identity + wardrobe
  // signal for reference-to-video (which anchors appearance from these), reducing the
  // "clothing changed" drift. Portrait first (cleaner wardrobe read).
  const refsFor = (l: { characterId?: string; name?: string }): string[] => {
    const c = charFor(l);
    return [c?.referenceImageUrl, c?.characterSheetUrl].filter((u): u is string => !!u);
  };
  // Collect each present cast member's images — speakers first (that's who the shot is
  // on), then any silent/background cast. De-duped, and ONLY people actually in this
  // scene: a shot with no cast lines (an establishing beat) must NOT force the lead in.
  const refs: string[] = [];
  const push = (u?: string) => { if (u && !refs.includes(u)) refs.push(u); };
  for (const l of lines.filter((l) => (l.dialogue || "").trim())) refsFor(l).forEach(push);
  for (const l of lines) refsFor(l).forEach(push);
  const spoken = lines.filter((l) => (l.dialogue || "").trim());
  // Tag each speaker with a SHORT visual descriptor so the model can tell who's who
  // on screen and lip-sync the right line to the right person (fixes "the wrong
  // character says someone else's line" in multi-person shots).
  const tag = (c?: FilmCharacter): string => {
    if (!c) return "";
    const d = (c.wardrobe?.trim() || c.description || "").replace(/\s+/g, " ").trim();
    if (d) return ` (${d.split(" ").slice(0, 12).join(" ")})`;
    return c.role ? ` (${c.role})` : "";
  };
  const dialogue = spoken.length
    ? spoken.map((l) => `${l.name}${tag(charFor(l))} says: "${(l.dialogue || "").trim()}"`).join("\n")
    : undefined;
  return { refs: refs.slice(0, 7), dialogue }; // reference-to-video accepts up to 7 images
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
function keyframePrompt(scene: FilmScene, continuity: string, hasCast: boolean): string {
  const is3d = scene.style === "3d";
  const look = is3d
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
): Promise<string | null> {
  const [w, h] = aspect === "9:16" ? [768, 1344] : aspect === "16:9" ? [1344, 768] : [1024, 1024];
  const prompt = keyframePrompt(scene, continuity, castRefs.length > 0);
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

export interface GenerateResult { ok: boolean; film?: FilmProject; message?: string }

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
      const { refs: castRefs, dialogue } = sceneCastData(film, scene);
      const continuity = continuityForScene(film, scene);
      void renderAiScene(filmId, userId, sceneId, scene, film.aspect, cost, castRefs, dialogue, continuity); // fire-and-forget (VPS is long-lived)
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
async function renderAiScene(filmId: string, userId: string, sceneId: string, scene: FilmScene, aspect: FilmAspect, cost: number, castRefs: string[] = [], dialogue?: string, continuity = ""): Promise<void> {
  try {
    let p = 8;
    // Stamp the render start so the watchdog can fail this scene if the worker
    // dies mid-render (e.g. a deploy) and leaves it stuck "rendering".
    await patchScene(filmId, userId, sceneId, { status: "rendering", progress: p, renderStartedAt: Date.now(), renderHeartbeatAt: Date.now() }).catch(() => {});
    // Fold the cast's spoken lines into the shot prompt as AUDIBLE dialogue (Veo
    // does native speech) — not on-screen captions, which the leak guard forbids.
    // The continuity bible keeps the shot in the film's shared world (location/wardrobe).
    const shot = scene.script || scene.title;
    const continuityLine = continuity ? `\n\nCONTINUITY — keep consistent with the rest of the film (same place, lighting and clothes): ${continuity}` : "";
    // When we anchor on cast reference images, hard-lock face + WARDROBE so the model
    // doesn't restyle the clothes (the "clothing changed" drift of reference-to-video).
    const usingRefs = !scene.referenceImageUrl && castRefs.length > 0;
    const identityLine = usingRefs
      ? `\n\nIDENTITY — the people on screen are the EXACT individuals in the reference images: keep each person's face, hair, skin tone, build AND their clothing/wardrobe exactly as shown in the references — do NOT restyle, change, swap, or remove anyone's outfit.`
      : "";
    const shotBody = `${shot}${continuityLine}${identityLine}`;
    const shotWithDialogue = dialogue
      ? `${shotBody}\n\nDIALOGUE — each line is spoken ALOUD and lip-synced by the EXACT named person on screen (identify each speaker by the description in parentheses). Do NOT let anyone speak another person's line, and keep this order. This is spoken audio on camera, NOT subtitles or on-screen text:\n${dialogue}`
      : shotBody;

    // IDENTITY PATH — REFERENCE-to-video: feed the approved cast SHEETS as reference
    // images so the same faces carry, while the model generates NATURAL motion from
    // scratch. Replaces the old keyframe → image-to-video approach, which animated a
    // generated still and looked stiff/posed ("not natural"). An explicit product
    // reference image on the scene still wins as a deliberate first frame; a scene with
    // NO cast renders as a clean text-to-video clip.
    const firstFrameUrl: string | undefined = scene.referenceImageUrl || undefined;
    let refImages: string[] = [];
    if (!firstFrameUrl && castRefs.length) {
      refImages = castRefs;
      // Keyframe still = a nice node POSTER only — best-effort, does NOT gate the render
      // (the video starts immediately from the reference images) and is NOT the first
      // frame. Starting the xAI job right away also means a restart during setup can
      // resume it (no keyframe-stage gap).
      void buildSceneKeyframe(filmId, userId, sceneId, scene, aspect, castRefs, continuity)
        .then((key) => { if (key) void patchScene(filmId, userId, sceneId, { thumbnailUrl: key }).catch(() => {}); })
        .catch(() => {});
    }

    // Time-based progress so the bar keeps MOVING while a slow provider works,
    // instead of freezing at a hard cap (the "stuck at 90%" complaint). Eases
    // smoothly toward ~96% and never quite lands until the ready patch snaps to 100.
    const videoStart = Date.now();
    const result = await withTimeout(
      generateVideoForRole("video_standard", {
        prompt: withVideoGuard(shotWithDialogue, scene.style),
        // ≤10s (reference-to-video) / ≤15s (text-to-video) renders as one clip; longer
        // chains seamless extensions (the router handles it, capped at 30s).
        durationSeconds: Math.min(30, scene.durationSec || 8),
        aspectRatio: aspect,
        // (1080p is not available for grok-imagine-video — verified; router defaults to 720p.)
        referenceImageUrl: firstFrameUrl,
        // Cast sheets → reference-to-video on Grok (natural motion + identity) / referenceImages on Veo.
        characterReferenceUrls: refImages,
        // Persist the provider job handle so a restart RESUMES this render (polls the
        // job, pulls the finished clip) instead of killing it. Updated on each
        // extension too, so a chained >15s shot resumes to its latest segment.
        onJobId: (info) => { void patchScene(filmId, userId, sceneId, { refKind: info.provider, refId: info.jobId }).catch(() => {}); },
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

/**
 * RESUME (or fail) a Director AI scene whose in-process worker died on a restart.
 * Polls the persisted provider job: done → pull the finished clip + mark ready;
 * failed / genuinely-stuck / no-handle → fail + refund; still pending → leave it
 * rendering (re-checked on a later poll). Mutates the scene in place; returns true
 * if it changed. Never resumes a LIVE render (fresh heartbeat ⇒ left alone).
 */
async function resumeOrphanedAiScene(film: FilmProject, s: FilmScene, userId: string, now: number): Promise<boolean> {
  const lastBeat = s.renderHeartbeatAt || s.renderStartedAt || 0;
  if (now - lastBeat < AI_SCENE_STALE_MS) return false; // a live worker is still on it
  const startedAgo = s.renderStartedAt ? now - s.renderStartedAt : Infinity;
  const failRefund = async (msg: string) => { s.status = "failed"; s.error = msg; await refundAiScene(userId, film.id, s.id); };

  // No resumable provider handle ⇒ died before/at submit (or the keyframe hung).
  if (!s.refId || (s.refKind !== "grok" && s.refKind !== "veo3")) {
    if (startedAgo > AI_SCENE_NO_HANDLE_MS) { await failRefund("This shot was interrupted — please try again."); return true; }
    return false; // give the submit a little more grace
  }

  try {
    const done = async (buf: Buffer) => {
      const url = await uploadToS3(`director/${film.id}/${s.id}-${uid()}.mp4`, buf, "video/mp4");
      s.status = "ready"; s.progress = 100; s.videoUrl = url; s.error = null;
    };
    if (s.refKind === "grok") {
      const st = await grokVideoClient.pollOnce(s.refId);
      if (st.state === "failed") { await failRefund(`This shot couldn't finish${st.error ? ` (${st.error})` : ""} — please try again.`); return true; }
      if (st.state === "done" && st.url) { await done(await grokVideoClient.fetchVideoBuffer(st.url)); return true; }
    } else {
      const st = await veoClient.pollOnceByName(s.refId);
      if (st.state === "failed") { await failRefund(`This shot couldn't finish${st.error ? ` (${st.error})` : ""} — please try again.`); return true; }
      if (st.state === "done" && st.uri) { await done(await veoClient.fetchVideoByUri(st.uri)); return true; }
    }
    // Still pending (or an unknown Veo poll) — keep waiting, age-bounded.
    if (startedAgo > AI_SCENE_RESUME_MAX_MS) { await failRefund("This shot took too long — please try again."); return true; }
    s.renderHeartbeatAt = now - (AI_SCENE_STALE_MS - AI_SCENE_REPOLL_MS); // re-poll in ~20s, not every tick
    return true;
  } catch (e) {
    console.error(`[video-director] scene resume failed for ${s.id}:`, e instanceof Error ? e.message : e);
    if (startedAgo > AI_SCENE_RESUME_MAX_MS) { await failRefund("This shot couldn't be recovered — please try again."); return true; }
    return false; // transient provider error — a later poll retries
  }
}

export async function syncFilmScenes(film: FilmProject, userId: string): Promise<FilmProject> {
  let changed = false;

  // An AI scene stuck "rendering" with a stale heartbeat means its in-process worker
  // died (a deploy pm2-reloads the app). Instead of just failing it, RESUME from the
  // persisted xAI/Veo job — the provider kept rendering — and only fail if it's truly
  // gone. This is why a deploy mid-render no longer loses the shot.
  const now = Date.now();
  for (const s of film.scenes) {
    if (s.engine === "ai" && s.status === "rendering") {
      if (await resumeOrphanedAiScene(film, s, userId, now)) changed = true;
    }
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
    // Cheap pre-filter — only parse a film that actually has a rendering AI scene.
    if (!row.canvasData || !row.canvasData.includes('"rendering"')) continue;
    const film = await getFilm(row.id, row.userId).catch(() => null);
    if (!film) continue;
    let touched = false;
    for (const s of film.scenes) {
      if (s.engine === "ai" && s.status === "rendering") {
        if (await resumeOrphanedAiScene(film, s, row.userId, now)) touched = true;
      }
    }
    if (touched) { await saveFilm(row.id, row.userId, film).catch(() => {}); changed++; }
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

    // Music bed — mix the film-level track under everything (best-effort).
    if (film.music && /^https?:\/\//i.test(film.music)) {
      try {
        const mres = await fetch(film.music);
        if (mres.ok) finalBuffer = await mixMusicUnder(finalBuffer, Buffer.from(await mres.arrayBuffer()));
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
