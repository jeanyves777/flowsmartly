"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import Image from "next/image";
import { Download, Maximize2, X, ExternalLink, Copy, Check, Volume2, Square, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { createSpeechPlayer, type SpeechPlayer } from "./use-tts";
import { RichText } from "./rich-text";

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

export type MessageBlock =
  | { type: "text"; text: string }
  | { type: "tool"; id: string }
  | { type: "proposal"; id: string }
  | { type: "task"; id: string }
  | { type: "templates"; requestId: string; templates: TemplateOption[] };

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
        <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
          Estimated cost: <span className="font-semibold text-foreground">{proposal.totalCreditCost} credits</span>
        </div>
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

export function TaskCard({ task }: { task: AgentTaskCardData }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const kindLabel = humanizeTaskKind(task.kind);
  const isRunning = task.status === "running" || task.status === "pending";
  const isDone = task.status === "completed";
  const isFailed = task.status === "failed" || task.status === "canceled";
  const mediaUrl =
    typeof task.output?.url === "string" && /^https?:\/\//.test(task.output.url)
      ? task.output.url
      : null;
  const isVideo = mediaUrl ? /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl) : false;
  const isAudio = mediaUrl ? /\.(mp3|wav|m4a|ogg)(\?|$)/i.test(mediaUrl) : false;
  // In-app deep link to the produced result (proposal, pitch, website,
  // store, etc.) — tools put it on output.link. Lets the user open it.
  const resultLink =
    typeof task.output?.link === "string" && task.output.link.startsWith("/") ? task.output.link : null;

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
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
      {isRunning && (
        <div className="px-3.5 py-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {task.progressMessage ?? task.summary ?? "Working…"}
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(6, task.progress ?? 30))}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            You can leave this chat — we&apos;ll notify you when it&apos;s ready.
          </p>
        </div>
      )}
      {isDone && mediaUrl && (
        <div className="bg-muted/30">
          {isVideo ? (
            <video src={mediaUrl} controls className="block w-full max-h-[60vh] bg-black" />
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
                className="block w-full h-auto"
              />
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="h-3 w-3" /> View
              </span>
            </button>
          )}
          <div className="px-3.5 py-2 flex items-center justify-between">
            <a
              href={mediaDownloadHref(mediaUrl, `flowsmartly-${task.kind || "design"}`)}
              download
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-3 w-3" />
              Download
            </a>
            {typeof task.output?.tier === "string" && (
              <span className="text-[10px] text-muted-foreground capitalize">{task.output.tier} tier</span>
            )}
          </div>
        </div>
      )}
      {isDone && !mediaUrl && (
        <div className="px-3.5 py-3 flex items-center justify-between gap-2">
          {resultLink ? (
            <>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
              <a
                href={resultLink}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-sm shadow-blue-500/20 transition-colors"
              >
                Open <ExternalLink className="h-3.5 w-3.5" />
              </a>
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
  const pick = (t: TemplateOption | null) => {
    if (chosen) return; // one choice per card
    setChosen(t ? t.id : "none");
    onPick?.(t ? { id: t.id, name: t.name } : null);
  };
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-white dark:bg-gray-900 p-3 shadow-sm">
      <div className="text-xs font-semibold text-foreground mb-2">Pick a look — or design from your idea</div>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((t) => {
          const isChosen = chosen === t.id;
          const dimmed = chosen && !isChosen;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => pick(t)}
              disabled={!!chosen}
              className={cn(
                "group relative overflow-hidden rounded-lg border text-left transition-all",
                isChosen ? "border-sky-500 ring-2 ring-sky-400" : "border-border hover:border-sky-300",
                dimmed && "opacity-50",
              )}
            >
              <div className="aspect-[3/4] w-full bg-muted overflow-hidden">
                {t.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumbnailUrl} alt={t.name} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">{t.name}</div>
                )}
              </div>
              <div className="px-1.5 py-1">
                <div className="truncate text-[11px] font-medium text-foreground">{t.name}</div>
                {t.industry ? <div className="truncate text-[10px] text-muted-foreground">{t.industry}</div> : null}
              </div>
              {isChosen ? (
                <div className="absolute right-1 top-1 rounded-full bg-sky-500 p-0.5 text-white">
                  <Check className="h-3 w-3" />
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => pick(null)}
        disabled={!!chosen}
        className={cn(
          "mt-2 w-full rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-sky-300 hover:text-foreground",
          chosen === "none" && "border-sky-500 text-foreground ring-2 ring-sky-400",
          chosen && chosen !== "none" && "opacity-50",
        )}
      >
        No template — design from my prompt only
      </button>
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
  bubbleClassName,
}: {
  blocks: MessageBlock[];
  toolCalls?: AgentToolCardData[];
  planProposals?: PlanProposalCardData[];
  agentTasks?: AgentTaskCardData[];
  onPlanResponse?: (planId: string, confirmed: boolean) => void;
  /** Called when the user clicks a template card (or "No template" → null). */
  onPickTemplate?: (choice: { id: string; name: string } | null) => void;
  /** Tailwind classes for the assistant text bubble (themed per surface). */
  bubbleClassName?: string;
}) {
  const toolMap = new Map((toolCalls ?? []).map((t) => [t.id, t]));
  const propMap = new Map((planProposals ?? []).map((p) => [p.id, p]));
  const taskMap = new Map((agentTasks ?? []).map((t) => [t.id, t]));

  const rows: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "text") {
      const text = b.text;
      if (text.trim()) {
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
      i += 1;
    } else if (b.type === "tool") {
      // Group consecutive tool chips into one wrap row.
      const chips: React.ReactNode[] = [];
      while (i < blocks.length && blocks[i].type === "tool") {
        const tc = toolMap.get((blocks[i] as { id: string }).id);
        if (tc) chips.push(<ToolCallChip key={tc.id} call={tc} />);
        i += 1;
      }
      if (chips.length) {
        rows.push(
          <div key={`tools-${i}`} className="flex flex-wrap gap-1.5">
            {chips}
          </div>,
        );
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
        rows.push(
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
    } else {
      i += 1;
    }
  }

  return <div className="flex flex-col items-start gap-2">{rows}</div>;
}
