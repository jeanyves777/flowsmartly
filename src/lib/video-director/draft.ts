/**
 * The director's brain — turn a brief into a pipeline of scene nodes, choosing
 * the right engine per beat (cinematic AI shot, talking-avatar clone, branded
 * still). Avatar scenes are pre-set to the user's default avatar/voice so they
 * generate in one click. Drafting is free; generating each scene is charged.
 */

import { ai } from "@/lib/ai/client";
import { getFilm, saveFilm } from "./store";
import { normalizeScene, normalizeContinuity, type FilmProject, type FilmScene, type FilmCharacter, type FilmContinuity, type SceneEngine } from "./types";
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

/**
 * Establish the film's CONTINUITY BIBLE (free, one LLM call): the single shared
 * world — primary location(s), a held time-of-day/colour palette, and each cast
 * member's LOCKED wardrobe. Woven into every shot + keyframe so scenes stop
 * drifting into different places, lighting or clothes shot-to-shot.
 */
async function establishContinuity(
  brief: string,
  style: string | null | undefined,
  target: number,
  cast: FilmCharacter[],
): Promise<FilmContinuity | null> {
  const castBlock = cast.length
    ? cast.map((c) => `- ${c.name}${c.wardrobe?.trim() ? ` (MUST wear: ${c.wardrobe.trim()})` : ""}: ${c.description}`).join("\n")
    : "(no named cast — describe the on-screen people/subjects generically)";
  try {
    const json = await ai.generateJSON<FilmContinuity>(
      `You are the CONTINUITY supervisor for a ${target}s ${style || "cinematic"} film. Brief: "${brief}".\n` +
        `CAST:\n${castBlock}\n` +
        `Define the film's CONTINUITY BIBLE so every scene shares ONE consistent world — the same place, the same look, the same clothes:\n` +
        `- "location": the primary concrete setting(s) where the story happens — specific and vivid (e.g. "a sun-bleached municipal soccer pitch with chain-link fencing and worn wooden bleachers"). If the story genuinely moves, name the 2-3 key locations.\n` +
        `- "timePalette": the time of day + the consistent lighting and colour palette held across the WHOLE film.\n` +
        `- "wardrobe": for EACH cast member, the ONE fixed outfit they wear throughout (specific garments + colours). If a cast member already has a required outfit above, use it VERBATIM. Keep each outfit constant unless the story truly demands a change.\n` +
        `Return JSON: {"location":"...","timePalette":"...","wardrobe":[{"name":"<cast name>","outfit":"..."}]}.`,
      { maxTokens: 900, temperature: 0.5 },
    );
    const c = normalizeContinuity(json);
    if (!c?.wardrobe) return c;
    // Link each wardrobe entry back to its cast id (best-effort, by name).
    const byName = new Map(cast.map((x) => [x.name.toLowerCase(), x.id]));
    c.wardrobe = c.wardrobe.map((w) => ({ ...w, characterId: w.characterId || byName.get((w.name || "").toLowerCase()) }));
    return c;
  } catch {
    return null;
  }
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

  // A MOVIE is built around its approved CAST acting in AI shots — it never uses
  // a talking-head avatar (that's the Avatar tab) unless the user attached their
  // OWN photo to present. So avatar is off for movies by default.
  const isMovie = film.filmType === "ai_film";
  const approvedCast = (film.characters || []).filter((c) => c.approved);
  const castList = approvedCast.length ? approvedCast : (film.characters || []);
  const useCast = isMovie && castList.length > 0;
  const allowAvatar = !isMovie || !!photoAvatar;

  // Establish the shared world (location / palette / wardrobe) CONCURRENTLY with the
  // storyboard. Running it as a SECOND SEQUENTIAL LLM call here added enough latency
  // to push long movies past the request timeout — the draft never returned and the
  // canvas came back EMPTY. The bible is stored for RENDER-time use (keyframes + shot
  // prompts), which is where the visual continuity actually matters; the storyboard
  // scripts don't need it inline. Awaited below, after the (longer) storyboard call.
  const continuityPromise = establishContinuity(brief, film.style, target, castList).catch(() => null);

  type Planned = { engine?: string; title?: string; script?: string; durationSec?: number; cast?: { name?: string; dialogue?: string }[] };
  let planned: Planned[] = [];
  try {
    let prompt: string;
    if (useCast) {
      const castBlock = castList.map((c) => `- ${c.name} — ${c.role}: ${c.description}`).join("\n");
      prompt =
        `You are a SCREENWRITER + director writing ONE continuous ${target}s ${film.style || "cinematic"} short FILM as a shot list. Brief: "${brief}".\n` +
        `CAST — every on-screen character MUST be one of these EXACT people (use their names verbatim):\n${castBlock}\n` +
        (productImg ? `A product/reference image is attached — you may feature it in a shot or a "design" end card.\n` : "") +
        `Write the WHOLE film as one coherent story before you output — a clear beginning, middle and end — then break it into exactly ${approx} scenes IN ORDER.\n` +
        `STORY CONTINUITY (this is the most important rule):\n` +
        `- Each scene must flow DIRECTLY and NATURALLY from the one before it — continuous time/place or a purposeful cut, clear cause → effect. No jumping to unrelated moments, no non-sequiturs.\n` +
        `- The DIALOGUE across all scenes must read as ONE real, logical conversation/screenplay. If a character asks a question, it gets ANSWERED (in the same scene or the very next) — NEVER leave a question hanging or switch topics abruptly. A question with no answer, or a line that ignores the previous line, is a hard failure.\n` +
        `- Keep CONSISTENCY throughout: the same names, relationships, goals, wardrobe and tone; the plot advances logically scene to scene.\n` +
        `- Minimise SILENT scenes: MOST scenes should carry spoken dialogue that moves the story. Only make a scene silent when the silence itself is the point (one deliberate establishing or emotional beat) — never pad with silent 'in shot' characters. Only include a character in a scene if they matter to that beat.\n` +
        `For EACH scene give:\n` +
        `- "engine": "ai" for a shot of the cast acting (the default), or "design" for a branded end card (use only for the final beat).\n` +
        `- "title": 2-4 words.\n` +
        `- "script": the SHOT — setting, action, camera, mood (what is ON SCREEN). NOT the dialogue.\n` +
        `- "cast": who is on screen and what they SAY — [{"name":"<a cast name from above>","dialogue":"their spoken line — leave empty ONLY for a deliberate silent beat"}]. Lines must continue the conversation from the previous scene.\n` +
        `- "durationSec": PREFER 8; use up to 15 only when a beat truly needs it. The total spoken dialogue in a scene must FIT its duration — about 2 words per second (an 8s shot ≈ 16 words total, 15s ≈ 30). Keep lines short.\n` +
        `Open on a hook, build the story with connected beats, resolve it at the end. Return JSON: {"scenes":[{"engine":"ai","title":"...","script":"...","cast":[{"name":"...","dialogue":"..."}],"durationSec":8}, ...]} with exactly ${approx} scenes.`;
    } else {
      const engines: string[] = ['"ai": a cinematic AI shot. script = a vivid SHOT PROMPT (what\'s on screen, mood, motion) — no dialogue.'];
      if (allowAvatar) engines.push(`"avatar": the user's talking-avatar${photoAvatar ? " (their own photo)" : " clone"} speaking to camera. script = the SPOKEN words — first person, punchy.`);
      engines.push('"design": a branded still / end card. script = the on-screen HEADLINE only.');
      if (hasSource) engines.push('"reel": a scored clip cut from the uploaded long video. script = a short note on which moment to grab.');
      prompt =
        `You are a senior video DIRECTOR planning a ${target}s ${film.filmType.replace("_", " ")} as a sequence of scenes. Brief: "${brief}".\n` +
        (photoAvatar ? `The user attached a PHOTO OF THEMSELVES — use "avatar" scenes for a PRESENTER that is them.\n` : "") +
        (productImg ? `A PRODUCT/REFERENCE image is attached — use "ai" shots to show it and a "design" end card featuring it.\n` : "") +
        `Plan exactly ${approx} scenes that build one cohesive story. For EACH scene pick the best engine:\n` +
        engines.map((e) => `- ${e}`).join("\n") + "\n" +
        `Open with a scroll-stopping beat and close with a clear call to action. Durations sum to ~${target}s (each 6-15s).\n` +
        `Return JSON: {"scenes":[{"engine":"...","title":"2-4 words","script":"...","durationSec":10}, ...]} with exactly ${approx} scenes.`;
    }
    const json = await ai.generateJSON<{ scenes: Planned[] }>(prompt, { maxTokens: 2800, temperature: 0.7 });
    planned = Array.isArray(json?.scenes) ? json.scenes.slice(0, 30) : [];
  } catch {
    planned = [];
  }
  if (planned.length === 0) {
    planned = useCast
      ? castList.slice(0, 1).map((c) => ({ engine: "ai", title: "Opening", script: brief, durationSec: 8, cast: [{ name: c.name, dialogue: "" }] }))
      : [
          { engine: "ai", title: "Hook", script: brief, durationSec: 8 },
          { engine: allowAvatar ? "avatar" : "ai", title: "Message", script: brief, durationSec: 12 },
          { engine: "design", title: "Call to action", script: "Learn more", durationSec: 4 },
        ];
  }
  const nameToId = new Map(castList.map((c) => [c.name.toLowerCase(), c.id]));

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
    let engine = (ENGINE_SET.has(s.engine as SceneEngine) ? s.engine : "ai") as SceneEngine;
    // A movie never renders as a talking-head avatar — coerce any avatar beat to an AI shot of the cast.
    if (useCast && engine === "avatar") engine = "ai";
    const sceneCast = Array.isArray(s.cast)
      ? s.cast.filter((l) => l?.name).slice(0, 6).map((l) => ({
          characterId: nameToId.get(String(l.name).toLowerCase()),
          name: String(l.name).slice(0, 80),
          dialogue: typeof l.dialogue === "string" ? l.dialogue.slice(0, 2000) : "",
        }))
      : undefined;
    return normalizeScene(
      {
        id: `sc_${i}_${Math.random().toString(36).slice(2, 7)}`,
        engine,
        title: (s.title || `Scene ${i + 1}`).slice(0, 60),
        script: (s.script || brief).slice(0, 4000),
        cast: sceneCast,
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
  // The continuity bible ran alongside the storyboard — fold it in now (already
  // resolved, so this adds no latency) for RENDER-time keyframes + shot prompts.
  film.continuity = await continuityPromise;
  // A music bed + brand logo make the cut feel finished (user can change/remove).
  if (hasMedia && !film.music) { /* music library TBD — leave for the user to add via the output node */ }
  await saveFilm(filmId, userId, film);
  return film;
}
