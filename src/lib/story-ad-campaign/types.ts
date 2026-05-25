export type CampaignStyle = "3d" | "cinematic";

export type CampaignPhase =
  | "STYLE"
  | "CHARACTERS"
  | "SCENES"
  | "PROMPTS"
  | "VOICE"
  | "BATCH"
  | "DONE"
  | "FAILED";

export type CampaignClipLength = 8 | 10;

export type CampaignDurationSeconds = 60 | 90 | 120 | 150 | 180;

export type CampaignAspectRatio = "9:16" | "1:1" | "16:9";

export type CampaignProvider = "veo3" | "xai";

export type ActPosition =
  | "HOOK"
  | "PROBLEM"
  | "DISCOVERY"
  | "TRANSFORM"
  | "RESOLUTION"
  | "CTA";

export type ShotType =
  | "WIDE"
  | "CLOSE_UP"
  | "POV"
  | "DRONE"
  | "MACRO"
  | "OVER_SHOULDER"
  | "MEDIUM";

export type CameraMovement =
  | "PUSH_IN"
  | "PULL_BACK"
  | "PAN"
  | "STATIC"
  | "ORBIT"
  | "HANDHELD"
  | "TRACK";

export interface CampaignCharacter {
  id: string;
  name: string;
  role: string;
  visualDescription: string;
  voiceCriteria: {
    age: string;
    tone: string;
    pace: string;
    texture: string;
    delivery: string;
  };
  referenceImageUrl?: string | null;
  previewStatus?: "idle" | "generating" | "ready" | "failed";
  previewError?: string | null;
  approved?: boolean;
}

export interface ClipDialogueLine {
  id: string;
  characterId: string;
  line: string;
  /** Optional acting note: "concerned", "skeptical", "warm" — shapes TTS delivery + Veo performance */
  emotion?: string;
}

export interface CampaignClipSlot {
  id: string;
  index: number;
  act: ActPosition;
  shotType: ShotType;
  cameraMovement: CameraMovement;
  sceneAction: string;
  moodLighting: string;
  /** All characters visible on-camera in this clip */
  characterIds: string[];
  /** In-scene dialogue between characters (NOT voiceover). Lines play in order. */
  dialogue: ClipDialogueLine[];
  prompt: string;
  status: "PENDING" | "QUEUED" | "RENDERING" | "READY" | "FAILED";
  videoUrl?: string | null;
  error?: string | null;
  /** @deprecated legacy single-character field; migrated to characterIds */
  characterId?: string | null;
  /** @deprecated legacy single VO line; migrated to dialogue */
  voiceoverLine?: string;
}

export interface CampaignState {
  phase: CampaignPhase;
  style: CampaignStyle | null;
  brief: string;
  goal: string;
  destinationUrl: string;
  aspectRatio: CampaignAspectRatio;
  durationSeconds: CampaignDurationSeconds;
  clipLength: CampaignClipLength;
  platforms: string[];
  provider: CampaignProvider;
  characters: CampaignCharacter[];
  clips: CampaignClipSlot[];
  storyOutline?: string;
  campaignCaption?: string;
  ctaText?: string;
  hashtags?: string[];
  finalVideoUrl?: string | null;
  finalVideoThumbnailUrl?: string | null;
  errorMessage?: string | null;
}

export type SuggestField =
  | "brief"
  | "goal"
  | "character.name"
  | "character.role"
  | "character.visualDescription"
  | "character.voice.age"
  | "character.voice.tone"
  | "character.voice.pace"
  | "character.voice.texture"
  | "character.voice.delivery"
  | "clip.sceneAction"
  | "clip.moodLighting"
  | "clip.dialogue"
  | "clip.dialogueLine";

export const NEGATIVE_TEXT_PROMPT =
  "no text overlays, no subtitles, no on-screen typography, no title cards, no captions, no watermark, no lower thirds, no fake logos, pure cinematic visuals only";

export const STYLE_LABELS: Record<CampaignStyle, string> = {
  "3d": "3D Animation",
  cinematic: "Cinematic Live-Action",
};

export const STYLE_VISUAL_LANGUAGE: Record<CampaignStyle, string> = {
  "3d":
    "premium Pixar/Disney-grade 3D animation, soft global illumination, expressive stylized character rigs, polished cinematic 3D rendering, depth of field",
  cinematic:
    "cinematic live-action, ARRI Alexa look, anamorphic lenses, naturalistic lighting, shallow depth of field, photoreal skin texture, real production design",
};

export const ACT_LABELS: Record<ActPosition, string> = {
  HOOK: "Hook",
  PROBLEM: "Problem",
  DISCOVERY: "Discovery",
  TRANSFORM: "Transform",
  RESOLUTION: "Resolution",
  CTA: "Call to Action",
};

export const SHOT_LABELS: Record<ShotType, string> = {
  WIDE: "Wide",
  CLOSE_UP: "Close-up",
  POV: "POV",
  DRONE: "Drone",
  MACRO: "Macro",
  OVER_SHOULDER: "Over-shoulder",
  MEDIUM: "Medium",
};

export const CAMERA_LABELS: Record<CameraMovement, string> = {
  PUSH_IN: "Push in",
  PULL_BACK: "Pull back",
  PAN: "Pan",
  STATIC: "Static",
  ORBIT: "Orbit",
  HANDHELD: "Handheld",
  TRACK: "Track",
};

export function clipsForDuration(duration: CampaignDurationSeconds, clipLength: CampaignClipLength): number {
  return Math.round(duration / clipLength);
}

export function emptyCampaignState(): CampaignState {
  return {
    phase: "STYLE",
    style: null,
    brief: "",
    goal: "Build desire, trust, and a clear reason to act.",
    destinationUrl: "",
    aspectRatio: "9:16",
    durationSeconds: 120,
    clipLength: 10,
    platforms: ["instagram", "tiktok"],
    provider: "veo3",
    characters: [],
    clips: [],
  };
}
