import OpenAI from "openai";
import { getOpenAIVoice, buildInstructions, type VoiceGender, type VoiceAccent, type VoiceStyle, type OpenAIVoice } from "./voice-presets";
import { generateXAISpeech, getXAIVoice, isXAIVoiceEnabled, mapOpenAIToXAIVoice } from "./xai-voice-client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface VoiceGenerateOptions {
  text: string;
  gender: VoiceGender;
  accent: VoiceAccent;
  style: VoiceStyle;
  speed?: number;
  overrideVoice?: OpenAIVoice;
}

export interface VoiceGenerateResult {
  audioBuffer: Buffer;
  format: "mp3";
  estimatedDurationMs: number;
  provider: "xai" | "openai";
}

export async function generateVoice(options: VoiceGenerateOptions): Promise<VoiceGenerateResult> {
  const { text, gender, accent, style, speed = 1.0, overrideVoice } = options;

  const openaiVoice = overrideVoice || getOpenAIVoice(gender, accent, style);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const estimatedDurationMs = Math.round(((wordCount / 150) * 60 * 1000) / speed);

  if (isXAIVoiceEnabled()) {
    try {
      const xaiVoice = overrideVoice ? mapOpenAIToXAIVoice(overrideVoice) : getXAIVoice(gender, accent, style);
      const result = await generateXAISpeech({
        text,
        voiceId: xaiVoice,
        speed,
      });
      return {
        audioBuffer: result.audioBuffer,
        format: result.format,
        estimatedDurationMs,
        provider: "xai",
      };
    } catch (error) {
      console.warn("[VoiceEngine] xAI TTS failed, using OpenAI fallback:", error);
    }
  }

  const instructions = buildInstructions(accent, style);

  const response = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: openaiVoice,
    input: text,
    instructions,
    response_format: "mp3",
    speed: Math.max(0.25, Math.min(4.0, speed)),
  });

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  return { audioBuffer, format: "mp3", estimatedDurationMs, provider: "openai" };
}
