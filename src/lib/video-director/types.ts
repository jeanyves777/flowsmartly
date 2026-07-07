/**
 * Video Studio — Director: the unified "film" pipeline.
 *
 * One draggable node-canvas that fuses the three video engines (AI cinematic,
 * avatar clone, reel clips) into a single film. Each scene node renders on the
 * engine it already uses today; the finished MP4s are stitched into one video.
 *
 * Persisted schema-free on the Design model (`type="director_film"`,
 * `canvasData` = JSON of a FilmProject) — no DB migration, matching how the
 * legacy video-editor rides `type="video_project"`. [[campaign-studio-playground]]
 */

/** Which engine renders a scene. */
export type SceneEngine = "ai" | "avatar" | "reel" | "media" | "design";
/** Lifecycle of one scene's render. */
export type SceneStatus = "draft" | "queued" | "rendering" | "ready" | "failed";
export type FilmAspect = "9:16" | "1:1" | "16:9";
/** The kind of film — seeds the director's default pipeline + pacing. */
export type FilmType = "product_ad" | "ai_film" | "reel" | "testimonial" | "explainer";
export type TransitionKind = "cut" | "crossfade" | "dissolve" | "slide";

/**
 * One beat of the film — a node on the canvas. Carries the engine-specific
 * config AND a handle (`refKind`/`refId`) to the real render job on the
 * underlying backend, so status/URL can be polled back in.
 */
export interface FilmScene {
  id: string;
  engine: SceneEngine;
  title: string;
  order: number;              // sequence position in the final film
  x: number;                  // canvas position (draggable)
  y: number;
  // shared
  script?: string;            // spoken words / shot prompt / headline, per engine
  durationSec?: number;
  transitionIn?: TransitionKind;
  captionsOn?: boolean;
  // ai cinematic
  style?: string;             // "cinematic" | "3d" | "narrated"
  aiProvider?: string;        // "veo" | "grok"
  cameraMotion?: string;
  // avatar clone (HeyGen)
  avatarId?: string; avatarName?: string;
  voiceId?: string; voiceName?: string;
  voiceEmotion?: string | null; voiceSpeed?: number | null; motionPrompt?: string | null;
  background?: string | null;
  quality?: string;           // "standard" | "avatar_iv"
  // reel clip / uploaded media
  sourceMediaId?: string; sourceUrl?: string;
  clipStart?: number; clipEnd?: number; score?: number; aspectAuto?: boolean;
  // design still
  designId?: string; headline?: string;
  // link to the real render job on the underlying backend
  refKind?: string;           // "avatar_video" | "story_ad" | "reel_clip" | "media" | "design"
  refId?: string;
  status: SceneStatus;
  progress?: number;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
  // picture-in-picture overlay composited on top of this scene
  overlay?: FilmOverlay | null;
}

export type OverlayCorner = "tl" | "tr" | "bl" | "br";

/**
 * A picture-in-picture overlay composited on TOP of a scene for its duration —
 * e.g. an avatar presenter or a media inset over a b-roll base. It renders on its
 * own engine (its own job handle) and is composited at stitch time.
 */
export interface FilmOverlay {
  engine: SceneEngine;               // usually "avatar" (presenter) or "media"/"design"
  title?: string;
  script?: string;                   // avatar VO / ai prompt
  avatarId?: string; avatarName?: string;
  voiceId?: string; voiceName?: string;
  voiceEmotion?: string | null; voiceSpeed?: number | null; motionPrompt?: string | null;
  quality?: string;
  sourceUrl?: string;                // media/reel/design source
  corner: OverlayCorner;             // where the inset sits
  scale: number;                     // inset width as a fraction of the frame (0.18–0.5)
  // render handle + status
  refKind?: string; refId?: string;
  status: SceneStatus;
  progress?: number;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
}

/** A canvas wire between two scene ids (visual pipeline direction). */
export type FilmEdge = [string, string];

/** Uploaded/attached asset the brief works from (product photo, footage, clone photo). */
export interface FilmAsset {
  id: string;
  url: string;
  kind: "image" | "video";
  name?: string;
  /** How the director routed it: a long video → reel clipping, a selfie → avatar, etc. */
  role?: "product" | "footage" | "long_video" | "clone_photo" | "logo";
}

export interface FilmProject {
  id: string;
  title: string;
  brief: string;
  filmType: FilmType;
  aspect: FilmAspect;
  targetSeconds: number;
  scenes: FilmScene[];
  edges: FilmEdge[];
  assets?: FilmAsset[];
  music?: string | null;
  /** Burn the brand logo onto the final cut (overlay). Default on. */
  brandLogo?: boolean;
  captionsOn?: boolean;
  finalVideoUrl?: string | null;
  finalThumbnailUrl?: string | null;
  finalStatus?: SceneStatus;
  finalProgress?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const FILM_ASPECTS: FilmAspect[] = ["9:16", "1:1", "16:9"];
export const FILM_TYPES: FilmType[] = ["product_ad", "ai_film", "reel", "testimonial", "explainer"];
export const SCENE_ENGINES: SceneEngine[] = ["ai", "avatar", "reel", "media", "design"];
export const TRANSITIONS: TransitionKind[] = ["cut", "crossfade", "dissolve", "slide"];

/** Pixel size string for the Design row, from the film aspect. */
export function aspectToSize(a: FilmAspect): string {
  return a === "16:9" ? "1280x720" : a === "1:1" ? "1080x1080" : "720x1280";
}

export function emptyFilm(partial?: Partial<FilmProject>): FilmProject {
  return {
    id: "",
    title: "Untitled film",
    brief: "",
    filmType: "product_ad",
    aspect: "9:16",
    targetSeconds: 30,
    scenes: [],
    edges: [],
    assets: [],
    music: null,
    brandLogo: true,
    captionsOn: true,
    finalVideoUrl: null,
    finalStatus: "draft",
    ...partial,
  };
}

const VALID_ENGINES = new Set<SceneEngine>(SCENE_ENGINES);
const VALID_STATUS = new Set<SceneStatus>(["draft", "queued", "rendering", "ready", "failed"]);
const VALID_CORNERS = new Set<OverlayCorner>(["tl", "tr", "bl", "br"]);

/** Coerce untrusted JSON into a safe FilmOverlay. */
export function normalizeOverlay(raw: Partial<FilmOverlay>): FilmOverlay {
  const engine = VALID_ENGINES.has(raw.engine as SceneEngine) ? (raw.engine as SceneEngine) : "avatar";
  const status = VALID_STATUS.has(raw.status as SceneStatus) ? (raw.status as SceneStatus) : "draft";
  return {
    engine,
    title: typeof raw.title === "string" ? raw.title.slice(0, 120) : undefined,
    script: typeof raw.script === "string" ? raw.script.slice(0, 8000) : undefined,
    avatarId: raw.avatarId, avatarName: raw.avatarName, voiceId: raw.voiceId, voiceName: raw.voiceName,
    voiceEmotion: raw.voiceEmotion ?? null, voiceSpeed: raw.voiceSpeed ?? null, motionPrompt: raw.motionPrompt ?? null,
    quality: raw.quality, sourceUrl: raw.sourceUrl,
    corner: VALID_CORNERS.has(raw.corner as OverlayCorner) ? (raw.corner as OverlayCorner) : "br",
    scale: typeof raw.scale === "number" ? Math.max(0.15, Math.min(0.5, raw.scale)) : 0.3,
    refKind: raw.refKind, refId: raw.refId,
    status,
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    videoUrl: raw.videoUrl ?? null,
    thumbnailUrl: raw.thumbnailUrl ?? null,
    error: raw.error ?? null,
  };
}

/** Coerce untrusted JSON (from canvasData or an API body) into a safe FilmScene. */
export function normalizeScene(raw: Partial<FilmScene>, idx: number): FilmScene {
  const engine = VALID_ENGINES.has(raw.engine as SceneEngine) ? (raw.engine as SceneEngine) : "ai";
  const status = VALID_STATUS.has(raw.status as SceneStatus) ? (raw.status as SceneStatus) : "draft";
  return {
    id: String(raw.id || `sc_${idx}_${Math.round((raw.x || 0))}`),
    engine,
    title: String(raw.title || `Scene ${idx + 1}`).slice(0, 120),
    order: typeof raw.order === "number" ? raw.order : idx,
    x: typeof raw.x === "number" ? raw.x : 340 + idx * 260,
    y: typeof raw.y === "number" ? raw.y : 80 + (idx % 2) * 200,
    script: typeof raw.script === "string" ? raw.script.slice(0, 25000) : undefined,
    durationSec: typeof raw.durationSec === "number" ? raw.durationSec : undefined,
    transitionIn: raw.transitionIn,
    captionsOn: !!raw.captionsOn,
    style: raw.style, aiProvider: raw.aiProvider, cameraMotion: raw.cameraMotion,
    avatarId: raw.avatarId, avatarName: raw.avatarName, voiceId: raw.voiceId, voiceName: raw.voiceName,
    voiceEmotion: raw.voiceEmotion ?? null, voiceSpeed: raw.voiceSpeed ?? null, motionPrompt: raw.motionPrompt ?? null,
    background: raw.background ?? null, quality: raw.quality,
    sourceMediaId: raw.sourceMediaId, sourceUrl: raw.sourceUrl,
    clipStart: raw.clipStart, clipEnd: raw.clipEnd, score: raw.score, aspectAuto: raw.aspectAuto,
    designId: raw.designId, headline: raw.headline,
    refKind: raw.refKind, refId: raw.refId,
    status,
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    videoUrl: raw.videoUrl ?? null,
    thumbnailUrl: raw.thumbnailUrl ?? null,
    error: raw.error ?? null,
    overlay: raw.overlay ? normalizeOverlay(raw.overlay) : null,
  };
}

/** Coerce untrusted JSON into a safe FilmProject (used on read + write). */
export function normalizeFilm(raw: Partial<FilmProject> & { id: string }): FilmProject {
  const base = emptyFilm({ id: raw.id });
  const scenes = Array.isArray(raw.scenes) ? raw.scenes.map((s, i) => normalizeScene(s, i)) : [];
  const sceneIds = new Set(scenes.map((s) => s.id));
  const edges = Array.isArray(raw.edges)
    ? raw.edges.filter((e): e is FilmEdge => Array.isArray(e) && e.length === 2 && sceneIds.has(e[1]))
    : [];
  return {
    ...base,
    ...raw,
    title: String(raw.title || base.title).slice(0, 160),
    brief: String(raw.brief || "").slice(0, 8000),
    filmType: FILM_TYPES.includes(raw.filmType as FilmType) ? (raw.filmType as FilmType) : base.filmType,
    aspect: FILM_ASPECTS.includes(raw.aspect as FilmAspect) ? (raw.aspect as FilmAspect) : base.aspect,
    targetSeconds: typeof raw.targetSeconds === "number" ? raw.targetSeconds : base.targetSeconds,
    scenes,
    edges,
    assets: Array.isArray(raw.assets) ? raw.assets.slice(0, 40) : [],
  };
}
