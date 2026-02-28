import OpenAI from "openai";
import type { TimedWord, CaptionSegment, CaptionClipData } from "./types";
import type { CaptionStyleId } from "@/lib/cartoon/caption-generator";

const openai = new OpenAI();

// ── Transcription via Whisper ────────────────────────────────────────────

/**
 * Transcribe audio with word-level timestamps using OpenAI Whisper.
 */
export async function transcribeAudioForCaptions(
  audioBuffer: Buffer,
  mimeType: string = "audio/mp3"
): Promise<TimedWord[]> {
  const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("flac") ? "flac" : "mp3";
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  const file = new File([blob], `audio.${ext}`, { type: mimeType });

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  const words: TimedWord[] = [];
  // The response includes a `words` array when using word-level timestamps
  const rawWords = (response as unknown as { words?: Array<{ word: string; start: number; end: number }> }).words;

  if (rawWords) {
    for (const w of rawWords) {
      words.push({
        word: w.word,
        startTime: w.start,
        endTime: w.end,
      });
    }
  }

  return words;
}

// ── Generate captions from known TTS script ──────────────────────────────

/**
 * For TTS-generated audio where we already know the text, estimate word-level
 * timing proportional to word length.
 */
export function generateCaptionsFromTTSScript(
  script: string,
  audioDurationSec: number
): TimedWord[] {
  const rawWords = script.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  // Total character count for proportional timing
  const totalChars = rawWords.reduce((sum, w) => sum + w.length, 0);
  const words: TimedWord[] = [];
  let currentTime = 0;

  for (const word of rawWords) {
    const wordDuration = (word.length / totalChars) * audioDurationSec;
    words.push({
      word,
      startTime: currentTime,
      endTime: currentTime + wordDuration,
    });
    currentTime += wordDuration;
  }

  return words;
}

// ── Segment words into display groups ────────────────────────────────────

/**
 * Group words into caption segments (phrases/sentences) for display.
 * Breaks at punctuation and limits words per segment.
 */
export function segmentWords(
  words: TimedWord[],
  maxWordsPerSegment: number = 7
): CaptionSegment[] {
  if (words.length === 0) return [];

  const segments: CaptionSegment[] = [];
  let currentWords: TimedWord[] = [];

  for (const word of words) {
    currentWords.push(word);

    // Break at sentence-ending punctuation or word limit
    const endsWithPunctuation = /[.!?;]$/.test(word.word);
    const atLimit = currentWords.length >= maxWordsPerSegment;

    if (endsWithPunctuation || atLimit) {
      segments.push({
        text: currentWords.map((w) => w.word).join(" "),
        startTime: currentWords[0].startTime,
        endTime: currentWords[currentWords.length - 1].endTime,
        words: [...currentWords],
      });
      currentWords = [];
    }
  }

  // Remaining words
  if (currentWords.length > 0) {
    segments.push({
      text: currentWords.map((w) => w.word).join(" "),
      startTime: currentWords[0].startTime,
      endTime: currentWords[currentWords.length - 1].endTime,
      words: [...currentWords],
    });
  }

  return segments;
}

// ── Create caption clip data from audio ──────────────────────────────────

/**
 * Orchestrates caption generation: transcribe (or use script) → segment → return data.
 */
export function createCaptionClipData(
  linkedAudioClipId: string,
  words: TimedWord[],
  captionStyleId: CaptionStyleId = "classic"
): CaptionClipData {
  const segments = segmentWords(words);
  return {
    linkedAudioClipId,
    captionStyleId,
    words,
    segments,
  };
}
