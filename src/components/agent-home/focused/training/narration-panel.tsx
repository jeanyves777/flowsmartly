"use client";

import { useMemo, useRef, useState } from "react";
import { AudioLines, Download, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DeckSlide } from "@/lib/training/types";

const mmss = (s: number) => {
  if (!isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return `${m}:${String(r === 60 ? 0 : r).padStart(2, "0")}`;
};

/**
 * ADMIN / PREVIEW control — every baked voice segment of the deck, in play order, with the total
 * runtime of the whole narration and one-click download (each segment, or the full voiceover as a
 * single MP3). Shown under the preview player. [[training-presenter-talking-video]]
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
    <div className="mt-3 rounded-xl border border-border bg-card/60">
      {/* header: total runtime of the ENTIRE narration + download all */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-300">
          <AudioLines className="h-3.5 w-3.5" /> Narration voiceover
        </span>
        <span className="text-[11px] text-muted-foreground">
          {segments.length} segment{segments.length === 1 ? "" : "s"}
          {unvoiced > 0 ? ` · ${unvoiced} not voiced yet` : ""}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-[12px] font-black tabular-nums text-foreground">
          {mmss(total)}{allKnown ? "" : "…"} <span className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">total</span>
        </span>
        <a
          href={dlBase}
          className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white hover:opacity-95"
          title="Download the whole narration as one MP3"
        >
          <Download className="h-3.5 w-3.5" /> Download all
        </a>
      </div>

      {/* per-segment list */}
      <div className="max-h-52 overflow-auto p-1.5">
        {segments.map((seg) => {
          const active = playingId === seg.id;
          const current = seg.id === currentSlideId;
          return (
            <div
              key={seg.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px]",
                current ? "bg-brand-500/10" : "hover:bg-muted/60",
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
              <button
                onClick={() => onJump?.(seg.index)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                title="Jump to this slide"
              >
                <span className="shrink-0 tabular-nums text-muted-foreground">{seg.index + 1}</span>
                <span className={cn("truncate font-semibold", current ? "text-brand-300" : "text-foreground")}>{seg.title || "Untitled slide"}</span>
              </button>
              <span className="shrink-0 tabular-nums text-muted-foreground">{dur[seg.id] ? mmss(dur[seg.id]) : "—"}</span>
              <a
                href={`${dlBase}&slideId=${encodeURIComponent(seg.id)}`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:text-brand-300 group-hover:opacity-100"
                title="Download this segment"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              {/* hidden metadata loader → feeds the per-segment + total runtime */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                preload="metadata"
                src={seg.url}
                className="hidden"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (isFinite(d) && d > 0) setDur((p) => (p[seg.id] === d ? p : { ...p, [seg.id]: d }));
                }}
              />
            </div>
          );
        })}
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={playRef} onEnded={() => setPlayingId(null)} className="hidden" />
    </div>
  );
}
