/**
 * Persistence for Director films — stored schema-free on the Design model
 * (`type="director_film"`, `canvasData` = JSON of a FilmProject). No migration.
 */

import { prisma } from "@/lib/db/client";
import {
  aspectToSize,
  emptyFilm,
  normalizeFilm,
  normalizeScene,
  normalizeOverlay,
  normalizeVideoEdit,
  type FilmProject,
  type FilmScene,
  type FilmOverlay,
  type FilmVideoEdit,
} from "./types";

const TYPE = "director_film";

function parseFilm(canvasData: string | null, id: string): FilmProject {
  let parsed: Partial<FilmProject> = {};
  try {
    parsed = canvasData ? (JSON.parse(canvasData) as Partial<FilmProject>) : {};
  } catch {
    parsed = {};
  }
  return normalizeFilm({ ...parsed, id });
}

export async function createFilm(userId: string, input: Partial<FilmProject>): Promise<FilmProject> {
  const project = normalizeFilm({ ...emptyFilm(input), id: "pending" });
  const row = await prisma.design.create({
    data: {
      userId,
      prompt: (project.brief || project.title).slice(0, 2000) || "Film",
      category: "video",
      size: aspectToSize(project.aspect),
      name: project.title.slice(0, 160),
      type: TYPE,
      status: "PENDING",
      canvasData: JSON.stringify({ ...project, id: "" }),
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });
  const full: FilmProject = {
    ...project,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  await prisma.design.update({ where: { id: row.id }, data: { canvasData: JSON.stringify(full) } });
  return full;
}

export async function getFilm(id: string, userId: string): Promise<FilmProject | null> {
  const row = await prisma.design.findFirst({
    where: { id, userId, type: TYPE },
    select: { id: true, canvasData: true, createdAt: true, updatedAt: true },
  });
  if (!row) return null;
  return {
    ...parseFilm(row.canvasData, row.id),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFilms(userId: string, limit = 24) {
  const rows = await prisma.design.findMany({
    where: { userId, type: TYPE },
    orderBy: { updatedAt: "desc" },
    take: Math.min(limit, 50),
    select: { id: true, canvasData: true, name: true, updatedAt: true },
  });
  // Per-row resilience: one unparseable film must NEVER blank the whole library.
  const out: {
    id: string; title: string; aspect: string; filmType: string; sceneCount: number;
    readyCount: number; finalVideoUrl: string | null; finalStatus: string; updatedAt: string;
  }[] = [];
  for (const r of rows) {
    try {
      const film = parseFilm(r.canvasData, r.id);
      out.push({
        id: r.id,
        title: film.title || r.name || "Untitled film",
        aspect: film.aspect,
        filmType: film.filmType,
        sceneCount: film.scenes.length,
        readyCount: film.scenes.filter((s) => s.status === "ready").length,
        finalVideoUrl: film.finalVideoUrl ?? null,
        finalStatus: film.finalStatus ?? "draft",
        updatedAt: r.updatedAt.toISOString(),
      });
    } catch (err) {
      // Still surface the film with a minimal card rather than dropping it.
      console.error(`[video-director] listFilms: bad row ${r.id}:`, err);
      out.push({
        id: r.id, title: r.name || "Untitled film", aspect: "9:16", filmType: "ai_film",
        sceneCount: 0, readyCount: 0, finalVideoUrl: null, finalStatus: "draft", updatedAt: r.updatedAt.toISOString(),
      });
    }
  }
  return out;
}

/**
 * The user's reusable CAST across all their films — so a serial/franchise can reuse
 * the SAME characters (same face) in a new episode instead of regenerating them.
 * Only characters with a generated portrait are included; de-duped by portrait so the
 * same person picked in many films appears once. Newest film first.
 */
export async function listCastLibrary(
  userId: string,
  opts: { excludeFilmId?: string; limit?: number } = {},
): Promise<{
  sourceId: string; name: string; role: string; description: string; renderStyle: "cinematic" | "3d"; wardrobe: string;
  portraitUrl: string; sheetUrl: string | null; filmId: string; filmTitle: string; updatedAt: string;
}[]> {
  const rows = await prisma.design.findMany({
    where: { userId, type: TYPE, ...(opts.excludeFilmId ? { id: { not: opts.excludeFilmId } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, canvasData: true, name: true, updatedAt: true },
  });
  const out: Awaited<ReturnType<typeof listCastLibrary>> = [];
  const seenPortrait = new Set<string>();
  for (const r of rows) {
    let film: FilmProject;
    try { film = parseFilm(r.canvasData, r.id); } catch { continue; }
    for (const c of film.characters || []) {
      const portrait = c.referenceImageUrl;
      if (!portrait || seenPortrait.has(portrait)) continue;
      seenPortrait.add(portrait);
      out.push({
        sourceId: `${r.id}:${c.id}`,
        name: c.name || "Character",
        role: c.role || "",
        description: c.description || "",
        renderStyle: c.renderStyle === "3d" ? "3d" : "cinematic",
        wardrobe: c.wardrobe || "",
        portraitUrl: portrait,
        sheetUrl: c.characterSheetUrl || null,
        filmId: r.id,
        filmTitle: film.title || r.name || "Untitled film",
        updatedAt: r.updatedAt.toISOString(),
      });
      if (out.length >= (opts.limit ?? 60)) return out;
    }
  }
  return out;
}

export async function saveFilm(id: string, userId: string, project: FilmProject): Promise<boolean> {
  const owned = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true } });
  if (!owned) return false;
  const clean = normalizeFilm({ ...project, id });
  await prisma.design.update({
    where: { id },
    data: {
      canvasData: JSON.stringify(clean),
      name: clean.title.slice(0, 160),
      prompt: (clean.brief || clean.title).slice(0, 2000) || "Film",
      size: aspectToSize(clean.aspect),
      status: clean.finalVideoUrl ? "COMPLETED" : "PENDING",
    },
  });
  return true;
}

export async function deleteFilm(id: string, userId: string): Promise<boolean> {
  const res = await prisma.design.deleteMany({ where: { id, userId, type: TYPE } });
  return res.count > 0;
}

/**
 * Merge-patch the film-level stitch fields. Re-reads first so a heartbeat can't
 * clobber scene updates landing while the (long) stitch runs.
 */
export async function patchFilmFinal(
  filmId: string,
  userId: string,
  patch: Partial<Pick<FilmProject, "finalStatus" | "finalProgress" | "finalVideoUrl" | "finalHeartbeatAt" | "finalTries">>,
): Promise<FilmProject | null> {
  const film = await getFilm(filmId, userId);
  if (!film) return null;
  Object.assign(film, patch);
  await saveFilm(filmId, userId, film);
  return film;
}

/**
 * Merge-patch a single scene (used by generation kicks + status polling). Returns
 * the updated film, or null if the film/scene is gone. Re-reads before writing so
 * concurrent scene updates don't clobber each other's fields.
 */
export async function patchScene(
  filmId: string,
  userId: string,
  sceneId: string,
  patch: Partial<FilmScene>,
): Promise<FilmProject | null> {
  const film = await getFilm(filmId, userId);
  if (!film) return null;
  const idx = film.scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0) return null;
  film.scenes[idx] = normalizeScene({ ...film.scenes[idx], ...patch }, idx);
  await saveFilm(filmId, userId, film);
  return film;
}

/** Merge-patch a scene's PiP overlay (used by overlay generation + status polling). */
export async function patchOverlay(
  filmId: string,
  userId: string,
  sceneId: string,
  patch: Partial<FilmOverlay>,
): Promise<FilmProject | null> {
  const film = await getFilm(filmId, userId);
  if (!film) return null;
  const idx = film.scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0 || !film.scenes[idx].overlay) return null;
  film.scenes[idx].overlay = normalizeOverlay({ ...film.scenes[idx].overlay, ...patch });
  await saveFilm(filmId, userId, film);
  return film;
}

/** Merge-patch a scene's independent xAI video-edit job. */
export async function patchVideoEdit(
  filmId: string,
  userId: string,
  sceneId: string,
  patch: Partial<FilmVideoEdit>,
): Promise<FilmProject | null> {
  const film = await getFilm(filmId, userId);
  if (!film) return null;
  const idx = film.scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0 || !film.scenes[idx].videoEdit) return null;
  film.scenes[idx].videoEdit = normalizeVideoEdit({ ...film.scenes[idx].videoEdit, ...patch });
  await saveFilm(filmId, userId, film);
  return film;
}
