"use client";

/**
 * Animation Studio — a full-screen surface for directing how the AI presenter's hand
 * marks each slide: the animation VARIANT, the keyword it marks, the reveal order, and
 * the hand's ink + visibility. It reuses DeckSlideView for a true, stepping live preview
 * and a reveal timeline, so what you set here is exactly what plays in the room. Applies
 * live (no regeneration) and persists through the same deck autosave. [[training-studio]]
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Play, RotateCcw, Sparkles, Eye, EyeOff, Hand, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DeckSlideView } from "./deck-slide-view";
import type { DeckSlide, TrainingDeck, VisualStyle, HandStyleSettings } from "@/lib/training/types";

type Ann = NonNullable<DeckSlide["annotate"]> | "none";
const VARIANTS: { v: Ann; icon: string; label: string; hint: string }[] = [
  { v: "circle", icon: "✍️", label: "Circle", hint: "Circle a key term" },
  { v: "underline", icon: "＿", label: "Underline", hint: "Underline a fact" },
  { v: "box", icon: "▢", label: "Box", hint: "Box a definition" },
  { v: "strike", icon: "⊘", label: "Strike", hint: "Strike a myth" },
  { v: "check", icon: "✔", label: "Check", hint: "Approve / do this" },
  { v: "highlight", icon: "🖍️", label: "Marker", hint: "Highlighter sweep" },
  { v: "point", icon: "👉", label: "Point", hint: "Point at it" },
  { v: "none", icon: "∅", label: "None", hint: "No hand mark" },
];
const INKS: { c: string; label: string }[] = [
  { c: "#0e7db8", label: "Blue" },
  { c: "brand", label: "Accent" },
  { c: "#111827", label: "Ink" },
  { c: "#dc2626", label: "Red" },
  { c: "#16a34a", label: "Green" },
  { c: "#d97706", label: "Amber" },
];
const REVEALS: { v: NonNullable<DeckSlide["revealMode"]>; label: string }[] = [
  { v: "progressive", label: "One point at a time" },
  { v: "all_at_once", label: "All at once" },
  { v: "word_by_word", label: "Word by word" },
];

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
  const total = Math.max(1, bullets); // reveal caps at bullet count; the mark lands on the last beat
  const hand = deck.handStyle ?? {};

  // Auto-step the reveals so the preview animates the way the room plays it.
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const replay = () => { setStep(1); setPlaying(true); };
  useEffect(() => { replay(); }, [page, slide?.annotate, slide?.highlight, slide?.revealMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!playing) return;
    timer.current = setInterval(() => setStep((s) => { const n = s + 1; if (n >= total) setPlaying(false); return Math.min(n, total); }), 1300);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, total]);

  const curAnn: Ann = highlight ? (slide?.annotate ?? "circle") : "none";
  const timeline = useMemo(() => {
    const items = (slide?.bullets ?? []).slice(0, bullets).map((b, i) => ({ k: `b${i}`, n: i + 1, text: b.replace(/\*\*/g, "").slice(0, 40) }));
    return items;
  }, [slide, bullets]);
  const markActive = highlight && step >= bullets;

  const setVariant = (v: Ann) => {
    if (v === "none") { onEditSlide({ annotate: undefined, highlight: undefined }); return; }
    const src = (slide?.bullets?.[0] || slide?.subtitle || "").replace(/\*\*/g, "").trim();
    const hl = highlight || src.split(/\s+/).slice(0, 3).join(" ").replace(/[:.,;]+$/, "");
    onEditSlide({ annotate: v as DeckSlide["annotate"], highlight: hl.length >= 3 ? hl : highlight || undefined });
  };
  const setHand = (patch: Partial<HandStyleSettings>) => onEditDeck({ handStyle: { ...hand, ...patch } });

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b10]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Sparkles className="h-4.5 w-4.5" /></span>
        <div className="min-w-0"><b className="block text-[15px] leading-tight">Animation Studio</b><span className="text-[11px] text-muted-foreground">Direct how the presenter’s hand marks this slide.</span></div>
        <div className="ms-auto flex items-center gap-1.5">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page <= 0} className="grid h-7 w-7 place-items-center rounded-lg border border-border disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[76px] text-center text-[11px] text-muted-foreground">Slide {page + 1} / {deck.slides.length}</span>
          <button onClick={() => setPage(Math.min(deck.slides.length - 1, page + 1))} disabled={page >= deck.slides.length - 1} className="grid h-7 w-7 place-items-center rounded-lg border border-border disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={onClose} className="ms-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold hover:border-brand-500"><X className="h-4 w-4" /> Done</button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px]">
        {/* stage + timeline */}
        <div className="flex min-w-0 flex-col overflow-auto p-5">
          <div className="mx-auto w-full max-w-[900px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
            <div className="aspect-video w-full"><DeckSlideView slide={slide} reveal={step} styleKey={styleKey} hand={deck.handStyle} /></div>
          </div>
          <div className="mx-auto mt-3 flex w-full max-w-[900px] items-center gap-2">
            <button onClick={replay} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/50 px-3 py-1.5 text-[12px] font-bold text-brand-300 hover:bg-brand-500/10">{playing ? <Play className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />} {playing ? "Playing" : "Replay"}</button>
            {/* reveal timeline */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto rounded-lg border border-border bg-muted/40 px-2 py-1.5">
              {timeline.length === 0 && !highlight ? <span className="text-[11px] text-muted-foreground">This slide has no reveal steps.</span> : null}
              {timeline.map((t) => (
                <span key={t.k} className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold", step >= t.n ? "bg-brand-500/20 text-brand-200" : "bg-white/5 text-muted-foreground")}>
                  <b className="opacity-70">{t.n}</b> {t.text}
                </span>
              ))}
              {highlight ? (
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-bold", markActive ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-muted-foreground")}>
                  {VARIANTS.find((x) => x.v === curAnn)?.icon} mark “{highlight.slice(0, 22)}”
                </span>
              ) : null}
            </div>
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
                  {REVEALS.map((r) => (
                    <button key={r.v} onClick={() => onEditSlide({ revealMode: r.v })} className={cn("rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] font-semibold", (slide?.revealMode ?? "progressive") === r.v ? "border-brand-500 bg-brand-500/10 text-brand-200" : "border-border hover:border-brand-500")}>{r.label}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-300"><Hand className="h-3.5 w-3.5" /> The hand</div>
                <button onClick={() => setHand({ showHand: hand.showHand === false })} className="mb-2.5 flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-2 text-[11.5px] font-semibold hover:border-brand-500">
                  <span className="inline-flex items-center gap-1.5">{hand.showHand === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} Show the drawing hand</span>
                  <span className={cn("inline-flex h-4 w-7 items-center rounded-full px-0.5 transition", hand.showHand === false ? "bg-white/15" : "bg-brand-500")}><span className={cn("h-3 w-3 rounded-full bg-white transition", hand.showHand === false ? "translate-x-0" : "translate-x-3")} /></span>
                </button>
                <div className="mb-1 text-[10.5px] font-bold text-muted-foreground">Ink colour</div>
                <div className="flex flex-wrap gap-1.5">
                  {INKS.map((k) => {
                    const on = (hand.color ?? "#0e7db8") === k.c;
                    return (
                      <button key={k.c} onClick={() => setHand({ color: k.c })} title={k.label} className={cn("h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[#0b0b10]", on ? "ring-brand-400" : "ring-transparent hover:ring-white/30")} style={{ background: k.c === "brand" ? "linear-gradient(135deg,var(--sa),var(--sa2))" : k.c }} />
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
