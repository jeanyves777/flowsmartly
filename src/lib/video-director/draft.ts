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
import { heygenClient } from "@/lib/ai/heygen-client";

const ENGINE_SET = new Set<SceneEngine>(["ai", "avatar", "reel", "media", "design"]);

/**
 * Turn the brief's attached media into routing inputs: a product/reference image
 * (anchors AI shots + design cards) and — if the user attached their photo — a
 * HeyGen talking-photo avatar (Avatar IV) so "my photo" literally presents.
 */
async function resolveMedia(film: FilmProject): Promise<{ productImg: string | null; photoAvatar: { id: string; name: string } | null }> {
  const assets = film.assets || [];
  const productImg = assets.find((a) => a.kind === "image" && a.role !== "clone_photo")?.url || null;
  const photoAsset = assets.find((a) => a.role === "clone_photo");
  let photoAvatar: { id: string; name: string } | null = null;
  if (photoAsset?.url && heygenClient.isAvailable()) {
    try {
      const res = await fetch(photoAsset.url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const up = await heygenClient.uploadTalkingPhoto(buf, res.headers.get("content-type") || "image/jpeg");
        if (up.id) photoAvatar = { id: up.id, name: "You" };
      }
    } catch { /* fall back to a normal avatar */ }
  }
  return { productImg, photoAvatar };
}

export async function draftFilmPipeline(filmId: string, userId: string): Promise<FilmProject | null> {
  const film = await getFilm(filmId, userId);
  if (!film) return null;

  const { productImg, photoAvatar } = await resolveMedia(film);
  const hasMedia = !!productImg || !!photoAvatar;

  // Reel film — lay N reel scenes from the source video directly (no LLM plan needed).
  if (film.filmType === "reel" && film.sourceVideoUrl) {
    const src = film.sourceVideoUrl;
    const n = Math.max(2, Math.min(10, film.sceneCount || 6));
    const per = Math.max(4, Math.min(15, film.targetSeconds || 30)); // clip length
    film.scenes = Array.from({ length: n }, (_, i) => normalizeScene({
      id: `sc_${i}_${Math.random().toString(36).slice(2, 7)}`,
      engine: "reel", title: `Clip ${i + 1}`, script: "Best moment from the source video",
      durationSec: Math.min(per, 15), order: i, x: 340 + i * 250, y: 80 + (i % 2) * 210,
      status: "draft", captionsOn: true, sourceUrl: src,
    }, i));
    await saveFilm(filmId, userId, film);
    return film;
  }

  // Avatar film — N talking-avatar scenes (mirrors the Avatar Studio talking flow).
  if (film.filmType === "testimonial") {
    const b = film.brief.trim() || "A short talking-avatar video.";
    const count = Math.max(1, Math.min(8, film.sceneCount || 3));
    const words = Math.max(20, Math.round((film.targetSeconds || 30) * 2));
    let drafted: { title?: string; script?: string }[] = [];
    try {
      const json = await ai.generateJSON<{ scenes: { title: string; script: string }[] }>(
        `You are scripting a ${count}-scene talking-avatar video for this brief: "${b}". ` +
        `Write ${count} DISTINCT scenes spoken to camera by one avatar, together telling a cohesive story. ` +
        `Each script ~${words} words, punchy, first person, no stage directions or emojis. ` +
        `Return JSON: {"scenes":[{"title":"short label","script":"the spoken words"}, ...]} with exactly ${count} scenes.`,
        { maxTokens: 1600, temperature: 0.7 },
      );
      drafted = Array.isArray(json?.scenes) ? json.scenes.slice(0, count) : [];
    } catch { drafted = []; }
    if (drafted.length === 0) drafted = Array.from({ length: count }, (_, i) => ({ title: `Scene ${i + 1}`, script: b }));

    let dAvatar = photoAvatar || (film.avatarId ? { id: film.avatarId, name: film.avatarName || "Avatar" } : null);
    let dVoice = film.voiceId ? { id: film.voiceId, name: film.voiceName || "Voice" } : null;
    if (!dAvatar || !dVoice) {
      try {
        const [av, vo] = await Promise.all([listAvatarsForUser(), listVoicesForUser()]);
        if (!dAvatar && av[0]) dAvatar = { id: av[0].id, name: av[0].name };
        if (!dVoice && vo[0]) dVoice = { id: vo[0].id, name: vo[0].name };
      } catch { /* leave unset — user picks in the inspector */ }
    }
    const q = photoAvatar || film.quality === "avatar_iv" ? "avatar_iv" : "standard"; // talking-photo is Avatar IV
    const secEach = Math.max(4, Math.round((film.targetSeconds || 30) / count));
    film.scenes = drafted.map((s, i) => normalizeScene({
      id: `sc_${i}_${Math.random().toString(36).slice(2, 7)}`,
      engine: "avatar", title: (s.title || `Scene ${i + 1}`).slice(0, 60), script: (s.script || b).slice(0, 4000),
      durationSec: Math.min(secEach, 60), order: i, x: 340 + i * 250, y: 80 + (i % 2) * 210,
      status: "draft", captionsOn: true, quality: q,
      ...(dAvatar ? { avatarId: dAvatar.id, avatarName: dAvatar.name } : {}),
      ...(dVoice ? { voiceId: dVoice.id, voiceName: dVoice.name } : {}),
    }, i));
    await saveFilm(filmId, userId, film);
    return film;
  }

  const brief = film.brief.trim();
  if (!brief) return film;

  const target = film.targetSeconds || 30;
  // ~15s per shot (Grok's max clip), so a 5-min movie → ~20 shots. Cap at 24 so a
  // long film still storyboards fully instead of the old hard cap of 8.
  const approx = film.sceneCount ? Math.max(1, Math.min(30, film.sceneCount)) : Math.max(2, Math.min(24, Math.round(target / 15)));
  const hasSource = !!film.sourceVideoUrl;

  let planned: { engine?: string; title?: string; script?: string; durationSec?: number }[] = [];
  try {
    const json = await ai.generateJSON<{ scenes: { engine: string; title: string; script: string; durationSec: number }[] }>(
      `You are a senior video DIRECTOR planning a ${target}s ${film.filmType.replace("_", " ")} as a sequence of scenes. Brief: "${brief}".\n` +
      (photoAvatar ? `The user attached a PHOTO OF THEMSELVES — use "avatar" scenes for a PRESENTER that is them (open and/or close on the presenter, or have them speak between shots).\n` : "") +
      (productImg ? `The user attached a PRODUCT/REFERENCE image — use "ai" shots to show that product (macro, in-use, hero) and a "design" end card featuring it.\n` : "") +
      `Plan exactly ${approx} scenes that build one cohesive story. MIX the engines to deliver the best result. For EACH scene pick the best engine:\n` +
      `- "ai": a cinematic AI-generated shot (product macro, b-roll, establishing, motion). script = a vivid SHOT PROMPT (what's on screen, mood, motion) — no dialogue.\n` +
      `- "avatar": the user's talking-avatar${photoAvatar ? " (their own photo)" : " clone"} speaking to camera (hook, testimonial, explainer, spoken CTA). script = the SPOKEN words — first person, punchy, to one viewer.\n` +
      `- "design": a branded still / end card (logo, offer, "Shop now"). script = the on-screen HEADLINE only.\n` +
      (hasSource ? `- "reel": a scored clip cut from the user's uploaded long video (use for b-roll / real-footage beats). script = a short note on what moment to grab.\n` : "") +
      `Open with a scroll-stopping beat and close with a clear call to action. Durations sum to ~${target}s (each 6-15s).\n` +
      `Return JSON: {"scenes":[{"engine":"ai|avatar|design${hasSource ? "|reel" : ""}","title":"2-4 words","script":"...","durationSec":10}, ...]} with exactly ${approx} scenes.`,
      { maxTokens: 2600, temperature: 0.7 },
    );
    planned = Array.isArray(json?.scenes) ? json.scenes.slice(0, 30) : [];
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
  let defAvatar: { id: string; name: string } | null = photoAvatar || (film.avatarId ? { id: film.avatarId, name: film.avatarName || "Avatar" } : null);
  let defVoice: { id: string; name: string } | null = film.voiceId ? { id: film.voiceId, name: film.voiceName || "Voice" } : null;
  if (needsAvatar && (!defAvatar || !defVoice)) {
    try {
      const [avatars, voices] = await Promise.all([listAvatarsForUser(), listVoicesForUser()]);
      if (!defAvatar && avatars[0]) defAvatar = { id: avatars[0].id, name: avatars[0].name };
      if (!defVoice && voices[0]) defVoice = { id: voices[0].id, name: voices[0].name };
    } catch { /* leave unset — the user picks in the inspector */ }
  }
  const avatarQuality = photoAvatar || film.quality === "avatar_iv" ? "avatar_iv" : "standard";
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
        transitionIn: i === 0 ? "cut" : "crossfade", // planned transitions for a finished feel
        quality: engine === "avatar" ? avatarQuality : undefined,
        style: engine === "ai" ? aiStyle : undefined,
        aiProvider: engine === "ai" ? "veo" : undefined,
        // route attached media: product image anchors AI shots + design cards
        ...(engine === "ai" && productImg ? { referenceImageUrl: productImg } : {}),
        ...(engine === "design" && productImg ? { sourceUrl: productImg, thumbnailUrl: productImg } : {}),
        ...(engine === "reel" && film.sourceVideoUrl ? { sourceUrl: film.sourceVideoUrl } : {}),
        ...(engine === "avatar" && defAvatar ? { avatarId: defAvatar.id, avatarName: defAvatar.name } : {}),
        ...(engine === "avatar" && defVoice ? { voiceId: defVoice.id, voiceName: defVoice.name } : {}),
      },
      i,
    );
  });

  film.scenes = scenes;
  // A music bed + brand logo make the cut feel finished (user can change/remove).
  if (hasMedia && !film.music) { /* music library TBD — leave for the user to add via the output node */ }
  await saveFilm(filmId, userId, film);
  return film;
}
