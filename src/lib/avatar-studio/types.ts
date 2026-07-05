import type { AvatarAspect, AvatarQuality } from "@/lib/ai/heygen-client";

export type { AvatarAspect, AvatarQuality };

/** How the video is produced. Phase 1 renders all modes as a talking-avatar video. */
export type AvatarMode = "talking" | "photo" | "translate" | "batch";

/**
 * Avatar-video state — persisted in CartoonVideo.metadata (JSON string).
 * One HeyGen render per record (avatar + voice + script → one MP4).
 */
export interface AvatarVideoState {
  brief: string;
  script: string;
  avatarId: string;
  avatarName: string;
  voiceId: string;
  voiceName: string;
  quality: AvatarQuality;
  aspect: AvatarAspect;
  lengthSeconds: number;
  mode: AvatarMode;
  /** Groups videos built together in one studio session (a "project"). */
  projectId?: string | null;
  /** 1-based scene order within a project (for the drafted multi-scene plan). */
  projectSeq?: number | null;
  templateId?: string | null;
  /** Per-scene editor settings (HeyGen-style). */
  captionsOn?: boolean;
  captionStyle?: string | null;   // "standard" | "bold" | …
  background?: string | null;     // "original" | a hex colour like "#0ea5e9"
  layout?: string | null;         // "original" | "circle"
  music?: string | null;          // track id/name, or null for none
  /** Translate mode: source video URL + target language. */
  sourceVideoUrl?: string | null;
  targetLanguage?: string | null;
  /** Upstream HeyGen job id, persisted for restart-safe polling/recovery. */
  heygenVideoId?: string | null;
  caption?: string;
  hashtags?: string[];
  error?: string | null;
}

export function emptyAvatarState(): AvatarVideoState {
  return {
    brief: "",
    script: "",
    avatarId: "",
    avatarName: "",
    voiceId: "",
    voiceName: "",
    quality: "standard",
    aspect: "9:16",
    lengthSeconds: 30,
    mode: "talking",
    projectId: null,
    templateId: null,
    sourceVideoUrl: null,
    targetLanguage: null,
    heygenVideoId: null,
    error: null,
  };
}

export const AVATAR_ASPECTS: AvatarAspect[] = ["9:16", "1:1", "16:9"];
export const AVATAR_QUALITIES: AvatarQuality[] = ["standard", "avatar_iv"];
export const AVATAR_MODES: AvatarMode[] = ["talking", "photo", "translate", "batch"];
// Short-form social clips through long-form (training / explainers), up to 30 min.
export const AVATAR_LENGTHS = [15, 30, 60, 180, 600, 1800] as const;
export const MAX_SCRIPT_CHARS = 25000; // ~30 min of speech at ~2 words/sec
export const isAvatarLength = (n: unknown): boolean => (AVATAR_LENGTHS as readonly number[]).includes(Number(n));
