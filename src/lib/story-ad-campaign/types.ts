export type CampaignStyle = "3d" | "cinematic" | "narrated";

export type ClipMediaType = "video" | "image";

export type CampaignPhase =
  | "STYLE"
  | "CHARACTERS"
  | "NARRATION"
  | "SCENES"
  | "PROMPTS"
  | "VOICE"
  | "BATCH"
  | "DONE"
  | "FAILED";

export type CampaignClipLength = 8 | 10 | 12 | 15;

/**
 * Per-tier clip-length cap.
 * Both Premium and Standard render via Veo 3.1 (Quality / Lite respectively), whose
 * /generate-preview endpoint tops out at 8s. xAI is a silent fallback only; even
 * when it kicks in we still clamp to 8s so the final concat doesn't mix clip lengths.
 */
export const PROVIDER_CLIP_LENGTH_CAPS: Record<CampaignProvider, number> = {
  veo3: 8,
  xai: 8,
  // Cheap tier uses xAI Imagine's full 15s window — fewer scenes overall for the same
  // total duration, more dialogue per scene. The reel is uniform-length internally
  // (all clips are 15s) so concat still mixes cleanly.
  cheap: 15,
};

/** UI options gated by the provider cap. */
export function clipLengthOptionsForProvider(provider: CampaignProvider): CampaignClipLength[] {
  const cap = PROVIDER_CLIP_LENGTH_CAPS[provider];
  const all: CampaignClipLength[] = [8, 10, 12, 15];
  return all.filter((v) => v <= cap);
}

// Extended for narrated style (up to 10 min). Video styles are capped at 180s in the UI.
// 30s is the floor — useful for short-form catch-phrase reels and TikTok-style hooks.
export type CampaignDurationSeconds = 30 | 60 | 90 | 120 | 150 | 180 | 240 | 300 | 420 | 600;

export const STYLE_DURATION_CAP: Record<"3d" | "cinematic" | "narrated", CampaignDurationSeconds> = {
  "3d": 180,
  cinematic: 180,
  narrated: 600, // up to 10 min for narrated-story style
};

export type CampaignAspectRatio = "9:16" | "1:1" | "16:9";

/**
 * Render tier the user selects:
 * - "veo3"  → Premium (Veo 3.1 Quality — best fidelity, most expensive)
 * - "xai"   → Standard (Veo 3.1 Lite — great quality at lower cost; xAI fallback on failure)
 *             The enum value stays "xai" for back-compat with existing campaign rows;
 *             the internal renderer maps it to Veo Lite.
 * - "cheap" → Cheap (xAI Imagine Video direct — fastest + cheapest, lower fidelity)
 */
export type CampaignProvider = "veo3" | "xai" | "cheap";

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
  /**
   * Multi-angle turnaround sheet (front / three-quarter / profile + face close-up,
   * one image, neutral seamless backdrop). Generated alongside `referenceImageUrl`
   * and fed into Veo Quality's `referenceImages` as the cast anchor — multiple angles
   * give the video model far stronger cross-shot identity lock than a single front
   * portrait. The single `referenceImageUrl` is still kept for the Veo-Lite first-frame
   * path (which must NOT open on a grid).
   */
  characterSheetUrl?: string | null;
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
  /** Narrated style: rendered TTS audio for this line (mp3 url) */
  audioUrl?: string;
  /** Narrated style: time (within the scene) this line begins playing, in milliseconds */
  startMs?: number;
  /** Narrated style: measured duration of the rendered audio, in milliseconds */
  durationMs?: number;
}

/**
 * A cinematic-quality audio bed for a single narrated scene.
 * - `ambient` plays at low volume under everything else (room tone, weather, traffic, etc.)
 * - `spot` are short cues fired at specific moments (door slam, glass break, dog bark, swell)
 *
 * Why this exists: customers building YouTube storytelling channels expect movie-grade
 * sound design, not a slideshow. Layering ambient + spot SFX under narrator + dialogue is
 * what makes a story FEEL like a film.
 */
export interface SceneSoundscape {
  ambient?: {
    description: string;
    audioUrl?: string;
    /** Mix gain in dB. Default -20 (well under voice). */
    gainDb?: number;
  };
  spot?: Array<{
    id: string;
    description: string;
    audioUrl?: string;
    /** Time within the scene (seconds) when this cue starts. */
    atSec: number;
    /** Optional rendered duration in seconds. */
    durationSec?: number;
    /** Mix gain in dB. Default -8 (clearly audible but not louder than voice). */
    gainDb?: number;
  }>;
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
  /** User reviewed this rendered clip and approved it for the final compose. */
  approved?: boolean;
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
  /**
   * Narrated style: cinematic SFX bed for this scene (ambient + spot cues).
   * Mixed under narrator + dialogue to give the reel the feel of a real film.
   */
  soundscape?: SceneSoundscape;
  /**
   * Narrated style: final mixed audio for this scene (narrator + dialogue + SFX),
   * encoded as a single mp3 the renderer drops onto the image with Ken Burns motion.
   * When present, takes priority over the legacy single-track `audioUrl`.
   */
  mixedAudioUrl?: string;
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
  /** Set when the user picked a preset from NARRATOR_PRESETS instead of the AI default */
  presetId?: string;
  /**
   * Opt-in: when set, the narrator audio renders via ElevenLabs using THIS voice
   * (premade or cloned voice from the platform's EL account). When unset, narrator
   * audio falls back to the default xAI / OpenAI TTS path. ElevenLabs is more
   * expensive per character but higher quality.
   */
  elevenlabsVoiceId?: string;
  /** Human-readable name of the picked ElevenLabs voice (for UI display). */
  elevenlabsVoiceName?: string;
}

export interface NarratorPreset {
  id: string;
  label: string;
  gender: "male" | "female";
  tone: string;
  pace: string;
  description: string;
}

/**
 * Curated narrator voices the user can choose from. Each maps directly to the
 * TTS engine's gender + style heuristics via tone keywords.
 */
export const NARRATOR_PRESETS: NarratorPreset[] = [
  {
    id: "documentary-male",
    label: "Documentary Male",
    gender: "male",
    tone: "warm documentary, grounded",
    pace: "measured, deliberate",
    description: "Calm, authoritative — perfect for serious real-life stories.",
  },
  {
    id: "documentary-female",
    label: "Documentary Female",
    gender: "female",
    tone: "warm documentary, intimate",
    pace: "measured, gentle",
    description: "Empathetic, thoughtful — for emotional narratives.",
  },
  {
    id: "epic-male",
    label: "Epic Cinematic",
    gender: "male",
    tone: "dramatic cinematic, weighty",
    pace: "deliberate, building",
    description: "Bold and theatrical — for action and adventure stories.",
  },
  {
    id: "epic-female",
    label: "Epic Female",
    gender: "female",
    tone: "dramatic cinematic, intense",
    pace: "deliberate, building",
    description: "Commanding and rich — for high-stakes drama.",
  },
  {
    id: "warm-storyteller",
    label: "Warm Storyteller",
    gender: "female",
    tone: "warm, gentle, lullaby-like",
    pace: "soft, unhurried",
    description: "Soothing, comforting — for heartfelt family stories.",
  },
  {
    id: "intimate-friend",
    label: "Intimate Friend",
    gender: "female",
    tone: "intimate, conversational",
    pace: "natural, easy",
    description: "Like a friend telling you a story over coffee.",
  },
  {
    id: "energetic-host",
    label: "Energetic Host",
    gender: "male",
    tone: "energetic, charismatic",
    pace: "punchy, animated",
    description: "High-energy host vibe — for upbeat brand stories.",
  },
  {
    id: "noir-male",
    label: "Noir Veteran",
    gender: "male",
    tone: "rasped, world-weary",
    pace: "slow, deliberate",
    description: "Gravelly, lived-in — for noir, crime, or somber tales.",
  },
];

/**
 * Campaign-level music plan: a small number of music cues (typically 0-4) that span
 * multiple scenes. Each cue is one Lyria 3 generation, overlaid on the final reel
 * after the per-scene audio mix is done. Music ducks under voice via a fixed gain.
 */
export interface CampaignMusicCue {
  id: string;
  /** First scene this cue starts on (0-based, inclusive) */
  startSceneIndex: number;
  /** Last scene this cue covers (0-based, inclusive) */
  endSceneIndex: number;
  /** Mood + instruments + tempo prompt for Lyria — single line. */
  description: string;
  /** Generated music audio URL (set after Lyria render). */
  audioUrl?: string;
  /** Measured duration of the rendered music in seconds. */
  durationSec?: number;
  /** Mix gain in dB on the final reel. Default -16 (sits under voice). */
  gainDb?: number;
  /** Which Lyria tier was used. */
  model?: "clip" | "pro";
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
  /** Narrated style: visual sub-style for the still illustrations (3d animation vs cinematic photoreal). */
  narratedSubStyle?: "3d" | "cinematic";
  /**
   * Narrated style: small, intentional music cues across the reel (typically 0-4).
   * Generated by Lyria 3 and overlaid on the final reel under the voice mix.
   */
  musicCues?: CampaignMusicCue[];
  /**
   * Narrated style only. When true, every scene is rendered as a Veo Lite 720p no-audio
   * video clip (~$0.24 / 8s clip) instead of a still image with Ken Burns motion. The
   * narrator + dialogue + SFX + music layers still compose separately on top.
   * Drops the legacy xAI hook clip — Veo handles every scene end-to-end.
   */
  fullAnimation?: boolean;
  /**
   * Route the render through Vertex AI / Gemini Batch API for a 50% per-call discount.
   * Trade-off: results arrive within ~24h instead of minutes. Suitable for scheduled /
   * content-pipeline workloads, not for interactive "render right now" runs.
   */
  batchMode?: boolean;
  /**
   * When true, the render pipeline composites the final reel automatically as soon as all
   * clips finish. When false/undefined (the interactive default), rendering STOPS at
   * "clips ready" so the user can review, approve, regenerate, remove, reorder, or add
   * clips before explicitly triggering the final compose. Only the scheduled-automation
   * path sets this true (no human in the loop).
   */
  autoComposite?: boolean;
  /** Per-clip approval is tracked on CampaignClipSlot.approved. */
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
    // Both tiers cap at 8s (Veo /generate-preview limit) — clipLength now lives at the
    // hard cap so we always use the longest call possible.
    clipLength: 8,
    platforms: ["instagram", "tiktok"],
    provider: "veo3",
    characters: [],
    clips: [],
  };
}
