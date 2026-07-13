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

// A cast shot renders via reference-to-video (identity-anchored), which caps at
// ~10s per clip — extension chaining is disabled (the edit endpoint caps input
// at 8.7s and burned the 1-req/sec budget). So a cast scene must be PLANNED at
// ≤10s: anything longer is a lie the render can't keep, and its dialogue gets
// rushed/truncated to fit. Films get their length from MORE scenes, not longer
// clips. Keep this in sync with GROK_MAX_REF2VID_SECONDS in video-router.ts.
const CAST_SCENE_MAX_SECONDS = 10;
// Words of dialogue a clip can hold at a natural, unhurried pace (~2.2 words/sec).
// 10s ≈ 22 words. Used to keep the storyboard from over-writing a shot.
const DIALOGUE_WORDS_PER_SEC = 2.2;

/** One planned beat from the storyboard LLM (loose shape — coerced downstream). */
type PlannedScene = { engine?: string; title?: string; script?: string; durationSec?: number; cast?: { name?: string; dialogue?: string }[] };

/**
 * Parse the storyboard model output into scene objects — ROBUST to truncation.
 * A long movie's JSON can overrun the token budget and get cut off mid-array; a
 * strict parse then fails and we fell back to a single "Opening" scene. This first
 * tries a clean parse, then salvages every COMPLETE {…} element from the scenes
 * array (string-aware balanced braces), so a truncated response still yields the
 * scenes that DID come through instead of just one.
 */
function extractScenes(raw: string): PlannedScene[] {
  const text = (raw || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { const o = JSON.parse(m[0]) as { scenes?: unknown }; if (Array.isArray(o?.scenes)) return o.scenes as PlannedScene[]; }
  } catch { /* truncated / malformed — fall through to salvage */ }
  // Salvage: scan the scenes array and keep each complete object.
  const arrStart = text.indexOf("[", text.indexOf('"scenes"') >= 0 ? text.indexOf('"scenes"') : 0);
  const src = arrStart >= 0 ? text.slice(arrStart + 1) : text;
  const out: PlannedScene[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}" && depth > 0) { depth--; if (depth === 0 && start >= 0) { try { out.push(JSON.parse(src.slice(start, i + 1)) as PlannedScene); } catch { /* partial tail object */ } start = -1; } }
  }
  return out;
}

/**
 * Generate the storyboard with a RETRY. A single transient LLM error (rate limit,
 * a blip) used to zero out the whole draft; two attempts + logging make it resilient.
 * Never throws — returns [] if both attempts come back empty.
 */
async function storyboardPlanned(prompt: string): Promise<PlannedScene[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await ai.generate(prompt, { maxTokens: 4000, temperature: attempt === 0 ? 0.7 : 0.55 });
      const scenes = extractScenes(raw).slice(0, 30);
      if (scenes.length) return scenes;
      console.warn(`[video-director] storyboard attempt ${attempt + 1} returned 0 scenes`);
    } catch (e) {
      console.error(`[video-director] storyboard attempt ${attempt + 1} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return [];
}

/**
 * Deterministic multi-scene SKELETON for a movie when the LLM storyboard can't be
 * produced — so a cast-driven film is never stuck at 0/1 scene. Lays out story
 * beats across the approved cast; the user edits the scripts + dialogue and
 * generates. Better than a dead-end retry loop.
 */
const STORY_BEATS = ["Opening", "The spark", "First step", "A challenge", "Turning point", "Setback", "The push", "A win", "The climb", "Payoff", "Resolution", "Closing"];
function castSkeleton(castList: FilmCharacter[], brief: string, approx: number): PlannedScene[] {
  const n = Math.max(3, Math.min(approx || 6, 12));
  return Array.from({ length: n }, (_, i) => ({
    engine: "ai", // every beat is a generatable cast shot (a "design" card would need an image)
    title: STORY_BEATS[i] || `Scene ${i + 1}`,
    script: `${STORY_BEATS[i] || `Beat ${i + 1}`} — ${brief}`,
    durationSec: 8,
    cast: castList.length ? [{ name: castList[i % castList.length].name, dialogue: "" }] : [],
  }));
}

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

/**
 * Run the storyboard in the BACKGROUND, then stamp the film's draftStatus so the
 * canvas poll can reflect done/failed. The /draft route kicks this off and returns
 * immediately, so a long movie storyboard can't hit the request timeout (which
 * previously left the canvas empty). Never throws.
 */
export async function draftFilmAsync(filmId: string, userId: string): Promise<void> {
  try {
    const film = await draftFilmPipeline(filmId, userId);
    const f = await getFilm(filmId, userId);
    if (f) { f.draftStatus = film && film.scenes.length ? "ready" : "failed"; await saveFilm(filmId, userId, f); }
  } catch (e) {
    console.error("[video-director] async draft failed:", e);
    const f = await getFilm(filmId, userId);
    if (f) { f.draftStatus = "failed"; await saveFilm(filmId, userId, f); }
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
  // Cast shots render at ≤10s each (CAST_SCENE_MAX_SECONDS), so budget the scene
  // count against a ~11s average (a few shorter design/silent beats pull it down
  // from 10). A 5-min film → ~27 shots. Undershooting the count makes the film come
  // out SHORTER than asked AND crams dialogue into too-few clips, so lean generous.
  const approx = film.sceneCount ? Math.max(1, Math.min(40, film.sceneCount)) : Math.max(3, Math.min(32, Math.round(target / 11)));
  const hasSource = !!film.sourceVideoUrl;

  // A MOVIE is built around its approved CAST acting in AI shots — it never uses
  // a talking-head avatar (that's the Avatar tab) unless the user attached their
  // OWN photo to present. So avatar is off for movies by default.
  const isMovie = film.filmType === "ai_film";
  const approvedCast = (film.characters || []).filter((c) => c.approved);
  const castList = approvedCast.length ? approvedCast : (film.characters || []);
  const useCast = isMovie && castList.length > 0;
  const allowAvatar = !isMovie || !!photoAvatar;

  let planned: PlannedScene[] = [];
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
        `- CINEMATIC FLOW & COMPOSITION (so the film plays as ONE piece, not disconnected clips): write each scene to ENTER and EXIT in motion — begin with the action already underway and end on a beat that hands off to the next scene (a glance, a step, a line landing) so the cut feels motivated, never abrupt. Give ADJACENT scenes a visual through-line (the same place & light, a matched movement, or an eyeline that carries over). Vary the shot scale for real rhythm — open on an establishing WIDE, use MEDIUM two-shots for dialogue, push to CLOSE-UPS for emotion — and say the framing in the script.\n` +
        `For EACH scene give:\n` +
        `- "engine": "ai" for a shot of the cast acting (the default), or "design" for a branded end card (use only for the final beat).\n` +
        `- "title": 2-4 words.\n` +
        `- "script": the SHOT — setting, camera FRAMING (wide/medium/close), the action, and mood (what is ON SCREEN). Describe how the shot opens and where it lands. NOT the dialogue.\n` +
        `- "cast": who is on screen and what they SAY — [{"name":"<a cast name from above>","dialogue":"their spoken line — leave empty ONLY for a deliberate silent beat"}]. Lines must continue the conversation from the previous scene.\n` +
        `- "durationSec": each cast shot renders up to ${CAST_SCENE_MAX_SECONDS}s, so keep every beat 6-${CAST_SCENE_MAX_SECONDS}s — NEVER longer. Dialogue MUST fit at ~2 words/sec (8s ≈ 16 words, ${CAST_SCENE_MAX_SECONDS}s ≈ ${Math.round(CAST_SCENE_MAX_SECONDS * DIALOGUE_WORDS_PER_SEC)} words). That means AT MOST one line, or a tight two-line exchange (~10 words each), per scene. This is a HARD limit: writing more words than fit makes the actors rush and swallow half the line — a failure. To show a LONGER conversation, SPLIT it across consecutive scenes (each scene continues the exchange from the last), never cram it into one shot.\n` +
        `Open on a hook, build the story with connected beats, resolve it at the end. Return JSON: {"scenes":[{"engine":"ai","title":"...","script":"...","cast":[{"name":"...","dialogue":"..."}],"durationSec":9}, ...]} with exactly ${approx} scenes.`;
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
    // Drafting is async now (background), so token headroom + a retry are safe.
    planned = await storyboardPlanned(prompt);
  } catch (e) {
    console.error("[video-director] storyboard build failed:", e instanceof Error ? e.message : e);
    planned = [];
  }

  // Establish the shared world AFTER the storyboard (sequential, not parallel — two
  // simultaneous LLM calls can trip a rate/concurrency limit and zero out the draft).
  // Async draft means the extra latency is invisible. Stored for render-time keyframes.
  film.continuity = await establishContinuity(brief, film.style, target, castList).catch(() => null);

  if (planned.length === 0) {
    // Never dead-end: a movie gets a real multi-scene skeleton to edit; other kinds
    // get their usual 3-beat starter. (A blank canvas + retry loop helps no one.)
    planned = useCast
      ? castSkeleton(castList, brief, approx)
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
        // Cast shots render at ≤10s (reference-to-video, no extension chaining), so a
        // cast beat can't be planned longer than the clip it produces — else its dialogue
        // overflows and rushes. Design/end-card beats stay short; non-cast clips ≤15s.
        durationSec: typeof s.durationSec === "number"
          ? Math.max(2, Math.min(useCast ? CAST_SCENE_MAX_SECONDS : 15, Math.round(s.durationSec)))
          : engine === "design" ? 3 : useCast ? CAST_SCENE_MAX_SECONDS : 8,
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
