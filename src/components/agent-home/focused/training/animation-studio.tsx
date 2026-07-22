"use client";

/**
 * Animation Studio — a full-screen surface for directing how the AI presenter's hand
 * marks each slide: the animation VARIANT, the keyword it marks, the reveal order, the
 * hand's ink / tool / visibility, and — on the narration WAVEFORM timeline — exactly WHEN
 * the hand marks (a draggable beat). It reuses DeckSlideView for a true, audio-synced live
 * preview. Applies live (no regeneration) and persists through the deck autosave. [[training-studio]]
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Play, Pause, RotateCcw, Sparkles, Eye, EyeOff, Hand, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DeckSlideView } from "./deck-slide-view";
import { ANNOTATE_VARIANTS } from "@/lib/training/types";
import type { DeckSlide, TrainingDeck, VisualStyle, HandStyleSettings } from "@/lib/training/types";

type Ann = NonNullable<DeckSlide["annotate"]> | "none";
const VARIANTS: { v: Ann; icon: string; label: string; hint: string }[] = [
  ...ANNOTATE_VARIANTS,
  { v: "none", icon: "∅", label: "None", hint: "No hand mark" },
];
const INKS: { c: string; label: string }[] = [
  { c: "#0e7db8", label: "Blue" }, { c: "brand", label: "Accent" }, { c: "#111827", label: "Ink" },
  { c: "#dc2626", label: "Red" }, { c: "#16a34a", label: "Green" }, { c: "#d97706", label: "Amber" },
];
const TOOLS: { v: NonNullable<HandStyleSettings["tool"]>; label: string }[] = [
  { v: "pen", label: "Pen" }, { v: "marker", label: "Marker" }, { v: "highlighter", label: "Highlighter" },
];
const REVEALS: { v: NonNullable<DeckSlide["revealMode"]>; label: string }[] = [
  { v: "progressive", label: "One point at a time" }, { v: "all_at_once", label: "All at once" }, { v: "word_by_word", label: "Word by word" },
];
const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
// Deterministic pseudo-waveform when the real audio can't be decoded (CORS) — looks voice-like.
function synthBars(seed: string, n = 84): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const out: number[] = [];
  for (let i = 0; i < n; i++) { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; const r = ((h >>> 0) % 1000) / 1000; out.push(0.18 + r * 0.82 * (0.6 + 0.4 * Math.sin(i / 3))); }
  return out;
}

export function AnimationStudio({ deck, page, setPage, onEditSlide, onEditDeck, styleKey, onClose }: {
  deck: TrainingDeck;
  page: number;
  setPage: (n: number) => void;
  onEditSlide: (patch: Partial<DeckSlide>) => void;
  onEditDeck: (patch: Partial<TrainingDeck>) => void;
  styleKey?: VisualStyle | null;
  onClose: () => void;
}) {
  const slide = deck.slides[page];
  const isDoc = slide?.type === "doc";
  const bullets = slide?.bullets?.length ?? 0;
  const highlight = (slide?.highlight || "").trim();
  const total = Math.max(1, bullets);
  const hand = deck.handStyle ?? {};
  const audioUrl = slide?.narration?.audioUrl;
  const durMs = slide?.narration?.durationMs || 0;
  const markMs = Math.min(durMs || 1, Math.max(300, slide?.annotateAtMs ?? Math.round((durMs || 4000) * 0.8)));

  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [tMs, setTMs] = useState(0); // playhead
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [bars, setBars] = useState<number[] | null>(null);

  // decode the narration into a waveform (fallback to a synthetic one on CORS/failure)
  useEffect(() => {
    let cancelled = false;
    if (!audioUrl) { setBars(null); return; }
    setBars(synthBars(slide?.narration?.text || slide?.id || "w")); // instant placeholder
    (async () => {
      try {
        const res = await fetch(audioUrl);
        const buf = await res.arrayBuffer();
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const audio = await ctx.decodeAudioData(buf);
        const ch = audio.getChannelData(0); const N = 84, block = Math.max(1, Math.floor(ch.length / N)); const out: number[] = [];
        for (let i = 0; i < N; i++) { let max = 0; for (let j = 0; j < block; j++) { const v = Math.abs(ch[i * block + j] || 0); if (v > max) max = v; } out.push(Math.max(0.08, max)); }
        const peak = Math.max(...out) || 1; ctx.close();
        if (!cancelled) setBars(out.map((v) => v / peak));
      } catch { /* keep the synthetic bars */ }
    })();
    return () => { cancelled = true; };
  }, [audioUrl, slide?.id, slide?.narration?.text]);

  const stop = () => {
    setPlaying(false);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); clearInterval(rafRef.current); }
    const a = audioRef.current; if (a) a.pause();
  };
  // audio-synced playback: reveals + the hand mark ride the real narration time.
  const playAudio = () => {
    const a = audioRef.current; if (!a) return;
    a.currentTime = 0; setStep(bullets ? 0 : 1); setPlaying(true);
    a.play().catch(() => {});
    const loop = () => {
      const now = (a.currentTime || 0) * 1000; setTMs(now);
      const prog = Math.min(1, now / markMs);
      setStep(Math.max(1, Math.round(prog * total)));
      if (!a.paused && !a.ended) rafRef.current = requestAnimationFrame(loop); else setPlaying(false);
    };
    rafRef.current = requestAnimationFrame(loop);
  };
  // no-narration fallback: step the reveals on a timer
  const playTimer = () => {
    setStep(1); setPlaying(true);
    let s = 1; const id = setInterval(() => { s += 1; setStep(s); if (s >= total) { clearInterval(id); setPlaying(false); } }, 1300);
    rafRef.current = id as unknown as number;
  };
  const play = () => { if (playing) { stop(); return; } if (audioUrl) playAudio(); else playTimer(); };
  // reset the beat when the slide / its animation changes, and stop on unmount
  useEffect(() => { stop(); setStep(1); setTMs(0); }, [page, slide?.annotate, slide?.highlight, slide?.revealMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const curAnn: Ann = highlight ? (slide?.annotate ?? "circle") : "none";
  const timeline = useMemo(() => (slide?.bullets ?? []).slice(0, bullets).map((b, i) => ({ k: `b${i}`, n: i + 1, text: b.replace(/\*\*/g, "").slice(0, 40) })), [slide, bullets]);
  const markActive = !!highlight && step >= bullets;

  const setVariant = (v: Ann) => {
    if (v === "none") { onEditSlide({ annotate: undefined, highlight: undefined }); return; }
    const src = (slide?.bullets?.[0] || slide?.subtitle || "").replace(/\*\*/g, "").trim();
    const hl = highlight || src.split(/\s+/).slice(0, 3).join(" ").replace(/[:.,;]+$/, "");
    onEditSlide({ annotate: v as DeckSlide["annotate"], highlight: hl.length >= 3 ? hl : highlight || undefined });
  };
  const setHand = (patch: Partial<HandStyleSettings>) => onEditDeck({ handStyle: { ...hand, ...patch } });

  // drag the "hand marks here" beat along the waveform
  const dragMark = (clientX: number) => {
    const el = barRef.current; if (!el || !durMs) return;
    const r = el.getBoundingClientRect(); const pct = Math.min(1, Math.max(0.02, (clientX - r.left) / r.width));
    onEditSlide({ annotateAtMs: Math.round(pct * durMs) });
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b10]">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Sparkles className="h-4.5 w-4.5" /></span>
        <div className="min-w-0"><b className="block text-[15px] leading-tight">Animation Studio</b><span className="text-[11px] text-muted-foreground">Direct how — and when — the presenter’s hand marks this slide.</span></div>
        <div className="ms-auto flex items-center gap-1.5">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page <= 0} className="grid h-7 w-7 place-items-center rounded-lg border border-border disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[76px] text-center text-[11px] text-muted-foreground">Slide {page + 1} / {deck.slides.length}</span>
          <button onClick={() => setPage(Math.min(deck.slides.length - 1, page + 1))} disabled={page >= deck.slides.length - 1} className="grid h-7 w-7 place-items-center rounded-lg border border-border disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={onClose} className="ms-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold hover:border-brand-500"><X className="h-4 w-4" /> Done</button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col overflow-auto p-5">
          <div className="mx-auto w-full max-w-[900px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
            <div className="aspect-video w-full"><DeckSlideView slide={slide} reveal={step} styleKey={styleKey} hand={deck.handStyle} /></div>
          </div>

          {/* TIMELINE */}
          <div className="mx-auto mt-3 w-full max-w-[900px]">
            <div className="mb-1.5 flex items-center gap-2">
              <button onClick={play} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/50 px-3 py-1.5 text-[12px] font-bold text-brand-300 hover:bg-brand-500/10">{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? "Pause" : "Play with narration"}</button>
              <button onClick={() => { stop(); setStep(1); setTMs(0); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
              <span className="ms-auto text-[11px] tabular-nums text-muted-foreground">{audioUrl ? `${fmt(tMs)} / ${fmt(durMs)}` : "no narration yet"}</span>
            </div>

            {audioUrl ? (
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                {/* waveform + beats */}
                <div ref={barRef} className="relative flex h-[64px] items-end gap-[1.5px] overflow-hidden rounded-md">
                  {(bars ?? []).map((v, i) => {
                    const barPct = i / (bars!.length - 1 || 1);
                    const passed = durMs ? barPct <= tMs / durMs : false;
                    return <div key={i} className={cn("min-w-0 flex-1 rounded-sm", passed ? "bg-brand-400" : "bg-white/20")} style={{ height: `${Math.max(6, v * 100)}%` }} />;
                  })}
                  {/* reveal ticks */}
                  {timeline.map((t) => { const pct = (t.n / total) * (markMs / (durMs || 1)); return <div key={t.k} className="absolute bottom-0 top-0 w-px bg-cyan-300/40" style={{ left: `${pct * 100}%` }} title={`Point ${t.n}`} />; })}
                  {/* playhead */}
                  {playing ? <div className="absolute bottom-0 top-0 z-[3] w-px bg-white" style={{ left: `${(tMs / (durMs || 1)) * 100}%` }} /> : null}
                  {/* draggable "hand marks here" beat */}
                  {highlight ? (
                    <div
                      role="slider" aria-label="When the hand marks" tabIndex={0}
                      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); const mv = (ev: PointerEvent) => dragMark(ev.clientX); const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); dragMark(e.clientX); }}
                      onKeyDown={(e) => { if (e.key === "ArrowLeft") onEditSlide({ annotateAtMs: Math.max(300, markMs - 250) }); if (e.key === "ArrowRight") onEditSlide({ annotateAtMs: Math.min(durMs, markMs + 250) }); }}
                      className="absolute bottom-0 top-0 z-[4] -ml-2 w-4 cursor-ew-resize touch-none"
                      style={{ left: `${(markMs / (durMs || 1)) * 100}%` }}
                    >
                      <div className="mx-auto h-full w-[3px] rounded bg-emerald-400 shadow-[0_0_0_1px_rgba(0,0,0,.4)]" />
                      <div className="absolute -top-[1px] left-1/2 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full bg-emerald-400 text-[9px] text-emerald-950">✍</div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-cyan-300/60" /> point reveals</span>
                  {highlight ? <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> hand marks “{highlight.slice(0, 18)}” at <b className="tabular-nums text-foreground">{fmt(markMs)}</b> — drag to retime</span> : <span>add a keyword to place a hand mark</span>}
                </div>
              </div>
            ) : (
              /* no narration — the reveal-order strip */
              <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-muted/30 p-2.5">
                {timeline.length === 0 && !highlight ? <span className="text-[11px] text-muted-foreground">This slide has no reveal steps.</span> : null}
                {timeline.map((t) => <span key={t.k} className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold", step >= t.n ? "bg-brand-500/20 text-brand-200" : "bg-white/5 text-muted-foreground")}><b className="opacity-70">{t.n}</b> {t.text}</span>)}
                {highlight ? <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-bold", markActive ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-muted-foreground")}>{VARIANTS.find((x) => x.v === curAnn)?.icon} mark “{highlight.slice(0, 22)}”</span> : null}
                <span className="ms-auto shrink-0 text-[10px] text-muted-foreground">Generate narration to place marks on the voice timeline.</span>
              </div>
            )}
          </div>
        </div>

        {/* controls */}
        <div className="flex min-h-0 flex-col gap-4 overflow-auto border-l border-border p-4">
          {!isDoc ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">Hand-marking is for document slides. Whiteboard / Live-Draw slides animate as the diagram is drawn — pick <b className="text-foreground">Live hand draws it</b> when you regenerate them.</div>
          ) : (
            <>
              <div>
                <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-brand-300">Animation variant</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {VARIANTS.map((x) => (
                    <button key={x.v} onClick={() => setVariant(x.v)} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left", curAnn === x.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500")}>
                      <span className="text-[15px] leading-none">{x.icon}</span>
                      <span className="min-w-0"><b className="block text-[11.5px] leading-tight">{x.label}</b><span className="block text-[9.5px] leading-tight text-muted-foreground">{x.hint}</span></span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-brand-300">Keyword the hand marks</span>
                <input value={slide?.highlight ?? ""} onChange={(e) => onEditSlide({ highlight: e.target.value })} placeholder="a 2–4 word phrase from the slide" className="w-full rounded-lg border border-border bg-muted px-2.5 py-2 text-[12px] outline-none focus:border-brand-500" />
              </label>

              <div>
                <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-300">Reveal order</div>
                <div className="flex flex-col gap-1.5">
                  {REVEALS.map((r) => <button key={r.v} onClick={() => onEditSlide({ revealMode: r.v })} className={cn("rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] font-semibold", (slide?.revealMode ?? "progressive") === r.v ? "border-brand-500 bg-brand-500/10 text-brand-200" : "border-border hover:border-brand-500")}>{r.label}</button>)}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-300"><Hand className="h-3.5 w-3.5" /> The hand</div>
                <button onClick={() => setHand({ showHand: hand.showHand === false })} className="mb-2.5 flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-2 text-[11.5px] font-semibold hover:border-brand-500">
                  <span className="inline-flex items-center gap-1.5">{hand.showHand === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} Show the drawing hand</span>
                  <span className={cn("inline-flex h-4 w-7 items-center rounded-full px-0.5 transition", hand.showHand === false ? "bg-white/15" : "bg-brand-500")}><span className={cn("h-3 w-3 rounded-full bg-white transition", hand.showHand === false ? "translate-x-0" : "translate-x-3")} /></span>
                </button>
                <div className="mb-1 text-[10.5px] font-bold text-muted-foreground">Tool</div>
                <div className="mb-2.5 grid grid-cols-3 gap-1.5">
                  {TOOLS.map((t) => <button key={t.v} onClick={() => setHand({ tool: t.v })} className={cn("rounded-lg border px-1.5 py-1.5 text-[10.5px] font-bold", (hand.tool ?? "marker") === t.v ? "border-brand-500 bg-brand-500/10 text-brand-200" : "border-border hover:border-brand-500")}>{t.label}</button>)}
                </div>
                <div className="mb-1 text-[10.5px] font-bold text-muted-foreground">Ink colour</div>
                <div className="flex flex-wrap gap-1.5">
                  {INKS.map((k) => { const on = (hand.color ?? "#0e7db8") === k.c; return <button key={k.c} onClick={() => setHand({ color: k.c })} title={k.label} className={cn("h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[#0b0b10]", on ? "ring-brand-400" : "ring-transparent hover:ring-white/30")} style={{ background: k.c === "brand" ? "linear-gradient(135deg,var(--sa),var(--sa2))" : k.c }} />; })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {audioUrl ? <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" onEnded={() => setPlaying(false)} /> : null}
    </div>
  );
}
