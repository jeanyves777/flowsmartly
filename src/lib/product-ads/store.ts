/**
 * Persistence for Product Ads projects — Design model, `type="product_ad_project"`,
 * canvasData = JSON of an AdProject. Mirrors the UGC/Director stores. No migration.
 */
import { prisma } from "@/lib/db/client";
import { emptyAdProject, normalizeAdProject, type AdProject, type AdTake } from "./types";

const TYPE = "product_ad_project";

function aspectToSize(aspect: string): string {
  return aspect === "1:1" ? "1024x1024" : aspect === "16:9" ? "1280x720" : "720x1280";
}

function parseProject(canvasData: string | null, id: string): AdProject {
  let parsed: Partial<AdProject> = {};
  try { parsed = canvasData ? (JSON.parse(canvasData) as Partial<AdProject>) : {}; } catch { parsed = {}; }
  return normalizeAdProject({ ...parsed, id });
}

export async function createAdProject(userId: string, input: Partial<AdProject>): Promise<AdProject> {
  const project = normalizeAdProject({ ...emptyAdProject(input), id: "pending" });
  const row = await prisma.design.create({
    data: {
      userId,
      prompt: (project.prompt || project.title).slice(0, 2000) || "Product ad",
      category: "video",
      size: aspectToSize(project.aspect),
      name: project.title.slice(0, 160),
      type: TYPE,
      status: "PENDING",
      canvasData: JSON.stringify({ ...project, id: "" }),
    },
    select: { id: true },
  });
  const full: AdProject = { ...project, id: row.id };
  await prisma.design.update({ where: { id: row.id }, data: { canvasData: JSON.stringify(full) } });
  return full;
}

export async function getAdProject(id: string, userId: string): Promise<AdProject | null> {
  const row = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true, canvasData: true } });
  if (!row) return null;
  return parseProject(row.canvasData, row.id);
}

export async function listAdProjects(userId: string, limit = 24) {
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
        id: r.id, title: p.title || r.name || "Untitled ad", aspect: p.aspect,
        takeCount: p.takes.length, readyCount: p.takes.filter((t) => t.status === "ready").length,
        thumbnailUrl: first?.thumbnailUrl || first?.videoUrl || null,
        updatedAt: r.updatedAt.toISOString(),
      });
    } catch {
      out.push({ id: r.id, title: r.name || "Untitled ad", aspect: "9:16", takeCount: 0, readyCount: 0, thumbnailUrl: null, updatedAt: r.updatedAt.toISOString() });
    }
  }
  return out;
}

export async function saveAdProject(id: string, userId: string, project: AdProject): Promise<boolean> {
  const owned = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true } });
  if (!owned) return false;
  await prisma.design.update({
    where: { id },
    data: { canvasData: JSON.stringify({ ...project, id: "" }), name: project.title.slice(0, 160), size: aspectToSize(project.aspect) },
  });
  return true;
}

export async function deleteAdProject(id: string, userId: string): Promise<boolean> {
  const owned = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true } });
  if (!owned) return false;
  await prisma.design.delete({ where: { id } });
  return true;
}

export async function patchAdTake(projectId: string, userId: string, takeId: string, patch: Partial<AdTake>): Promise<AdProject | null> {
  const project = await getAdProject(projectId, userId);
  if (!project) return null;
  const i = project.takes.findIndex((t) => t.id === takeId);
  if (i < 0) return project;
  project.takes[i] = { ...project.takes[i], ...patch };
  await saveAdProject(projectId, userId, project);
  return project;
}
