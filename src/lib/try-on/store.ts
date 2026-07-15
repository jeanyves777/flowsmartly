/**
 * Persistence for Virtual Try-on projects — Design model, `type="tryon_project"`.
 * Mirrors the UGC / Product-ads stores. No migration.
 */
import { prisma } from "@/lib/db/client";
import { emptyTryOnProject, normalizeTryOnProject, type TryOnProject, type TryOnTake } from "./types";

const TYPE = "tryon_project";

function aspectToSize(aspect: string): string {
  return aspect === "1:1" ? "1024x1024" : aspect === "9:16" ? "720x1280" : "720x960";
}

function parseProject(canvasData: string | null, id: string): TryOnProject {
  let parsed: Partial<TryOnProject> = {};
  try { parsed = canvasData ? (JSON.parse(canvasData) as Partial<TryOnProject>) : {}; } catch { parsed = {}; }
  return normalizeTryOnProject({ ...parsed, id });
}

export async function createTryOnProject(userId: string, input: Partial<TryOnProject>): Promise<TryOnProject> {
  const project = normalizeTryOnProject({ ...emptyTryOnProject(input), id: "pending" });
  const row = await prisma.design.create({
    data: {
      userId,
      prompt: (project.prompt || project.title).slice(0, 2000) || "Virtual try-on",
      category: "video",
      size: aspectToSize(project.aspect),
      name: project.title.slice(0, 160),
      type: TYPE,
      status: "PENDING",
      canvasData: JSON.stringify({ ...project, id: "" }),
    },
    select: { id: true },
  });
  const full: TryOnProject = { ...project, id: row.id };
  await prisma.design.update({ where: { id: row.id }, data: { canvasData: JSON.stringify(full) } });
  return full;
}

export async function getTryOnProject(id: string, userId: string): Promise<TryOnProject | null> {
  const row = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true, canvasData: true } });
  if (!row) return null;
  return parseProject(row.canvasData, row.id);
}

export async function listTryOnProjects(userId: string, limit = 24) {
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
      const first = p.takes.find((t) => t.status === "ready");
      out.push({
        id: r.id, title: p.title || r.name || "Untitled try-on", aspect: p.aspect,
        takeCount: p.takes.length, readyCount: p.takes.filter((t) => t.status === "ready").length,
        thumbnailUrl: first?.thumbnailUrl || first?.videoUrl || null,
        updatedAt: r.updatedAt.toISOString(),
      });
    } catch {
      out.push({ id: r.id, title: r.name || "Untitled try-on", aspect: "3:4", takeCount: 0, readyCount: 0, thumbnailUrl: null, updatedAt: r.updatedAt.toISOString() });
    }
  }
  return out;
}

export async function saveTryOnProject(id: string, userId: string, project: TryOnProject): Promise<boolean> {
  const owned = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true } });
  if (!owned) return false;
  await prisma.design.update({
    where: { id },
    data: { canvasData: JSON.stringify({ ...project, id: "" }), name: project.title.slice(0, 160), size: aspectToSize(project.aspect) },
  });
  return true;
}

export async function deleteTryOnProject(id: string, userId: string): Promise<boolean> {
  const owned = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true } });
  if (!owned) return false;
  await prisma.design.delete({ where: { id } });
  return true;
}

export async function patchTryOnTake(projectId: string, userId: string, takeId: string, patch: Partial<TryOnTake>): Promise<TryOnProject | null> {
  const project = await getTryOnProject(projectId, userId);
  if (!project) return null;
  const i = project.takes.findIndex((t) => t.id === takeId);
  if (i < 0) return project;
  project.takes[i] = { ...project.takes[i], ...patch };
  await saveTryOnProject(projectId, userId, project);
  return project;
}
