/**
 * The director's brain — turn a brief into a pipeline of scene nodes, choosing
 * the right engine per beat (cinematic AI shot, talking-avatar clone, branded
 * still). Avatar scenes are pre-set to the user's default avatar/voice so they
 * generate in one click. Drafting is free; generating each scene is charged.
 */

import { ai } from "@/lib/ai/client";
import { getFilm, saveFilm } from "./store";
import { normalizeScene, type FilmProject, type FilmScene, type SceneEngine } from "./types";
import { listAvatarsForUser, listVoicesForUser } from "@/lib/avatar-studio";

const ENGINE_SET = new Set<SceneEngine>(["ai", "avatar", "reel", "media", "design"]);

export async function draftFilmPipeline(filmId: string, userId: string): Promise<FilmProject | null> {
  const film = await getFilm(filmId, userId);
  if (!film) return null;
  const brief = film.brief.trim();
  if (!brief) return film;

  const target = film.targetSeconds || 30;
  const approx = film.sceneCount ? Math.max(1, Math.min(10, film.sceneCount)) : Math.max(2, Math.min(8, Math.round(target / 8)));
  const hasSource = !!film.sourceVideoUrl;

  let planned: { engine?: string; title?: string; script?: string; durationSec?: number }[] = [];
  try {
    const json = await ai.generateJSON<{ scenes: { engine: string; title: string; script: string; durationSec: number }[] }>(
      `You are a senior video DIRECTOR planning a ${target}s ${film.filmType.replace("_", " ")} as a sequence of scenes. Brief: "${brief}".\n` +
      `Plan exactly ${approx} scenes that build one cohesive story. For EACH scene pick the best engine:\n` +
      `- "ai": a cinematic AI-generated shot (product macro, b-roll, establishing, motion). script = a vivid SHOT PROMPT (what's on screen, mood, motion) — no dialogue.\n` +
      `- "avatar": the user's talking-avatar clone speaking to camera (hook, testimonial, explainer, spoken CTA). script = the SPOKEN words — first person, punchy, to one viewer.\n` +
      `- "design": a branded still / end card (logo, offer, "Shop now"). script = the on-screen HEADLINE only.\n` +
      (hasSource ? `- "reel": a scored clip cut from the user's uploaded long video (use for b-roll / real-footage beats). script = a short note on what moment to grab.\n` : "") +
      `Open with a scroll-stopping beat and close with a clear call to action. Durations sum to ~${target}s (each 3-10s).\n` +
      `Return JSON: {"scenes":[{"engine":"ai|avatar|design${hasSource ? "|reel" : ""}","title":"2-4 words","script":"...","durationSec":8}, ...]} with exactly ${approx} scenes.`,
      { maxTokens: 1600, temperature: 0.7 },
    );
    planned = Array.isArray(json?.scenes) ? json.scenes.slice(0, 10) : [];
  } catch {
    planned = [];
  }
  if (planned.length === 0) {
    planned = [
      { engine: "ai", title: "Hook", script: brief, durationSec: 8 },
      { engine: "avatar", title: "Message", script: brief, durationSec: 12 },
      { engine: "design", title: "Call to action", script: "Learn more", durationSec: 4 },
    ];
  }

  // Presenter defaults — the brief's chosen avatar/voice (or the account's first)
  // so drafted avatar scenes are one-click generatable.
  const needsAvatar = planned.some((s) => s.engine === "avatar");
  let defAvatar: { id: string; name: string } | null = film.avatarId ? { id: film.avatarId, name: film.avatarName || "Avatar" } : null;
  let defVoice: { id: string; name: string } | null = film.voiceId ? { id: film.voiceId, name: film.voiceName || "Voice" } : null;
  if (needsAvatar && (!defAvatar || !defVoice)) {
    try {
      const [avatars, voices] = await Promise.all([listAvatarsForUser(), listVoicesForUser()]);
      if (!defAvatar && avatars[0]) defAvatar = { id: avatars[0].id, name: avatars[0].name };
      if (!defVoice && voices[0]) defVoice = { id: voices[0].id, name: voices[0].name };
    } catch { /* leave unset — the user picks in the inspector */ }
  }
  const avatarQuality = film.quality === "standard" ? "standard" : "avatar_iv";
  const aiStyle = ["cinematic", "3d", "narrated"].includes(String(film.style)) ? String(film.style) : "cinematic";

  const scenes: FilmScene[] = planned.map((s, i) => {
    const engine = (ENGINE_SET.has(s.engine as SceneEngine) ? s.engine : "ai") as SceneEngine;
    return normalizeScene(
      {
        id: `sc_${i}_${Math.random().toString(36).slice(2, 7)}`,
        engine,
        title: (s.title || `Scene ${i + 1}`).slice(0, 60),
        script: (s.script || brief).slice(0, 4000),
        durationSec: typeof s.durationSec === "number" ? Math.max(2, Math.min(15, Math.round(s.durationSec))) : engine === "design" ? 3 : 8,
        order: i,
        x: 340 + i * 250,
        y: 80 + (i % 2) * 210,
        status: "draft",
        captionsOn: true,
        quality: engine === "avatar" ? avatarQuality : undefined,
        style: engine === "ai" ? aiStyle : undefined,
        aiProvider: engine === "ai" ? "veo" : undefined,
        ...(engine === "reel" && film.sourceVideoUrl ? { sourceUrl: film.sourceVideoUrl } : {}),
        ...(engine === "avatar" && defAvatar ? { avatarId: defAvatar.id, avatarName: defAvatar.name } : {}),
        ...(engine === "avatar" && defVoice ? { voiceId: defVoice.id, voiceName: defVoice.name } : {}),
      },
      i,
    );
  });

  film.scenes = scenes;
  await saveFilm(filmId, userId, film);
  return film;
}
