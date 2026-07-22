/**
 * Studio voices for the AI co-host — curated ElevenLabs PREMADE voices (real, high-quality)
 * the user can assign to their presenter INSTEAD of cloning their own. Cloning stays optional.
 * These are stable public ElevenLabs voice ids; a chosen one is stored as a VoiceProfile
 * (elevenLabsVoiceId) so it flows through narration + the talking-video pipeline unchanged.
 * Verified 2026-07-21: premade voices render on our ElevenLabs plan (real TTS, 200 OK).
 * [[training-presenter-talking-video]] [[voice-studio]]
 */
export interface StudioVoice {
  id: string;          // ElevenLabs premade voice id
  name: string;        // display name
  tag: string;         // one-line character
  gender: "male" | "female";
}

export const STUDIO_VOICES: StudioVoice[] = [
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", tag: "Clear, engaging educator", gender: "female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", tag: "Mature, reassuring, confident", gender: "female" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", tag: "Knowledgeable, professional", gender: "female" },
  { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", tag: "Professional, bright, warm", gender: "female" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", tag: "Warm, captivating storyteller", gender: "male" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", tag: "Deep, resonant, comforting", gender: "male" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", tag: "Steady broadcaster", gender: "male" },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", tag: "Wise, mature, balanced", gender: "male" },
];

export function findStudioVoice(id: string): StudioVoice | undefined {
  return STUDIO_VOICES.find((v) => v.id === id);
}

/* ---- Voice LIBRARY filter facets (for browsing the full ElevenLabs shared-voice library) ----
 * A picked library voice is used by its voice_id directly (verified: TTS works with a shared
 * voice_id, no "add", no slot consumed), so the whole library scales to every customer. */
export const VOICE_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" }, { code: "es", label: "Spanish" }, { code: "fr", label: "French" },
  { code: "de", label: "German" }, { code: "pt", label: "Portuguese" }, { code: "it", label: "Italian" },
  { code: "hi", label: "Hindi" }, { code: "ar", label: "Arabic" }, { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" }, { code: "zh", label: "Chinese" }, { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" }, { code: "tr", label: "Turkish" }, { code: "ru", label: "Russian" },
];
export const VOICE_ACCENTS: string[] = [
  "american", "british", "australian", "canadian", "irish", "received pronunciation",
  "us midwest", "us northeast", "us southern", "indian", "nigerian", "south african",
  "spanish", "french", "german", "italian", "arabic", "japanese", "korean", "singaporean",
];
export const VOICE_AGES: { v: string; label: string }[] = [
  { v: "young", label: "Young" }, { v: "middle_aged", label: "Middle aged" }, { v: "old", label: "Older" },
];
export const VOICE_USE_CASES: { v: string; label: string }[] = [
  { v: "informative_educational", label: "Educational" }, { v: "conversational", label: "Conversational" },
  { v: "narrative_story", label: "Narration" }, { v: "social_media", label: "Social media" },
  { v: "advertisement", label: "Advertisement" }, { v: "entertainment_tv", label: "Entertainment" },
  { v: "characters_animation", label: "Characters" },
];

/** One voice from the browsable library (a normalized ElevenLabs shared voice). */
export interface LibraryVoice {
  voiceId: string;
  name: string;
  description?: string;
  gender?: string;
  age?: string;
  accent?: string;
  language?: string;
  useCase?: string;
  previewUrl?: string;
}
