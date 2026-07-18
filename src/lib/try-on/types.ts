/**
 * Virtual Try-on model — a single-shot playground that animates a fashion look from TWO
 * references: (1) the person, (2) the outfit. Unlike UGC/Product-ads (which use
 * grok-imagine-video-1.5 image-to-video), try-on uses grok-imagine-video
 * REFERENCE-to-video so the model can re-dress the person rather than animate one frame.
 * Persisted on the Design model (type="tryon_project").
 */

export type TryOnAspect = "3:4" | "9:16" | "1:1";
export type TryOnTakeStatus = "draft" | "queued" | "rendering" | "ready" | "failed";
export type TryOnTemplateId = "walk" | "turn" | "detail" | "street" | "blank";

export interface TryOnTake {
  id: string;
  n: number;
  x: number;
  y: number;
  w: number;
  status: TryOnTakeStatus;
  progress?: number;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
  refKind?: string;   // "grok"
  refId?: string;
  renderStartedAt?: number;
  renderHeartbeatAt?: number;
}

export interface TryOnProject {
  id: string;
  title: string;
  template: TryOnTemplateId;
  /** The motion/scene direction — walk, turn, fabric movement, setting. */
  prompt: string;
  personImageUrl?: string | null;   // reference 1 — WHO
  outfitImageUrl?: string | null;   // reference 2 — WHAT they wear
  aspect: TryOnAspect;
  durationSec: number;              // reference-to-video caps at 10s; 6 is the sweet spot
  resolution: "720p";
  takes: TryOnTake[];
}

/** grok-imagine-video reference-to-video caps at ~10s per clip (verified). */
export const TRYON_MAX_DURATION = 10;
export const TRYON_MAX_TAKES = 8;

export function clampTryOnDuration(d: number): number {
  return Math.max(4, Math.min(TRYON_MAX_DURATION, Math.round(d || 6)));
}

const STATUSES: TryOnTakeStatus[] = ["draft", "queued", "rendering", "ready", "failed"];

export function normalizeTryOnTake(raw: Partial<TryOnTake>, idx: number): TryOnTake {
  return {
    id: raw.id || `take_${idx}_${Math.random().toString(36).slice(2, 7)}`,
    n: typeof raw.n === "number" ? raw.n : idx + 1,
    x: typeof raw.x === "number" ? raw.x : 340 + (idx % 4) * 270,
    y: typeof raw.y === "number" ? raw.y : 110 + Math.floor(idx / 4) * 560,
    w: typeof raw.w === "number" ? Math.max(160, Math.min(420, raw.w)) : 236,
    status: STATUSES.includes(raw.status as TryOnTakeStatus) ? (raw.status as TryOnTakeStatus) : "draft",
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    videoUrl: raw.videoUrl ?? null,
    thumbnailUrl: raw.thumbnailUrl ?? null,
    error: raw.error ?? null,
    refKind: raw.refKind,
    refId: raw.refId,
    renderStartedAt: raw.renderStartedAt,
    renderHeartbeatAt: raw.renderHeartbeatAt,
  };
}

export function emptyTryOnProject(partial?: Partial<TryOnProject>): TryOnProject {
  return {
    id: partial?.id || "",
    title: partial?.title || "New try-on",
    template: partial?.template || "walk",
    prompt: partial?.prompt || "",
    personImageUrl: partial?.personImageUrl ?? null,
    outfitImageUrl: partial?.outfitImageUrl ?? null,
    aspect: partial?.aspect || "3:4",
    durationSec: clampTryOnDuration(partial?.durationSec ?? 6),
    resolution: "720p",
    takes: Array.isArray(partial?.takes) ? partial!.takes!.map((t, i) => normalizeTryOnTake(t, i)) : [],
  };
}

export function normalizeTryOnProject(raw: Partial<TryOnProject> & { id: string }): TryOnProject {
  return emptyTryOnProject(raw);
}
