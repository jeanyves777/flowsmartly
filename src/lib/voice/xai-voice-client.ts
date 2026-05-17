import type { OpenAIVoice, VoiceAccent, VoiceGender, VoiceStyle } from "./voice-presets";

const XAI_TTS_URL = "https://api.x.ai/v1/tts";

export type XAIVoiceId = "eve" | "rex" | "ara" | "leo" | "sal";

export interface XAIGenerateSpeechOptions {
  text: string;
  voiceId?: XAIVoiceId;
  language?: string;
  speed?: number;
}

export interface XAIGenerateSpeechResult {
  audioBuffer: Buffer;
  format: "mp3";
}

function getApiKey(): string | null {
  return process.env.XAI_API_KEY || null;
}

export function isXAIVoiceEnabled(): boolean {
  return !!getApiKey();
}

export function getXAIVoice(
  gender: VoiceGender,
  accent: VoiceAccent,
  style: VoiceStyle
): XAIVoiceId {
  if (gender === "male") {
    if (style === "dramatic" || style === "professional") return "rex";
    if (accent === "british" || style === "calm") return "leo";
    return "sal";
  }

  if (style === "professional" || style === "energetic") return "ara";
  return "eve";
}

export function mapOpenAIToXAIVoice(voice?: OpenAIVoice | string | null): XAIVoiceId {
  switch (voice) {
    case "onyx":
      return "rex";
    case "echo":
    case "fable":
      return "leo";
    case "alloy":
      return "ara";
    case "shimmer":
    case "nova":
    default:
      return "eve";
  }
}

function applySpeedTag(text: string, speed = 1): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (speed <= 0.85) return `<slow>${trimmed}</slow>`;
  if (speed >= 1.2) return `<fast>${trimmed}</fast>`;
  return trimmed;
}

export async function generateXAISpeech(
  options: XAIGenerateSpeechOptions
): Promise<XAIGenerateSpeechResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("XAI_API_KEY is not configured");

  const response = await fetch(XAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: applySpeedTag(options.text, options.speed),
      voice_id: options.voiceId || "eve",
      language: options.language || "en",
      output_format: {
        codec: "mp3",
        sample_rate: 24000,
        bit_rate: 128000,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`xAI TTS failed (${response.status}): ${body || response.statusText}`);
  }

  return {
    audioBuffer: Buffer.from(await response.arrayBuffer()),
    format: "mp3",
  };
}
