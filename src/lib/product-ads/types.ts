/**
 * Product Ads Studio model — a single-shot playground that turns a product HERO STILL
 * into a cinematic, timed TVC-style ad (grok-imagine-video-1.5 image-to-video). Same
 * shape as the UGC studio: one brief + a free canvas of "takes" you keep/move/resize/
 * delete. Persisted schema-free on the Design model (type="product_ad_project").
 */

export type AdAspect = "9:16" | "1:1" | "16:9";
export type AdTakeStatus = "draft" | "queued" | "rendering" | "ready" | "failed";

/** Built-in templates (the gallery inside the brief). */
export type AdTemplateId = "luxury" | "orbit" | "lifestyle" | "flyover" | "character" | "blank";

export interface AdTake {
  id: string;
  n: number;
  x: number;
  y: number;
  w: number;
  status: AdTakeStatus;
  progress?: number;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
  refKind?: string;   // "grok"
  refId?: string;
  renderStartedAt?: number;
  renderHeartbeatAt?: number;
}

export interface AdProject {
  id: string;
  title: string;
  template: AdTemplateId;
  /** The ad direction — the timed camera sequence, lighting and mood. NOT dialogue. */
  prompt: string;
  productImageUrl?: string | null;  // the hero still (first frame)
  mood: string;                     // "Luxury" | "Clean" | "Bold" | "Warm"
  aspect: AdAspect;
  durationSec: number;              // 6 | 8 | 10
  resolution: "720p";
  takes: AdTake[];
}

export const AD_MAX_DURATION = 10;  // grok-imagine-video-1.5 image-to-video cap
export const AD_MAX_TAKES = 8;

export function clampAdDuration(d: number): number {
  return Math.max(4, Math.min(AD_MAX_DURATION, Math.round(d || 10)));
}

const AD_STATUSES: AdTakeStatus[] = ["draft", "queued", "rendering", "ready", "failed"];

export function normalizeAdTake(raw: Partial<AdTake>, idx: number): AdTake {
  return {
    id: raw.id || `take_${idx}_${Math.random().toString(36).slice(2, 7)}`,
    n: typeof raw.n === "number" ? raw.n : idx + 1,
    x: typeof raw.x === "number" ? raw.x : 340 + (idx % 4) * 270,
    y: typeof raw.y === "number" ? raw.y : 110 + Math.floor(idx / 4) * 560,
    w: typeof raw.w === "number" ? Math.max(160, Math.min(420, raw.w)) : 236,
    status: AD_STATUSES.includes(raw.status as AdTakeStatus) ? (raw.status as AdTakeStatus) : "draft",
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

export function emptyAdProject(partial?: Partial<AdProject>): AdProject {
  return {
    id: partial?.id || "",
    title: partial?.title || "New product ad",
    template: partial?.template || "luxury",
    prompt: partial?.prompt || "",
    productImageUrl: partial?.productImageUrl ?? null,
    mood: partial?.mood || "Luxury",
    aspect: partial?.aspect || "9:16",
    durationSec: clampAdDuration(partial?.durationSec ?? 10),
    resolution: "720p",
    takes: Array.isArray(partial?.takes) ? partial!.takes!.map((t, i) => normalizeAdTake(t, i)) : [],
  };
}

export function normalizeAdProject(raw: Partial<AdProject> & { id: string }): AdProject {
  return emptyAdProject(raw);
}
