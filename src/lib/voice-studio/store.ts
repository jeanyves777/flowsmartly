/**
 * Voice Studio — narration persistence.
 *
 * Schema-free on the Design row (canvasData JSON), same as the other playgrounds:
 * the deploy runs `next build` with no `db push`, so a narration must not need a
 * migration to ship. [[voice-studio]]
 */
import { prisma } from "@/lib/db/client";
import {
  aspectToSize, emptyNarration, normalizeNarration, normalizeShot,
  type NarrationProject, type NarrationShot, type NarrationTake,
} from "./types";

const TYPE = "narration_project";

export async function createNarration(userId: string, input: Partial<NarrationProject>): Promise<NarrationProject> {
  const row = await prisma.design.create({
    data: {
      userId,
      type: TYPE,
      category: "video",
      name: (input.title || "Untitled narration").slice(0, 160),
      prompt: (input.brief || input.title || "Narration").slice(0, 2000),
      size: aspectToSize(input.aspect || "16:9"),
      status: "PENDING",
      canvasData: "{}",
    },
    select: { id: true },
  });
  const project = normalizeNarration({ ...emptyNarration({ id: row.id }), ...input, id: row.id });
  await prisma.design.update({ where: { id: row.id }, data: { canvasData: JSON.stringify(project) } });
  return project;
}

export async function getNarration(id: string, userId: string): Promise<NarrationProject | null> {
  const row = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true, canvasData: true } });
  if (!row) return null;
  try {
    return normalizeNarration({ ...(JSON.parse(row.canvasData || "{}") as Partial<NarrationProject>), id: row.id });
  } catch {
    return normalizeNarration({ id: row.id });
  }
}

export async function saveNarration(id: string, userId: string, project: NarrationProject): Promise<boolean> {
  const owned = await prisma.design.findFirst({ where: { id, userId, type: TYPE }, select: { id: true } });
  if (!owned) return false;
  const clean = normalizeNarration({ ...project, id });
  await prisma.design.update({
    where: { id },
    data: {
      canvasData: JSON.stringify(clean),
      name: clean.title.slice(0, 160),
      prompt: (clean.brief || clean.title).slice(0, 2000) || "Narration",
      size: aspectToSize(clean.aspect),
      status: clean.finalVideoUrl || clean.takes.some((t) => t.audioUrl) ? "COMPLETED" : "PENDING",
    },
  });
  return true;
}

export async function listNarrations(userId: string, limit = 24) {
  const rows = await prisma.design.findMany({
    where: { userId, type: TYPE },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, name: true, updatedAt: true, canvasData: true },
  });
  return rows.map((r) => {
    try {
      const p = normalizeNarration({ ...(JSON.parse(r.canvasData || "{}") as Partial<NarrationProject>), id: r.id });
      return {
        id: r.id, title: p.title, mode: p.mode,
        shotCount: p.shots.length,
        readyCount: p.shots.filter((s) => s.status === "ready").length,
        finalVideoUrl: p.finalVideoUrl ?? null,
        firstTakeUrl: p.takes.find((t) => t.audioUrl)?.audioUrl ?? null,
        updatedAt: r.updatedAt.toISOString(),
      };
    } catch {
      return { id: r.id, title: r.name, mode: "film" as const, shotCount: 0, readyCount: 0, finalVideoUrl: null, firstTakeUrl: null, updatedAt: r.updatedAt.toISOString() };
    }
  });
}

export async function deleteNarration(id: string, userId: string): Promise<boolean> {
  const res = await prisma.design.deleteMany({ where: { id, userId, type: TYPE } });
  return res.count > 0;
}

/** Merge-patch ONE shot. Re-reads first so concurrent shot renders don't clobber each other. */
export async function patchShot(
  id: string,
  userId: string,
  shotId: string,
  patch: Partial<NarrationShot>,
): Promise<NarrationProject | null> {
  const p = await getNarration(id, userId);
  if (!p) return null;
  const i = p.shots.findIndex((s) => s.id === shotId);
  if (i < 0) return null;
  p.shots[i] = normalizeShot({ ...p.shots[i], ...patch }, i);
  await saveNarration(id, userId, p);
  return p;
}

/** Merge-patch ONE voiceover take. */
export async function patchTake(
  id: string,
  userId: string,
  takeId: string,
  patch: Partial<NarrationTake>,
): Promise<NarrationProject | null> {
  const p = await getNarration(id, userId);
  if (!p) return null;
  const i = p.takes.findIndex((t) => t.id === takeId);
  if (i < 0) return null;
  p.takes[i] = { ...p.takes[i], ...patch };
  await saveNarration(id, userId, p);
  return p;
}

/** Merge-patch the film-level stitch fields (heartbeat included) without touching shots. */
export async function patchNarrationFinal(
  id: string,
  userId: string,
  patch: Partial<Pick<NarrationProject, "finalStatus" | "finalProgress" | "finalVideoUrl" | "finalHeartbeatAt" | "finalTries">>,
): Promise<NarrationProject | null> {
  const p = await getNarration(id, userId);
  if (!p) return null;
  Object.assign(p, patch);
  await saveNarration(id, userId, p);
  return p;
}

/** Merge-patch the on-camera-explainer PRESENTER fields (the Avatar IV take) without touching shots. */
export async function patchNarrationPresenter(
  id: string,
  userId: string,
  patch: Partial<Pick<NarrationProject,
    "presenterStatus" | "presenterVideoUrl" | "presenterImageUrl" | "presenterMotion" | "presenterError" | "presenterHeartbeatAt" | "presenterTries">>,
): Promise<NarrationProject | null> {
  const p = await getNarration(id, userId);
  if (!p) return null;
  Object.assign(p, patch);
  await saveNarration(id, userId, p);
  return p;
}
