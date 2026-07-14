import { ai } from "@/lib/ai/client";
import { getFilm, patchScene } from "./store";
import { continuityText, type FilmProject, type FilmScene, type SceneCastLine } from "./types";

export type SceneWriteMode = "scene" | "prompt";

type WrittenScene = {
  script?: string;
  cast?: { name?: string; dialogue?: string }[];
};

function sceneSummary(scene?: FilmScene): string {
  if (!scene) return "(none)";
  const dialogue = (scene.cast || [])
    .filter((line) => line.name || line.dialogue)
    .map((line) => `${line.name}: ${(line.dialogue || "(silent in shot)").slice(0, 500)}`)
    .join(" | ")
    .slice(0, 2500);
  return `${scene.title}. Shot: ${(scene.script || "(not written)").slice(0, 2000)}${dialogue ? ` Dialogue: ${dialogue}` : ""}`;
}

function castContext(film: FilmProject, scene: FilmScene, previous?: FilmScene): string {
  const known = new Map<string, { name: string; role?: string; description?: string }>();
  for (const character of film.characters || []) {
    known.set(character.name.toLowerCase(), character);
  }
  for (const line of [...(previous?.cast || []), ...(scene.cast || [])]) {
    if (line.name && !known.has(line.name.toLowerCase())) known.set(line.name.toLowerCase(), { name: line.name });
  }
  if (!known.size) return "(no named cast; keep subjects consistent with the existing film)";
  return [...known.values()]
    .map((character) => `- ${character.name}${character.role ? ` (${character.role})` : ""}${character.description ? `: ${character.description}` : ""}`)
    .join("\n");
}

function resolveCastLines(film: FilmProject, scene: FilmScene, written?: WrittenScene["cast"]): SceneCastLine[] | undefined {
  if (!Array.isArray(written) || written.length === 0) return scene.cast;
  const candidates = new Map<string, SceneCastLine>();
  for (const character of film.characters || []) {
    candidates.set(character.name.toLowerCase(), { characterId: character.id, name: character.name });
  }
  for (const line of scene.cast || []) {
    if (line.name && !candidates.has(line.name.toLowerCase())) candidates.set(line.name.toLowerCase(), { characterId: line.characterId, name: line.name });
  }

  const firstNames = new Map<string, SceneCastLine | null>();
  for (const candidate of candidates.values()) {
    const first = candidate.name.trim().split(/\s+/)[0]?.toLowerCase();
    if (!first) continue;
    firstNames.set(first, firstNames.has(first) ? null : candidate);
  }

  const out: SceneCastLine[] = [];
  for (const line of written.slice(0, 6)) {
    const rawName = String(line?.name || "").trim();
    if (!rawName) continue;
    const exact = candidates.get(rawName.toLowerCase());
    const byFirstName = firstNames.get(rawName.toLowerCase());
    const candidate = exact || byFirstName || undefined;
    if (!candidate || out.some((existing) => existing.name.toLowerCase() === candidate.name.toLowerCase())) continue;
    out.push({
      characterId: candidate.characterId,
      name: candidate.name,
      dialogue: typeof line.dialogue === "string" ? line.dialogue.trim().slice(0, 2000) : "",
    });
  }
  return out.length ? out : scene.cast;
}

export async function writeDirectorScene(
  filmId: string,
  userId: string,
  sceneId: string,
  mode: SceneWriteMode,
  instruction = "",
): Promise<{ ok: boolean; message?: string; film?: FilmProject }> {
  const film = await getFilm(filmId, userId);
  if (!film) return { ok: false, message: "Film not found." };
  const ordered = [...film.scenes].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((candidate) => candidate.id === sceneId);
  if (index < 0) return { ok: false, message: "Scene not found." };
  const scene = ordered[index];
  if (scene.engine !== "ai") return { ok: false, message: "AI scene writing is available for cinematic scenes." };

  const previous = index > 0 ? ordered[index - 1] : undefined;
  const next = index < ordered.length - 1 ? ordered[index + 1] : undefined;
  const duration = Math.min(scene.continuationMode === "exact" ? 10 : 15, Math.max(2, Math.round(scene.durationSec || 8)));
  const wordBudget = Math.max(4, Math.round(duration * 2.2));
  const continuity = continuityText(film.continuity);
  const context =
    `FILM DIRECTION: ${(film.brief || film.title).slice(0, 6000)}\n` +
    `STYLE: ${film.style || "cinematic"}; FORMAT: ${film.aspect}; SCENE ${index + 1} OF ${ordered.length}; LENGTH: ${duration}s.\n` +
    `CONTINUITY BIBLE: ${(continuity || "Keep the established world, wardrobe, lighting, and identities consistent.").slice(0, 5000)}\n` +
    `PREVIOUS SCENE: ${sceneSummary(previous)}\n` +
    `CURRENT SCENE: ${sceneSummary(scene)}\n` +
    `NEXT SCENE: ${sceneSummary(next)}\n` +
    `AVAILABLE CAST (use these exact names only):\n${castContext(film, scene, previous)}\n` +
    (scene.continuationMode === "exact"
      ? `This is an EXACT xAI video extension of the previous scene. Preserve its location, decor, people, wardrobe, lighting, framing, and camera direction; describe only the uninterrupted next action.\n`
      : "This is a new single continuous shot: one location, one framing, no cuts or angle changes inside the scene.\n");

  let written: WrittenScene | null;
  if (mode === "prompt") {
    written = await ai.generateJSON<WrittenScene>(
      `${context}\nImprove ONLY the CURRENT visual shot prompt. Keep the same story intention and cast. Make it concrete and production-ready: identify who is in frame and where, the setting, physical action, mood, lighting, and one restrained camera movement. Do not include spoken dialogue in the prompt. Return {"script":"..."}.`,
      { maxTokens: 900, temperature: 0.45 },
    );
  } else {
    const direction = instruction.trim()
      ? `USER DIRECTION (follow this exactly while fitting the film): ${instruction.trim().slice(0, 2000)}`
      : "Continue the film naturally from the previous scene and hand the action cleanly toward the next scene.";
    written = await ai.generateJSON<WrittenScene>(
      `${context}\n${direction}\nWrite this scene now. "script" is the visual shot prompt only, with one continuous camera setup and no dialogue. "cast" lists only people visibly present and gives each speaker a natural on-camera line. Dialogue across all speakers must fit ${duration}s: no more than about ${wordBudget} words total. Continue any prior conversation logically; answer a preceding question instead of changing topic. Return {"script":"...","cast":[{"name":"exact available cast name","dialogue":"spoken line"}]}.`,
      { maxTokens: 1400, temperature: 0.6 },
    );
  }

  const script = typeof written?.script === "string" ? written.script.trim().slice(0, 4000) : "";
  if (!script) return { ok: false, message: "The scene writer returned no usable prompt. Please try again." };
  const patch: Partial<FilmScene> = { script };
  if (mode === "scene") patch.cast = resolveCastLines(film, scene, written?.cast);
  const updated = await patchScene(filmId, userId, sceneId, patch);
  return updated ? { ok: true, film: updated } : { ok: false, message: "The scene changed before it could be updated." };
}
