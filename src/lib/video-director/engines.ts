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

/** Append the anti-leak guard to a shot prompt (once). */
function withVideoGuard(prompt: string): string {
  const base = (prompt || "").trim();
  if (!base) return VIDEO_ANTI_LEAK;
  return `${base}\n\n${VIDEO_ANTI_LEAK}`;
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
      void renderAiScene(filmId, userId, sceneId, scene, film.aspect, cost); // fire-and-forget (VPS is long-lived)
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
    await patchOverlay(filmId, userId, sceneId, { status: "failed", error: e instanceof Error ? e.message : "Overlay render failed" }).catch(() => {});
  }
}

/** Fire-and-forget AI shot render → upload → mark ready. Refunds on failure. Never throws. */
async function renderAiScene(filmId: string, userId: string, sceneId: string, scene: FilmScene, aspect: FilmAspect, cost: number): Promise<void> {
  try {
    let p = 8;
    const result = await generateVideoForRole("video_standard", {
      prompt: withVideoGuard(scene.script || scene.title),
      durationSeconds: Math.min(15, scene.durationSec || 8),
      aspectRatio: aspect,
      // A product/reference image anchors the shot so it shows the user's actual product.
      referenceImageUrl: scene.referenceImageUrl || undefined,
      onStatus: () => { p = Math.min(90, p + 14); void patchScene(filmId, userId, sceneId, { status: "rendering", progress: p }).catch(() => {}); },
    });
    const url = await uploadToS3(`director/${filmId}/${sceneId}.mp4`, result.videoBuffer, "video/mp4");
    await patchScene(filmId, userId, sceneId, { status: "ready", progress: 100, videoUrl: url });
  } catch (e) {
    if (cost > 0) {
      await creditService.addCredits({
        userId, type: TRANSACTION_TYPES.REFUND, amount: cost,
        referenceType: "director_scene", referenceId: sceneId, description: "Refund: Director AI scene failed",
      }).catch(() => {});
    }
    await patchScene(filmId, userId, sceneId, { status: "failed", error: e instanceof Error ? e.message : "AI render failed" }).catch(() => {});
  }
}

/**
 * Reconcile scenes whose render lives in another table (avatar → CartoonVideo)
 * back onto the film. Called on each GET poll so the canvas reflects live status.
 * AI/media/design update themselves in-process, so only external refs need this.
 */
export async function syncFilmScenes(film: FilmProject, userId: string): Promise<FilmProject> {
  let changed = false;
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

    // Brand logo — overlay the brand mark on the final cut (best-effort).
    if (film.brandLogo !== false) {
      try {
        const bk = await prisma.brandKit.findFirst({ where: { userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: { logo: true, iconLogo: true } });
        const logo = bk?.iconLogo || bk?.logo || null;
        if (logo) finalBuffer = await overlayBrandLogoOnVideo(finalBuffer, logo);
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
