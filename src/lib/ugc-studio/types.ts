/**
 * UGC Studio model — a single-shot creator-video playground. A project holds one
 * brief (photo + script + settings) and a free canvas of "takes" (independent
 * grok-imagine-video-1.5 image-to-video generations the user keeps, moves, resizes,
 * edits or deletes). Persisted schema-free on the Design model (type="ugc_project"),
 * mirroring the Video Director so it reuses the same batch/resume/persistence infra.
 */

export type UgcAspect = "9:16" | "1:1";
export type UgcTakeStatus = "draft" | "queued" | "rendering" | "ready" | "failed";

/** Built-in template ids (the "Start from a template" gallery inside the brief). */
export type UgcTemplateId = "review" | "testimonial" | "unboxing" | "grwm" | "demo" | "blank";

export interface UgcTake {
  id: string;
  n: number;                    // display index ("Take 3")
  // free-canvas placement (draggable / resizable)
  x: number;
  y: number;
  w: number;                    // node width in px (height derives from aspect)
  status: UgcTakeStatus;
  progress?: number;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
  // resumable provider job (grok), same pattern as the Director
  refKind?: string;             // "grok"
  refId?: string;
  renderStartedAt?: number;
  renderHeartbeatAt?: number;
  // an independent AI-edit job on this take (base stays playable until it succeeds)
  editStatus?: UgcTakeStatus;
  editPrompt?: string;
  editRefId?: string;
}

export interface UgcProject {
  id: string;
  title: string;
  // the brief
  template: UgcTemplateId;
  script: string;               // the spoken words (lip-synced)
  photoUrl?: string | null;     // the creator / reference photo (first frame source)
  style: string;                // "Authentic" | "Testimonial" | "Unboxing" | "GRWM"
  aspect: UgcAspect;
  durationSec: number;          // 6 | 8 | 10
  resolution: "720p";
  takes: UgcTake[];
  createdAt?: number;
  updatedAt?: number;
}

export const UGC_MAX_DURATION = 10;   // grok-imagine-video-1.5 image-to-video cap
export const UGC_MAX_TAKES = 8;       // per Generate batch

export function emptyUgcProject(partial?: Partial<UgcProject>): UgcProject {
  return {
    id: partial?.id || "",
    title: partial?.title || "New UGC video",
    template: partial?.template || "review",
    script: partial?.script || "",
    photoUrl: partial?.photoUrl ?? null,
    style: partial?.style || "Authentic",
    aspect: partial?.aspect || "9:16",
    durationSec: clampDuration(partial?.durationSec ?? 8),
    resolution: "720p",
    takes: Array.isArray(partial?.takes) ? partial!.takes!.map((t, i) => normalizeTake(t, i)) : [],
    createdAt: partial?.createdAt,
    updatedAt: partial?.updatedAt,
  };
}

export function clampDuration(d: number): number {
  return Math.max(4, Math.min(UGC_MAX_DURATION, Math.round(d || 8)));
}

const TAKE_STATUSES: UgcTakeStatus[] = ["draft", "queued", "rendering", "ready", "failed"];

export function normalizeTake(raw: Partial<UgcTake>, idx: number): UgcTake {
  return {
    id: raw.id || `take_${idx}_${Math.random().toString(36).slice(2, 7)}`,
    n: typeof raw.n === "number" ? raw.n : idx + 1,
    x: typeof raw.x === "number" ? raw.x : 340 + (idx % 4) * 270,
    y: typeof raw.y === "number" ? raw.y : 110 + Math.floor(idx / 4) * 560,
    w: typeof raw.w === "number" ? Math.max(160, Math.min(380, raw.w)) : 236,
    status: TAKE_STATUSES.includes(raw.status as UgcTakeStatus) ? (raw.status as UgcTakeStatus) : "draft",
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    videoUrl: raw.videoUrl ?? null,
    thumbnailUrl: raw.thumbnailUrl ?? null,
    error: raw.error ?? null,
    refKind: raw.refKind,
    refId: raw.refId,
    renderStartedAt: raw.renderStartedAt,
    renderHeartbeatAt: raw.renderHeartbeatAt,
    editStatus: TAKE_STATUSES.includes(raw.editStatus as UgcTakeStatus) ? (raw.editStatus as UgcTakeStatus) : undefined,
    editPrompt: raw.editPrompt,
    editRefId: raw.editRefId,
  };
}

export function normalizeUgcProject(raw: Partial<UgcProject> & { id: string }): UgcProject {
  return emptyUgcProject(raw);
}
