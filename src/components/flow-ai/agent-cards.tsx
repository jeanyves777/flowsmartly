"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import Image from "next/image";
import { Download, Maximize2, X, ExternalLink, Copy, Check, Volume2, Square, ThumbsUp, ThumbsDown, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { LogoGlowLoader, DotGrid } from "@/components/shared/logo-glow-loader";
import { createSpeechPlayer, type SpeechPlayer } from "./use-tts";
import { RichText } from "./rich-text";
import { useAgentNav } from "./agent-nav-context";
import { AgentView } from "@/components/agent-views/agent-view";
import type { ViewSpec, ViewEvent } from "@/lib/agent-views/spec";

/**
 * Small "Copy" button shown under an assistant text reply so the user can
 * grab the response (a verse, caption, draft, etc.) and paste it elsewhere.
 * Copies the RAW markdown/text the assistant produced. Shared by the full
 * page + the floating widget.
 */
export function CopyTextButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts / older browsers.
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — leave the icon unchanged.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy reply"}
      title={copied ? "Copied" : "Copy"}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> Copy
        </>
      )}
    </button>
  );
}

/**
 * "Play" button shown next to Copy — speaks the assistant reply aloud using
 * the self-hosted Supertonic TTS proxy (/api/flow-ai/tts). Toggles play/stop,
 * shows a spinner while synthesizing, and quietly hides itself if the voice
 * service is unavailable (so it never clutters the UI when TTS is down).
 * Shared by the full page + the floating widget.
 */
export function SpeakButton({ text, className }: { text: string; className?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const playerRef = useRef<SpeechPlayer | null>(null);

  useEffect(
    () => () => {
      playerRef.current?.stop();
      playerRef.current = null;
    },
    [],
  );

  const handleClick = async () => {
    if (state === "playing" || state === "loading") {
      playerRef.current?.stop();
      playerRef.current = null;
      setState("idle");
      return;
    }
    setState("loading");
    const player = createSpeechPlayer();
    playerRef.current = player;
    try {
      // Streams chunk-by-chunk: flips to "playing" the moment the first
      // sentence starts (~1.5s) instead of waiting for the whole reply.
      const { playedAny } = await player.play(text, () => setState("playing"));
      if (playerRef.current !== player) return; // a newer click superseded us
      if (!playedAny) {
        setState("error");
        setTimeout(() => setState((s) => (s === "error" ? "idle" : s)), 2500);
      } else {
        setState("idle");
      }
    } catch {
      setState("error");
      setTimeout(() => setState((s) => (s === "error" ? "idle" : s)), 2500);
    } finally {
      if (playerRef.current === player) playerRef.current = null;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={state === "playing" ? "Stop" : "Play reply aloud"}
      title={state === "error" ? "Voice unavailable" : state === "playing" ? "Stop" : "Play aloud"}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors",
        state === "error" && "text-amber-500",
        className,
      )}
    >
      {state === "loading" ? (
        <>
          <AISpinner size={14} /> …
        </>
      ) : state === "playing" ? (
        <>
          <Square className="h-3.5 w-3.5 fill-current" /> Stop
        </>
      ) : state === "error" ? (
        <>
          <Volume2 className="h-3.5 w-3.5" /> Unavailable
        </>
      ) : (
        <>
          <Volume2 className="h-3.5 w-3.5" /> Play
        </>
      )}
    </button>
  );
}

/**
 * Thumbs up / down on a Flow-AI reply — shown next to Copy/Play. Reports a
 * good/bad response to /api/flow-ai/feedback with a snapshot for review.
 * Optimistic; re-clicking updates the rating (the endpoint upserts per message).
 */
export function FeedbackButtons({
  messageId,
  conversationId,
  content,
  className,
}: {
  messageId?: string;
  conversationId?: string | null;
  content: string;
  className?: string;
}) {
  const [sent, setSent] = useState<null | "POSITIVE" | "NEGATIVE">(null);
  const [busy, setBusy] = useState(false);
  if (!messageId) return null;

  const submit = async (sentiment: "POSITIVE" | "NEGATIVE") => {
    if (busy) return;
    const prev = sent;
    setSent(sentiment); // optimistic
    setBusy(true);
    try {
      const res = await fetch("/api/flow-ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentiment,
          messageId,
          conversationId: conversationId ?? undefined,
          snapshot: { messageContent: (content || "").slice(0, 8000), ratedAt: new Date().toISOString() },
        }),
      });
      if (!res.ok) setSent(prev); // revert on failure
    } catch {
      setSent(prev);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => submit("POSITIVE")}
        disabled={busy}
        aria-label="Good response"
        title="Good response"
        className={cn(
          "inline-flex items-center transition-colors",
          sent === "POSITIVE" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ThumbsUp className={cn("h-3.5 w-3.5", sent === "POSITIVE" && "fill-current")} />
      </button>
      <button
        type="button"
        onClick={() => submit("NEGATIVE")}
        disabled={busy}
        aria-label="Bad response"
        title="Bad response"
        className={cn(
          "inline-flex items-center transition-colors",
          sent === "NEGATIVE" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ThumbsDown className={cn("h-3.5 w-3.5", sent === "NEGATIVE" && "fill-current")} />
      </button>
    </span>
  );
}

/**
 * Full-screen image lightbox. Shared by TaskCard + MediaCard so any
 * generated image is clickable to view large. Clicking the backdrop or
 * the X closes it. Download stays available on the card itself.
 */

/**
 * Build a same-origin download URL for a generated asset. A cross-origin
 * `<a download>` to S3 just opens the file in a new tab (browsers ignore the
 * download attribute cross-origin); this routes through our proxy which
 * streams it back with Content-Disposition: attachment so it actually saves.
 */
export function mediaDownloadHref(url: string, name = "flowsmartly-design"): string {
  return `/api/flow-ai/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
}

export function MediaLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Full size"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
      />
      <a
        href={mediaDownloadHref(url)}
        download
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
      >
        <Download className="h-4 w-4" /> Download
      </a>
    </div>
  );
}

/**
 * Shared Flow-AI agent UI bits — tool-call chips, plan-proposal cards,
 * task cards. Imported by both the full-screen `FlowAIShell` and the
 * floating `FlowAIWidget` so the two surfaces stay visually + behaviorally
 * identical as we evolve the agent.
 *
 * Pure presentational — no SSE handling lives here. Callers feed in the
 * already-parsed data and wire the `onPlanResponse` callback to their
 * `/api/flow-ai/agent/confirm` POST.
 */

export interface AgentToolCardData {
  id: string;
  name: string;
  status: "running" | "ok" | "error";
  errorCode?: string;
  creditCost?: number;
  durationMs?: number;
  output?: unknown;
}

export interface PlanStepData {
  id?: string;
  title: string;
  detail?: string;
  toolName?: string;
  creditCost?: number;
}

export interface PlanProposalCardData {
  id: string;
  summary: string;
  steps: PlanStepData[];
  totalCreditCost: number;
  status: "pending" | "confirmed" | "rejected" | "expired";
}

export interface AgentTaskCardData {
  id: string;
  kind: string;
  status: "pending" | "running" | "completed" | "failed" | "canceled";
  summary?: string;
  progress?: number;
  progressMessage?: string;
  output?: { url?: string; tier?: string; [key: string]: unknown } | null;
  error?: string | null;
  resultRefType?: string | null;
  resultRefId?: string | null;
}

/**
 * One ordered piece of an assistant turn. The turn is a SEQUENCE of these so
 * the chat renders chronologically — text, then a tool chip, then more text,
 * then a proposal card — exactly as it happened, and survives a reload.
 * `tool`/`proposal`/`task` reference a card by id (looked up from the message's
 * card arrays); `text` carries its own segment.
 */
export interface TemplateOption {
  id: string;
  name: string;
  industry?: string | null;
  thumbnailUrl?: string | null;
}

export interface QuestionOption {
  label: string;
  sublabel?: string | null;
}

export type MessageBlock =
  | { type: "text"; text: string }
  | { type: "tool"; id: string }
  | { type: "proposal"; id: string }
  | { type: "task"; id: string }
  | { type: "templates"; requestId: string; templates: TemplateOption[] }
  | { type: "question"; requestId: string; question: string; options: QuestionOption[]; allowOther?: boolean }
  | { type: "view"; requestId: string; spec: ViewSpec };

// ─── Tool-call chip ────────────────────────────────────────────────────

export function ToolCallChip({ call }: { call: AgentToolCardData }) {
  const label = humanizeToolName(call.name);
  const tone =
    call.status === "running"
      ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300"
      : call.status === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border",
        tone,
      )}
      title={call.errorCode ? `Error: ${call.errorCode}` : undefined}
    >
      {call.status === "running" ? (
        <AISpinner size={10} />
      ) : call.status === "ok" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      )}
      {label}
      {typeof call.creditCost === "number" && call.creditCost > 0 && (
        <span className="opacity-70">· {call.creditCost}cr</span>
      )}
    </span>
  );
}

function humanizeToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Friendly, user-facing verbs so the activity strip reads like what the agent is
// DOING — not the raw tool name / backend logic.
const ACTIVITY_VERB: Record<string, string> = {
  web_search: "Searching the web",
  web_fetch: "Reading a page",
  find_local_leads: "Finding local businesses",
  find_leads: "Saving leads",
  list_leads: "Reading your leads",
  list_opportunities: "Reading your pipeline",
  list_pitches: "Reading your pitches",
  list_content_campaigns: "Reading your campaigns",
  list_orders: "Reading your orders",
  list_products: "Reading your products",
  list_designs: "Reading your designs",
  list_media: "Reading your library",
  list_avatar_videos: "Reading your avatar videos",
  list_ad_campaigns: "Reading your ads",
  list_voiceovers: "Reading your voiceovers",
  get_activities: "Reading the timeline",
  list_sequences: "Reading your sequences",
  list_companies: "Reading your companies",
  list_customers: "Reading your customers",
  list_reviews: "Reading your reviews",
  get_analytics: "Checking your numbers",
  enrich_lead: "Enriching contacts",
  deep_enrich_lead: "Getting deeper details",
  build_sequence_step: "Writing",
  create_branded_design: "Designing",
  generate_image: "Creating an image",
  edit_image: "Editing the image",
  generate_video: "Making a video",
  create_proposal: "Building a proposal",
  create_pitch: "Writing a pitch",
  schedule_social_post: "Scheduling",
  send_email_campaign: "Sending",
  who_am_i: "Checking your account",
  list_my_features: "Checking costs",
  get_brand_identity: "Reading your Brand Kit",
};
function activityVerb(name: string): string {
  const key = name.replace(/_2025\d.*$/, ""); // strip Anthropic server-tool version suffix
  return ACTIVITY_VERB[key] || ACTIVITY_VERB[name] || humanizeToolName(name);
}

/**
 * A single faded, collapsible line that stands in for the agent's raw tool
 * chips — so the chat shows a calm "working…" process, not the backend logic.
 * While a step runs it pulses the current action ("Enriching contacts…"); when
 * done it collapses to a muted "N steps" the user can expand for the detail.
 * Approvals (plan cards) and questions are separate block types and still show.
 */
export function AgentActivity({ calls }: { calls: AgentToolCardData[] }) {
  const [open, setOpen] = useState(false);
  if (!calls.length) return null;
  const running = calls.some((c) => c.status === "running");
  const failed = calls.some((c) => c.status !== "running" && c.status !== "ok");
  const lastRunning = [...calls].reverse().find((c) => c.status === "running");
  const label = running
    ? `${activityVerb(lastRunning?.name || calls[calls.length - 1].name)}…`
    : `${calls.length} step${calls.length > 1 ? "s" : ""}${failed ? " · some failed" : ""}`;
  return (
    <div className="w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
          running
            ? "border-border/50 bg-muted/25 text-muted-foreground"
            : "border-border/40 bg-transparent text-muted-foreground/60 hover:text-muted-foreground",
        )}
        title={open ? "Hide steps" : "Show steps"}
      >
        {running ? <AISpinner size={11} /> : <Sparkles className="h-3 w-3 opacity-60" />}
        <span className={cn(running && "animate-pulse")}>{label}</span>
        <ChevronDown className={cn("h-3 w-3 opacity-50 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {calls.map((c) => <ToolCallChip key={c.id} call={c} />)}
        </div>
      )}
    </div>
  );
}

// ─── Plan proposal card — Confirm / Cancel ────────────────────────────

export function PlanProposalCard({
  proposal,
  onResponse,
}: {
  proposal: PlanProposalCardData;
  onResponse?: (planId: string, confirmed: boolean) => void;
}) {
  // Local guard against double-submission. Once the user clicks, the
  // buttons disable IMMEDIATELY and show a processing state — even if the
  // parent re-renders the card with status still "pending" (which happens
  // because the agent's SSE stream rebuilds messages mid-flight). This is
  // the safeguard against firing the same paid action multiple times.
  const [submitted, setSubmitted] = useState<null | "confirm" | "cancel">(null);

  // The card is interactive only when the server says pending AND we
  // haven't already clicked locally.
  const serverPending = proposal.status === "pending";
  const showButtons = serverPending && submitted === null && !!onResponse;
  const processing = serverPending && submitted !== null;

  const handle = (confirmed: boolean) => {
    if (submitted !== null || !serverPending) return; // hard double-click guard
    setSubmitted(confirmed ? "confirm" : "cancel");
    onResponse?.(proposal.id, confirmed);
  };

  const statusLabel = processing
    ? submitted === "confirm"
      ? "Confirming…"
      : "Canceling…"
    : proposal.status === "confirmed"
      ? "Confirmed"
      : proposal.status === "rejected"
        ? "Canceled"
        : proposal.status === "expired"
          ? "Expired"
          : "Waiting for you";
  const statusTone =
    proposal.status === "confirmed"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : proposal.status === "rejected"
        ? "bg-muted text-muted-foreground"
        : proposal.status === "expired"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Confirm action</span>
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full", statusTone)}>
          {processing && <AISpinner size={9} />}
          {statusLabel}
        </span>
      </div>
      <div className="px-3.5 py-3 space-y-2.5">
        <p className="text-sm text-foreground leading-snug">{proposal.summary}</p>
        {proposal.steps.length > 0 && (
          <ol className="text-xs text-muted-foreground space-y-1 pl-4 list-decimal">
            {proposal.steps.map((s, i) => (
              <li key={s.id ?? i}>
                <span className="text-foreground">{s.title}</span>
                {s.detail && <span className="block opacity-70 mt-0.5">{s.detail}</span>}
              </li>
            ))}
          </ol>
        )}
        {proposal.totalCreditCost > 0 && (
          <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
            Estimated cost: <span className="font-semibold text-foreground">{proposal.totalCreditCost} credits</span>
          </div>
        )}
      </div>
      {(showButtons || processing) && (
        <div className="px-3.5 py-2.5 bg-muted/40 flex items-center gap-2 border-t border-border">
          <button
            type="button"
            onClick={() => handle(false)}
            disabled={!showButtons}
            className="px-3 h-8 rounded-md text-xs font-medium border border-border bg-white dark:bg-gray-800 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handle(true)}
            disabled={!showButtons}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 h-8 rounded-md text-xs font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-sm shadow-blue-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitted === "confirm" ? (
              <>
                <AISpinner size={12} />
                Working on it…
              </>
            ) : (
              "Confirm — proceed"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Task card — background job status with inline media when done ────

/**
 * "Open" deep-link for a produced result. Inside agent-home it switches the
 * focused surface IN PLACE via the AgentNav context (no full-page reload); when
 * no handler is present (widget/shell) it behaves as a normal link.
 */
function OpenLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const nav = useAgentNav();
  return (
    <a
      href={href}
      onClick={(e) => {
        // Only intercept plain left-clicks (let ⌘/ctrl-click open a new tab).
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (nav && nav(href)) e.preventDefault();
      }}
      className={className}
    >
      {children}
    </a>
  );
}

// Real pipeline stages of the story-ad / film build, keyed to the progress %
// the worker reports. Lets the running card show honest stage-by-stage progress
// (the pipeline streams a % + a step message, NOT per-scene thumbnails).
const FILM_STAGES: { label: string; at: number }[] = [
  { label: "Screenplay", at: 5 },
  { label: "Characters & turnaround", at: 22 },
  { label: "Rendering scenes", at: 40 },
  { label: "Voiceover & music", at: 78 },
  { label: "Final cut", at: 92 },
];

function FilmProgress({ progress, message }: { progress?: number; message?: string }) {
  const p = Math.max(3, Math.min(99, typeof progress === "number" ? progress : 5));
  let activeIdx = 0;
  for (let i = 0; i < FILM_STAGES.length; i++) if (p >= FILM_STAGES[i].at) activeIdx = i;
  const step = message?.trim() || "Directing your film…";
  return (
    <div className="flex flex-col gap-3 px-3.5 py-3">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold">
        <AISpinner size={14} />
        <span className="truncate">{step}</span>
        <span className="ms-auto font-mono text-[11px] text-muted-foreground">{Math.round(p)}%</span>
      </div>
      <div className="flex flex-col gap-2">
        {FILM_STAGES.map((s, i) => {
          const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
          return (
            <div key={s.label} className={cn("flex items-center gap-2 text-[12px]", state === "pending" ? "text-muted-foreground" : "text-foreground")}>
              <span className={cn(
                "grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px]",
                state === "done" ? "border-emerald-500 bg-emerald-500/15 text-emerald-500"
                  : state === "active" ? "border-brand-500 text-brand-500 animate-pulse"
                  : "border-border text-muted-foreground",
              )}>
                {state === "done" ? "✓" : state === "active" ? "◜" : ""}
              </span>
              <span>{s.label}</span>
              {state === "done" && <span className="ms-auto font-mono text-[10px] text-muted-foreground">done</span>}
            </div>
          );
        })}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

export function TaskCard({ task }: { task: AgentTaskCardData }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const kindLabel = humanizeTaskKind(task.kind);
  const isRunning = task.status === "running" || task.status === "pending";
  // Film builds get a rich stage-by-stage running card instead of the plain loader.
  const isFilm = task.kind === "start_story_ad_campaign" || task.kind === "direct_film";
  const isDone = task.status === "completed";
  const isFailed = task.status === "failed" || task.status === "canceled";
  // Accept absolute OR app-relative media (dev S3 falls back to /uploads/…, so a
  // strict https-only check would hide the preview and show only an Open link).
  const mediaUrl =
    typeof task.output?.url === "string" && /^(https?:\/\/|\/)/.test(task.output.url.trim())
      ? task.output.url.trim()
      : null;
  const isVideo = mediaUrl ? /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl) : false;
  const isAudio = mediaUrl ? /\.(mp3|wav|m4a|ogg)(\?|$)/i.test(mediaUrl) : false;
  // In-app deep link to the produced result (proposal, pitch, website,
  // store, etc.) — tools put it on output.link. Lets the user open it. Rewrite
  // any legacy pitch-board links (incl. in OLD saved conversations) to the new
  // Pitch Studio surface — never send the user to the legacy dashboard.
  const rawLink = typeof task.output?.link === "string" && task.output.link.startsWith("/") ? task.output.link : null;
  const resultLink = rawLink
    ? rawLink.replace(/^\/pitch-board(?:\/[^?]*)?\?pitch=([^&]+).*$/, "/home/pitchstudio?pitch=$1")
    : null;
  // A canvas object/background is INSERTED into the open design — show a preview
  // and an "added" note, never an "Open" link (which would navigate away).
  const isCanvasObject = task.kind === "canvas_object";
  const objectUrl = typeof task.output?.url === "string" && task.output.url ? task.output.url : null;
  const objectIsBg = (task.output as { objectType?: string } | null | undefined)?.objectType === "background";

  return (
    <div className={cn(
      "w-full max-w-md rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden transition-shadow",
      isRunning
        ? "border-brand-500/40 shadow-[0_0_0_1px_rgba(109,92,255,0.25),0_10px_34px_-8px_rgba(109,92,255,0.4)]"
        : "border-border shadow-sm",
    )}>
      <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isRunning ? (
            <AISpinner size={14} />
          ) : isDone ? (
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          )}
          <span className="text-xs font-semibold text-foreground truncate">{kindLabel}</span>
        </div>
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full",
            isRunning
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              : isDone
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
          )}
        >
          {task.status}
        </span>
      </div>
      {isRunning && (isFilm ? (
        <FilmProgress progress={task.progress} message={task.progressMessage} />
      ) : (
        <div className="relative grid place-items-center overflow-hidden py-11 text-muted-foreground/20">
          <DotGrid />
          <LogoGlowLoader size={72} />
        </div>
      ))}
      {isDone && isCanvasObject && objectUrl && (
        <div className="bg-muted/30">
          <div className="grid place-items-center bg-[repeating-conic-gradient(#80808022_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={objectUrl} alt={objectIsBg ? "Generated background" : "Generated element"} className="max-h-44 w-auto rounded-lg object-contain" />
          </div>
          <div className="flex items-center gap-1.5 border-t border-border px-3.5 py-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" /> {objectIsBg ? "Added as your canvas background" : "Added to your canvas — drag, resize & restyle it"}
          </div>
        </div>
      )}
      {isDone && mediaUrl && !isCanvasObject && (
        <div className="bg-muted/30">
          {isVideo ? (
            <video src={mediaUrl} controls className="block w-full max-h-72 bg-black object-contain" />
          ) : isAudio ? (
            <div className="px-3.5 py-3">
              <audio src={mediaUrl} controls preload="metadata" className="w-full" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLightbox(mediaUrl)}
              className="block w-full group relative"
              title="Click to view full size"
            >
              <Image
                src={mediaUrl}
                alt={kindLabel}
                width={512}
                height={512}
                unoptimized
                className="block w-full max-h-72 object-contain bg-muted/40"
              />
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="h-3 w-3" /> View
              </span>
            </button>
          )}
          <div className="px-3.5 py-2 flex items-center justify-between gap-2">
            <a
              href={mediaDownloadHref(mediaUrl, `flowsmartly-${task.kind || "design"}`)}
              download
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-3 w-3" />
              Download
            </a>
            <div className="flex items-center gap-2">
              {typeof task.output?.tier === "string" && (
                <span className="text-[10px] text-muted-foreground capitalize">{task.output.tier} tier</span>
              )}
              {resultLink && (
                <OpenLink
                  href={resultLink}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-sm shadow-blue-500/20 transition-colors"
                >
                  Open in studio <ExternalLink className="h-3.5 w-3.5" />
                </OpenLink>
              )}
            </div>
          </div>
        </div>
      )}
      {isDone && !mediaUrl && !(isCanvasObject && objectUrl) && (
        <div className="px-3.5 py-3 flex items-center justify-between gap-2">
          {resultLink ? (
            <>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
              <OpenLink
                href={resultLink}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-sm shadow-blue-500/20 transition-colors"
              >
                Open <ExternalLink className="h-3.5 w-3.5" />
              </OpenLink>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Done.</span>
          )}
        </div>
      )}
      {isFailed && (
        <div className="px-3.5 py-3 text-xs text-rose-600 dark:text-rose-400">
          {task.error ?? "Task failed."}
        </div>
      )}
      {lightbox && <MediaLightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function humanizeTaskKind(kind: string): string {
  const map: Record<string, string> = {
    generate_image: "AI image",
    generate_video: "AI video",
    schedule_post: "Scheduled post",
    import_contacts_csv: "Contact import",
    create_email_campaign: "Email campaign",
    start_story_ad_campaign: "Story ad movie",
    direct_film: "Film",
    create_automation: "Marketing automation",
    create_proposal: "Service proposal",
    create_pitch: "Outreach pitch",
    generate_narration: "Narrated audio",
    build_website: "Website build",
    build_store: "Store build",
  };
  return map[kind] ?? kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Ordered turn renderer — text + chips + cards, chronologically ───────

/**
 * Renders an assistant turn as its ORDERED sequence of blocks, looking each
 * tool/proposal/task up by id from the message's card arrays. Consecutive
 * tool chips group into one wrap row. This is what makes the flow read
 * chronologically (text → chip → text → card) instead of "all text, then all
 * cards", and it reconstructs faithfully on reload. Falls back to nothing if
 * `blocks` is empty — callers render the legacy layout in that case.
 */
/**
 * TemplateOptionsCard — clickable design-template thumbnails the agent offers
 * BEFORE generating a branded design. The user clicks one (or "No template")
 * and the choice is sent as the next chat message so the agent proceeds.
 */
export function TemplateOptionsCard({
  templates,
  onPick,
}: {
  templates: TemplateOption[];
  onPick?: (choice: { id: string; name: string } | null) => void;
}) {
  const [chosen, setChosen] = useState<string | "none" | null>(null);
  const [preview, setPreview] = useState<string | null>(null); // lightbox URL
  const pick = (t: TemplateOption | null) => {
    if (chosen) return; // one choice per card
    setChosen(t ? t.id : "none");
    onPick?.(t ? { id: t.id, name: t.name } : null);
  };
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-white dark:bg-gray-900 p-3 shadow-sm">
      <div className="text-xs font-semibold text-foreground mb-0.5">Pick a look — or design from your idea</div>
      <div className="text-[10px] text-muted-foreground mb-2">Tap a thumbnail to preview, then Select.</div>
      <div className="grid grid-cols-2 gap-2.5">
        {templates.map((t) => {
          const isChosen = chosen === t.id;
          const dimmed = chosen && !isChosen;
          return (
            <div
              key={t.id}
              className={cn(
                "overflow-hidden rounded-lg border transition-all",
                isChosen ? "border-sky-500 ring-2 ring-sky-400" : "border-border",
                dimmed && "opacity-50",
              )}
            >
              {/* Tap thumbnail → preview (does NOT select) */}
              <button
                type="button"
                onClick={() => t.thumbnailUrl && setPreview(t.thumbnailUrl)}
                className="group relative block w-full"
                aria-label={`Preview ${t.name}`}
              >
                <div className="aspect-[3/4] w-full bg-muted overflow-hidden">
                  {t.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.thumbnailUrl} alt={t.name} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">{t.name}</div>
                  )}
                </div>
                {t.thumbnailUrl ? (
                  <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <Maximize2 className="h-2.5 w-2.5" /> Preview
                  </span>
                ) : null}
              </button>
              <div className="px-1.5 pt-1">
                <div className="truncate text-[11px] font-medium text-foreground">{t.name}</div>
                {t.industry ? <div className="truncate text-[10px] text-muted-foreground">{t.industry}</div> : null}
              </div>
              <button
                type="button"
                onClick={() => pick(t)}
                disabled={!!chosen}
                className={cn(
                  "mt-1 mb-1.5 mx-1.5 w-[calc(100%-0.75rem)] rounded-md px-2 py-1 text-[11px] font-semibold transition-colors inline-flex items-center justify-center gap-1",
                  isChosen
                    ? "bg-sky-500 text-white"
                    : "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/50",
                )}
              >
                {isChosen ? (<><Check className="h-3 w-3" /> Selected</>) : "Select"}
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => pick(null)}
        disabled={!!chosen}
        className={cn(
          "mt-2.5 w-full rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-sky-300 hover:text-foreground",
          chosen === "none" && "border-sky-500 text-foreground ring-2 ring-sky-400",
          chosen && chosen !== "none" && "opacity-50",
        )}
      >
        No template — design from my prompt only
      </button>
      {preview ? <MediaLightbox url={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

/**
 * QuestionOptionsCard — the agent's clarifying question rendered as tappable
 * choices (numbered, with optional sublabels) + Skip, instead of plain text the
 * user must type. Tapping an option sends it as the user's next message.
 */
export function QuestionOptionsCard({
  question,
  options,
  allowOther,
  onPick,
}: {
  question: string;
  options: QuestionOption[];
  allowOther?: boolean;
  onPick?: (text: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const pick = (text: string) => {
    if (chosen) return;
    setChosen(text);
    onPick?.(text);
  };
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="px-4 py-3 text-sm font-semibold text-foreground border-b border-border">{question}</div>
      <div className="divide-y divide-border">
        {options.map((o, i) => {
          const isChosen = chosen === o.label;
          const dimmed = chosen && !isChosen;
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(o.label)}
              disabled={!!chosen}
              className={cn(
                "group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                isChosen ? "bg-sky-50 dark:bg-sky-950/40" : "hover:bg-muted/60",
                dimmed && "opacity-50",
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{o.label}</span>
                {o.sublabel ? <span className="block text-xs text-muted-foreground">{o.sublabel}</span> : null}
              </span>
              <span className="flex-shrink-0">
                {isChosen ? (
                  <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                ) : (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border text-[11px] text-muted-foreground group-hover:border-sky-300">
                    {i + 1}
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {allowOther !== false ? (
          <div className="px-4 py-2.5 text-xs text-muted-foreground">…or just type your own answer below 👇</div>
        ) : null}
      </div>
      <div className="px-3 py-2 border-t border-border">
        <button
          type="button"
          onClick={() => pick("skip")}
          disabled={!!chosen}
          className={cn(
            "rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-sky-300",
            chosen === "skip" && "border-sky-500 text-foreground",
            chosen && chosen !== "skip" && "opacity-50",
          )}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

export function MessageBlocks({
  blocks,
  toolCalls,
  planProposals,
  agentTasks,
  onPlanResponse,
  onPickTemplate,
  onPickOption,
  onViewEvent,
  bubbleClassName,
}: {
  blocks: MessageBlock[];
  toolCalls?: AgentToolCardData[];
  planProposals?: PlanProposalCardData[];
  agentTasks?: AgentTaskCardData[];
  onPlanResponse?: (planId: string, confirmed: boolean) => void;
  /** Called when the user clicks a template card (or "No template" → null). */
  onPickTemplate?: (choice: { id: string; name: string } | null) => void;
  /** Called when the user taps a question-card option (sends the option text). */
  onPickOption?: (text: string) => void;
  /** Called when the user interacts with an agent-authored view (tap/input/rate). */
  onViewEvent?: (e: ViewEvent) => void;
  /** Tailwind classes for the assistant text bubble (themed per surface). */
  bubbleClassName?: string;
}) {
  const toolMap = new Map((toolCalls ?? []).map((t) => [t.id, t]));
  const propMap = new Map((planProposals ?? []).map((p) => [p.id, p]));
  const taskMap = new Map((agentTasks ?? []).map((t) => [t.id, t]));

  const rows: ReactNode[] = [];
  // Task cards (a background job's live status) are deferred to the END of the
  // message so they read as the MOST-CURRENT item — the agent emits task_started
  // BEFORE its final text, but the running/completed card should sit BELOW the
  // "…it's generating" message, not above it.
  const taskRows: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "text") {
      const text = b.text;
      // "Interim" narration — text the agent emits right before it runs more
      // steps ("Now I'll search…"). Render it faded/inline (part of the working
      // process), not as a prominent result bubble. The FINAL text (nothing more
      // to run after it) stays a full bubble with copy/speak.
      const nextIsTool = i + 1 < blocks.length && blocks[i + 1].type === "tool";
      if (text.trim()) {
        if (nextIsTool) {
          rows.push(
            <div key={`txt-${i}`} className="px-1 text-[12.5px] italic leading-relaxed text-muted-foreground/70">
              <RichText text={text} />
            </div>,
          );
        } else {
          rows.push(
            <div key={`txt-${i}`} className="flex flex-col items-start gap-1">
              <div
                className={cn(
                  "inline-block px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words max-w-full text-left border",
                  bubbleClassName ?? "bg-white dark:bg-gray-900 border-border text-foreground",
                )}
              >
                <RichText text={text} />
              </div>
              <div className="pl-1 flex items-center gap-3">
                <CopyTextButton text={text} />
                <SpeakButton text={text} />
              </div>
            </div>,
          );
        }
      }
      i += 1;
    } else if (b.type === "tool") {
      // Collapse a run of tool calls into ONE faded, expandable "activity" strip
      // so the chat shows a calm working process, not the raw backend steps.
      const calls: AgentToolCardData[] = [];
      while (i < blocks.length && blocks[i].type === "tool") {
        const tc = toolMap.get((blocks[i] as { id: string }).id);
        if (tc) calls.push(tc);
        i += 1;
      }
      if (calls.length) {
        rows.push(<AgentActivity key={`tools-${i}`} calls={calls} />);
      }
    } else if (b.type === "proposal") {
      const p = propMap.get(b.id);
      if (p) {
        rows.push(
          <div key={`prop-${i}`} className="flex flex-col items-start">
            <PlanProposalCard proposal={p} onResponse={onPlanResponse} />
          </div>,
        );
      }
      i += 1;
    } else if (b.type === "task") {
      const t = taskMap.get(b.id);
      if (t) {
        taskRows.push(
          <div key={`task-${i}`} className="flex flex-col items-start">
            <TaskCard task={t} />
          </div>,
        );
      }
      i += 1;
    } else if (b.type === "templates") {
      if (b.templates?.length) {
        rows.push(
          <div key={`tpl-${i}`} className="flex flex-col items-start">
            <TemplateOptionsCard templates={b.templates} onPick={onPickTemplate} />
          </div>,
        );
      }
      i += 1;
    } else if (b.type === "question") {
      if (b.options?.length) {
        rows.push(
          <div key={`q-${i}`} className="flex flex-col items-start">
            <QuestionOptionsCard question={b.question} options={b.options} allowOther={b.allowOther} onPick={onPickOption} />
          </div>,
        );
      }
      i += 1;
    } else if (b.type === "view") {
      rows.push(
        <div key={`view-${i}`} className="w-full max-w-[420px]">
          <AgentView spec={b.spec} onEvent={onViewEvent} />
        </div>,
      );
      i += 1;
    } else {
      i += 1;
    }
  }

  // Task cards last — the live/most-current status sits below the message text.
  rows.push(...taskRows);

  return <div className="flex flex-col items-start gap-2">{rows}</div>;
}
