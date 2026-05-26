export type CampaignStyle = "3d" | "cinematic" | "narrated";

export type ClipMediaType = "video" | "image";

export type CampaignPhase =
  | "STYLE"
  | "CHARACTERS"
  | "SCENES"
  | "PROMPTS"
  | "VOICE"
  | "BATCH"
  | "DONE"
  | "FAILED";

export type CampaignClipLength = 8 | 10 | 12 | 15;

/** Per-provider hard caps (provider docs). */
export const PROVIDER_CLIP_LENGTH_CAPS: Record<CampaignProvider, number> = {
  veo3: 8,   // Veo 3.1 generate-preview tops out at 8s per call
  xai: 15,   // Grok Imagine Video: 1–15s per generation
};

/** UI options gated by the provider cap. */
export function clipLengthOptionsForProvider(provider: CampaignProvider): CampaignClipLength[] {
  const cap = PROVIDER_CLIP_LENGTH_CAPS[provider];
  const all: CampaignClipLength[] = [8, 10, 12, 15];
  return all.filter((v) => v <= cap);
}

// Extended for narrated style (up to 10 min). Video styles are capped at 180s in the UI.
export type CampaignDurationSeconds = 60 | 90 | 120 | 150 | 180 | 240 | 300 | 420 | 600;

export const STYLE_DURATION_CAP: Record<"3d" | "cinematic" | "narrated", CampaignDurationSeconds> = {
  "3d": 180,
  cinematic: 180,
  narrated: 600, // up to 10 min for narrated-story style
};

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
  /** Narrated style: what the narrator says over this scene */
  narratorLine?: string;
  /** Narrated style: video vs still image. Image is the cheap default. */
  mediaType?: ClipMediaType;
  /** Narrated style: URL of the generated still (when mediaType="image") */
  imageUrl?: string | null;
  /** Narrated style: rendered narrator audio for this segment (mp3 url) */
  audioUrl?: string | null;
  /** Narrated style: duration this segment will play in the final reel (seconds) */
  segmentDuration?: number;
  /** @deprecated legacy single-character field; migrated to characterIds */
  characterId?: string | null;
  /** @deprecated legacy single VO line; migrated to dialogue */
  voiceoverLine?: string;
}

export interface NarratorVoice {
  gender: "male" | "female";
  /** Free-form tone descriptor, e.g. "documentary, calm" or "epic, cinematic" */
  tone: string;
  pace: string;
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
  /** Narrated style: voice used for narrator lines */
  narratorVoice?: NarratorVoice;
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
  narrated: "Narrated Story",
};

export const STYLE_VISUAL_LANGUAGE: Record<CampaignStyle, string> = {
  "3d":
    "premium Pixar/Disney-grade 3D animation, soft global illumination, expressive stylized character rigs, polished cinematic 3D rendering, depth of field",
  cinematic:
    "cinematic live-action, ARRI Alexa look, anamorphic lenses, naturalistic lighting, shallow depth of field, photoreal skin texture, real production design",
  narrated:
    "documentary-style narrated short film. Cinematic still illustrations with painterly lighting, shot composition rivalling a feature-film storyboard. A handful of moments come alive as 8-second video clips. The narrator's voice carries the story across all scenes.",
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
