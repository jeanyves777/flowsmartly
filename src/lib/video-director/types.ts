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
  /** An exact continuation is rendered by extending continuationOf's final frame
   * with xAI. A normal inserted scene leaves both fields unset. */
  continuationMode?: "exact";
  continuationOf?: string;
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
  // a product/reference image that anchors this scene (AI shots use it as a reference frame)
  referenceImageUrl?: string | null;
  // which cast members appear in this scene + their dialogue (movie scenes)
  cast?: SceneCastLine[];
  // link to the real render job on the underlying backend
  refKind?: string;           // "avatar_video" | "story_ad" | "reel_clip" | "media" | "design"
  refId?: string;
  status: SceneStatus;
  progress?: number;
  /** Epoch ms when this scene's render started — the watchdog fails orphaned
   *  "rendering" scenes (e.g. the worker died on a deploy) past a threshold. */
  renderStartedAt?: number;
  /** Epoch ms of the last progress heartbeat from the live render worker. A row
   *  with a stale heartbeat = its in-process worker died (deploy/restart); combined
   *  with a persisted provider job (refKind/refId) the render is RESUMED, not lost. */
  renderHeartbeatAt?: number;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
  // Independent xAI edit job. The base scene stays ready/playable while this
  // renders, then videoUrl is atomically replaced only after the edit succeeds.
  videoEdit?: FilmVideoEdit | null;
  // picture-in-picture overlay composited on top of this scene
  overlay?: FilmOverlay | null;
}

export interface FilmVideoEdit {
  id: string;
  prompt: string;
  sourceVideoUrl: string;
  durationSec?: number;
  cost?: number;
  status: SceneStatus;
  progress?: number;
  refId?: string;
  startedAt?: number;
  heartbeatAt?: number;
  error?: string | null;
}

/** One character's appearance + spoken line within a scene (a "movie" scene can
 *  have several cast members, each with their own dialogue). */
export interface SceneCastLine {
  characterId?: string;   // links to a FilmCharacter on the film
  name: string;           // display name (denormalized for the LLM + node UI)
  dialogue?: string;      // what this character says in this scene ("" = silent/background)
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

/** One character's LOCKED outfit for the whole film (continuity). */
export interface FilmWardrobe {
  characterId?: string;
  name: string;
  outfit: string;
}

/**
 * The film's CONTINUITY BIBLE — the single source of truth for the world every
 * scene shares: where it happens, the time-of-day/colour palette, and each
 * character's fixed wardrobe. Established once from the brief + cast, then woven
 * into every AI shot (its keyframe still + its prompt) so scenes don't drift into
 * different locations, lighting or clothes shot-to-shot.
 */
export interface FilmContinuity {
  location?: string;         // the primary recurring setting(s)
  timePalette?: string;      // time of day + lighting/colour palette held across the film
  wardrobe?: FilmWardrobe[]; // one locked outfit per character
}

export type CharacterPreviewStatus = "idle" | "generating" | "ready" | "failed";

/**
 * A cast member the film is built around. Generated (or uploaded) as a clean
 * portrait + a multi-angle turnaround sheet, then APPROVED by the user before
 * the film renders — the approved sheet is fed into every AI shot as a reference
 * image so the SAME person appears across shots. Restores the story-ad cast step.
 */
export interface FilmCharacter {
  id: string;
  name: string;
  role: string;
  description: string;                 // visual description used for identity lock
  wardrobe?: string | null;            // LOCKED outfit (user-chosen/preset) — overrides the wardrobe in `description` for the portrait/sheet + every shot
  referenceImageUrl?: string | null;   // clean portrait (anchor)
  characterSheetUrl?: string | null;   // multi-angle turnaround (cross-shot reference)
  previewStatus?: CharacterPreviewStatus;
  previewError?: string | null;
  approved?: boolean;
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
  // brief-level defaults the director storyboards from (ported from the 3 studios,
  // deduped into one brief): scene count, AI look, presenter, and a source video to clip.
  sceneCount?: number | null;        // explicit scene count; null = auto from length
  style?: string | null;             // default AI visual style: "cinematic" | "3d" | "narrated"
  quality?: string | null;           // avatar quality: "standard" | "avatar_iv"
  avatarId?: string | null; avatarName?: string | null;
  voiceId?: string | null; voiceName?: string | null;
  sourceVideoUrl?: string | null;    // a long video to auto-clip into reel scenes
  scenes: FilmScene[];
  edges: FilmEdge[];
  assets?: FilmAsset[];
  /** Cast the film is built around — approved before scenes render (see FilmCharacter). */
  characters?: FilmCharacter[];
  /** The film's continuity bible — one shared world (location/palette/wardrobe) across all scenes. */
  continuity?: FilmContinuity | null;
  music?: string | null;
  /** Storyboarding lifecycle — the draft runs in the BACKGROUND (a long movie
   *  storyboard can't fit a request timeout), and the canvas polls this. */
  draftStatus?: "drafting" | "ready" | "failed" | null;
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
    sceneCount: null,
    style: "cinematic",
    quality: "avatar_iv",
    sourceVideoUrl: null,
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
const VALID_PREVIEW_STATUS = new Set<CharacterPreviewStatus>(["idle", "generating", "ready", "failed"]);

/** Coerce untrusted JSON into a safe FilmCharacter. */
export function normalizeCharacter(raw: Partial<FilmCharacter>, idx: number): FilmCharacter {
  return {
    id: String(raw.id || `ch_${idx}_${Math.round((raw as { _r?: number })._r || 0)}`),
    name: String(raw.name || `Character ${idx + 1}`).slice(0, 80),
    role: String(raw.role || "").slice(0, 120),
    description: String(raw.description || "").slice(0, 2000),
    wardrobe: typeof raw.wardrobe === "string" ? raw.wardrobe.slice(0, 600) : null,
    referenceImageUrl: raw.referenceImageUrl ?? null,
    characterSheetUrl: raw.characterSheetUrl ?? null,
    previewStatus: VALID_PREVIEW_STATUS.has(raw.previewStatus as CharacterPreviewStatus) ? (raw.previewStatus as CharacterPreviewStatus) : "idle",
    previewError: raw.previewError ?? null,
    approved: !!raw.approved,
  };
}

/** Coerce untrusted JSON into a safe FilmContinuity (or null if empty). */
export function normalizeContinuity(raw: unknown): FilmContinuity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<FilmContinuity>;
  const location = typeof r.location === "string" ? r.location.slice(0, 600) : undefined;
  const timePalette = typeof r.timePalette === "string" ? r.timePalette.slice(0, 400) : undefined;
  const wardrobe = Array.isArray(r.wardrobe)
    ? r.wardrobe
        .filter(Boolean)
        .slice(0, 8)
        .map((w) => ({
          characterId: typeof w?.characterId === "string" ? w.characterId : undefined,
          name: String(w?.name || "").slice(0, 80),
          outfit: String(w?.outfit || "").slice(0, 600),
        }))
        .filter((w) => w.name || w.outfit)
    : undefined;
  if (!location && !timePalette && !(wardrobe && wardrobe.length)) return null;
  return { location, timePalette, wardrobe };
}

/** Flatten a continuity bible into one compact directive line for a shot/keyframe prompt. */
export function continuityText(c?: FilmContinuity | null): string {
  if (!c) return "";
  const parts: string[] = [];
  if (c.location) parts.push(`Location — ${c.location}`);
  if (c.timePalette) parts.push(`Time & palette — ${c.timePalette}`);
  if (c.wardrobe?.length) {
    parts.push(`Wardrobe (locked per person) — ${c.wardrobe.filter((w) => w.name || w.outfit).map((w) => `${w.name}: ${w.outfit}`).join("; ")}`);
  }
  return parts.join(". ");
}

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

/** Coerce a persisted xAI video-edit job into the Director scene shape. */
export function normalizeVideoEdit(raw: Partial<FilmVideoEdit>): FilmVideoEdit {
  const status = VALID_STATUS.has(raw.status as SceneStatus) ? (raw.status as SceneStatus) : "draft";
  return {
    id: String(raw.id || `edit_${Date.now().toString(36)}`).slice(0, 80),
    prompt: typeof raw.prompt === "string" ? raw.prompt.slice(0, 3900) : "",
    sourceVideoUrl: typeof raw.sourceVideoUrl === "string" ? raw.sourceVideoUrl : "",
    durationSec: typeof raw.durationSec === "number" ? Math.max(1, Math.min(8.7, raw.durationSec)) : undefined,
    cost: typeof raw.cost === "number" ? Math.max(0, raw.cost) : undefined,
    status,
    progress: typeof raw.progress === "number" ? Math.max(0, Math.min(100, raw.progress)) : 0,
    refId: typeof raw.refId === "string" ? raw.refId : undefined,
    startedAt: typeof raw.startedAt === "number" ? raw.startedAt : undefined,
    heartbeatAt: typeof raw.heartbeatAt === "number" ? raw.heartbeatAt : undefined,
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
    continuationMode: raw.continuationMode === "exact" ? "exact" : undefined,
    continuationOf: typeof raw.continuationOf === "string" ? raw.continuationOf.slice(0, 100) : undefined,
    avatarId: raw.avatarId, avatarName: raw.avatarName, voiceId: raw.voiceId, voiceName: raw.voiceName,
    voiceEmotion: raw.voiceEmotion ?? null, voiceSpeed: raw.voiceSpeed ?? null, motionPrompt: raw.motionPrompt ?? null,
    background: raw.background ?? null, quality: raw.quality,
    sourceMediaId: raw.sourceMediaId, sourceUrl: raw.sourceUrl,
    clipStart: raw.clipStart, clipEnd: raw.clipEnd, score: raw.score, aspectAuto: raw.aspectAuto,
    designId: raw.designId, headline: raw.headline,
    referenceImageUrl: raw.referenceImageUrl ?? null,
    cast: Array.isArray(raw.cast)
      ? raw.cast.slice(0, 6).map((l) => ({
          characterId: typeof l?.characterId === "string" ? l.characterId : undefined,
          name: String(l?.name || "").slice(0, 80),
          dialogue: typeof l?.dialogue === "string" ? l.dialogue.slice(0, 2000) : undefined,
        }))
      : undefined,
    refKind: raw.refKind, refId: raw.refId,
    status,
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    renderStartedAt: typeof raw.renderStartedAt === "number" ? raw.renderStartedAt : undefined,
    renderHeartbeatAt: typeof raw.renderHeartbeatAt === "number" ? raw.renderHeartbeatAt : undefined,
    videoUrl: raw.videoUrl ?? null,
    thumbnailUrl: raw.thumbnailUrl ?? null,
    error: raw.error ?? null,
    videoEdit: raw.videoEdit ? normalizeVideoEdit(raw.videoEdit) : null,
    overlay: raw.overlay ? normalizeOverlay(raw.overlay) : null,
  };
}

/** Coerce untrusted JSON into a safe FilmProject (used on read + write). */
export function normalizeFilm(raw: Partial<FilmProject> & { id: string }): FilmProject {
  const base = emptyFilm({ id: raw.id });
  // filter(Boolean) — a stored array must never contain a null/undefined hole, or
  // normalizeScene/normalizeCharacter would throw and (in listFilms) blank the
  // whole library on one bad row.
  const scenes = Array.isArray(raw.scenes) ? raw.scenes.filter(Boolean).map((s, i) => normalizeScene(s, i)) : [];
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
    characters: Array.isArray(raw.characters) ? raw.characters.filter(Boolean).slice(0, 8).map((c, i) => normalizeCharacter(c, i)) : [],
    continuity: normalizeContinuity(raw.continuity),
    draftStatus: raw.draftStatus === "drafting" || raw.draftStatus === "ready" || raw.draftStatus === "failed" ? raw.draftStatus : null,
  };
}
