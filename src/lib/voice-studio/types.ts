/**
 * Voice Studio — NARRATION types.
 *
 * Two things come out of one brief:
 *   • a voiceover      — the script read in a chosen/cloned voice, as N takes;
 *   • a narrated film  — that same read, laid over images and video.
 *
 * The difference from the Filmmaking studio is the spine: a film there is driven by
 * per-scene character DIALOGUE, so every shot has to lip-sync. Here the narration is
 * ONE continuous voice across the whole story, so the cast are DEPICTED, never
 * speakers — which is what lets a cloned voice narrate a film with people in it.
 *
 * Cast reuses FilmCharacter (and the Director's anchor pipeline) because "the same
 * subject across many shots" is exactly the same problem. [[voice-studio]]
 */
import type { FilmCharacter } from "@/lib/video-director/types";

/**
 * voiceover = audio takes · film = narrated images/video · oncam = "On-camera explainer":
 * a full HeyGen Avatar IV clone (talks + gestures) on top, designed explainer graphics
 * below, both locked to ONE cloned-voice audio track so they can't drift.
 */
export type NarrationMode = "voiceover" | "film" | "oncam";
/** How the narration is pictured. `images` = every shot a still; `mixed` = stills carry it, video hits the moments. */
export type VisualTreatment = "images" | "mixed";
export type ShotKind = "image" | "video" | "character";

/** The designed bottom-half graphic for an on-camera-explainer beat (rendered, not AI-photo). */
export type ExplainerGraphicKind = "title" | "iconflow" | "keypoints" | "stat" | "diagram" | "quote";
export interface ExplainerGraphic {
  kind: ExplainerGraphicKind;
  /** Big on-screen title, e.g. "WHAT IS AGENTIC AI?". */
  headline?: string;
  /** The burned caption line for this beat, e.g. "It doesn't just respond — it takes action." */
  caption?: string;
  /** Flow/point items, e.g. GOAL → PLAN → TOOLS → ACTION. `icon` is a named glyph key. */
  items?: { label: string; icon?: string; sub?: string }[];
  /** A single big number/label for a `stat` card. */
  stat?: { value: string; label?: string };
  /** ONE emoji that ILLUSTRATES this beat's subject (🏠 🤖 📺 📈 💬 …). Rendered as the
   *  animated hero. Optional — falls back to a kind-appropriate default. */
  subject?: string;
}
/** AI-generated, or a file the user brought. Never stock. */
export type ShotSource = "ai" | "upload";
export type ShotStatus = "idle" | "queued" | "rendering" | "ready" | "failed";
export type NarrationAspect = "9:16" | "1:1" | "16:9";
export type KenBurns = "in" | "out" | "left" | "right" | "none";

export const NARRATION_STYLES = ["documentary", "explainer", "commercial", "audiobook", "news", "meditation"] as const;
export type NarrationStyle = (typeof NARRATION_STYLES)[number];

export interface NarrationVoice {
  /** A cloned VoiceProfile id. When set it wins over everything below. */
  profileId?: string | null;
  /** A raw ElevenLabs voice id (a library voice the user picked but hasn't saved as a
   *  profile). Used directly so library voices work without a DB write. */
  elevenLabsVoiceId?: string | null;
  label: string;
  gender: string;
  accent: string;
  style: string;
  speed: number;
}

export interface NarrationShot {
  id: string;
  order: number;
  kind: ShotKind;
  /** The beat of narration this shot carries. Drives the shot's hold. */
  line: string;
  /** The drafted visual prompt. Written up front from the brief so the flow is consistent. */
  prompt: string;
  /** FilmCharacter ids featured here — anchored so they look the same in every shot. */
  cast: string[];
  /** Seconds on screen. Derived from the read of `line`, then user-adjustable. */
  holdSec: number;
  move: KenBurns;
  source: ShotSource;
  imageUrl?: string | null;
  videoUrl?: string | null;
  /** On-camera-explainer: the designed bottom-half graphic for this beat (rendered, not AI-photo). */
  graphic?: ExplainerGraphic | null;
  /** This beat's narration audio (kept per-shot so one line can be re-read alone). */
  audioUrl?: string | null;
  audioMs?: number | null;
  status: ShotStatus;
  progress?: number;
  error?: string | null;
  /** Raw provider reason behind a failure — diagnostic only, NEVER rendered in the UI
   *  (the banner reads `error`). Lets us root-cause a failed render without server logs. */
  errorDebug?: string | null;
  /** Canvas position + width (draggable / resizable). Absent ⇒ auto-laid-out. */
  x?: number;
  y?: number;
  w?: number;
  /** Provider handle, so a render orphaned by a deploy can be pulled instead of lost. */
  refKind?: string | null;
  refId?: string | null;
  renderHeartbeatAt?: number;
}

export interface NarrationTake {
  id: string;
  status: ShotStatus;
  audioUrl?: string | null;
  durationMs?: number | null;
  error?: string | null;
  renderHeartbeatAt?: number;
}

export interface NarrationProject {
  id: string;
  title: string;
  brief: string;
  script: string;
  mode: NarrationMode;
  treatment: VisualTreatment;
  aspect: NarrationAspect;
  narrationStyle: NarrationStyle;
  voice: NarrationVoice;
  characters: FilmCharacter[];
  shots: NarrationShot[];
  takes: NarrationTake[];
  takeCount: number;
  music?: string | null;
  musicVolume?: number;
  captionsOn?: boolean;
  /** ── On-camera explainer (oncam mode) ──────────────────────────────
   *  A full HeyGen Avatar IV clone (talks + gestures) reads the whole script as ONE
   *  continuous take (top layer), driven by the same cloned-voice audio the explainer
   *  beats below are timed to — so the two layers stay locked in sync. */
  presenterImageUrl?: string | null;   // clone SOURCE image (upper-body, hands visible)
  presenterMotion?: string | null;     // Avatar IV gesture/energy prompt
  presenterVideoUrl?: string | null;   // the rendered continuous Avatar IV take
  presenterStatus?: ShotStatus;
  presenterError?: string | null;      // friendly reason the presenter take failed
  presenterErrorDebug?: string | null; // raw reason (diagnostic; not rendered)
  presenterHeartbeatAt?: number;
  presenterTries?: number;
  /** Background drafting (script + cast + every shot prompt) — the canvas polls this. */
  draftStatus?: "drafting" | "ready" | "failed" | null;
  draftError?: string | null;
  /** Epoch ms the draft kicked. A "drafting" project whose start has gone stale was
   *  orphaned (deploy/crash killed the worker) and is safe to re-run — without this a
   *  dead draft spins on "Writing the script…" forever. */
  draftStartedAt?: number;
  draftTries?: number;
  finalVideoUrl?: string | null;
  finalStatus?: ShotStatus;
  finalProgress?: number;
  /** Beaten during the stitch; a quiet beat means it died and is safe to resume. */
  finalHeartbeatAt?: number;
  finalTries?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const NARRATION_ASPECTS: NarrationAspect[] = ["9:16", "1:1", "16:9"];

/** Words per second for a natural read — the same figure the Director uses for dialogue. */
export const NARRATION_WORDS_PER_SEC = 2.4;
/** A beat never sits on screen for less/more than this, however long the line is. */
export const MIN_HOLD_SEC = 1.2;
export const MAX_HOLD_SEC = 15;
/** Small breath after a line so beats don't cut the instant the voice stops — kept tight
 *  so the video flows with the narration instead of sitting in silence. */
export const HOLD_PAD_SEC = 0.2;

export function holdForLine(line: string): number {
  const words = (line.trim().match(/\S+/g) || []).length;
  const spoken = words / NARRATION_WORDS_PER_SEC;
  return Math.max(MIN_HOLD_SEC, Math.min(MAX_HOLD_SEC, Math.round((spoken + HOLD_PAD_SEC) * 10) / 10));
}

export function narrationDims(aspect: NarrationAspect): { w: number; h: number } {
  // Full-HD so the presenter + designed graphics stay crisp (720p read as "poor quality").
  return aspect === "16:9" ? { w: 1920, h: 1080 } : aspect === "1:1" ? { w: 1080, h: 1080 } : { w: 1080, h: 1920 };
}

export function aspectToSize(a: NarrationAspect): string {
  const { w, h } = narrationDims(a);
  return `${w}x${h}`;
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyNarration(seed: { id: string } & Partial<NarrationProject>): NarrationProject {
  return {
    title: "Untitled narration",
    brief: "",
    script: "",
    mode: "film",
    treatment: "mixed",
    aspect: "16:9",
    narrationStyle: "documentary",
    voice: { profileId: null, label: "Narrator", gender: "female", accent: "american", style: "narrative", speed: 1 },
    characters: [],
    shots: [],
    takes: [],
    takeCount: 2,
    music: null,
    musicVolume: 0.22,
    captionsOn: false,
    draftStatus: null,
    draftError: null,
    finalVideoUrl: null,
    finalStatus: "idle",
    finalProgress: 0,
    ...seed,
  };
}

export function normalizeShot(raw: Partial<NarrationShot>, i: number): NarrationShot {
  const kind: ShotKind = raw.kind === "video" || raw.kind === "character" ? raw.kind : "image";
  const line = String(raw.line || "").slice(0, 1200);
  return {
    id: raw.id || rid("shot"),
    order: typeof raw.order === "number" ? raw.order : i,
    kind,
    line,
    prompt: String(raw.prompt || "").slice(0, 3000),
    cast: Array.isArray(raw.cast) ? raw.cast.filter((c): c is string => typeof c === "string").slice(0, 6) : [],
    holdSec: typeof raw.holdSec === "number" && raw.holdSec > 0
      ? Math.max(MIN_HOLD_SEC, Math.min(MAX_HOLD_SEC, raw.holdSec))
      : holdForLine(line),
    move: (["in", "out", "left", "right", "none"] as const).includes(raw.move as KenBurns) ? (raw.move as KenBurns) : "in",
    source: raw.source === "upload" ? "upload" : "ai",
    imageUrl: raw.imageUrl ?? null,
    videoUrl: raw.videoUrl ?? null,
    graphic: raw.graphic && typeof raw.graphic === "object" ? raw.graphic : null,
    audioUrl: raw.audioUrl ?? null,
    audioMs: raw.audioMs ?? null,
    status: (["idle", "queued", "rendering", "ready", "failed"] as const).includes(raw.status as ShotStatus) ? (raw.status as ShotStatus) : "idle",
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    error: raw.error ?? null,
    errorDebug: raw.errorDebug ?? null,
    x: typeof raw.x === "number" ? raw.x : undefined,
    y: typeof raw.y === "number" ? raw.y : undefined,
    w: typeof raw.w === "number" ? raw.w : undefined,
    refKind: raw.refKind ?? null,
    refId: raw.refId ?? null,
    renderHeartbeatAt: raw.renderHeartbeatAt,
  };
}

export function normalizeNarration(raw: Partial<NarrationProject> & { id: string }): NarrationProject {
  const base = emptyNarration({ id: raw.id });
  // filter(Boolean) — a stored array must never carry a hole, or one bad row blanks the library.
  const shots = Array.isArray(raw.shots) ? raw.shots.filter(Boolean).map((s, i) => normalizeShot(s, i)) : [];
  return {
    ...base,
    ...raw,
    title: String(raw.title || base.title).slice(0, 160),
    brief: String(raw.brief || "").slice(0, 8000),
    script: String(raw.script || "").slice(0, 20000),
    mode: raw.mode === "voiceover" ? "voiceover" : raw.mode === "oncam" ? "oncam" : "film",
    treatment: raw.treatment === "images" ? "images" : "mixed",
    aspect: NARRATION_ASPECTS.includes(raw.aspect as NarrationAspect) ? (raw.aspect as NarrationAspect) : base.aspect,
    narrationStyle: NARRATION_STYLES.includes(raw.narrationStyle as NarrationStyle) ? (raw.narrationStyle as NarrationStyle) : base.narrationStyle,
    voice: { ...base.voice, ...(raw.voice || {}) },
    characters: Array.isArray(raw.characters) ? raw.characters.filter(Boolean).slice(0, 12) as FilmCharacter[] : [],
    shots: shots.sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i })),
    takes: Array.isArray(raw.takes) ? raw.takes.filter(Boolean).slice(0, 6) : [],
    takeCount: Math.max(1, Math.min(4, raw.takeCount || 2)),
    draftStatus: raw.draftStatus === "drafting" || raw.draftStatus === "ready" || raw.draftStatus === "failed" ? raw.draftStatus : null,
  };
}

/** Total run time of the narrated film — shots are cut, never cross-faded, so this is additive. */
export function narrationLength(p: NarrationProject): number {
  return p.shots.reduce((n, s) => n + (s.holdSec || 0), 0);
}
