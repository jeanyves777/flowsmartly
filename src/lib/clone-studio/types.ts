/**
 * Clone Yourself — types.
 *
 * Upload a photo or two → the studio LOCKS your identity → put yourself in any
 * scene, outfit or pose. Everything is identity-preserving image-to-image off the
 * uploaded references. A project holds several reusable clones (identities) and the
 * shots generated from them, on one manipulable canvas. Schema-free on the Design
 * row — no migration to ship. [[clone-studio]]
 */

export type CloneQuality = "standard" | "premium";
export type CloneAspect = "9:16" | "1:1" | "16:9";
export type ShotKind = "person" | "background";
export type ShotStatus = "idle" | "queued" | "rendering" | "ready" | "failed";

export const CLONE_ASPECTS: CloneAspect[] = ["9:16", "1:1", "16:9"];

/** A saved identity — the reference photos that lock a look, reusable across shots. */
export interface CloneIdentity {
  id: string;
  name: string;
  /** Uploaded reference photos. More angles ⇒ more faithful identity. */
  photoUrls: string[];
  /** Optional clean generated anchor portrait derived from the photos. */
  anchorUrl?: string | null;
  createdAt?: string;
}

export interface CloneShot {
  id: string;
  order: number;
  /** Which identity this shot depicts (null for a background-only plate). */
  cloneId: string | null;
  kind: ShotKind;
  /** The drafted/edited visual prompt actually sent to the image model. */
  prompt: string;
  scene: string;
  outfit: string;
  pose: string;
  aspect: CloneAspect;
  quality: CloneQuality;
  imageUrl?: string | null;
  status: ShotStatus;
  progress?: number;
  error?: string | null;
  /** Canvas position + width (draggable / resizable). Absent ⇒ auto-laid-out. */
  x?: number;
  y?: number;
  w?: number;
  /** Beaten while rendering; a quiet beat means the worker died and it's safe to re-run. */
  renderHeartbeatAt?: number;
  tries?: number;
}

export interface CloneProject {
  id: string;
  title: string;
  activeCloneId: string | null;
  clones: CloneIdentity[];
  shots: CloneShot[];
  createdAt?: string;
  updatedAt?: string;
}

export function cloneDims(aspect: CloneAspect): { w: number; h: number } {
  return aspect === "16:9" ? { w: 1536, h: 864 } : aspect === "9:16" ? { w: 864, h: 1536 } : { w: 1024, h: 1024 };
}

export function aspectToSize(a: CloneAspect): string {
  const { w, h } = cloneDims(a);
  return `${w}x${h}`;
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyProject(seed: { id: string } & Partial<CloneProject>): CloneProject {
  return {
    title: "Untitled clone session",
    activeCloneId: null,
    clones: [],
    shots: [],
    ...seed,
  };
}

export function normalizeIdentity(raw: Partial<CloneIdentity>, i: number): CloneIdentity {
  return {
    id: raw.id || rid("clone"),
    name: String(raw.name || `Clone ${i + 1}`).slice(0, 80),
    photoUrls: Array.isArray(raw.photoUrls) ? raw.photoUrls.filter((u): u is string => typeof u === "string").slice(0, 4) : [],
    anchorUrl: raw.anchorUrl ?? null,
    createdAt: raw.createdAt,
  };
}

export function normalizeShot(raw: Partial<CloneShot>, i: number): CloneShot {
  return {
    id: raw.id || rid("shot"),
    order: typeof raw.order === "number" ? raw.order : i,
    cloneId: raw.cloneId ?? null,
    kind: raw.kind === "background" ? "background" : "person",
    prompt: String(raw.prompt || "").slice(0, 3000),
    scene: String(raw.scene || "studio").slice(0, 60),
    outfit: String(raw.outfit || "Keep current").slice(0, 120),
    pose: String(raw.pose || "Looking at camera").slice(0, 120),
    aspect: CLONE_ASPECTS.includes(raw.aspect as CloneAspect) ? (raw.aspect as CloneAspect) : "1:1",
    quality: raw.quality === "premium" ? "premium" : "standard",
    imageUrl: raw.imageUrl ?? null,
    status: (["idle", "queued", "rendering", "ready", "failed"] as const).includes(raw.status as ShotStatus) ? (raw.status as ShotStatus) : "idle",
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    error: raw.error ?? null,
    x: typeof raw.x === "number" ? raw.x : undefined,
    y: typeof raw.y === "number" ? raw.y : undefined,
    w: typeof raw.w === "number" ? raw.w : undefined,
    renderHeartbeatAt: raw.renderHeartbeatAt,
    tries: raw.tries,
  };
}

export function normalizeProject(raw: Partial<CloneProject> & { id: string }): CloneProject {
  const base = emptyProject({ id: raw.id });
  const clones = Array.isArray(raw.clones) ? raw.clones.filter(Boolean).map((c, i) => normalizeIdentity(c, i)) : [];
  const shots = Array.isArray(raw.shots) ? raw.shots.filter(Boolean).map((s, i) => normalizeShot(s, i)) : [];
  const cloneIds = new Set(clones.map((c) => c.id));
  return {
    ...base,
    ...raw,
    title: String(raw.title || base.title).slice(0, 160),
    clones,
    shots: shots.sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i })),
    // A dangling activeCloneId (deleted clone) falls back to the first, or null.
    activeCloneId: raw.activeCloneId && cloneIds.has(raw.activeCloneId) ? raw.activeCloneId : (clones[0]?.id ?? null),
  };
}
