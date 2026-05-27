/**
 * Google Lyria 3 Music Generation Client
 *
 * Lyria 3 is Google's text-to-music model. We use the "clip" preview variant which
 * always generates 30-second 48kHz stereo audio. Pricing (May 2026): $0.04 per song
 * for clip preview, $0.08 per song for the full-song pro preview.
 *
 * Why we use this: narrated story reels need cinematic music that elevates emotional
 * arcs (hook, transformation, resolution) without overpowering the narrator. The
 * Story Ad Campaign planner picks 0-4 music cues per campaign and asks Lyria to
 * generate them; the audio compositor then overlays them on the final reel with
 * fixed-volume ducking under voice.
 */

const LYRIA_CLIP_MODEL = "lyria-3-clip-preview";
const LYRIA_PRO_MODEL = "lyria-3-pro-preview";
const GENAI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

export function isLyriaEnabled(): boolean {
  return !!getApiKey();
}

export type LyriaModel = "clip" | "pro";

export interface LyriaGenerateOptions {
  /** Free-text description of the music: mood, tempo, instruments, genre */
  prompt: string;
  /**
   * "clip" → 30s 48kHz stereo (~$0.04). Default and recommended for short cues.
   * "pro"  → full song (~$0.08). Use when the cue must span > 25s and looping is undesirable.
   */
  model?: LyriaModel;
}

export interface LyriaResult {
  audioBuffer: Buffer;
  /** Reported MIME (e.g. "audio/wav" / "audio/mp3") — falls back to "audio/wav" */
  mimeType: string;
  /** Optional lyrics + structure metadata when returned by the API */
  lyrics?: string;
  structure?: string;
  modelUsed: string;
}

interface LyriaInlineData {
  mime_type?: string;
  mimeType?: string;
  data?: string;
}
interface LyriaPart {
  inlineData?: LyriaInlineData;
  inline_data?: LyriaInlineData;
  text?: string;
}
interface LyriaCandidate {
  content?: { parts?: LyriaPart[] };
}
interface LyriaResponse {
  candidates?: LyriaCandidate[];
  promptFeedback?: { blockReason?: string };
}

/**
 * Generate a music clip via Lyria 3.
 *
 * Throws on any failure (no audio returned, API error, missing key). Callers should
 * treat this as best-effort and continue without music if it throws — music is a
 * nice-to-have, not a hard dependency.
 */
export async function generateMusicClip(options: LyriaGenerateOptions): Promise<LyriaResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const modelTier: LyriaModel = options.model ?? "clip";
  const modelId = modelTier === "pro" ? LYRIA_PRO_MODEL : LYRIA_CLIP_MODEL;

  const url = `${GENAI_BASE}/models/${modelId}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: options.prompt }],
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = `${response.status}`;
    try {
      const err = await response.json() as Record<string, unknown>;
      detail = JSON.stringify(err).slice(0, 500);
    } catch {
      try { detail = (await response.text()).slice(0, 500); } catch { /* ignore */ }
    }
    throw new Error(`Lyria generation failed: ${detail}`);
  }

  const data = (await response.json()) as LyriaResponse;
  const block = data.promptFeedback?.blockReason;
  if (block) throw new Error(`Lyria blocked the prompt (reason: ${block})`);

  const parts = data.candidates?.[0]?.content?.parts || [];
  let audioBuffer: Buffer | null = null;
  let mimeType = "audio/wav";
  let lyrics: string | undefined;
  let structure: string | undefined;

  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      const partMime = inline.mime_type || inline.mimeType || "";
      // The audio part is whichever inline_data carries audio/* — there may also be
      // a text part with lyrics/structure metadata.
      if (partMime.startsWith("audio/")) {
        audioBuffer = Buffer.from(inline.data, "base64");
        mimeType = partMime;
      }
    }
    if (part.text) {
      // Lyria returns structure + lyrics as text. We don't currently parse them
      // structurally — keep the raw text for diagnostic logging.
      if (/lyrics|verse|chorus/i.test(part.text)) lyrics = part.text;
      else structure = part.text;
    }
  }

  if (!audioBuffer) {
    throw new Error("Lyria returned no audio data");
  }

  return {
    audioBuffer,
    mimeType,
    lyrics,
    structure,
    modelUsed: modelId,
  };
}
