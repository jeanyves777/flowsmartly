import type { CaptionStyleId } from "@/lib/cartoon/caption-generator";

// ── Clip & Track Types ───────────────────────────────────────────────

export type ClipType = "video" | "image" | "audio" | "voiceover" | "caption" | "text";
export type TrackType = "video" | "audio" | "text" | "caption";

// ── Word-level timing (for captions synced to voiceovers) ────────────

export interface TimedWord {
  word: string;
  startTime: number; // seconds from clip start
  endTime: number;
}

// ── Caption segment (group of words displayed together) ──────────────

export interface CaptionSegment {
  text: string;
  startTime: number; // seconds from clip start
  endTime: number;
  words: TimedWord[];
}

// ── Caption clip data ────────────────────────────────────────────────

export interface CaptionClipData {
  linkedAudioClipId: string;
  captionStyleId: CaptionStyleId;
  words: TimedWord[];
  segments: CaptionSegment[];
}

// ── Timeline clip ────────────────────────────────────────────────────

export interface TimelineClip {
  id: string;
  type: ClipType;
  trackId: string;
  startTime: number;      // seconds from timeline start
  duration: number;        // seconds (visible duration after trim)
  trimStart: number;       // seconds trimmed from source start
  trimEnd: number;         // seconds trimmed from source end
  sourceUrl: string;       // S3 URL for media; empty for text/caption clips
  sourceDuration: number;  // original media duration in seconds
  name: string;

  // Video/image specific
  thumbnailUrl?: string;
  width?: number;
  height?: number;

  // Audio
  volume: number;          // 0-1
  muted: boolean;

  // Text overlay specific
  textContent?: string;
  textStyle?: TextClipStyle;

  // Caption specific
  captionData?: CaptionClipData;

  // Transitions
  transitionType?: TransitionType;
  transitionDuration?: number; // seconds

  // AI generation metadata
  aiGenerated?: boolean;
  aiProvider?: string;     // "veo3" | "sora" | "slideshow" | "openai-tts" | etc.
  aiPrompt?: string;
}

// ── Text clip styling ────────────────────────────────────────────────

export interface TextClipStyle {
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  fontWeight: "normal" | "bold";
  textAlign: "left" | "center" | "right";
  backgroundColor?: string;
  position: { x: number; y: number }; // percentage 0-100
  animation?: TextAnimation;
}

export type TextAnimation = "none" | "fade-in" | "slide-up" | "slide-left" | "typewriter";

// ── Transitions ──────────────────────────────────────────────────────

export type TransitionType = "none" | "crossfade" | "wipe-left" | "wipe-right" | "slide" | "dissolve";

// ── Timeline track ───────────────────────────────────────────────────

export interface TimelineTrack {
  id: string;
  type: TrackType;
  name: string;
  height: number;          // px height in timeline UI
  muted: boolean;
  locked: boolean;
  visible: boolean;
  clips: string[];         // ordered clip IDs
}

// ── Video project ────────────────────────────────────────────────────

export interface VideoProject {
  id: string | null;
  name: string;
  width: number;           // output resolution width
  height: number;          // output resolution height
  fps: number;
  duration: number;        // total timeline duration (computed from clips)
  aspectRatio: string;     // "16:9" | "9:16" | "1:1"
}

// ── Playback ─────────────────────────────────────────────────────────

export type PlaybackState = "stopped" | "playing" | "paused";

// ── Export settings ──────────────────────────────────────────────────

export interface ExportSettings {
  format: "mp4" | "webm";
  quality: "draft" | "standard" | "high";
  resolution: "480p" | "720p" | "1080p";
  fps: 24 | 30 | 60;
  includeAudio: boolean;
  captionStyleId?: CaptionStyleId;
}

// ── Caption settings ─────────────────────────────────────────────────

export interface CaptionSettings {
  autoCaption: boolean;
  defaultStyleId: CaptionStyleId;
  globalPosition: "top" | "center" | "bottom";
}

// ── Active panel tabs ────────────────────────────────────────────────

export type VideoActivePanel =
  | "media"
  | "generate"
  | "voice"
  | "captions"
  | "text"
  | "audio"
  | "elements"
  | "transitions";

// ── Serialized project (for save/load) ───────────────────────────────

export interface SerializedVideoProject {
  _videoProject: true;
  project: VideoProject;
  tracks: TimelineTrack[];
  clips: Record<string, TimelineClip>;
  captionSettings: CaptionSettings;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Generate a unique ID for clips, tracks, etc. */
export function generateId(prefix: string = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Default video project settings */
export function createDefaultProject(): VideoProject {
  return {
    id: null,
    name: "Untitled Video",
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 0,
    aspectRatio: "16:9",
  };
}

/** Default caption settings */
export function createDefaultCaptionSettings(): CaptionSettings {
  return {
    autoCaption: true,
    defaultStyleId: "classic",
    globalPosition: "bottom",
  };
}

/** Default track heights */
export const TRACK_HEIGHTS: Record<TrackType, number> = {
  video: 60,
  audio: 40,
  text: 36,
  caption: 32,
};

/** Clip type colors for the timeline */
export const CLIP_COLORS: Record<ClipType, string> = {
  video: "bg-blue-500/80",
  image: "bg-cyan-500/80",
  audio: "bg-green-500/80",
  voiceover: "bg-purple-500/80",
  caption: "bg-amber-500/80",
  text: "bg-orange-500/80",
};
