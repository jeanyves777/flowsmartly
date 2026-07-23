/**
 * AI Presenter narration — turns a built deck into spoken narration the co-host plays
 * while delivering. For each slide the text AI writes a short, natural spoken script;
 * the script is then synthesized in the presenter's cloned voice (or a preset when no
 * clone is available) and stored in S3. This is the audio spine of the timeline runtime.
 * [[training-studio]]
 */
import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ai } from "@/lib/ai/client";
import { generateVoice } from "@/lib/voice/voice-engine";
import { generateWithClonedVoice } from "@/lib/voice/openai-voice-client";
import { generateWithClonedVoice as generateWithElevenLabs } from "@/lib/voice/elevenlabs-client";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { nanoid } from "nanoid";
import type { DeckSlide, SlideNarration } from "./types";

/** ~ms of real silence prepended to every slide's clip so each new slide opens with a natural
 *  settling beat (done at the audio level so it lands even when the TTS engine ignores text cues). */
const LEAD_SILENCE_MS = 550;

export interface ClonedVoice { openaiVoiceId?: string | null; elevenLabsVoiceId?: string | null }

/** What the presenter should say — one spoken script per slide, in one AI call. The
 *  narration LENGTH scales to the session duration so a 45-min room gets ~45 min of talking
 *  (not the old ~30-60 words/slide that left long sessions ending in 5 minutes). */
export async function writeDeckScripts(slides: DeckSlide[], style: string, presenterName?: string, minutes?: number): Promise<string[]> {
  const outline = slides.map((s, i) => {
    const labels = (s.board ?? []).filter((b) => b.t === "text" && !("note" in b && b.note)).map((b) => (b as { text: string }).text);
    const facts = [s.subtitle, ...(s.bullets ?? []), s.notes, labels.length ? `Diagram: ${labels.join(" → ")}` : ""].filter(Boolean).join(" | ");
    return `${i + 1}. "${s.title}"${facts ? ` — ${facts}` : ""}`;
  }).join("\n");

  // Content slides (not the fixed intro/quiz/Q&A scripts) share the speaking budget.
  const contentSlides = Math.max(1, slides.filter((s) => !s.intro && !s.quiz && !s.qa && !s.presenterMoment).length);
  const perSlideWords = Math.min(300, Math.max(55, Math.round(((minutes ?? 8) * 140) / contentSlides)));
  const sentenceHint = perSlideWords <= 70 ? "3-4 natural sentences" : perSlideWords <= 160 ? "5-8 natural sentences" : "a full, flowing paragraph of 8-12 sentences";

  const prompt = `You are a ${style} training presenter delivering a live ${minutes ? `${minutes}-minute ` : ""}session. For EACH slide below, write the spoken narration — about ${perSlideWords} words (${sentenceHint}) you'd actually say out loud. TEACH it with real depth: explain the idea, give a concrete example or the "why it matters", and connect to the slide's points — not a one-line summary. Speak TO the audience in the first person, warm and clear; connect slides so the session flows as one talk.

DELIVERY — write for the EAR, calm and composed, like an unhurried presenter who lets ideas land:
- Complete, moderate-length sentences (roughly 10–18 words), ONE idea per sentence. End every sentence with a period, "?" or "!". Do NOT run clauses together into long breathless sentences.
- Vary the rhythm: drop in a short, reflective sentence between longer ones so there's a beat between thoughts.
- Open the slide gently — a brief settling phrase or transition ("Now,", "So,", "Here's the thing,", "Let's look at this together.") before the meat, so it doesn't start abruptly.
- Punctuate for speech: commas for natural micro-pauses, periods for full stops. Let it breathe.
- No stage directions, no markdown, no slide numbers, no bracketed cues like [pause] — just the plain words to speak.

Slides:
${outline}

Return JSON: { "scripts": string[] } with EXACTLY ${slides.length} entries, in order.`;

  // Long narration for many slides needs a lot of output room or the JSON truncates.
  const maxTokens = Math.min(16000, 1500 + Math.round(contentSlides * perSlideWords * 1.7));
  const raw = (await ai.generateJSON<{ scripts?: string[] }>(prompt, { temperature: 0.6, maxTokens }))
    ?? (await ai.generateJSON<{ scripts?: string[] }>(prompt, { temperature: 0.35, maxTokens }));
  const scripts = raw?.scripts ?? [];
  // Always return one script per slide (fall back to a plain read of the title).
  const who = (presenterName || "").trim().split(/\s+/)[0] || "your A I co-host";
  return slides.map((s, i) => {
    // The opening slide is the AI co-host's disclosed self-introduction.
    if (s.intro) {
      return `Hi everyone, and welcome! I'm ${who}, your A I co-host for today's session — yes, I'm an A I, presenting right alongside your host. I'll walk us through the material, and you can raise your hand or use Ask the presenter any time. Let's get started.`;
    }
    // A between-slide presenter moment: a short warm bridge (used as the fallback line if no
    // Avatar IV video is generated for this moment).
    if (s.presenterMoment) {
      return `Great — let's take a quick breath and connect what we've covered so far. Alright, let's keep going.`;
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
    return (scripts[i] || [s.title, s.subtitle, ...(s.bullets ?? []), s.notes].filter(Boolean).join(". ")).trim().slice(0, 2600);
  });
}

/** The spoken ANSWER reveal for a quiz — deterministic (the data is already on the slide),
 *  so no AI call is needed. Played when the host resumes after the hand-raise pause. */
function quizRevealScript(q: { options: string[]; answerIndex: number; explanation?: string }): string {
  const letter = String.fromCharCode(65 + q.answerIndex);
  const opt = q.options[q.answerIndex] ?? "";
  const why = q.explanation ? ` ${q.explanation}` : "";
  return `The correct answer is ${letter} — ${opt}.${why} Great — let's keep going.`;
}

const STYLE_MAP: Record<string, "professional" | "conversational" | "energetic" | "warm"> = {
  professional: "professional", conversational: "conversational", energetic: "energetic", teacher: "warm",
};

/** Lay the script out one sentence per line so EVERY TTS engine takes a real breath between
 *  sentences (line breaks are never spoken, but they cue a pause). On the ElevenLabs cloned path
 *  we also drop an explicit short break tag, which it renders as a precise silence. This enforces
 *  the natural inter-sentence pacing without touching the speaking speed. */
function withNaturalPauses(text: string, breaks: boolean): string {
  const clean = text.replace(/\s+/g, " ").trim();
  // Split on sentence-ending punctuation that's followed by a new sentence (a capital/quote),
  // so decimals like "0.3" and "A.I." aren't torn apart.
  const sentences = clean.split(/(?<=[.!?])\s+(?=["'A-Z])/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length <= 1) return clean;
  return sentences.join(breaks ? ' <break time="0.4s" />\n' : "\n");
}

/** Prepend real silence to a clip via ffmpeg so each slide opens with a natural settling beat.
 *  Engine-agnostic; if ffmpeg isn't available it returns the clip unchanged (never blocks audio). */
async function prependSilence(buffer: Buffer, ms: number): Promise<Buffer> {
  const ffmpeg = findFFmpegPath();
  if (!ffmpeg || ms <= 0) return buffer;
  const dir = await mkdtemp(join(tmpdir(), "narr-"));
  const ain = join(dir, "a.mp3"), out = join(dir, "out.mp3");
  try {
    await writeFile(ain, buffer);
    await new Promise<void>((resolve, reject) => {
      const p = spawn(ffmpeg, ["-y", "-i", ain, "-af", `adelay=${ms}:all=1`, "-c:a", "libmp3lame", "-q:a", "4", out]);
      let e = ""; p.stderr.on("data", (d) => (e += d));
      p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${e.slice(-160)}`))));
    });
    return await readFile(out);
  } catch (e) {
    console.error("[narration] lead-silence failed, using raw clip:", e instanceof Error ? e.message : e);
    return buffer;
  } finally {
    for (const f of [ain, out]) await unlink(f).catch(() => {});
  }
}

/** Retry a TTS call through transient failures (ElevenLabs 429 / 5xx / network blips are common
 *  when a whole deck is narrated in rapid concurrent batches). TTS is idempotent, so retrying is
 *  safe; a few jittered exponential backoffs turn a momentary rate-limit into a short pause instead
 *  of a dropped-to-a-different-voice slide. [[voice-agent-elevenlabs-migration]] */
async function withVoiceRetry(fn: () => Promise<Buffer>, label: string, attempts = 4): Promise<Buffer> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        const wait = 700 * 2 ** i + Math.floor(Math.random() * 400);
        console.warn(`[narration] ${label} attempt ${i + 1}/${attempts} failed (${e instanceof Error ? e.message : e}); retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

/** Synthesize one script in the presenter's voice. When a specific voice is SELECTED it is locked
 *  in: the call is retried through transient errors and, if it still fails, the slide THROWS (so it
 *  is left un-narrated for a re-run) rather than silently switching to a different preset voice —
 *  a voice change mid-deck breaks the narrator's identity. The generic preset is used ONLY when no
 *  voice was selected at all (a consistent default for the whole deck). `usedClone` records the path. */
export async function synthesize(text: string, voice: ClonedVoice | null, pace: number, style: string): Promise<{ buffer: Buffer; durationMs: number; usedClone: boolean }> {
  const words = text.split(/\s+/).filter(Boolean).length;
  // Speed is untouched here on purpose — the natural feel comes from PAUSES, not from slowing
  // the voice. We keep the measured 0.95-of-raw baseline; the live room fine-tunes playback.
  const speed = Math.min(1.2, Math.max(0.7, (pace || 1) * 0.95));
  const fallbackMs = Math.max(1500, Math.round((words / 150) * 60 * 1000 / speed));
  // The presenter's cloned voice (ElevenLabs is true cloning; try it first). ElevenLabs renders
  // <break> tags, so it gets the break-tagged layout; other engines get the one-per-line layout.
  const elevenText = withNaturalPauses(text, true);
  const plainText = withNaturalPauses(text, false);
  // Prepend the settling silence and fold it into the reported duration (once, here).
  const finish = async (raw: Buffer, baseMs: number, usedClone: boolean) =>
    ({ buffer: await prependSilence(raw, LEAD_SILENCE_MS), durationMs: baseMs + LEAD_SILENCE_MS, usedClone });
  // A SELECTED voice is locked in — retried through transient errors, and if it still fails the
  // call THROWS (caller skips the slide) instead of falling back to a DIFFERENT voice. This is
  // what keeps the narrator's identity consistent across every slide and every re-generation.
  if (voice?.elevenLabsVoiceId) {
    const voiceId = voice.elevenLabsVoiceId;
    return await finish(await withVoiceRetry(() => generateWithElevenLabs({ text: elevenText, voiceId, speed }), "ElevenLabs"), fallbackMs, true);
  }
  if (voice?.openaiVoiceId) {
    const voiceId = voice.openaiVoiceId;
    return await finish(await withVoiceRetry(() => generateWithClonedVoice({ text: plainText, voiceId, speed }), "OpenAI"), fallbackMs, true);
  }
  // No voice selected → the generic preset, used consistently for the WHOLE deck.
  const r = await generateVoice({ text: plainText, gender: "male", accent: "american", style: STYLE_MAP[style] ?? "conversational", speed });
  return await finish(r.audioBuffer, r.estimatedDurationMs || fallbackMs, false);
}

export interface NarrateResult {
  narrations: Record<string, SlideNarration>;
  /** per-quiz-slide ANSWER-reveal narration, keyed by slide id (played on resume) */
  reveals: Record<string, SlideNarration>;
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
  minutes?: number;
}): Promise<NarrateResult> {
  const scripts = await writeDeckScripts(opts.slides, opts.style, opts.presenterName, opts.minutes);
  const out: Record<string, SlideNarration> = {};
  const reveals: Record<string, SlideNarration> = {};
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
        // A UNIQUE key per generation — the object is served with a 1-year immutable cache, so a
        // fixed key would make the browser replay the OLD audio after re-voicing (e.g. a voice
        // change). A fresh id guarantees the new voice is actually fetched. [[training-studio]]
        const audioUrl = await uploadToS3(`training/${opts.sessionId}/narration/${s.id}-${nanoid(6)}.mp3`, buffer, "audio/mpeg");
        out[s.id] = { text, audioUrl, durationMs };
        // A quiz slide gets a SECOND clip: the spoken answer reveal, played on resume so the
        // co-host says "The correct answer is …" instead of re-reading the question.
        if (s.quiz) {
          const revText = quizRevealScript(s.quiz);
          const rev = await synthesize(revText, opts.voice, opts.pace, opts.style);
          if (rev.usedClone) cloneUsed = true;
          const revUrl = await uploadToS3(`training/${opts.sessionId}/narration/${s.id}-reveal-${nanoid(6)}.mp3`, rev.buffer, "audio/mpeg");
          reveals[s.id] = { text: revText, audioUrl: revUrl, durationMs: rev.durationMs };
        }
      } catch (e) { console.error(`[narration] slide ${s.id} synthesis failed:`, e instanceof Error ? e.message : e); }
    }));
  }
  return { narrations: out, reveals, cloneRequested, cloneUsed };
}
