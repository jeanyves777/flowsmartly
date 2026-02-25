import OpenAI from "openai";
import { getOpenAIVoice, buildInstructions, type VoiceGender, type VoiceAccent, type VoiceStyle, type OpenAIVoice } from "./voice-presets";

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
}

export async function generateVoice(options: VoiceGenerateOptions): Promise<VoiceGenerateResult> {
  const { text, gender, accent, style, speed = 1.0, overrideVoice } = options;

  const voice = overrideVoice || getOpenAIVoice(gender, accent, style);
  const instructions = buildInstructions(accent, style);

  const response = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice,
    input: text,
    instructions,
    response_format: "mp3",
    speed: Math.max(0.25, Math.min(4.0, speed)),
  });

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const estimatedDurationMs = Math.round(((wordCount / 150) * 60 * 1000) / speed);

  return { audioBuffer, format: "mp3", estimatedDurationMs };
}
