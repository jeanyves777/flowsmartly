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
