import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { CartoonScene, CartoonCharacter } from "./script-generator";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SceneAudio {
  sceneNumber: number;
  audioUrl: string;
  durationMs: number;
}

// Voice options - each character gets a distinct voice
const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
type Voice = (typeof VOICES)[number];

// Character voice assignment pool (varied genders/tones)
const CHARACTER_VOICE_POOL: Voice[] = ["nova", "onyx", "shimmer", "fable", "alloy"];
const NARRATOR_VOICE: Voice = "echo";

/**
 * Build a voice map: assign a unique TTS voice to each character
 * Respects user-selected voices, auto-assigns for the rest
 */
function buildVoiceMap(characters: CartoonCharacter[]): Map<string, Voice> {
  const voiceMap = new Map<string, Voice>();
  voiceMap.set("narrator", NARRATOR_VOICE);

  // Track which auto-pool voices are already taken by user selections
  const usedVoices = new Set<Voice>();
  characters.forEach((char) => {
    if (char.voice && char.voice !== "auto" && VOICES.includes(char.voice as Voice)) {
      voiceMap.set(char.name.toLowerCase(), char.voice as Voice);
      usedVoices.add(char.voice as Voice);
    }
  });

  // Auto-assign remaining characters from the pool, avoiding duplicates
  const availableVoices = CHARACTER_VOICE_POOL.filter((v) => !usedVoices.has(v));
  let autoIndex = 0;

  characters.forEach((char) => {
    if (!voiceMap.has(char.name.toLowerCase())) {
      const pool = availableVoices.length > 0 ? availableVoices : CHARACTER_VOICE_POOL;
      const voice = pool[autoIndex % pool.length];
      voiceMap.set(char.name.toLowerCase(), voice);
      autoIndex++;
    }
  });

  return voiceMap;
}

/**
 * Generate TTS audio for a single dialogue line
 */
async function generateLineAudio(
  text: string,
  voice: Voice
): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
    response_format: "mp3",
    speed: 0.95,
  });

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Generate TTS audio for a scene - uses different voices per character
 */
export async function generateSceneAudio(
  scene: CartoonScene,
  jobId: string,
  voiceMap: Map<string, Voice>,
  fallbackVoice: Voice = "nova"
): Promise<SceneAudio> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "cartoons");
  await mkdir(uploadDir, { recursive: true });

  const hasDialogue = scene.dialogue && scene.dialogue.length > 0;

  let combinedBuffer: Buffer;
  let totalWordCount = 0;

  if (hasDialogue) {
    // Generate audio per dialogue line with character-specific voices
    const audioBuffers: Buffer[] = [];

    for (const line of scene.dialogue) {
      const charKey = line.character.toLowerCase();
      const voice = voiceMap.get(charKey) || fallbackVoice;

      try {
        const buffer = await generateLineAudio(line.line, voice);
        audioBuffers.push(buffer);
        totalWordCount += line.line.split(/\s+/).length;
      } catch (error) {
        console.error(`Failed to generate audio for "${line.character}: ${line.line}":`, error);
      }
    }

    if (audioBuffers.length === 0) {
      // Fallback: generate from narration text
      combinedBuffer = await generateLineAudio(scene.narration, fallbackVoice);
      totalWordCount = scene.narration.split(/\s+/).length;
    } else {
      // Concatenate all MP3 buffers (MP3 is a streaming format, concat works)
      combinedBuffer = Buffer.concat(audioBuffers);
    }
  } else {
    // Legacy: single narration voice
    combinedBuffer = await generateLineAudio(scene.narration, fallbackVoice);
    totalWordCount = scene.narration.split(/\s+/).length;
  }

  // Save combined audio
  const filename = `${jobId}-audio-${scene.sceneNumber}.mp3`;
  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, combinedBuffer);

  // Estimate duration based on total word count
  const estimatedDurationMs = Math.round((totalWordCount / 150) * 60 * 1000);
  const minDurationMs = scene.durationSeconds * 800;
  const durationMs = Math.max(estimatedDurationMs, minDurationMs);

  return {
    sceneNumber: scene.sceneNumber,
    audioUrl: `/uploads/cartoons/${filename}`,
    durationMs,
  };
}

/**
 * Generate audio for all scenes with character-specific voices
 */
export async function generateAllSceneAudio(
  scenes: CartoonScene[],
  jobId: string,
  characters: CartoonCharacter[] = [],
  onProgress?: (completed: number, total: number) => void
): Promise<SceneAudio[]> {
  const voiceMap = buildVoiceMap(characters);
  const audioFiles: SceneAudio[] = [];
  const total = scenes.length;

  for (let i = 0; i < scenes.length; i++) {
    try {
      const audio = await generateSceneAudio(scenes[i], jobId, voiceMap);
      audioFiles.push(audio);
      onProgress?.(i + 1, total);
    } catch (error) {
      console.error(`Failed to generate audio for scene ${scenes[i].sceneNumber}:`, error);
      audioFiles.push({
        sceneNumber: scenes[i].sceneNumber,
        audioUrl: "",
        durationMs: scenes[i].durationSeconds * 1000,
      });
    }
  }

  return audioFiles.sort((a, b) => a.sceneNumber - b.sceneNumber);
}

/**
 * Get available voices
 */
export function getAvailableVoices(): typeof VOICES {
  return VOICES;
}
