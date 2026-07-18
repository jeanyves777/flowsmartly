/**
 * Clone Yourself — persistence. Schema-free on the Design row (canvasData JSON),
 * same as the other playgrounds. [[clone-studio]]
 */
import { prisma } from "@/lib/db/client";
import {
  aspectToSize, emptyProject, normalizeProject, normalizeShot, normalizeIdentity,
  type CloneProject, type CloneShot, type CloneIdentity,
} from "./types";

const TYPE = "clone_project";

export async function createProject(userId: string, input: Partial<CloneProject>): Promise<CloneProject> {
  const row = await prisma.design.create({
    data: {
      userId,
      type: TYPE,
      category: "image",
      name: (input.title || "Clone session").slice(0, 160),
      prompt: (input.title || "Clone yourself").slice(0, 2000),
      size: aspectToSize("1:1"),
      status: "PENDING",
      canvasData: "{}",
    },
    select: { id: true },
  });
  const project = normalizeProject({ ...emptyProject({ id: row.id }), ...input, id: row.id });
  await prisma.design.update({ where: { id: row.id }, data: { canvasData: JSON.stringify(project) } });
  return project;
}

export async function getProject(id: string, userId: string): Promise<CloneProject | null> {
  const row = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true, canvasData: true } });
  if (!row) return null;
  try {
    return normalizeProject({ ...(JSON.parse(row.canvasData || "{}") as Partial<CloneProject>), id: row.id });
  } catch {
    return normalizeProject({ id: row.id });
  }
}

export async function saveProject(id: string, userId: string, project: CloneProject): Promise<boolean> {
  const owned = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true } });
  if (!owned) return false;
  const clean = normalizeProject({ ...project, id });
  await prisma.design.update({
    where: { id },
    data: {
      canvasData: JSON.stringify(clean),
      name: clean.title.slice(0, 160),
      size: aspectToSize(clean.shots[0]?.aspect || "1:1"),
      status: clean.shots.some((s) => s.status === "ready") ? "COMPLETED" : "PENDING",
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
      const p = normalizeProject({ ...(JSON.parse(r.canvasData || "{}") as Partial<CloneProject>), id: r.id });
      return {
        id: r.id, title: p.title,
        cloneCount: p.clones.length,
        shotCount: p.shots.length,
        readyCount: p.shots.filter((s) => s.status === "ready").length,
        cover: p.shots.find((s) => s.imageUrl)?.imageUrl ?? p.clones[0]?.photoUrls[0] ?? null,
        updatedAt: r.updatedAt.toISOString(),
      };
    } catch {
      return { id: r.id, title: r.name, cloneCount: 0, shotCount: 0, readyCount: 0, cover: null, updatedAt: r.updatedAt.toISOString() };
    }
  });
}

export async function deleteProject(id: string, userId: string): Promise<boolean> {
  const res = await prisma.design.deleteMany({ where: { id, userId, type: TYPE } });
  return res.count > 0;
}

/** Merge-patch ONE shot. Re-reads first so concurrent renders don't clobber each other. */
export async function patchShot(id: string, userId: string, shotId: string, patch: Partial<CloneShot>): Promise<CloneProject | null> {
  const p = await getProject(id, userId);
  if (!p) return null;
  const i = p.shots.findIndex((s) => s.id === shotId);
  if (i < 0) return null;
  p.shots[i] = normalizeShot({ ...p.shots[i], ...patch }, i);
  await saveProject(id, userId, p);
  return p;
}

/** Merge-patch ONE clone identity. */
export async function patchClone(id: string, userId: string, cloneId: string, patch: Partial<CloneIdentity>): Promise<CloneProject | null> {
  const p = await getProject(id, userId);
  if (!p) return null;
  const i = p.clones.findIndex((c) => c.id === cloneId);
  if (i < 0) return null;
  p.clones[i] = normalizeIdentity({ ...p.clones[i], ...patch }, i);
  await saveProject(id, userId, p);
  return p;
}
