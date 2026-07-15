/**
 * Persistence for UGC Studio projects — stored schema-free on the Design model
 * (`type="ugc_project"`, `canvasData` = JSON of a UgcProject). Mirrors the Video
 * Director store so it reuses the same reconcile/resume/batch machinery. No migration.
 */
import { prisma } from "@/lib/db/client";
import { emptyUgcProject, normalizeUgcProject, type UgcProject, type UgcTake } from "./types";

const TYPE = "ugc_project";

function aspectToSize(aspect: string): string {
  return aspect === "1:1" ? "1024x1024" : "720x1280";
}

function parseProject(canvasData: string | null, id: string): UgcProject {
  let parsed: Partial<UgcProject> = {};
  try { parsed = canvasData ? (JSON.parse(canvasData) as Partial<UgcProject>) : {}; } catch { parsed = {}; }
  return normalizeUgcProject({ ...parsed, id });
}

export async function createUgcProject(userId: string, input: Partial<UgcProject>): Promise<UgcProject> {
  const project = normalizeUgcProject({ ...emptyUgcProject(input), id: "pending" });
  const row = await prisma.design.create({
    data: {
      userId,
      prompt: (project.script || project.title).slice(0, 2000) || "UGC",
      category: "video",
      size: aspectToSize(project.aspect),
      name: project.title.slice(0, 160),
      type: TYPE,
      status: "PENDING",
      canvasData: JSON.stringify({ ...project, id: "" }),
    },
    select: { id: true },
  });
  const full: UgcProject = { ...project, id: row.id };
  await prisma.design.update({ where: { id: row.id }, data: { canvasData: JSON.stringify(full) } });
  return full;
}

export async function getUgcProject(id: string, userId: string): Promise<UgcProject | null> {
  const row = await prisma.design.findFirst({
    where: { id, userId, type: TYPE },
    select: { id: true, canvasData: true },
  });
  if (!row) return null;
  return parseProject(row.canvasData, row.id);
}

export async function listUgcProjects(userId: string, limit = 24) {
  const rows = await prisma.design.findMany({
    where: { userId, type: TYPE },
    orderBy: { updatedAt: "desc" },
    take: Math.min(limit, 50),
    select: { id: true, canvasData: true, name: true, updatedAt: true },
  });
  const out: { id: string; title: string; aspect: string; takeCount: number; readyCount: number; thumbnailUrl: string | null; updatedAt: string }[] = [];
  for (const r of rows) {
    try {
      const p = parseProject(r.canvasData, r.id);
      const firstReady = p.takes.find((t) => t.status === "ready" && t.thumbnailUrl) || p.takes.find((t) => t.status === "ready");
      out.push({
        id: r.id,
        title: p.title || r.name || "Untitled UGC",
        aspect: p.aspect,
        takeCount: p.takes.length,
        readyCount: p.takes.filter((t) => t.status === "ready").length,
        thumbnailUrl: firstReady?.thumbnailUrl || firstReady?.videoUrl || null,
        updatedAt: r.updatedAt.toISOString(),
      });
    } catch {
      out.push({ id: r.id, title: r.name || "Untitled UGC", aspect: "9:16", takeCount: 0, readyCount: 0, thumbnailUrl: null, updatedAt: r.updatedAt.toISOString() });
    }
  }
  return out;
}

export async function saveUgcProject(id: string, userId: string, project: UgcProject): Promise<boolean> {
  const owned = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true } });
  if (!owned) return false;
  await prisma.design.update({
    where: { id },
    data: { canvasData: JSON.stringify({ ...project, id: "" }), name: project.title.slice(0, 160), size: aspectToSize(project.aspect) },
  });
  return true;
}

export async function deleteUgcProject(id: string, userId: string): Promise<boolean> {
  const owned = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true } });
  if (!owned) return false;
  await prisma.design.delete({ where: { id } });
  return true;
}

/** Patch a single take in place and persist. Returns the updated project (or null). */
export async function patchTake(projectId: string, userId: string, takeId: string, patch: Partial<UgcTake>): Promise<UgcProject | null> {
  const project = await getUgcProject(projectId, userId);
  if (!project) return null;
  const i = project.takes.findIndex((t) => t.id === takeId);
  if (i < 0) return project;
  project.takes[i] = { ...project.takes[i], ...patch };
  await saveUgcProject(projectId, userId, project);
  return project;
}
