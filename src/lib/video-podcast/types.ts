/**
 * Video Podcast — types.
 *
 * Two speakers (host + guest), one conversation. We write the back-and-forth (or
 * take the user's own transcript), render each turn as a lip-synced talking clip
 * (HeyGen Avatar IV off a photo avatar), then cut between a composited 2-shot and
 * single-speaker close-ups into one podcast. Schema-free on the Design row
 * (`canvasData` JSON), same as the other studio playgrounds. [[clone-yourself-studio]]
 */

export type PodcastRole = "host" | "guest";
export type PodcastAspect = "16:9" | "1:1" | "9:16";
export type PodcastQuality = "standard" | "hd";
/** How we move between the wide 2-shot and single-speaker close-ups. */
export type CutStyle = "auto" | "two" | "close";
export type TurnStatus = "idle" | "queued" | "rendering" | "ready" | "failed";
export type PodcastStatus = "idle" | "drafting" | "ready" | "failed";

/** One speaker: which photo avatar wears the face, which voice speaks. */
export interface PodcastSpeaker {
  /** Display name (from the chosen avatar / clone). */
  name: string;
  /** HeyGen avatar id. For a custom PHOTO avatar this is a talking-photo id used
   *  with Avatar IV; for a stock avatar it's a normal avatar id. */
  avatarId: string | null;
  /** true = a custom photo avatar (Avatar IV lip-sync); false = a stock avatar. */
  isPhoto: boolean;
  /** A still portrait of this avatar — used for the listener seat in the 2-shot. */
  portraitUrl: string | null;
  /** Voice id (HeyGen / cloned), and a label for the UI. */
  voiceId: string | null;
  voiceLabel: string | null;
  /** A short sample of the voice, for the ▶ preview on the speaker card. */
  voicePreviewUrl?: string | null;
}

/** One line of the conversation → one rendered clip. */
export interface PodcastTurn {
  id: string;
  order: number;
  speaker: PodcastRole;
  text: string;
  status: TurnStatus;
  progress?: number;
  /** The speaker's lip-synced clip (close-up). */
  clipUrl?: string | null;
  clipMs?: number | null;
  error?: string | null;
  /** Provider job id, so a render orphaned by a deploy can be pulled, not lost. */
  refId?: string | null;
  renderHeartbeatAt?: number;
}

export interface PodcastProject {
  id: string;
  title: string;
  host: PodcastSpeaker;
  guest: PodcastSpeaker;
  /** The brief (topic / points / link / pasted document) the script is written from. */
  brief: string;
  /** true = the user pasted an exact Host:/Guest: transcript; false = AI writes it. */
  ownScript: boolean;
  /** Delivery tone the script is written in (e.g. "Conversational", "Debate"). */
  tone?: string;
  /** An episode-style preset ("interview" | "debate" | "expert") that shapes the write. */
  stylePreset?: string | null;
  turns: PodcastTurn[];
  durationMin: number;
  quality: PodcastQuality;
  aspect: PodcastAspect;
  cutStyle: CutStyle;
  /** Optional set/mood instructions ("warm studio, wooden desk, soft key light"). */
  scene: string;
  /** A generated podcast-set background image, reused across the 2-shots. */
  backdropUrl?: string | null;

  /** Background scripting (turns drafted from the brief) — the UI polls this. */
  draftStatus?: PodcastStatus | null;
  draftError?: string | null;
  /** Epoch ms the draft kicked; a stale "drafting" was orphaned and is safe to re-run. */
  draftStartedAt?: number;
  draftTries?: number;

  finalVideoUrl?: string | null;
  finalStatus?: TurnStatus;
  finalProgress?: number;
  /** Beaten during the stitch; a quiet beat means it died and is safe to resume. */
  finalHeartbeatAt?: number;
  finalTries?: number;

  createdAt?: string;
  updatedAt?: string;
}

export const PODCAST_ASPECTS: PodcastAspect[] = ["16:9", "1:1", "9:16"];

export function podcastDims(aspect: PodcastAspect): { w: number; h: number } {
  return aspect === "16:9" ? { w: 1280, h: 720 } : aspect === "1:1" ? { w: 1080, h: 1080 } : { w: 720, h: 1280 };
}
export function aspectToSize(a: PodcastAspect): string {
  const { w, h } = podcastDims(a);
  return `${w}x${h}`;
}

/** A natural read is ~2.4 words/sec; use it to size the script to the target length. */
export const WORDS_PER_SEC = 2.4;
export function wordBudget(durationMin: number): number {
  return Math.round(Math.max(1, durationMin) * 60 * WORDS_PER_SEC);
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptySpeaker(): PodcastSpeaker {
  return { name: "", avatarId: null, isPhoto: false, portraitUrl: null, voiceId: null, voiceLabel: null };
}

export function emptyPodcast(seed: { id: string } & Partial<PodcastProject>): PodcastProject {
  return {
    title: "Untitled podcast",
    host: emptySpeaker(),
    guest: emptySpeaker(),
    brief: "",
    ownScript: false,
    turns: [],
    durationMin: 1,
    quality: "standard",
    aspect: "16:9",
    cutStyle: "auto",
    scene: "",
    backdropUrl: null,
    draftStatus: null,
    draftError: null,
    finalVideoUrl: null,
    finalStatus: "idle",
    finalProgress: 0,
    ...seed,
  };
}

function normalizeSpeaker(raw: Partial<PodcastSpeaker> | undefined): PodcastSpeaker {
  const s = raw || {};
  return {
    name: String(s.name || "").slice(0, 120),
    avatarId: s.avatarId ?? null,
    isPhoto: !!s.isPhoto,
    portraitUrl: s.portraitUrl ?? null,
    voiceId: s.voiceId ?? null,
    voiceLabel: s.voiceLabel ? String(s.voiceLabel).slice(0, 120) : null,
    voicePreviewUrl: s.voicePreviewUrl ?? null,
  };
}

export function normalizeTurn(raw: Partial<PodcastTurn>, i: number): PodcastTurn {
  return {
    id: raw.id || rid("turn"),
    order: typeof raw.order === "number" ? raw.order : i,
    speaker: raw.speaker === "guest" ? "guest" : "host",
    text: String(raw.text || "").slice(0, 1200),
    status: (["idle", "queued", "rendering", "ready", "failed"] as const).includes(raw.status as TurnStatus) ? (raw.status as TurnStatus) : "idle",
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    clipUrl: raw.clipUrl ?? null,
    clipMs: raw.clipMs ?? null,
    error: raw.error ?? null,
    refId: raw.refId ?? null,
    renderHeartbeatAt: raw.renderHeartbeatAt,
  };
}

export function normalizePodcast(raw: Partial<PodcastProject> & { id: string }): PodcastProject {
  const base = emptyPodcast({ id: raw.id });
  const turns = Array.isArray(raw.turns) ? raw.turns.filter(Boolean).map((t, i) => normalizeTurn(t, i)) : [];
  return {
    ...base,
    ...raw,
    title: String(raw.title || base.title).slice(0, 160),
    host: normalizeSpeaker(raw.host),
    guest: normalizeSpeaker(raw.guest),
    brief: String(raw.brief || "").slice(0, 8000),
    ownScript: !!raw.ownScript,
    tone: raw.tone ? String(raw.tone).slice(0, 60) : "Conversational",
    stylePreset: (["interview", "debate", "expert"] as string[]).includes(String(raw.stylePreset)) ? String(raw.stylePreset) : null,
    turns: turns.sort((a, b) => a.order - b.order).map((t, i) => ({ ...t, order: i })),
    durationMin: Math.max(1, Math.min(10, raw.durationMin || 1)),
    quality: raw.quality === "hd" ? "hd" : "standard",
    aspect: PODCAST_ASPECTS.includes(raw.aspect as PodcastAspect) ? (raw.aspect as PodcastAspect) : base.aspect,
    cutStyle: (["auto", "two", "close"] as const).includes(raw.cutStyle as CutStyle) ? (raw.cutStyle as CutStyle) : "auto",
    scene: String(raw.scene || "").slice(0, 600),
    draftStatus: (["drafting", "ready", "failed"] as PodcastStatus[]).includes(raw.draftStatus as PodcastStatus) ? raw.draftStatus as PodcastStatus : null,
  };
}

/**
 * Parse an own-transcript into turns. Lines are labelled `Host:` / `Guest:`
 * (case-insensitive, also "H:" / "G:" and the speakers' names); an unlabelled line
 * continues the previous speaker. Alternates from the host when nothing is labelled.
 */
export function parseTranscript(text: string, hostName: string, guestName: string): { speaker: PodcastRole; text: string }[] {
  const out: { speaker: PodcastRole; text: string }[] = [];
  const hn = (hostName || "host").trim().toLowerCase();
  const gn = (guestName || "guest").trim().toLowerCase();
  let last: PodcastRole = "host";
  let sawLabel = false;
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^([^:]{1,40}):\s*(.*)$/);
    if (m) {
      const label = m[1].trim().toLowerCase();
      let role: PodcastRole | null = null;
      if (label === "host" || label === "h" || (hn && label === hn)) role = "host";
      else if (label === "guest" || label === "g" || (gn && label === gn)) role = "guest";
      if (role) {
        sawLabel = true;
        last = role;
        if (m[2].trim()) out.push({ speaker: role, text: m[2].trim() });
        continue;
      }
    }
    // Unlabelled — continue the current speaker (or start on the host).
    if (out.length && sawLabel) out[out.length - 1].text += " " + line;
    else { out.push({ speaker: last, text: line }); last = last === "host" ? "guest" : "host"; }
  }
  return out.map((t) => ({ ...t, text: t.text.trim() })).filter((t) => t.text);
}
