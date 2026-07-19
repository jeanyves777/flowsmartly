/**
 * AI Presenter narration — turns a built deck into spoken narration the co-host plays
 * while delivering. For each slide the text AI writes a short, natural spoken script;
 * the script is then synthesized in the presenter's cloned voice (or a preset when no
 * clone is available) and stored in S3. This is the audio spine of the timeline runtime.
 * [[training-studio]]
 */
import { ai } from "@/lib/ai/client";
import { generateVoice } from "@/lib/voice/voice-engine";
import { generateWithClonedVoice } from "@/lib/voice/openai-voice-client";
import { generateWithClonedVoice as generateWithElevenLabs } from "@/lib/voice/elevenlabs-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import type { DeckSlide, SlideNarration } from "./types";

export interface ClonedVoice { openaiVoiceId?: string | null; elevenLabsVoiceId?: string | null }

/** What the presenter should say — one short spoken script per slide, in one AI call. */
export async function writeDeckScripts(slides: DeckSlide[], style: string): Promise<string[]> {
  const outline = slides.map((s, i) => {
    const labels = (s.board ?? []).filter((b) => b.t === "text" && !("note" in b && b.note)).map((b) => (b as { text: string }).text);
    const facts = [s.subtitle, ...(s.bullets ?? []), s.notes, labels.length ? `Diagram: ${labels.join(" → ")}` : ""].filter(Boolean).join(" | ");
    return `${i + 1}. "${s.title}"${facts ? ` — ${facts}` : ""}`;
  }).join("\n");

  const prompt = `You are a ${style} training presenter delivering a live session. For EACH slide below, write a SHORT spoken narration — 2 to 4 natural sentences (about 30-60 words) you would actually say out loud. Speak TO the audience in the first person, warm and clear; connect slides so it flows. No stage directions, no markdown, no slide numbers — just the words to speak.

Slides:
${outline}

Return JSON: { "scripts": string[] } with EXACTLY ${slides.length} entries, in order.`;

  const raw = (await ai.generateJSON<{ scripts?: string[] }>(prompt, { temperature: 0.6, maxTokens: 2200 }))
    ?? (await ai.generateJSON<{ scripts?: string[] }>(prompt, { temperature: 0.35, maxTokens: 2200 }));
  const scripts = raw?.scripts ?? [];
  // Always return one script per slide (fall back to a plain read of the title).
  return slides.map((s, i) => (scripts[i] || `${s.title}. ${(s.bullets ?? []).slice(0, 2).join(". ")}`).trim().slice(0, 700));
}

const STYLE_MAP: Record<string, "professional" | "conversational" | "energetic" | "warm"> = {
  professional: "professional", conversational: "conversational", energetic: "energetic", teacher: "warm",
};

/** Synthesize one script in the presenter's voice (cloned when available, else preset). */
export async function synthesize(text: string, voice: ClonedVoice | null, pace: number, style: string): Promise<{ buffer: Buffer; durationMs: number }> {
  const words = text.split(/\s+/).filter(Boolean).length;
  const fallbackMs = Math.max(1500, Math.round((words / 150) * 60 * 1000 / (pace || 1)));
  if (voice?.openaiVoiceId) return { buffer: await generateWithClonedVoice({ text, voiceId: voice.openaiVoiceId, speed: pace }), durationMs: fallbackMs };
  if (voice?.elevenLabsVoiceId) return { buffer: await generateWithElevenLabs({ text, voiceId: voice.elevenLabsVoiceId }), durationMs: fallbackMs };
  const r = await generateVoice({ text, gender: "male", accent: "american", style: STYLE_MAP[style] ?? "conversational", speed: pace });
  return { buffer: r.audioBuffer, durationMs: r.estimatedDurationMs || fallbackMs };
}

/** Narrate a whole deck: write scripts, synthesize each slide, return per-slide audio.
 *  Returns a map slideId → narration (only for slides that succeeded). */
export async function narrateDeck(opts: {
  slides: DeckSlide[];
  sessionId: string;
  voice: ClonedVoice | null;
  pace: number;
  style: string;
}): Promise<Record<string, SlideNarration>> {
  const scripts = await writeDeckScripts(opts.slides, opts.style);
  const out: Record<string, SlideNarration> = {};
  const LIMIT = 3;
  for (let i = 0; i < opts.slides.length; i += LIMIT) {
    await Promise.all(opts.slides.slice(i, i + LIMIT).map(async (s, j) => {
      const text = scripts[i + j];
      if (!text) return;
      try {
        const { buffer, durationMs } = await synthesize(text, opts.voice, opts.pace, opts.style);
        const audioUrl = await uploadToS3(`training/${opts.sessionId}/narration/${s.id}.mp3`, buffer, "audio/mpeg");
        out[s.id] = { text, audioUrl, durationMs };
      } catch { /* a slide without audio just won't auto-play; the deck still presents */ }
    }));
  }
  return out;
}
