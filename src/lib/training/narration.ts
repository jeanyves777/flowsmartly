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
export async function writeDeckScripts(slides: DeckSlide[], style: string, presenterName?: string): Promise<string[]> {
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
  const who = (presenterName || "").trim().split(/\s+/)[0] || "your A I co-host";
  return slides.map((s, i) => {
    // The opening slide is the AI co-host's disclosed self-introduction.
    if (s.intro) {
      return `Hi everyone, and welcome! I'm ${who}, your A I co-host for today's session — yes, I'm an A I, presenting right alongside your host. I'll walk us through the material, and you can raise your hand or use Ask the presenter any time. Let's get started.`;
    }
    // Quiz slides read the question + options, then the runtime pauses for a hand-raise
    // check before the host reveals the answer on screen.
    if (s.quiz) {
      const opts = s.quiz.options.map((o, k) => `${String.fromCharCode(65 + k)}, ${o}`).join(". ");
      return `Quick check. ${s.quiz.question} Your options are: ${opts}. Take a few seconds — raise your hand if you think you know the answer, and I'll reveal it.`;
    }
    // Q&A slides speak a fixed invitation, then the runtime pauses for questions.
    if (s.qa) return s.qaKind === "final"
      ? "That covers everything I planned to share. Before we wrap up, let's open the floor — what questions do you have? Raise your hand or use Ask the presenter, and I'll help. Host, feel free to jump in here too."
      : "Let's pause here for a moment. Does anyone have a question about what we've covered so far? Raise your hand or use Ask the presenter — I'm happy to clarify before we move on.";
    return (scripts[i] || `${s.title}. ${(s.bullets ?? []).slice(0, 2).join(". ")}`).trim().slice(0, 700);
  });
}

const STYLE_MAP: Record<string, "professional" | "conversational" | "energetic" | "warm"> = {
  professional: "professional", conversational: "conversational", energetic: "energetic", teacher: "warm",
};

/** Synthesize one script in the presenter's voice. Tries the cloned voice first, but a
 *  clone failure must NEVER block narration — it falls back to a preset voice so slides
 *  still get audio (`usedClone` records which path actually produced the sound). */
export async function synthesize(text: string, voice: ClonedVoice | null, pace: number, style: string): Promise<{ buffer: Buffer; durationMs: number; usedClone: boolean }> {
  const words = text.split(/\s+/).filter(Boolean).length;
  // Deliver a touch slower than the raw pace for a natural, measured cadence (the default
  // delivery was rushing). Reveals track the audio, so this paces the whole timeline too.
  const speed = Math.min(1.1, Math.max(0.7, (pace || 1) * 0.9));
  const fallbackMs = Math.max(1500, Math.round((words / 150) * 60 * 1000 / speed));
  // 1. the presenter's cloned voice (ElevenLabs is true cloning; try it first)
  if (voice?.elevenLabsVoiceId) {
    try { return { buffer: await generateWithElevenLabs({ text, voiceId: voice.elevenLabsVoiceId, speed }), durationMs: fallbackMs, usedClone: true }; }
    catch (e) { console.error("[narration] ElevenLabs voice failed, falling back to preset:", e instanceof Error ? e.message : e); }
  }
  if (voice?.openaiVoiceId) {
    try { return { buffer: await generateWithClonedVoice({ text, voiceId: voice.openaiVoiceId, speed }), durationMs: fallbackMs, usedClone: true }; }
    catch (e) { console.error("[narration] OpenAI voice failed, falling back to preset:", e instanceof Error ? e.message : e); }
  }
  // 2. preset voice — always available (never lets narration fail outright)
  const r = await generateVoice({ text, gender: "male", accent: "american", style: STYLE_MAP[style] ?? "conversational", speed });
  return { buffer: r.audioBuffer, durationMs: r.estimatedDurationMs || fallbackMs, usedClone: false };
}

export interface NarrateResult {
  narrations: Record<string, SlideNarration>;
  /** the presenter asked for a cloned voice */
  cloneRequested: boolean;
  /** at least one slide actually used the cloned voice (vs the preset fallback) */
  cloneUsed: boolean;
}

/** Narrate a whole deck: write scripts, synthesize each slide, return per-slide audio
 *  plus whether the cloned voice was actually reachable. */
export async function narrateDeck(opts: {
  slides: DeckSlide[];
  sessionId: string;
  voice: ClonedVoice | null;
  pace: number;
  style: string;
  presenterName?: string;
}): Promise<NarrateResult> {
  const scripts = await writeDeckScripts(opts.slides, opts.style, opts.presenterName);
  const out: Record<string, SlideNarration> = {};
  const cloneRequested = !!(opts.voice?.elevenLabsVoiceId || opts.voice?.openaiVoiceId);
  let cloneUsed = false;
  const LIMIT = 3;
  for (let i = 0; i < opts.slides.length; i += LIMIT) {
    await Promise.all(opts.slides.slice(i, i + LIMIT).map(async (s, j) => {
      const text = scripts[i + j];
      if (!text) return;
      try {
        const { buffer, durationMs, usedClone } = await synthesize(text, opts.voice, opts.pace, opts.style);
        if (usedClone) cloneUsed = true;
        const audioUrl = await uploadToS3(`training/${opts.sessionId}/narration/${s.id}.mp3`, buffer, "audio/mpeg");
        out[s.id] = { text, audioUrl, durationMs };
      } catch (e) { console.error(`[narration] slide ${s.id} synthesis failed:`, e instanceof Error ? e.message : e); }
    }));
  }
  return { narrations: out, cloneRequested, cloneUsed };
}
