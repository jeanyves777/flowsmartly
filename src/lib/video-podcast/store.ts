/**
 * Video Podcast — persistence. Schema-free on the Design row (`canvasData` JSON),
 * same as the other playgrounds. [[clone-yourself-studio]]
 */
import { prisma } from "@/lib/db/client";
import {
  aspectToSize, emptyPodcast, normalizePodcast, normalizeTurn,
  type PodcastProject, type PodcastTurn,
} from "./types";

const TYPE = "podcast_project";

export async function createProject(userId: string, input: Partial<PodcastProject>): Promise<PodcastProject> {
  const row = await prisma.design.create({
    data: {
      userId,
      type: TYPE,
      category: "video",
      name: (input.title || "Video podcast").slice(0, 160),
      prompt: (input.brief || input.title || "Video podcast").slice(0, 2000),
      size: aspectToSize(input.aspect || "16:9"),
      status: "PENDING",
      canvasData: "{}",
    },
    select: { id: true },
  });
  const project = normalizePodcast({ ...emptyPodcast({ id: row.id }), ...input, id: row.id });
  await prisma.design.update({ where: { id: row.id }, data: { canvasData: JSON.stringify(project) } });
  return project;
}

export async function getProject(id: string, userId: string): Promise<PodcastProject | null> {
  const row = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true, canvasData: true } });
  if (!row) return null;
  try {
    return normalizePodcast({ ...(JSON.parse(row.canvasData || "{}") as Partial<PodcastProject>), id: row.id });
  } catch {
    return normalizePodcast({ id: row.id });
  }
}

export async function saveProject(id: string, userId: string, project: PodcastProject): Promise<boolean> {
  const owned = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true } });
  if (!owned) return false;
  const clean = normalizePodcast({ ...project, id });
  await prisma.design.update({
    where: { id },
    data: {
      canvasData: JSON.stringify(clean),
      name: clean.title.slice(0, 160),
      size: aspectToSize(clean.aspect),
      status: clean.finalVideoUrl ? "COMPLETED" : "PENDING",
    },
  });
  return true;
}

export async function listProjects(userId: string, limit = 24) {
  const rows = await prisma.design.findMany({
    where: { userId, type: TYPE },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, name: true, updatedAt: true, canvasData: true },
  });
  return rows.map((r) => {
    try {
      const p = normalizePodcast({ ...(JSON.parse(r.canvasData || "{}") as Partial<PodcastProject>), id: r.id });
      return {
        id: r.id, title: p.title,
        host: p.host.name, guest: p.guest.name,
        turnCount: p.turns.length,
        readyCount: p.turns.filter((t) => t.status === "ready").length,
        cover: p.host.portraitUrl ?? p.guest.portraitUrl ?? null,
        finalVideoUrl: p.finalVideoUrl ?? null,
        updatedAt: r.updatedAt.toISOString(),
      };
    } catch {
      return { id: r.id, title: r.name, host: "", guest: "", turnCount: 0, readyCount: 0, cover: null, finalVideoUrl: null, updatedAt: r.updatedAt.toISOString() };
    }
  });
}

export async function deleteProject(id: string, userId: string): Promise<boolean> {
  const res = await prisma.design.deleteMany({ where: { id, userId, type: TYPE } });
  return res.count > 0;
}

/** Merge-patch ONE turn. Re-reads first so concurrent renders don't clobber each other. */
export async function patchTurn(id: string, userId: string, turnId: string, patch: Partial<PodcastTurn>): Promise<PodcastProject | null> {
  const p = await getProject(id, userId);
  if (!p) return null;
  const i = p.turns.findIndex((t) => t.id === turnId);
  if (i < 0) return null;
  p.turns[i] = normalizeTurn({ ...p.turns[i], ...patch }, i);
  await saveProject(id, userId, p);
  return p;
}

/** Merge-patch project-level fields (draft/final status, backdrop, etc.). */
export async function patchProject(id: string, userId: string, patch: Partial<PodcastProject>): Promise<PodcastProject | null> {
  const p = await getProject(id, userId);
  if (!p) return null;
  const merged = normalizePodcast({ ...p, ...patch, id });
  await saveProject(id, userId, merged);
  return merged;
}
