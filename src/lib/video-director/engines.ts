/**
 * Engine bridges — a Director scene renders on the engine it already uses today.
 * Nothing here reimplements a generator; it dispatches to the existing avatar /
 * AI-video pipelines, then reconciles their status back onto the scene, and
 * stitches the ready clips into one film with the shared concat primitive.
 */

import { getFilm, saveFilm, patchScene, patchOverlay } from "./store";
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
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { sanitizeUserError } from "@/lib/ai/user-error";
import { approvedCastReferences } from "./cast";
import { filmDims, imageToClip, normalizeClip, crossfadePair, mixMusicUnder, xfadeName, compositeOverlay } from "./clip-helpers";

const isVideoUrl = (u?: string | null): u is string => !!u && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
const isImageUrl = (u?: string | null): u is string => !!u && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u);
const AI_SCENE_COST_KEY = "AI_VIDEO_LITE";

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

/** For a movie scene: the reference image (first cast member's sheet, else the
 *  approved lead) + the spoken dialogue block, so the AI shot shows the same
 *  people saying their lines. */
function sceneCastData(film: FilmProject, scene: FilmScene): { ref?: string; dialogue?: string } {
  const chars = film.characters || [];
  const lines = scene.cast || [];
  const refFor = (l: { characterId?: string; name?: string }): string | undefined => {
    const c = chars.find((x) => x.id === l.characterId) || chars.find((x) => x.name.toLowerCase() === (l.name || "").toLowerCase());
    return c?.characterSheetUrl || c?.referenceImageUrl || undefined;
  };
  // Anchor the shot on the character who SPEAKS in this scene (that's who the shot
  // is on) — falling back to the first present cast member, then the film's lead.
  // Otherwise every shot re-uses the lead's face (the "always Marcus" bug).
  let ref: string | undefined;
  for (const l of lines.filter((l) => (l.dialogue || "").trim())) { ref = refFor(l); if (ref) break; }
  if (!ref) for (const l of lines) { ref = refFor(l); if (ref) break; }
  if (!ref) ref = approvedCastReferences(film)[0];
  const spoken = lines.filter((l) => (l.dialogue || "").trim());
  const dialogue = spoken.length ? spoken.map((l) => `${l.name} says: "${(l.dialogue || "").trim()}"`).join(" ") : undefined;
  return { ref, dialogue };
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
      const { ref: castRef, dialogue } = sceneCastData(film, scene);
      void renderAiScene(filmId, userId, sceneId, scene, film.aspect, cost, castRef, dialogue); // fire-and-forget (VPS is long-lived)
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
    const url = await uploadToS3(`director/${filmId}/${sceneId}-overlay.mp4`, result.videoBuffer, "video/mp4");
    await patchOverlay(filmId, userId, sceneId, { status: "ready", progress: 100, videoUrl: url });
  } catch (e) {
    if (cost > 0) await creditService.addCredits({ userId, type: TRANSACTION_TYPES.REFUND, amount: cost, referenceType: "director_scene", referenceId: `${sceneId}:overlay`, description: "Refund: Director overlay failed" }).catch(() => {});
    await patchOverlay(filmId, userId, sceneId, { status: "failed", error: sanitizeUserError(e, "video") }).catch(() => {});
  }
}

/** Fire-and-forget AI shot render → upload → mark ready. Refunds on failure. Never throws. */
async function renderAiScene(filmId: string, userId: string, sceneId: string, scene: FilmScene, aspect: FilmAspect, cost: number, castRef?: string, dialogue?: string): Promise<void> {
  try {
    let p = 8;
    // Stamp the render start so the watchdog can fail this scene if the worker
    // dies mid-render (e.g. a deploy) and leaves it stuck "rendering".
    await patchScene(filmId, userId, sceneId, { status: "rendering", progress: p, renderStartedAt: Date.now() }).catch(() => {});
    // Fold the cast's spoken lines into the shot prompt as AUDIBLE dialogue (Veo
    // does native speech) — not on-screen captions, which the leak guard forbids.
    const shot = scene.script || scene.title;
    const shotWithDialogue = dialogue ? `${shot}\n\nDIALOGUE — spoken aloud on camera, audible and lip-synced (NOT subtitles or on-screen text): ${dialogue}` : shot;
    const result = await withTimeout(
      generateVideoForRole("video_standard", {
        prompt: withVideoGuard(shotWithDialogue, scene.style),
        durationSeconds: Math.min(15, scene.durationSec || 8),
        aspectRatio: aspect,
        // Anchor the shot: the scene's product/reference image if set, else the
        // approved lead cast member so the same person appears across shots.
        referenceImageUrl: scene.referenceImageUrl || castRef || undefined,
        onStatus: () => { p = Math.min(90, p + 14); void patchScene(filmId, userId, sceneId, { status: "rendering", progress: p }).catch(() => {}); },
      }),
      AI_SCENE_TIMEOUT_MS,
      "This shot took too long and timed out.",
    );
    const url = await uploadToS3(`director/${filmId}/${sceneId}.mp4`, result.videoBuffer, "video/mp4");
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
async function buildDirectorOutro(logoSource: string, aspect: FilmAspect, brandColor: string | null): Promise<Buffer | null> {
  let bgImage: Buffer | null = null;
  try {
    const [iw, ih] = aspect === "9:16" ? [1024, 1536] : aspect === "16:9" ? [1536, 1024] : [1024, 1024];
    const prompt =
      `A premium ABSTRACT brand background for a film outro end-card: soft cinematic light, elegant out-of-focus bokeh and a gentle gradient, ${brandColor ? `built around the brand colour ${brandColor}` : "deep tasteful brand tones"}, with a calmer darker area toward the centre for a logo. ` +
      `Absolutely NO text, NO letters, NO logo, NO watermark, NO people, NO products — only an atmospheric on-brand backdrop.`;
    const res = await generateImageXaiFirst(prompt, iw, ih, { quality: "high", preferredProvider: "openai" });
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
        const bk = await prisma.brandKit.findFirst({ where: { userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: { logo: true, iconLogo: true, colors: true } });
        const logo = bk?.iconLogo || bk?.logo || null;
        if (logo) {
          finalBuffer = await overlayBrandLogoOnVideo(finalBuffer, logo);
          try {
            let brandColor: string | null = null;
            try { const c = bk?.colors ? JSON.parse(bk.colors) : null; brandColor = typeof c?.primary === "string" ? c.primary : null; } catch { /* ignore */ }
            const outro = await buildDirectorOutro(logo, film.aspect, brandColor);
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

    const url = await uploadToS3(`director/${filmId}/final.mp4`, finalBuffer, "video/mp4");

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
