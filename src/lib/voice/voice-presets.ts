export type VoiceGender = "male" | "female";
export type VoiceAccent = "american" | "british" | "australian" | "indian" | "african_american" | "latin" | "french" | "middle_eastern";
export type VoiceStyle = "professional" | "conversational" | "dramatic" | "warm" | "energetic" | "calm";
export type OpenAIVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface VoicePreset {
  id: string;
  name: string;
  gender: VoiceGender;
  accent: VoiceAccent;
  style: VoiceStyle;
  openaiVoice: OpenAIVoice;
  description: string;
}

// Map gender + accent + style → best OpenAI voice
export function getOpenAIVoice(gender: VoiceGender, accent: VoiceAccent, style: VoiceStyle): OpenAIVoice {
  if (gender === "male") {
    if (accent === "british") return "fable";
    if (style === "dramatic" || style === "professional") return "onyx";
    return "echo";
  }
  if (style === "calm" || style === "warm") return "shimmer";
  if (style === "energetic" || style === "professional") return "alloy";
  return "nova";
}

// Build TTS instructions string for gpt-4o-mini-tts
export function buildInstructions(accent: VoiceAccent, style: VoiceStyle): string {
  const accentLabels: Record<VoiceAccent, string> = {
    american: "standard American English",
    british: "British English (Received Pronunciation)",
    australian: "Australian English",
    indian: "Indian English",
    african_american: "African American English",
    latin: "Latin-accented English with warm, rhythmic intonation",
    french: "French-accented English",
    middle_eastern: "Middle Eastern-accented English with Arabic influence",
  };

  const styleDirections: Record<VoiceStyle, string> = {
    professional: "Speak in a professional, clear, and authoritative tone. Measured pace, confident delivery.",
    conversational: "Speak naturally and conversationally, as if talking to a friend. Relaxed pace with natural pauses.",
    dramatic: "Speak with dramatic flair and emotional intensity. Vary pace for effect, emphasize key words.",
    warm: "Speak with warmth and friendliness. Gentle pace, inviting tone, slight smile in the voice.",
    energetic: "Speak with high energy and enthusiasm. Upbeat pace, excited delivery, engaging and dynamic.",
    calm: "Speak calmly and soothingly. Slow, measured pace. Relaxing and reassuring tone.",
  };

  return `Speak with a ${accentLabels[accent]} accent. ${styleDirections[style]}`;
}

// UI constants
export const GENDERS: { id: VoiceGender; label: string }[] = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
];

export const ACCENTS: { id: VoiceAccent; label: string }[] = [
  { id: "american", label: "American" },
  { id: "british", label: "British" },
  { id: "australian", label: "Australian" },
  { id: "indian", label: "Indian" },
  { id: "african_american", label: "African American" },
  { id: "latin", label: "Latin" },
  { id: "french", label: "French" },
  { id: "middle_eastern", label: "Middle Eastern" },
];

export const STYLES: { id: VoiceStyle; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "conversational", label: "Conversational" },
  { id: "dramatic", label: "Dramatic" },
  { id: "warm", label: "Warm" },
  { id: "energetic", label: "Energetic" },
  { id: "calm", label: "Calm" },
];

export const VOICE_PRESETS: VoicePreset[] = [
  { id: "pro-male-american", name: "Corporate Pro", gender: "male", accent: "american", style: "professional", openaiVoice: "onyx", description: "Deep, authoritative American male" },
  { id: "warm-female-american", name: "Friendly Host", gender: "female", accent: "american", style: "warm", openaiVoice: "nova", description: "Warm, approachable American female" },
  { id: "british-male", name: "British Narrator", gender: "male", accent: "british", style: "dramatic", openaiVoice: "fable", description: "Classic British storyteller" },
  { id: "energetic-female", name: "Hype Queen", gender: "female", accent: "american", style: "energetic", openaiVoice: "alloy", description: "High-energy, exciting female voice" },
  { id: "calm-female-british", name: "Meditation Guide", gender: "female", accent: "british", style: "calm", openaiVoice: "shimmer", description: "Soothing British female" },
  { id: "latin-male", name: "Latin Storyteller", gender: "male", accent: "latin", style: "conversational", openaiVoice: "echo", description: "Warm Latin-accented male" },
];
