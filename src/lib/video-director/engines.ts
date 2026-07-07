/**
 * Engine bridges — a Director scene renders on the engine it already uses today.
 * Nothing here reimplements a generator; it dispatches to the existing avatar /
 * AI-video pipelines, then reconciles their status back onto the scene, and
 * stitches the ready clips into one film with the shared concat primitive.
 */

import { getFilm, saveFilm, patchScene } from "./store";
import type { FilmProject, FilmScene, FilmAspect } from "./types";
import { startAvatarVideo, getAvatarVideo } from "@/lib/avatar-studio";
import { emptyAvatarState } from "@/lib/avatar-studio/types";
import { generateVideoForRole } from "@/lib/ai/video-router";
import { concatenateVideoBuffers } from "@/lib/video/concat-videos";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsAvailable } from "@/lib/credits/costs";
import { filmDims, imageToClip, normalizeClip } from "./clip-helpers";

const isVideoUrl = (u?: string | null): u is string => !!u && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
const isImageUrl = (u?: string | null): u is string => !!u && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u);
const AI_SCENE_COST_KEY = "AI_VIDEO_LITE";

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

/** Fire-and-forget AI shot render → upload → mark ready. Refunds on failure. Never throws. */
async function renderAiScene(filmId: string, userId: string, sceneId: string, scene: FilmScene, aspect: FilmAspect, cost: number): Promise<void> {
  try {
    let p = 8;
    const result = await generateVideoForRole("video_standard", {
      prompt: scene.script || scene.title,
      durationSeconds: Math.min(15, scene.durationSec || 8),
      aspectRatio: aspect,
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
  for (const s of film.scenes) {
    if (s.refKind === "avatar_video" && s.refId && (s.status === "rendering" || s.status === "queued")) {
      const av = await getAvatarVideo(s.refId, userId).catch(() => null);
      if (!av) continue;
      const st = (av.row.status || "").toUpperCase();
      if (st === "COMPLETED" && av.row.videoUrl) {
        s.status = "ready"; s.progress = 100; s.videoUrl = av.row.videoUrl; s.thumbnailUrl = av.row.thumbnailUrl || s.thumbnailUrl; changed = true;
      } else if (st === "FAILED") {
        s.status = "failed"; s.error = av.row.errorMessage || "Avatar render failed"; changed = true;
      } else {
        const p = Math.max(8, av.row.progress || 10);
        if (p !== s.progress) { s.progress = p; s.status = "rendering"; changed = true; }
      }
    }
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

    const clips: Buffer[] = [];
    for (const s of ordered) {
      const res = await fetch(s.videoUrl as string).catch(() => null);
      if (!res?.ok) continue;
      const raw = Buffer.from(await res.arrayBuffer());
      try {
        if (isImageUrl(s.videoUrl)) {
          clips.push(await imageToClip(raw, s.durationSec || 3, w, h));
        } else {
          // Keep the avatar/AI voiceover; reel/media b-roll gets a uniform silent track.
          const preferSourceAudio = s.engine === "avatar" || s.engine === "ai";
          const trim = s.engine === "reel" && typeof s.clipStart === "number" && typeof s.clipEnd === "number" && s.clipEnd > s.clipStart
            ? { start: s.clipStart, end: s.clipEnd } : undefined;
          clips.push(await normalizeClip(raw, w, h, { preferSourceAudio, trim }));
        }
      } catch (e) {
        console.error(`[video-director] clip build failed for scene ${s.id}:`, e instanceof Error ? e.message : e);
      }
    }
    if (clips.length === 0) throw new Error("Could not assemble any scene clips.");

    const finalBuffer = clips.length === 1 ? clips[0] : await concatenateVideoBuffers(clips);
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
