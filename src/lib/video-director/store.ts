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
  type FilmProject,
  type FilmScene,
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
    select: { id: true, canvasData: true, updatedAt: true },
  });
  return rows.map((r) => {
    const film = parseFilm(r.canvasData, r.id);
    return {
      id: r.id,
      title: film.title,
      aspect: film.aspect,
      filmType: film.filmType,
      sceneCount: film.scenes.length,
      readyCount: film.scenes.filter((s) => s.status === "ready").length,
      finalVideoUrl: film.finalVideoUrl ?? null,
      finalStatus: film.finalStatus ?? "draft",
      updatedAt: r.updatedAt.toISOString(),
    };
  });
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
