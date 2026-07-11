/**
 * Engine bridges — a Director scene renders on the engine it already uses today.
 * Nothing here reimplements a generator; it dispatches to the existing avatar /
 * AI-video pipelines, then reconciles their status back onto the scene, and
 * stitches the ready clips into one film with the shared concat primitive.
 */

import { getFilm, saveFilm, patchScene, patchOverlay } from "./store";
import { continuityText } from "./types";
import type { FilmProject, FilmScene, FilmOverlay, FilmAspect } from "./types";
import { startAvatarVideo, getAvatarVideo } from "@/lib/avatar-studio";
import { emptyAvatarState } from "@/lib/avatar-studio/types";
import { generateVideoForRole } from "@/lib/ai/video-router";
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

// A single AI shot is a ≤15s clip — it should render in 1-3 min. Bound the
// in-process wait so a stuck provider can't leave the scene "rendering" forever
// (the catch then fails + refunds with a friendly timeout message).
const AI_SCENE_TIMEOUT_MS = 8 * 60 * 1000;
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
  const refFor = (l: { characterId?: string; name?: string }): string | undefined => {
    const c = chars.find((x) => x.id === l.characterId) || chars.find((x) => x.name.toLowerCase() === (l.name || "").toLowerCase());
    return c?.characterSheetUrl || c?.referenceImageUrl || undefined;
  };
  // Collect each present cast member's sheet — speakers first (that's who the shot
  // is on), then any silent/background cast, so a multi-person shot keeps everyone's
  // identity. De-duped, and ONLY people actually in this scene: a shot with no cast
  // lines (an establishing beat) must NOT force the lead in — it renders peopleless.
  const refs: string[] = [];
  const push = (u?: string) => { if (u && !refs.includes(u)) refs.push(u); };
  for (const l of lines.filter((l) => (l.dialogue || "").trim())) push(refFor(l));
  for (const l of lines) push(refFor(l));
  const spoken = lines.filter((l) => (l.dialogue || "").trim());
  const dialogue = spoken.length ? spoken.map((l) => `${l.name} says: "${(l.dialogue || "").trim()}"`).join(" ") : undefined;
  return { refs: refs.slice(0, 3), dialogue };
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
const XFADE_DUR = 0.5; // seconds of overlap for a scene transition
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
    await patchScene(filmId, userId, sceneId, { status: "rendering", progress: p, renderStartedAt: Date.now() }).catch(() => {});
    // Fold the cast's spoken lines into the shot prompt as AUDIBLE dialogue (Veo
    // does native speech) — not on-screen captions, which the leak guard forbids.
    // The continuity bible keeps the shot in the film's shared world (location/wardrobe).
    const shot = scene.script || scene.title;
    const continuityLine = continuity ? `\n\nCONTINUITY — keep consistent with the rest of the film (same place, lighting and clothes): ${continuity}` : "";
    const shotBody = `${shot}${continuityLine}`;
    const shotWithDialogue = dialogue ? `${shotBody}\n\nDIALOGUE — spoken aloud on camera, audible and lip-synced (NOT subtitles or on-screen text): ${dialogue}` : shotBody;

    // FIRST FRAME: compose a real opening keyframe still so the clip STARTS in the
    // scene (correct location + wardrobe, identity-locked) instead of on the actor's
    // studio turnaround sheet — the old bug where the sheet was fed straight in as
    // the first frame. An explicit product/reference image on the scene still wins
    // as the deliberate first frame.
    let firstFrameUrl: string | undefined = scene.referenceImageUrl || undefined;
    let veoRefs: string[] = [];
    if (!firstFrameUrl) {
      // Compose a keyframe when there are people to place OR a continuity world to
      // establish; otherwise (an old film with neither) fall through to text-to-video.
      const wantKeyframe = castRefs.length > 0 || !!continuity;
      const key = wantKeyframe ? await buildSceneKeyframe(filmId, userId, sceneId, scene, aspect, castRefs, continuity) : null;
      if (key) {
        firstFrameUrl = key;
        p = 22;
        // Store it as the scene poster too (the node shows a real storyboard frame).
        await patchScene(filmId, userId, sceneId, { status: "rendering", progress: p, thumbnailUrl: key }).catch(() => {});
      } else if (castRefs.length) {
        // Keyframe failed — do NOT fall back to the turnaround sheet as the first
        // frame (that IS the bug). Anchor identity via Veo reference images instead;
        // Grok then renders text-to-video (no portrait start), relying on continuity.
        veoRefs = castRefs;
      }
    }

    const result = await withTimeout(
      generateVideoForRole("video_standard", {
        prompt: withVideoGuard(shotWithDialogue, scene.style),
        durationSeconds: Math.min(15, scene.durationSec || 8),
        aspectRatio: aspect,
        referenceImageUrl: firstFrameUrl,
        // Veo-only identity anchor (used when there's no keyframe first frame).
        characterReferenceUrls: veoRefs,
        onStatus: () => { p = Math.min(90, p + 12); void patchScene(filmId, userId, sceneId, { status: "rendering", progress: p }).catch(() => {}); },
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
const AI_SCENE_WATCHDOG_MS = 12 * 60 * 1000; // > the 8-min in-process cap, so only true orphans hit this

export async function syncFilmScenes(film: FilmProject, userId: string): Promise<FilmProject> {
  let changed = false;

  // WATCHDOG: an AI scene stuck "rendering" past the watchdog window means its
  // in-process worker died (e.g. a deploy) without ever hitting the 8-min
  // timeout — otherwise it would already be "failed". Fail it + refund so it
  // stops spinning forever. (The 12-min threshold sits above the 8-min cap, so a
  // live-but-slow render fails via its own catch first — no double refund.)
  const now = Date.now();
  for (const s of film.scenes) {
    if (s.engine === "ai" && s.status === "rendering" && s.renderStartedAt && now - s.renderStartedAt > AI_SCENE_WATCHDOG_MS) {
      s.status = "failed";
      s.error = "This shot took too long and timed out — please try again.";
      changed = true;
      const refund = await getDynamicCreditCost(AI_SCENE_COST_KEY).catch(() => 0);
      if (refund > 0) {
        await creditService.addCredits({
          userId, type: TRANSACTION_TYPES.REFUND, amount: refund,
          referenceType: "director_scene", referenceId: s.id, description: "Refund: Director AI scene stalled",
        }).catch(() => {});
      }
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
