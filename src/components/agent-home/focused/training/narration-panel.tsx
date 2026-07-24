"use client";

import { useMemo, useRef, useState } from "react";
import { AudioLines, ChevronDown, Download, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DeckSlide } from "@/lib/training/types";

const mmss = (s: number) => {
  if (!isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return `${m}:${String(r === 60 ? 0 : r).padStart(2, "0")}`;
};

/**
 * ADMIN / PREVIEW control — the deck's whole narration: total runtime always in view, and (when
 * expanded) every baked voice segment as a HORIZONTAL strip of chips you can play, jump to, or
 * download. Download each segment or the full voiceover as one MP3. Collapsible so it never
 * crowds the preview. Shown under the preview player. [[training-presenter-talking-video]]
 */
export function NarrationPanel({
  slides,
  sessionId,
  materialId,
  currentSlideId,
  onJump,
}: {
  slides: DeckSlide[];
  sessionId: string;
  materialId: string;
  currentSlideId?: string;
  onJump?: (index: number) => void;
}) {
  const segments = useMemo(
    () =>
      slides
        .map((s, i) => ({ id: s.id, url: s.narration?.audioUrl, title: s.title, index: i }))
        .filter((s): s is { id: string; url: string; title: string; index: number } => !!s.url),
    [slides],
  );

  const [open, setOpen] = useState(false);
  const [dur, setDur] = useState<Record<string, number>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playRef = useRef<HTMLAudioElement | null>(null);

  const known = segments.map((s) => dur[s.id]).filter((d): d is number => !!d && isFinite(d));
  const total = known.reduce((a, b) => a + b, 0);
  const allKnown = known.length === segments.length;
  const unvoiced = slides.length - segments.length;
  const dlBase = `/api/ai/training/${sessionId}/narration/download?materialId=${encodeURIComponent(materialId)}`;

  const toggle = (seg: { id: string; url: string }) => {
    const a = playRef.current;
    if (!a) return;
    if (playingId === seg.id) { a.pause(); setPlayingId(null); return; }
    a.src = seg.url; a.currentTime = 0; a.play().catch(() => {}); setPlayingId(seg.id);
  };

  if (!segments.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-border bg-card/70 shadow-sm">
      {/* header — ALWAYS shows the total runtime of the entire narration; collapses the strip */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" title={open ? "Hide segments" : "Show every voice segment"}>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          <AudioLines className="h-4 w-4 shrink-0 text-brand-300" />
          <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-foreground">Narration</span>
          <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
            {segments.length} segment{segments.length === 1 ? "" : "s"}{unvoiced > 0 ? ` · ${unvoiced} not voiced yet` : ""}
          </span>
          <span className="ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-[12px] font-black tabular-nums text-foreground">
            {mmss(total)}{allKnown ? "" : "…"}
            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">total</span>
          </span>
        </button>
        <a
          href={dlBase}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white hover:opacity-95"
          title="Download the whole narration as one MP3"
        >
          <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Download all</span>
        </a>
      </div>

      {/* horizontal segment strip (expandable) — chips scroll sideways, never grows tall */}
      {open ? (
        <div className="flex gap-2 overflow-x-auto border-t border-border px-3 py-2.5">
          {segments.map((seg) => {
            const active = playingId === seg.id;
            const current = seg.id === currentSlideId;
            return (
              <div
                key={seg.id}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg border px-2 py-1.5",
                  current ? "border-brand-500 bg-brand-500/10" : "border-border bg-background/60",
                )}
              >
                <button
                  onClick={() => toggle(seg)}
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition",
                    active ? "border-brand-500 bg-brand-500 text-white" : "border-border text-muted-foreground hover:border-brand-500 hover:text-foreground",
                  )}
                  title={active ? "Pause" : "Play this segment"}
                >
                  {active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </button>
                <button onClick={() => onJump?.(seg.index)} className="flex min-w-0 items-center gap-1.5 text-left" title="Jump to this slide">
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">{seg.index + 1}</span>
                  <span className={cn("max-w-[130px] truncate text-[11px] font-semibold", current ? "text-brand-300" : "text-foreground")}>{seg.title || "Untitled"}</span>
                </button>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{dur[seg.id] ? mmss(dur[seg.id]) : "—"}</span>
                <a href={`${dlBase}&slideId=${encodeURIComponent(seg.id)}`} className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-brand-300" title="Download this segment">
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* hidden metadata loaders — always mounted so the total runtime shows even while collapsed */}
      {segments.map((seg) => (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          key={`m-${seg.id}`}
          preload="metadata"
          src={seg.url}
          className="hidden"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (isFinite(d) && d > 0) setDur((p) => (p[seg.id] === d ? p : { ...p, [seg.id]: d }));
          }}
        />
      ))}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={playRef} onEnded={() => setPlayingId(null)} className="hidden" />
    </div>
  );
}
