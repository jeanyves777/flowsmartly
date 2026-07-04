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
  templateId?: string | null;
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
    templateId: null,
    heygenVideoId: null,
    error: null,
  };
}

export const AVATAR_ASPECTS: AvatarAspect[] = ["9:16", "1:1", "16:9"];
export const AVATAR_QUALITIES: AvatarQuality[] = ["standard", "avatar_iv"];
export const AVATAR_MODES: AvatarMode[] = ["talking", "photo", "translate", "batch"];
export const AVATAR_LENGTHS = [15, 30, 60] as const;
