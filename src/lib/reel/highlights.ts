/**
 * highlights.ts — the PURE, deterministic heart of the Reel Studio pipeline.
 *
 * Given a transcript + settings it finds the moments most likely to travel and
 * scores each 0-99, then shapes them into 9:16 clip content (title, hook,
 * caption words, hashtags). NO imports — no DB, no network, no ffmpeg — so it
 * is unit-testable offline (see scripts/test-reel-build.ts) and safe to import
 * from client code. The DB layer (reel-editor.ts) builds on top of this.
 *
 * An LLM pass can later RE-RANK / rewrite titles, but this heuristic is the
 * testable baseline that must never regress.
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type ReelAspect = "9:16" | "1:1" | "16:9";
export type ReelClipLength = "auto" | "short" | "mid" | "long";
export type ReelCaptionStyle = "pop" | "hype" | "clean" | "brand";
export type ReelSourceType = "link" | "upload";
export type RenderStatus = "pending" | "rendering" | "ready" | "failed";

export interface ReelSettings {
  clipLength: ReelClipLength;
  aspect: ReelAspect;
  /** Number of clips to produce (1-12). */
  count: number;
  captionStyle: ReelCaptionStyle;
  speakerTracking: boolean;
  animatedCaptions: boolean;
  autoBroll: boolean;
}

export const DEFAULT_SETTINGS: ReelSettings = {
  clipLength: "short",
  aspect: "9:16",
  count: 6,
  captionStyle: "pop",
  speakerTracking: true,
  animatedCaptions: true,
  autoBroll: false,
};

/** A transcript segment (matches OpenAI whisper `verbose_json` segments). */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}
export interface Transcript {
  segments: TranscriptSegment[];
}

/** One word in a burned caption, with its offset (seconds) from the clip start. */
export interface CaptionWord {
  t: number;
  text: string;
  hi?: boolean; // highlighted (karaoke emphasis) word
}

export interface ReelClipContent {
  id: string;
  order: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  title: string;
  hook: string | null;
  score: number; // 0-99 virality score
  aspect: ReelAspect;
  caption: CaptionWord[];
  transcriptText: string | null;
  hashtags: string[];
  renderStatus: RenderStatus;
  renderUrl: string | null;
  thumbUrl: string | null;
}

// ── Channels that support reels / vertical short-form ─────────────────────────
export type ReelChannelId = "tiktok" | "instagram" | "youtube" | "facebook" | "linkedin" | "x";
export interface ReelChannel {
  id: ReelChannelId;
  name: string;
  /** what the vertical clip publishes AS on this network */
  format: string;
  /** true = native vertical short-form; false = supported as plain video */
  nativeReels: boolean;
}
export const REEL_CHANNELS: ReelChannel[] = [
  { id: "tiktok", name: "TikTok", format: "Video", nativeReels: true },
  { id: "instagram", name: "Instagram", format: "Reels", nativeReels: true },
  { id: "youtube", name: "YouTube", format: "Shorts", nativeReels: true },
  { id: "facebook", name: "Facebook", format: "Reels", nativeReels: true },
  { id: "linkedin", name: "LinkedIn", format: "Video", nativeReels: false },
  { id: "x", name: "X", format: "Video", nativeReels: false },
];
export function isReelChannel(id: string): id is ReelChannelId {
  return REEL_CHANNELS.some((c) => c.id === id);
}

// ── JSON helper (shared with the DB layer) ────────────────────────────────────
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── Settings normalisation ────────────────────────────────────────────────────
export function coerceSettings(raw: unknown): ReelSettings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const aspects: ReelAspect[] = ["9:16", "1:1", "16:9"];
  const lengths: ReelClipLength[] = ["auto", "short", "mid", "long"];
  const styles: ReelCaptionStyle[] = ["pop", "hype", "clean", "brand"];
  const num = typeof s.count === "number" ? s.count : Number(s.count);
  return {
    clipLength: lengths.includes(s.clipLength as ReelClipLength) ? (s.clipLength as ReelClipLength) : DEFAULT_SETTINGS.clipLength,
    aspect: aspects.includes(s.aspect as ReelAspect) ? (s.aspect as ReelAspect) : DEFAULT_SETTINGS.aspect,
    count: Number.isFinite(num) && num > 0 ? Math.min(12, Math.max(1, Math.round(num))) : DEFAULT_SETTINGS.count,
    captionStyle: styles.includes(s.captionStyle as ReelCaptionStyle) ? (s.captionStyle as ReelCaptionStyle) : DEFAULT_SETTINGS.captionStyle,
    speakerTracking: s.speakerTracking === undefined ? DEFAULT_SETTINGS.speakerTracking : Boolean(s.speakerTracking),
    animatedCaptions: s.animatedCaptions === undefined ? DEFAULT_SETTINGS.animatedCaptions : Boolean(s.animatedCaptions),
    autoBroll: Boolean(s.autoBroll),
  };
}

/** [minSeconds, maxSeconds] a clip may run for a given length preset. */
export function clipLengthBounds(len: ReelClipLength): [number, number] {
  switch (len) {
    case "short": return [12, 30];
    case "mid": return [30, 60];
    case "long": return [60, 90];
    default: return [15, 60]; // auto
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HIGHLIGHT SCORING
// ══════════════════════════════════════════════════════════════════════════════

const STOPWORDS = new Set([
  "the","a","an","and","or","but","so","to","of","in","on","for","with","is","are","was","were","be","been",
  "it","its","this","that","these","those","i","you","we","they","he","she","my","your","our","their","at","as",
  "if","then","than","just","really","um","uh","like","yeah","okay","ok","gonna","kind","sort","actually","here",
]);

/** Signal-based score for a candidate moment's text. Deterministic. 0-99. */
export function scoreMoment(text: string): number {
  const t = text.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 4) return 0;

  let score = 34; // baseline

  // Concrete numbers / money / percentages — the strongest "specific" signal.
  const nums = (t.match(/\$\s?\d|\b\d+\s?%|\b\d[\d,.]*\s?(k|m|x|million|thousand|dollars?|percent)\b|\b\d{2,}\b/g) || []).length;
  score += Math.min(18, nums * 9);

  // Curiosity / debate hooks.
  const hooks = /\b(secret|nobody|everyone|mistake|lie|truth|never|always|worst|best|reason|why|how|stop|don'?t|fired|zero|free|hack|proof|actually|wrong)\b/g;
  score += Math.min(22, (t.match(hooks) || []).length * 6);

  // Superlatives / #1.
  if (/\b(#1|number one|the best|the worst|the most|the only)\b/.test(t)) score += 7;

  // Question — opens a loop.
  if (text.includes("?")) score += 6;

  // First-person story energy.
  if (/\b(i|i'?m|i'?ve|my|we|our)\b/.test(t)) score += 5;

  // Completeness — ends on a sentence boundary (not mid-thought).
  if (/[.!?]\s*$/.test(text.trim())) score += 4;

  // Penalise filler-heavy openings.
  const filler = (t.match(/\b(um|uh|like|you know|kind of|sort of|i mean|anyway)\b/g) || []).length;
  score -= Math.min(14, filler * 4);

  return Math.max(0, Math.min(99, Math.round(score)));
}

/** First clean sentence of a block, trimmed to a title length. */
export function deriveTitle(text: string, max = 52): string {
  const first = (text.split(/(?<=[.!?])\s/)[0] || text).replace(/^[\s—-]+/, "").trim();
  const clean = first.replace(/\b(um|uh|so|yeah|okay|like)\b[,]?\s*/gi, "").trim();
  const base = clean || first;
  return base.length > max ? base.slice(0, max - 1).trimEnd() + "…" : base;
}

/** 2-3 hashtag-able keywords from a block. */
export function deriveHashtags(text: string): string[] {
  const freq = new Map<string, number>();
  for (const w of text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (w.length < 4 || STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => `#${w}`);
}

/** Distribute a block's words evenly across its duration → karaoke caption words. */
export function buildCaption(text: string, durationSec: number): CaptionWord[] {
  const words = text.split(/\s+/).filter(Boolean).slice(0, 60);
  if (words.length === 0) return [];
  const step = durationSec / words.length;
  const isSalient = (w: string) => /\$?\d|%|\b(never|always|zero|free|best|worst|secret|nobody)\b/i.test(w);
  return words.map((w, i) => ({ t: Math.round(i * step * 100) / 100, text: w, ...(isSalient(w) ? { hi: true } : {}) }));
}

export interface ScoredMoment {
  startSec: number;
  endSec: number;
  text: string;
  score: number;
}

/** Find non-overlapping high-scoring moments within the transcript. Pure. */
export function findHighlights(transcript: Transcript, settings: ReelSettings): ScoredMoment[] {
  const segs = (transcript.segments || []).filter((s) => s && s.end > s.start && s.text?.trim());
  if (segs.length === 0) return [];
  const [minLen, maxLen] = clipLengthBounds(settings.clipLength);

  // Build every contiguous window whose duration lands in [minLen, maxLen].
  const candidates: ScoredMoment[] = [];
  for (let i = 0; i < segs.length; i++) {
    let text = "";
    for (let j = i; j < segs.length; j++) {
      const dur = segs[j].end - segs[i].start;
      if (dur > maxLen) break;
      text += (text ? " " : "") + segs[j].text.trim();
      if (dur >= minLen) {
        candidates.push({ startSec: segs[i].start, endSec: segs[j].end, text, score: scoreMoment(text) });
      }
    }
    // A single long segment that already exceeds minLen (podcasts often have
    // long segments) — cap it at maxLen so it's still a usable clip.
    if (segs[i].end - segs[i].start >= minLen) {
      const end = Math.min(segs[i].end, segs[i].start + maxLen);
      candidates.push({ startSec: segs[i].start, endSec: end, text: segs[i].text.trim(), score: scoreMoment(segs[i].text) });
    }
  }

  // Greedy non-overlapping selection by score.
  candidates.sort((a, b) => b.score - a.score || a.startSec - b.startSec);
  const chosen: ScoredMoment[] = [];
  for (const c of candidates) {
    if (chosen.length >= settings.count) break;
    if (c.score <= 0) continue;
    const overlaps = chosen.some((x) => c.startSec < x.endSec && c.endSec > x.startSec);
    if (!overlaps) chosen.push(c);
  }
  chosen.sort((a, b) => b.score - a.score);
  return chosen;
}

/** The pure pipeline: transcript + settings → shaped clip content (unpersisted). */
export function buildReelClips(transcript: Transcript, settings: ReelSettings): ReelClipContent[] {
  const moments = findHighlights(transcript, settings);
  return moments.map((m, i) => {
    const durationSec = Math.round((m.endSec - m.startSec) * 100) / 100;
    return {
      id: `clip-${i}`,
      order: i,
      startSec: Math.round(m.startSec * 100) / 100,
      endSec: Math.round(m.endSec * 100) / 100,
      durationSec,
      title: deriveTitle(m.text),
      hook: deriveTitle(m.text, 90),
      score: m.score,
      aspect: settings.aspect,
      caption: buildCaption(m.text, durationSec),
      transcriptText: m.text,
      hashtags: deriveHashtags(m.text),
      renderStatus: "pending" as RenderStatus,
      renderUrl: null,
      thumbUrl: null,
    };
  });
}
