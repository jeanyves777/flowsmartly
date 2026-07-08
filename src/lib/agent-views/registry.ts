/**
 * Views library — persistence for agent-authored view specs, so a view the
 * agent composes once can be SAVED and REUSED across use-cases (the "it saves
 * it and can reuse" part of the vision). Stored schema-free on the Design model
 * (`type="agent_view"`, `canvasData` = JSON of { spec, skill, projectRef }),
 * keyed by a stable `name`. No migration.
 */

import { prisma } from "@/lib/db/client";
import { normalizeViewSpec, type ViewSpec } from "./spec";

const TYPE = "agent_view";

export interface SavedView {
  id: string;
  name: string;
  skill?: string | null;
  spec: ViewSpec;
  updatedAt: string;
}

interface Stored {
  spec: ViewSpec;
  skill?: string | null;
  projectRef?: { kind: string; id: string } | null;
}

function parse(canvasData: string | null): Stored | null {
  try {
    const raw = canvasData ? (JSON.parse(canvasData) as Partial<Stored>) : null;
    if (!raw) return null;
    const spec = normalizeViewSpec(raw.spec);
    if (!spec) return null;
    return { spec, skill: typeof raw.skill === "string" ? raw.skill : null, projectRef: raw.projectRef ?? null };
  } catch {
    return null;
  }
}

/** A stable library key for a view (its name, lower-kebab). */
export function viewKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "view";
}

/**
 * Save (upsert by name) a view spec to the user's library. Idempotent on name —
 * saving under an existing name updates it. Returns the saved id + name, or null
 * if the spec has no usable name.
 */
export async function saveView(
  userId: string,
  spec: ViewSpec,
  opts?: { skill?: string | null; projectRef?: { kind: string; id: string } | null; name?: string },
): Promise<{ id: string; name: string } | null> {
  const clean = normalizeViewSpec(spec);
  if (!clean) return null;
  const name = viewKey(opts?.name || clean.name || clean.title || "");
  if (!name || name === "view") {
    // Need a real name to make it re-findable.
    if (!opts?.name && !clean.name) return null;
  }
  clean.name = name;
  clean.source = "library";
  const skill = opts?.skill ?? clean.skill ?? null;
  const projectRef = opts?.projectRef ?? clean.projectRef ?? null;
  const canvasData = JSON.stringify({ spec: clean, skill, projectRef } satisfies Stored);

  const existing = await prisma.design.findFirst({
    where: { userId, type: TYPE, name },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    await prisma.design.update({ where: { id: existing.id }, data: { canvasData, prompt: (clean.title || name).slice(0, 2000), status: "COMPLETED" } });
    return { id: existing.id, name };
  }
  const row = await prisma.design.create({
    data: {
      userId,
      prompt: (clean.title || name).slice(0, 2000),
      category: "view",
      size: "auto",
      name,
      type: TYPE,
      status: "COMPLETED",
      canvasData,
    },
    select: { id: true },
  });
  return { id: row.id, name };
}

/** Fetch a saved view by its library name (or id). */
export async function getView(userId: string, nameOrId: string): Promise<SavedView | null> {
  const key = viewKey(nameOrId);
  const row = await prisma.design.findFirst({
    where: { userId, type: TYPE, OR: [{ name: key }, { id: nameOrId }] },
    select: { id: true, name: true, canvasData: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  const parsed = parse(row.canvasData);
  if (!parsed) return null;
  return { id: row.id, name: row.name || key, skill: parsed.skill ?? null, spec: parsed.spec, updatedAt: row.updatedAt.toISOString() };
}

/** List the user's saved views (optionally filtered to a skill). */
export async function listViews(userId: string, opts?: { skill?: string; limit?: number }): Promise<SavedView[]> {
  const rows = await prisma.design.findMany({
    where: { userId, type: TYPE },
    orderBy: { updatedAt: "desc" },
    take: Math.min(opts?.limit ?? 30, 60),
    select: { id: true, name: true, canvasData: true, updatedAt: true },
  });
  const out: SavedView[] = [];
  for (const r of rows) {
    const parsed = parse(r.canvasData);
    if (!parsed) continue;
    if (opts?.skill && parsed.skill !== opts.skill) continue;
    out.push({ id: r.id, name: r.name || "view", skill: parsed.skill ?? null, spec: parsed.spec, updatedAt: r.updatedAt.toISOString() });
  }
  return out;
}

/** Remove a saved view. */
export async function deleteView(userId: string, nameOrId: string): Promise<boolean> {
  const key = viewKey(nameOrId);
  const res = await prisma.design.deleteMany({ where: { userId, type: TYPE, OR: [{ name: key }, { id: nameOrId }] } });
  return res.count > 0;
}
