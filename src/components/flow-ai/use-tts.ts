"use client";

/**
 * Synthesize speech for a piece of text via the self-hosted Supertonic proxy
 * (/api/flow-ai/tts). Returns an object URL for the WAV, or null if the voice
 * service is unavailable. Caller owns the URL (revoke it when done).
 */
export async function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch("/api/flow-ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
      signal,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Split text into speech-sized chunks at sentence boundaries (~180 chars).
 * Streaming these one at a time drops time-to-first-audio from ~20s (whole
 * reply) to ~1.5s (first sentence) — synthesis runs ~3x faster than playback,
 * so prefetching one chunk ahead keeps the audio gapless.
 */
export function splitIntoSpeechChunks(text: string, target = 180): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= target) return [clean];
  const sentences = clean.match(/[^.!?\n]+[.!?]+|\S[^.!?\n]*$/g) || [clean];
  const chunks: string[] = [];
  let cur = "";
  for (const raw of sentences) {
    let piece = raw.trim();
    if (!piece) continue;
    // Hard-split a single overly long sentence so no chunk balloons.
    while (piece.length > target * 1.6) {
      const head = (cur ? cur + " " : "") + piece.slice(0, target);
      chunks.push(head.trim());
      cur = "";
      piece = piece.slice(target);
    }
    if (cur && cur.length + 1 + piece.length > target) {
      chunks.push(cur);
      cur = piece;
    } else {
      cur = cur ? `${cur} ${piece}` : piece;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

export interface SpeechPlayer {
  /** Resolves when playback finishes (or is stopped). onFirstAudio fires once
   * the first chunk starts playing (use it to flip a "loading"→"playing" UI). */
  play: (text: string, onFirstAudio?: () => void) => Promise<{ playedAny: boolean }>;
  stop: () => void;
}

/**
 * A streaming speech player: synthesizes chunk-by-chunk, plays in order, and
 * prefetches the next chunk while the current one plays.
 */
export function createSpeechPlayer(): SpeechPlayer {
  let stopped = false;
  let current: HTMLAudioElement | null = null;

  const playUrl = (url: string) =>
    new Promise<void>((resolve) => {
      const audio = new Audio(url);
      current = audio;
      const done = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.addEventListener("ended", done, { once: true });
      audio.addEventListener("error", done, { once: true });
      audio.play().catch(done);
    });

  return {
    async play(text, onFirstAudio) {
      stopped = false;
      const chunks = splitIntoSpeechChunks(text);
      if (chunks.length === 0) return { playedAny: false };

      let nextUrl: Promise<string | null> = synthesizeSpeech(chunks[0]);
      let playedAny = false;
      for (let i = 0; i < chunks.length; i++) {
        if (stopped) break;
        const url = await nextUrl;
        // Kick off the next chunk's synthesis immediately (prefetch).
        nextUrl = i + 1 < chunks.length ? synthesizeSpeech(chunks[i + 1]) : Promise.resolve(null);
        if (!url) continue;
        if (stopped) {
          URL.revokeObjectURL(url);
          break;
        }
        if (!playedAny) {
          playedAny = true;
          onFirstAudio?.();
        }
        await playUrl(url);
      }
      return { playedAny };
    },
    stop() {
      stopped = true;
      if (current) {
        current.pause();
        current = null;
      }
    },
  };
}

// One shared player for fire-and-forget voice-mode auto-play, so a new reply
// stops any still-playing previous reply instead of overlapping.
let globalPlayer: SpeechPlayer | null = null;
export async function speakAloud(text: string): Promise<void> {
  globalPlayer?.stop();
  globalPlayer = createSpeechPlayer();
  await globalPlayer.play(text);
}
