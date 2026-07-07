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

const isVideoUrl = (u?: string | null): u is string => !!u && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

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
      await patchScene(filmId, userId, sceneId, { status: "rendering", progress: 6, error: null });
      void renderAiScene(filmId, userId, sceneId, scene, film.aspect); // fire-and-forget (VPS is long-lived)
      const f = await getFilm(filmId, userId);
      return { ok: true, film: f ?? undefined };
    }
    case "reel":
      return { ok: false, message: "Reel scenes attach a scored clip — bringing the Reel picker onto the canvas next." };
  }
  return { ok: false, message: "Unknown engine." };
}

/** Fire-and-forget AI shot render → upload → mark the scene ready. Never throws. */
async function renderAiScene(filmId: string, userId: string, sceneId: string, scene: FilmScene, aspect: FilmAspect): Promise<void> {
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
 * Stitch the ready VIDEO scenes (in order) into one film via the shared concat
 * primitive (handles mixed codecs/resolutions across Veo/Grok/HeyGen). Fire-and-
 * forget; the canvas polls finalStatus. Stills-only scenes are skipped for now
 * (they need the timeline compositor — a later phase). Never throws.
 */
export async function composeFilm(filmId: string, userId: string): Promise<void> {
  try {
    const film = await getFilm(filmId, userId);
    if (!film) return;
    const ordered = [...film.scenes].sort((a, b) => a.order - b.order).filter((s) => s.status === "ready" && isVideoUrl(s.videoUrl));
    if (ordered.length === 0) throw new Error("No ready video scenes to stitch yet.");

    const buffers: Buffer[] = [];
    for (const s of ordered) {
      const res = await fetch(s.videoUrl as string);
      if (res.ok) buffers.push(Buffer.from(await res.arrayBuffer()));
    }
    if (buffers.length === 0) throw new Error("Could not fetch the scene videos.");

    const finalBuffer = buffers.length === 1 ? buffers[0] : await concatenateVideoBuffers(buffers);
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
