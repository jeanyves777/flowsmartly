"use client";

/**
 * Renders one deck slide — the SAME component backs the builder stage and the live
 * room's Slides stage. A document slide is a title + talking points + a visual; a
 * whiteboard / live-draw slide is an endless horizontal teaching canvas: the diagram
 * marches left→right and the view pans across it as the reveal advances, so a long
 * process reads like a board the presenter fills in while they talk. Live-draw goes
 * one element at a time and the current mark visibly draws itself on. [[training-studio]]
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils/cn";
import type { BoardItem, DeckSlide, VisualStyle, HandStyleSettings } from "@/lib/training/types";

type AnnStyle = NonNullable<DeckSlide["annotate"]>;
/** The circle / underline path (in host pixels) around a measured phrase box. */
function annPath(m: { x: number; y: number; w: number; h: number }, style: AnnStyle): string {
  const cx = m.x + m.w / 2, cy = m.y + m.h / 2, rx = m.w / 2 + m.h * 0.55, ry = m.h / 2 + m.h * 0.5;
  if (style === "underline") return `M ${m.x - m.h * 0.25} ${m.y + m.h + m.h * 0.22} Q ${cx} ${m.y + m.h + m.h * 0.55} ${m.x + m.w + m.h * 0.25} ${m.y + m.h + m.h * 0.14}`;
  // a line struck through the middle (myth/wrong/"not this") — slightly bowed so it reads hand-drawn
  if (style === "strike") return `M ${m.x - m.h * 0.3} ${cy + m.h * 0.06} Q ${cx} ${cy - m.h * 0.14} ${m.x + m.w + m.h * 0.3} ${cy + m.h * 0.02}`;
  // a hand-drawn box around the phrase (one continuous clockwise stroke, small overshoot)
  if (style === "box") {
    const p = m.h * 0.4, l = m.x - p, r = m.x + m.w + p, t = m.y - p, b = m.y + m.h + p;
    return `M ${l} ${t} L ${r} ${t} L ${r} ${b} L ${l} ${b} L ${l} ${t - m.h * 0.06}`;
  }
  // a checkmark drawn just to the right of the phrase (approval / "yes, this")
  if (style === "check") {
    const g = m.h * 0.45, s = m.h * 1.15, sx = m.x + m.w + g;
    return `M ${sx} ${cy + m.h * 0.05} L ${sx + s * 0.36} ${m.y + m.h * 0.98} L ${sx + s} ${m.y - m.h * 0.32}`;
  }
  // an arrow drawn pointing UP at the phrase from just below its centre
  if (style === "arrow") {
    const tipY = m.y + m.h + m.h * 0.22, tailY = m.y + m.h + m.h * 1.5, hw = m.h * 0.5, hh = m.h * 0.5;
    return `M ${cx} ${tailY} L ${cx} ${tipY} M ${cx} ${tipY} L ${cx - hw} ${tipY + hh} M ${cx} ${tipY} L ${cx + hw} ${tipY + hh}`;
  }
  // square brackets framing the phrase left and right  [ … ]
  if (style === "bracket") {
    const p = m.h * 0.35, l = m.x - p, r = m.x + m.w + p, t = m.y - p * 0.7, b = m.y + m.h + p * 0.7, q = m.h * 0.32;
    return `M ${l + q} ${t} L ${l} ${t} L ${l} ${b} L ${l + q} ${b} M ${r - q} ${t} L ${r} ${t} L ${r} ${b} L ${r - q} ${b}`;
  }
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy}`;
}

/** Overlay that measures the slide's highlighted phrase ([data-hl]) and has the photoreal hand
 *  CIRCLE / UNDERLINE / POINT AT it (or leaves the CSS marker for "highlight"), when `active`. */
type PenTool = "pen" | "pencil" | "marker" | "highlighter";
const TOOL_CFG: Record<PenTool, { mul: number; op: number; cap: "round" | "butt" }> = {
  pen: { mul: 0.8, op: 1, cap: "round" },
  pencil: { mul: 0.6, op: 0.85, cap: "round" },
  marker: { mul: 1, op: 1, cap: "round" },
  highlighter: { mul: 3.1, op: 0.34, cap: "butt" },
};
function HandAnnotate({ hostRef, active, style, ink, showHand, tool, widthMul }: { hostRef: RefObject<HTMLDivElement | null>; active: boolean; style: AnnStyle; ink?: string; showHand?: boolean; tool?: PenTool; widthMul?: number }) {
  const [m, setM] = useState<{ W: number; H: number; x: number; y: number; w: number; h: number } | null>(null);
  const imgRef = useRef<SVGImageElement | null>(null);
  useLayoutEffect(() => {
    if (!active) { setM(null); return; }
    const host = hostRef.current; if (!host) return;
    const measure = () => {
      const el = host.querySelector<HTMLElement>("[data-hl]"); if (!el) { setM(null); return; }
      const c = host.getBoundingClientRect(), s = el.getBoundingClientRect();
      if (!c.width || !s.width) return;
      setM({ W: c.width, H: c.height, x: s.left - c.left, y: s.top - c.top, w: s.width, h: s.height });
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(host);
    const t = setTimeout(measure, 90);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [active, hostRef, style]);
  // hand draws the circle/underline (nib pinned to the stroke each frame)
  useEffect(() => {
    if (!m || style === "highlight" || style === "point") return;
    const img = imgRef.current, svg = img?.ownerSVGElement; if (!img || !svg) return;
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", annPath(m, style)); p.setAttribute("visibility", "hidden"); svg.appendChild(p);
    let len = 0; try { len = p.getTotalLength(); } catch { len = 0; }
    if (!len) { p.remove(); return; }
    const hw = Math.max(120, m.h * 8.5), hh = hw * 0.667, nx = hw * 0.1335, ny = hh * 0.082;
    img.setAttribute("width", String(hw)); img.setAttribute("height", String(hh));
    let raf = 0, t0: number | null = null; const DUR = 850;
    const frame = (ts: number) => {
      if (t0 === null) t0 = ts; const k = Math.min(1, (ts - t0) / DUR);
      const pt = p.getPointAtLength(len * k);
      img.setAttribute("x", String(pt.x - nx)); img.setAttribute("y", String(pt.y - ny));
      img.style.opacity = k < 0.85 ? "1" : String(Math.max(0, (1 - k) / 0.15));
      if (k < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); p.remove(); };
  }, [m, style]);

  if (!active || !m || style === "highlight") return null;
  // A modest pointing hand that comes in from the LEFT edge of the phrase (fingertip at 20.51%/6.74%
  // of the PNG) — sized to the phrase, not the slide, and capped so it never blankets the content.
  const hw = Math.min(m.W * 0.19, Math.max(72, m.h * 3.6)), hh = hw * 0.667;
  return (
    <svg viewBox={`0 0 ${m.W} ${m.H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-[6] h-full w-full">
      <style>{`@keyframes an-draw{to{stroke-dashoffset:0}}@keyframes an-point{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}`}</style>
      {style === "point" ? (
        <image href="/training/point-hand.png" width={hw} height={hh} x={m.x - m.h * 0.35 - hw * 0.2051} y={m.y + m.h * 0.5 - hh * 0.0674} style={{ animation: "an-point .5s ease forwards", filter: "drop-shadow(0 8px 12px rgba(0,0,0,.28))" } as CSSProperties} />
      ) : (
        <>
          <path d={annPath(m, style)} pathLength={1} fill="none" stroke={ink || "#0e7db8"} strokeWidth={Math.max(2, m.h * 0.16 * (widthMul ?? 1) * TOOL_CFG[tool ?? "marker"].mul)} strokeLinecap={TOOL_CFG[tool ?? "marker"].cap} strokeLinejoin="round" style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "an-draw .85s ease forwards", opacity: TOOL_CFG[tool ?? "marker"].op } as CSSProperties} />
          {showHand !== false ? <image ref={imgRef} href="/training/draw-hand.png" x={-4000} y={-4000} style={{ filter: "drop-shadow(0 8px 12px rgba(0,0,0,.28))" } as CSSProperties} /> : null}
        </>
      )}
    </svg>
  );
}

// The hand PNG is 392×261 viewBox units; the marker's ink NIB sits at 13.35%/8.2% of it
// (measured). We pin THAT exact point to the current point on the stroke each frame so the pen
// end rides ON the line, then fade the hand out at the end. Deterministic — no offset-anchor.
const HAND_W = 392, HAND_H = 261, NIB_X = HAND_W * 0.1335, NIB_Y = HAND_H * 0.082;

/** A PHOTOREAL hand + blue marker that DRAWS along `d`: its pen nib travels the stroke as it's
 *  drawn (getPointAtLength per frame), the hand + forearm trailing up from the bottom-right. */
function DrawingHand({ d }: { d: string }) {
  const ref = useRef<SVGImageElement | null>(null);
  useEffect(() => {
    const img = ref.current, svg = img?.ownerSVGElement;
    if (!img || !svg) return;
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d); p.setAttribute("visibility", "hidden"); svg.appendChild(p);
    let len = 0; try { len = p.getTotalLength(); } catch { len = 0; }
    if (!len) { p.remove(); return; }
    const DUR = 700; let raf = 0, t0: number | null = null;
    const frame = (ts: number) => {
      if (t0 === null) t0 = ts;
      const k = Math.min(1, (ts - t0) / DUR);
      const pt = p.getPointAtLength(len * k);
      img.setAttribute("x", String(pt.x - NIB_X));
      img.setAttribute("y", String(pt.y - NIB_Y));
      img.style.opacity = k < 0.9 ? "1" : String(Math.max(0, (1 - k) / 0.1));
      if (k < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); p.remove(); };
  }, [d]);
  return <image ref={ref} href="/training/draw-hand.png" width={HAND_W} height={HAND_H} x={-2000} y={-2000} style={{ filter: "drop-shadow(0 10px 14px rgba(0,0,0,.28))" }} />;
}

/** Strip markdown at render so decks built before the generator was fixed don't show
 *  literal `**bold**` / `_italics_` / list markers on the slide. */
const md = (s: string | undefined | null): string =>
  (s ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|\s)\*(\S.*?\S|\S)\*(?=\s|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/#+\s*/g, "");

// ── Visual-style presets ────────────────────────────────────────────────────
// Every renderer used to hardcode the same purple-dark ground / accent / font, so
// `visualStyle` never changed the look. Each preset now drives the shared CSS vars
// (--sbg1/2 ground, --sa/sa2 accent gradient, --sat accent text) + a heading font,
// set on a display:contents themer that wraps the slide so the vars + font inherit
// into every branch below. Most grounds are dark-with-light-text; three (minimal /
// editorial / elegant) are LIGHT — `fg` is the foreground as an "R G B" triplet so the
// doc renderers flip their text/panels (--sfg) while accents stay saturated. Branded
// interstitials (intro/quiz/qa/question_answer) and the hero/full-visual overlays keep
// their own dark treatment on every style. They differ by hue, accent and typeface.
type StylePreset = { bg1: string; bg2: string; sa: string; sa2: string; sat: string; font: string; fg?: string };
const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const SERIF = 'Georgia,"Times New Roman",serif';
const LIGHT = "24 24 27"; // near-black foreground for light grounds
const STYLE_PRESETS: Record<string, StylePreset> = {
  modern_professional: { bg1: "#14121f", bg2: "#1c1830", sa: "#7c5cff", sa2: "#a855f7", sat: "#c4b5fd", font: SANS },
  cinematic:           { bg1: "#1c1210", bg2: "#241413", sa: "#ff8a3d", sa2: "#ff5a5f", sat: "#ffcf9e", font: SERIF },
  "3d_technology":     { bg1: "#0c1830", bg2: "#0a1424", sa: "#38bdf8", sa2: "#6366f1", sat: "#7dd3fc", font: SANS },
  whiteboard_teacher:  { bg1: "#12241c", bg2: "#0c1a14", sa: "#fbbf24", sa2: "#fca5a5", sat: "#fde68a", font: '"Segoe Print","Comic Sans MS",cursive' },
  editorial:           { bg1: "#f6f1e7", bg2: "#efe6d4", sa: "#b45309", sa2: "#92400e", sat: "#9a3412", font: SERIF, fg: "28 22 14" },
  minimal:             { bg1: "#f7f7f8", bg2: "#ececed", sa: "#475569", sa2: "#64748b", sat: "#334155", font: SANS, fg: LIGHT },
  bold_startup:        { bg1: "#1e0f2e", bg2: "#2a0f3a", sa: "#f43f5e", sa2: "#fb923c", sat: "#fda4af", font: SANS },
  data_driven:         { bg1: "#0f1a24", bg2: "#0b1520", sa: "#14b8a6", sa2: "#22d3ee", sat: "#5eead4", font: SANS },
  storytelling:        { bg1: "#1f1430", bg2: "#160e22", sa: "#c084fc", sa2: "#f0abfc", sat: "#e9d5ff", font: SERIF },
  workshop:            { bg1: "#1c1a17", bg2: "#12100e", sa: "#fbbf24", sa2: "#84cc16", sat: "#fde68a", font: SANS },
  elegant:             { bg1: "#f4f1ea", bg2: "#e9e3d5", sa: "#8a6d34", sa2: "#6b5424", sat: "#6b5424", font: '"Didot","Playfair Display",Georgia,serif', fg: "26 22 16" },
  playful_learning:    { bg1: "#26123a", bg2: "#3a0f2e", sa: "#a855f7", sa2: "#ec4899", sat: "#f5d0fe", font: '"Trebuchet MS","Segoe UI",sans-serif' },
  dark_technology:     { bg1: "#0a0e14", bg2: "#06080d", sa: "#22c55e", sa2: "#10b981", sat: "#86efac", font: '"Cascadia Code","SF Mono",ui-monospace,monospace' },
  brand_first:         { bg1: "#14121f", bg2: "#1c1830", sa: "#7c5cff", sa2: "#a855f7", sat: "#c4b5fd", font: SANS },
};
function styleVars(key?: VisualStyle | null): CSSProperties {
  const p = (key && STYLE_PRESETS[key]) || STYLE_PRESETS.modern_professional;
  return { "--sbg1": p.bg1, "--sbg2": p.bg2, "--sa": p.sa, "--sa2": p.sa2, "--sat": p.sat, "--sfg": p.fg ?? "255 255 255", fontFamily: p.font } as CSSProperties;
}

// ── Whiteboard surfaces ──────────────────────────────────────────────────────
// The board used to be one fixed cream sheet with dark ink baked into every item. Now the
// board SURFACE (ground, grid, ink, node fill/stroke, sticky, title font) is themed and the
// DiagramBoard re-inks every mark to match — so a chalkboard reads in chalk, a blueprint in
// cyan on navy, etc. The archetype is chosen from the deck's visual style.
export type BoardTheme = { base: string; bgImage?: string; bgSize?: string; ink: string; nodeFill: string; nodeStroke: string; title: string; font: string; sticky: string; stickyText: string };
const BOARD_ARCHETYPES: Record<string, BoardTheme> = {
  classic: { base: "#f7f7f2", bgImage: "radial-gradient(circle at 1px 1px,#dad9d0 1px,transparent 0)", bgSize: "22px 22px", ink: "#243244", nodeFill: "#ffffff", nodeStroke: "#334155", title: "#1a1a1a", font: '"Segoe Print","Comic Sans MS",cursive', sticky: "#fde68a", stickyText: "#3f3300" },
  chalkboard: { base: "#0f251d", bgImage: "linear-gradient(0deg,rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(160deg,#16352a,#0e231b)", bgSize: "46px 46px,46px 46px,cover", ink: "#eef3ec", nodeFill: "rgba(255,255,255,.05)", nodeStroke: "#eef3ec", title: "#fdf3d6", font: '"Segoe Print","Comic Sans MS",cursive', sticky: "#e7c14b", stickyText: "#3a2c00" },
  blueprint: { base: "#08203c", bgImage: "linear-gradient(0deg,rgba(125,211,252,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(125,211,252,.14) 1px,transparent 1px),linear-gradient(160deg,#0c2a4a,#071c34)", bgSize: "40px 40px,40px 40px,cover", ink: "#d6ecff", nodeFill: "rgba(125,211,252,.07)", nodeStroke: "#7dd3fc", title: "#dff0ff", font: '"Cascadia Code","SF Mono",ui-monospace,monospace', sticky: "#14507e", stickyText: "#e6f4ff" },
  glass: { base: "#0d0b15", bgImage: "radial-gradient(circle at 1px 1px,rgba(255,255,255,.07) 1px,transparent 0),linear-gradient(160deg,#16131f,#0c0a13)", bgSize: "26px 26px,cover", ink: "#ece9f7", nodeFill: "rgba(255,255,255,.05)", nodeStroke: "#a78bfa", title: "#f2effb", font: 'system-ui,-apple-system,"Segoe UI",sans-serif', sticky: "#2a2440", stickyText: "#e9e5f8" },
  notebook: { base: "#faf6ec", bgImage: "repeating-linear-gradient(0deg,transparent,transparent 33px,rgba(80,110,170,.16) 33px,rgba(80,110,170,.16) 34px)", bgSize: "auto", ink: "#2b2b33", nodeFill: "#fffdf5", nodeStroke: "#3b3b45", title: "#22303a", font: 'Georgia,"Times New Roman",serif', sticky: "#ffe6a1", stickyText: "#4a3a00" },
};
const BOARD_BY_STYLE: Record<string, keyof typeof BOARD_ARCHETYPES> = {
  modern_professional: "classic", brand_first: "classic", minimal: "classic", playful_learning: "classic",
  whiteboard_teacher: "chalkboard",
  "3d_technology": "blueprint", dark_technology: "blueprint", data_driven: "blueprint",
  cinematic: "glass", bold_startup: "glass", storytelling: "glass",
  editorial: "notebook", elegant: "notebook", workshop: "notebook",
};
export function boardTheme(key?: VisualStyle | null): BoardTheme {
  return BOARD_ARCHETYPES[BOARD_BY_STYLE[key ?? ""] ?? "classic"];
}

export function DeckSlideView({ slide, reveal, className, styleKey, hand }: { slide: DeckSlide; reveal?: number; className?: string; styleKey?: VisualStyle | null; hand?: HandStyleSettings | null }) {
  // `reveal` = how many steps are shown (undefined = show everything, e.g. a builder
  // thumbnail). Drives the progressive "drawing as you talk" reveal.
  const hostRef = useRef<HTMLDivElement | null>(null); // slide container, so the hand can circle a keyword

  // The whole slide is wrapped in a display:contents themer (below) that sets the visual-style
  // CSS vars + heading font — they inherit into every branch, so one style pick re-skins the deck.
  const body: ReactNode = (() => {
  // The opening slide — the AI co-host takes the stage to introduce itself. On the live
  // stage the moving avatar replaces this; here (builder / no avatar) it's a warm welcome.
  if (slide.intro) {
    return (
      <div className={cn("relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br from-[#241f38] via-[#191627] to-[#0f0d17] [container-type:inline-size]", className)}>
        <div className="flex flex-col items-center px-[8%] text-center">
          <div className="mb-[3cqw] grid h-[14cqw] w-[14cqw] place-items-center rounded-full bg-gradient-to-br from-cyan-400/25 to-brand-500/25 ring-2 ring-brand-400/40"><span className="text-[7cqw]">👋</span></div>
          <h1 className="text-[clamp(11px,5.6cqw,56px)] font-extrabold leading-tight tracking-tight text-white">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-[1.5cqw] text-[clamp(6px,2.4cqw,22px)] font-semibold text-[color:var(--sat)]">{md(slide.subtitle)}</p> : null}
          <span className="mt-[3cqw] inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-cyan-400 to-brand-500 px-[2.5cqw] py-[1.1cqw] text-[clamp(4px,1.5cqw,12px)] font-black text-[#04222a]">● AI CO-HOST</span>
        </div>
      </div>
    );
  }

  // An on-screen quiz — the question + lettered options; the correct one lights up green
  // (with an explanation) once the host reveals it (reveal step 2).
  if (slide.quiz) {
    const q = slide.quiz;
    const revealed = reveal === undefined || reveal >= 2;
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[#1b2540] via-[#161a2c] to-[#100e18] px-[7%] py-[6%] [container-type:inline-size]", className)}>
        <div className="mb-[2cqw] inline-flex items-center gap-2 self-start rounded-full bg-brand-500/20 px-[2.2cqw] py-[1cqw] text-[clamp(5px,1.7cqw,15px)] font-black uppercase tracking-wide text-[color:var(--sat)]">💡 Quick check</div>
        <h1 className="text-[clamp(9px,3.4cqw,34px)] font-extrabold leading-tight text-white">{md(q.question)}</h1>
        {/* ALWAYS 2 columns — this is a 16:9 (landscape) container, so a viewport `sm:`
            breakpoint was wrong: on a phone it stacked 4 options into ONE tall column that
            overflowed the 16:9 box (clipped top+bottom). 2 columns always fit. */}
        <div className="mt-[3cqw] grid grid-cols-2 gap-[1.6cqw]">
          {q.options.map((o, k) => {
            const correct = revealed && k === q.answerIndex;
            return (
              <div key={k} className={cn("flex items-center gap-[1.8cqw] rounded-[1.4cqw] border-2 px-[2.4cqw] py-[1.8cqw] text-[clamp(6px,2cqw,18px)] font-semibold transition",
                correct ? "border-emerald-400 bg-emerald-400/15 text-white" : "border-white/12 bg-white/[0.04] text-white/85")}>
                <span className={cn("grid h-[3.4cqw] w-[3.4cqw] shrink-0 place-items-center rounded-full text-[clamp(5px,1.8cqw,16px)] font-black",
                  correct ? "bg-emerald-400 text-emerald-950" : "bg-white/10 text-white/70")}>{correct ? "✓" : String.fromCharCode(65 + k)}</span>
                <span className="min-w-0">{md(o)}</span>
              </div>
            );
          })}
        </div>
        {revealed && q.explanation ? (
          <p className="mt-[2.6cqw] rounded-[1.2cqw] border border-emerald-400/25 bg-emerald-400/[0.08] px-[2.4cqw] py-[1.6cqw] text-[clamp(5px,1.8cqw,16px)] font-medium text-emerald-100">{md(q.explanation)}</p>
        ) : !revealed ? (
          <p className="mt-[2.6cqw] text-[clamp(5px,1.7cqw,15px)] font-semibold text-[color:var(--sat)]/90">Raise your hand ✋ with your answer — the host reveals it next.</p>
        ) : null}
      </div>
    );
  }

  // A "pause for questions" moment — a calm, centred prompt so the room knows it's time
  // to ask. The presenter pauses here; the host or the AI answers, then continues.
  if (slide.qa) {
    return (
      <div className={cn("relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br from-[#241f38] via-[#1a1726] to-[#100e18] [container-type:inline-size]", className)}>
        <div className="flex flex-col items-center px-[8%] text-center">
          <div className="mb-[3cqw] grid h-[13cqw] w-[13cqw] place-items-center rounded-full bg-gradient-to-br from-cyan-400/25 to-brand-500/25 ring-2 ring-brand-400/40">
            <span className="text-[7cqw]">💬</span>
          </div>
          <h1 className="text-[clamp(10px,5.2cqw,52px)] font-extrabold leading-tight tracking-tight text-white">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-[1.5cqw] text-[clamp(6px,2.4cqw,22px)] font-semibold text-[color:var(--sat)]">{md(slide.subtitle)}</p> : null}
          <p className="mt-[3cqw] inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-[2.5cqw] py-[1.2cqw] text-[clamp(5px,1.9cqw,16px)] font-semibold text-white/80">Raise your hand ✋ or use “Ask the presenter”</p>
        </div>
      </div>
    );
  }

  // Whiteboard & Live Draw share one renderer — a wide horizontal canvas that pans
  // to follow the reveal. Live Draw additionally animates the CURRENT element on.
  if (slide.type === "whiteboard" || slide.type === "livedraw") {
    const bt = boardTheme(styleKey ?? slide.visualStyle);
    return (
      <div
        className={cn("relative h-full w-full overflow-hidden [container-type:inline-size]", className)}
        style={{ backgroundColor: bt.base, backgroundImage: bt.bgImage, backgroundSize: bt.bgSize } as CSSProperties}
      >
        <div className="absolute left-[6%] top-[5%] z-[3] text-[clamp(8px,3.6cqw,32px)] font-extrabold" style={{ color: bt.title, fontFamily: bt.font }}>{md(slide.title)}</div>
        <DiagramBoard items={slide.board ?? []} reveal={reveal} wide={slide.wide} animated={slide.type === "livedraw"} theme={bt} />
      </div>
    );
  }

  const v = slide.visual;
  const left = v?.layout === "left";
  const full = v?.layout === "full";
  // Illustrations / diagrams carry meaning at their edges (arrows, labels), so they must FIT
  // inside their box (contain) — cropping them (cover) cuts off content. Photos still fill.
  const containImg = v?.style === "illustration" || /illustration|diagram|chart|infographic|graph|figure|flow|dashboard|screenshot|schematic|interface|ui|map/i.test(v?.tag ?? "");
  const hasImg = v?.kind === "image" && !!v.url;
  const bullets = slide.bullets ?? [];
  const shownB = reveal === undefined ? bullets : bullets.slice(0, reveal);
  const lay = slide.layout;

  // Hand annotation on a keyword: wrap the highlight phrase in a <span data-hl>, and the hand
  // marks it AS its line appears (not after everything) — so it engages intelligently, in step
  // with the narration. `T()` wraps the FIRST occurrence across the slide (title → subtitle →
  // bullets); `ann` is the overlay element (place it in a relative root).
  const hlPhrase = (slide.highlight || "").trim();
  const annStyle: AnnStyle = slide.annotate ?? "circle";
  // the reveal step at which the marked phrase first appears on screen (so we mark it then, not last)
  const hlLower = hlPhrase.toLowerCase();
  const hlInHead = !!hlPhrase && [slide.title, slide.subtitle].some((s) => md(s).toLowerCase().includes(hlLower));
  const hlBulletIdx = hlPhrase ? bullets.findIndex((b) => md(b).toLowerCase().includes(hlLower)) : -1;
  const hlReveal = hlInHead ? 1 : hlBulletIdx >= 0 ? hlBulletIdx + 1 : bullets.length;
  const annActive = reveal !== undefined && !!hlPhrase && reveal >= hlReveal;
  let hlUsed = false;
  const T = (text: string | undefined | null) => {
    const t = md(text);
    if (!hlPhrase || hlUsed || !t) return t;
    const i = t.toLowerCase().indexOf(hlPhrase.toLowerCase());
    if (i < 0) return t;
    hlUsed = true;
    const on = annStyle === "highlight";
    return <>{t.slice(0, i)}<span data-hl className={on ? "rounded-[.15em] bg-cyan-300/40 box-decoration-clone px-[.12em] text-[rgb(var(--sfg))]" : undefined}>{t.slice(i, i + hlPhrase.length)}</span>{t.slice(i + hlPhrase.length)}</>;
  };
  const inkColor = hand?.color === "brand" ? "var(--sa)" : hand?.color;
  const ann = hlPhrase ? <HandAnnotate hostRef={hostRef} active={annActive} style={annStyle} ink={inkColor} showHand={hand?.showHand} tool={hand?.tool} widthMul={hand?.strokeWidth} /> : null;

  // A DEMONSTRATION VIDEO slide — a short generated moving illustration beside the teaching text.
  if (slide.videoUrl || (slide.visualType === "video" && slide.videoPrompt)) {
    return (
      <div className={cn("relative grid h-full w-full grid-cols-[.92fr_1.08fr] items-center gap-[4%] overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[6%] py-[6%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="text-[clamp(11px,3.8cqw,38px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,2cqw,18px)] font-semibold text-[color:var(--sat)]">{md(slide.subtitle)}</p> : null}
          {shownB.length ? (
            <ul className="mt-[2.5cqw] flex flex-col gap-[1.4cqw]">
              {shownB.map((b, i) => <li key={i} className="flex gap-[1.6cqw] text-[clamp(6px,1.9cqw,17px)] leading-snug text-[rgb(var(--sfg)/.85)]"><span className="mt-[.9cqw] h-[1cqw] w-[1cqw] shrink-0 rounded-full bg-[var(--sa2)]" />{md(b)}</li>)}
            </ul>
          ) : null}
        </div>
        <div className="relative aspect-video overflow-hidden rounded-[1.4cqw] bg-black ring-1 ring-[rgb(var(--sfg)/.10)] shadow-2xl">
          {slide.videoUrl ? (
            <video src={slide.videoUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#241f38] to-[#14121f] text-center">
              <div className="px-[8%]">
                <div className="mx-auto mb-[2cqw] grid h-[8cqw] w-[8cqw] place-items-center rounded-full bg-brand-500/15 text-[4cqw] text-[color:var(--sat)]">▶</div>
                <div className="text-[clamp(6px,1.9cqw,16px)] font-bold text-white/85">Demonstration video</div>
                <div className="mt-[.6cqw] text-[clamp(5px,1.5cqw,13px)] text-muted-foreground">Generate it in the Build Studio</div>
              </div>
            </div>
          )}
          <span className="absolute bottom-[1.2cqw] left-[1.2cqw] inline-flex items-center gap-1 rounded-md bg-black/55 px-[1.6cqw] py-[.7cqw] text-[clamp(5px,1.4cqw,12px)] font-black text-white backdrop-blur">▶ Demonstration</span>
        </div>
      </div>
    );
  }

  // ---- content-aware LAYOUTS (only for decks that carry slide.layout; others fall through
  // to the classic title + points + side-visual). One idea per slide, composed by purpose. ----

  // A big centred statement: hero / section divider / quote / one big idea / closing.
  if (lay === "hero_statement" || lay === "section_divider" || lay === "quote" || lay === "big_idea" || lay === "closing") {
    const isQuote = lay === "quote", isDivider = lay === "section_divider", isClosing = lay === "closing";
    return (
      <div className={cn("relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] text-white [container-type:inline-size]", className)}>
        {hasImg ? <img src={v!.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/55" />
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <div className="relative z-[3] max-w-[88%] px-[7%] text-center">
          {isDivider ? <div className="mb-[2cqw] text-[clamp(6px,2cqw,18px)] font-black uppercase tracking-[.22em] text-[color:var(--sat)]">Section</div> : null}
          {isClosing ? <div className="mb-[2cqw] inline-flex items-center gap-1.5 rounded-full border border-[rgb(255_255_255/0.18)] px-[2.4cqw] py-[1cqw] text-[clamp(5px,1.7cqw,15px)] font-black uppercase tracking-[.18em] text-[color:var(--sat)]">✦ Wrap-up</div> : null}
          {isQuote ? <div className="mb-[-3cqw] select-none text-[16cqw] font-black leading-none text-brand-500/45">&ldquo;</div> : null}
          <h1 style={{ textWrap: "balance" }} className={cn("font-extrabold leading-[1.05] tracking-tight", isQuote ? "text-[clamp(12px,4.8cqw,48px)] italic" : "text-[clamp(14px,6.4cqw,66px)]")}>{md(slide.title)}</h1>
          {slide.subtitle ? <p style={{ textWrap: "balance" }} className="mx-auto mt-[2cqw] max-w-[46ch] text-[clamp(7px,2.6cqw,24px)] font-semibold text-brand-200/90">{md(slide.subtitle)}</p> : null}
          {isClosing && bullets.length ? (
            <div className="mt-[3cqw] flex flex-wrap items-center justify-center gap-[1.4cqw]">
              {shownB.slice(0, 3).map((b, i) => <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(255_255_255/0.08)] px-[2.4cqw] py-[1.1cqw] text-[clamp(5px,1.7cqw,15px)] font-semibold text-white/90">{md(b)}</span>)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Data spotlight — one big number pulled from the content, with a short interpretation.
  const statMatch = (slide.subtitle && slide.subtitle.match(/\$?\d[\d.,]*\s?(%|x|k|m|bn?|billion|million)?/i))
    || bullets.map((b) => b.match(/\$?\d[\d.,]*\s?(%|x|k|m|bn?|billion|million)?/i)).find(Boolean);
  if ((lay === "data_spotlight" || lay === "dashboard_insight") && statMatch) {
    const stat = statMatch[0].trim();
    const caption = (slide.subtitle && !slide.subtitle.startsWith(stat) ? slide.subtitle : bullets[0]) || slide.title;
    return (
      <div className={cn("relative grid h-full w-full grid-cols-[1.1fr_.9fr] items-center overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[7%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <div>
          <div className="bg-gradient-to-br from-[var(--sat)] to-[var(--sa2)] bg-clip-text text-[clamp(28px,16cqw,150px)] font-black leading-[.9] tracking-tight text-transparent">{stat}</div>
          <h1 className="mt-[1cqw] text-[clamp(10px,3.2cqw,30px)] font-extrabold leading-tight">{md(slide.title)}</h1>
        </div>
        <p style={{ textWrap: "balance" }} className="border-l-2 border-brand-500/40 pl-[4%] text-[clamp(7px,2.3cqw,20px)] font-medium text-[rgb(var(--sfg)/.80)]">{md(caption)}</p>
      </div>
    );
  }

  // Key takeaways / action plan / recap / concept map / dashboard — the points AS cards, not a bullet list.
  if ((lay === "key_takeaways" || lay === "action_plan" || lay === "recap_map" || lay === "concept_map" || lay === "dashboard_insight") && bullets.length) {
    const two = bullets.length > 3;
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[7%] py-[6%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <h1 className="text-[clamp(11px,4cqw,40px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
        {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,2cqw,18px)] font-semibold text-[color:var(--sat)]">{md(slide.subtitle)}</p> : null}
        <div className={cn("mt-[3cqw] grid gap-[1.6cqw]", two ? "grid-cols-2" : "grid-cols-1")}>
          {shownB.map((b, i) => (
            <div key={i} className="flex items-start gap-[1.8cqw] rounded-[1.4cqw] border border-[rgb(var(--sfg)/.10)] bg-[rgb(var(--sfg)/0.05)] px-[2.6cqw] py-[2cqw] duration-300 animate-in fade-in slide-in-from-bottom-2">
              <span className="grid h-[3.6cqw] w-[3.6cqw] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--sa)] to-[var(--sa2)] text-[clamp(6px,1.9cqw,17px)] font-black text-white">{lay === "action_plan" ? i + 1 : "✓"}</span>
              <span className="min-w-0 text-[clamp(6px,2cqw,18px)] font-medium leading-snug text-[rgb(var(--sfg)/.90)]">{md(b)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full-bleed cinematic visual with a caption over it.
  if (lay === "full_visual" && hasImg) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden bg-black [container-type:inline-size]", className)}>
        <img src={v!.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/25" />
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <div className="absolute inset-x-0 bottom-0 z-[3] px-[7%] pb-[6%] text-white">
          <h1 style={{ textWrap: "balance" }} className="max-w-[75%] text-[clamp(12px,4.8cqw,48px)] font-extrabold leading-tight">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-[1cqw] max-w-[62%] text-[clamp(7px,2.2cqw,20px)] font-semibold text-brand-200/90">{md(slide.subtitle)}</p> : null}
        </div>
      </div>
    );
  }

  // Two-column contrast — pros/cons, myth vs reality, comparison.
  if ((lay === "pros_cons" || lay === "myth_reality" || lay === "comparison_table" || lay === "before_after") && bullets.length >= 2) {
    const heads = lay === "pros_cons" ? ["Pros", "Cons"] : lay === "myth_reality" ? ["The myth", "The reality"] : ["Before", "After"];
    const half = Math.ceil(bullets.length / 2);
    const cols = [bullets.slice(0, half), bullets.slice(half)];
    const tones = ["border-emerald-400/30 from-emerald-500/[0.12]", "border-rose-400/30 from-rose-500/[0.1]"];
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[7%] py-[6%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <h1 className="text-[clamp(11px,3.8cqw,38px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
        {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,2cqw,18px)] font-semibold text-[color:var(--sat)]">{md(slide.subtitle)}</p> : null}
        <div className="mt-[3cqw] grid grid-cols-2 gap-[2cqw]">
          {cols.map((c, ci) => (
            <div key={ci} className={cn("rounded-[1.6cqw] border bg-gradient-to-b to-transparent p-[3.4%]", tones[ci])}>
              <div className="mb-[1.6cqw] text-[clamp(6px,2cqw,18px)] font-black uppercase tracking-wide text-[rgb(var(--sfg)/.85)]">{heads[ci]}</div>
              <ul className="flex flex-col gap-[1.4cqw]">
                {c.map((b, i) => <li key={i} className="flex gap-[1.4cqw] text-[clamp(6px,1.9cqw,17px)] leading-snug text-[rgb(var(--sfg)/.85)]"><span className="mt-[.9cqw] h-[1cqw] w-[1cqw] shrink-0 rounded-full bg-[rgb(var(--sfg)/.45)]" />{md(b)}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Problem → Solution → Result — three connected sections.
  if (lay === "problem_solution_result" && bullets.length >= 2) {
    const heads = ["Problem", "Solution", "Result"];
    const pick = [bullets[0], bullets[1], bullets[2] ?? slide.subtitle ?? ""];
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[7%] py-[6%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <h1 className="text-[clamp(11px,3.8cqw,38px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
        <div className="mt-[3cqw] grid grid-cols-3 gap-[1.6cqw]">
          {heads.map((h, i) => (
            <div key={i} className="relative rounded-[1.4cqw] border border-[rgb(var(--sfg)/.10)] bg-[rgb(var(--sfg)/0.05)] p-[3.4%]">
              <div className="mb-[1cqw] text-[clamp(5px,1.7cqw,15px)] font-black uppercase tracking-wide text-[color:var(--sat)]">{h}</div>
              <p className="text-[clamp(6px,1.9cqw,17px)] leading-snug text-[rgb(var(--sfg)/.85)]">{md(pick[i] || "")}</p>
              {i < 2 ? <span className="absolute -right-[1.1cqw] top-1/2 z-[2] -translate-y-1/2 text-[clamp(8px,2.4cqw,22px)] text-brand-400">→</span> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Numbered steps — a process, customer journey or timeline.
  if ((lay === "step_process" || lay === "customer_journey" || lay === "timeline" || lay === "vertical_journey" || lay === "workflow_diagram") && bullets.length >= 2) {
    const steps = shownB.slice(0, 5);
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[7%] py-[6%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <h1 className="text-[clamp(11px,3.8cqw,38px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
        {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,2cqw,18px)] font-semibold text-[color:var(--sat)]">{md(slide.subtitle)}</p> : null}
        <div className="mt-[3.5cqw] grid gap-[1.6cqw]" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
          {steps.map((b, i) => (
            <div key={i} className="relative flex flex-col rounded-[1.4cqw] border border-[rgb(var(--sfg)/.10)] bg-[rgb(var(--sfg)/0.05)] p-[3.2%] duration-300 animate-in fade-in slide-in-from-bottom-2">
              <span className="mb-[1.2cqw] grid h-[3.6cqw] w-[3.6cqw] place-items-center rounded-full bg-gradient-to-br from-[var(--sa)] to-[var(--sa2)] text-[clamp(6px,1.8cqw,16px)] font-black text-white">{i + 1}</span>
              <p className="text-[clamp(5px,1.7cqw,15px)] leading-snug text-[rgb(var(--sfg)/.85)]">{md(b)}</p>
              {i < steps.length - 1 ? <span className="absolute -right-[1cqw] top-[3.4cqw] z-[2] text-[clamp(7px,2cqw,18px)] text-brand-400">→</span> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // A leading question; the answer reveals progressively.
  if ((lay === "question_answer" || lay === "interactive_question") && (slide.subtitle || bullets.length)) {
    return (
      <div className={cn("relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br from-[#1b2540] via-[#161a2c] to-[#100e18] px-[7%] text-white [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <div className="max-w-[88%] text-center">
          <div className="mb-[1cqw] select-none text-[10cqw] font-black leading-none text-brand-500/40">?</div>
          <h1 style={{ textWrap: "balance" }} className="text-[clamp(12px,4.8cqw,46px)] font-extrabold leading-tight">{md(slide.title)}</h1>
          {shownB.length ? (
            <ul className="mx-auto mt-[3cqw] flex max-w-[80%] flex-col gap-[1.4cqw] text-left">
              {shownB.map((b, i) => <li key={i} className="flex gap-[1.6cqw] rounded-[1.2cqw] border border-white/10 bg-white/[0.05] px-[2.6cqw] py-[1.6cqw] text-[clamp(6px,1.9cqw,17px)] text-white/90 duration-300 animate-in fade-in slide-in-from-bottom-2"><span className="font-black text-[color:var(--sat)]">{String.fromCharCode(65 + i)}</span>{md(b)}</li>)}
            </ul>
          ) : slide.subtitle ? <p className="mt-[2cqw] text-[clamp(7px,2.4cqw,22px)] font-semibold text-brand-200/90">{md(slide.subtitle)}</p> : null}
        </div>
      </div>
    );
  }

  // Case study / real-world scenario — a visual beside a structured outcome.
  if ((lay === "case_study" || lay === "real_world_scenario" || lay === "role_play") && (hasImg || bullets.length >= 1)) {
    return (
      <div className={cn("relative grid h-full w-full grid-cols-[1fr_1fr] items-center gap-[4%] overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[6%] py-[6%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <div className="flex min-w-0 flex-col justify-center">
          <span className="mb-[1.5cqw] inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-500/15 px-[2.2cqw] py-[.9cqw] text-[clamp(5px,1.6cqw,14px)] font-black uppercase tracking-wide text-[color:var(--sat)]">{lay === "case_study" ? "Case study" : lay === "role_play" ? "Scenario" : "In the field"}</span>
          <h1 className="text-[clamp(11px,3.6cqw,34px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,1.9cqw,17px)] font-semibold text-[color:var(--sat)]">{md(slide.subtitle)}</p> : null}
          {shownB.length ? (
            <ul className="mt-[2.4cqw] flex flex-col gap-[1.4cqw]">
              {shownB.map((b, i) => <li key={i} className="flex gap-[1.6cqw] text-[clamp(6px,1.9cqw,17px)] leading-snug text-[rgb(var(--sfg)/.85)]"><span className="mt-[.9cqw] h-[1cqw] w-[1cqw] shrink-0 rounded-full bg-[var(--sa2)]" />{md(b)}</li>)}
            </ul>
          ) : null}
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.4cqw] bg-gradient-to-br from-[#2a2440] to-[#3a2f52] ring-1 ring-[rgb(var(--sfg)/.10)]">
          {hasImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v!.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : <span className="grid h-full w-full place-items-center text-[8cqw]">{v?.emoji ?? "🏢"}</span>}
        </div>
      </div>
    );
  }

  // Image + explanation — a big visual on one side, the teaching points on the other
  // (also annotated_photo / zoom_in). The image dominates; the hand can still mark a phrase.
  if ((lay === "image_explanation" || lay === "annotated_photo" || lay === "zoom_in") && hasImg) {
    const zoom = lay === "zoom_in";
    return (
      <div ref={hostRef} className={cn("relative grid h-full w-full grid-cols-[1.25fr_.85fr] items-stretch gap-[4%] overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[5%] py-[5%] text-[rgb(var(--sfg))] [container-type:inline-size]", left && "grid-cols-[.85fr_1.25fr]")}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <div className={cn("relative overflow-hidden rounded-[1.6cqw] bg-black ring-1 ring-[rgb(var(--sfg)/0.1)] shadow-2xl", left && "order-2")}>
          <img src={v!.url} alt="" className={cn("h-full w-full", containImg ? "object-contain p-[3%]" : zoom ? "scale-[1.35] object-cover" : "object-cover")} />
          {v?.tag ? <span className="absolute bottom-[1.2cqw] left-[1.2cqw] rounded-md bg-black/55 px-[1.6cqw] py-[.7cqw] text-[clamp(5px,1.4cqw,12px)] font-black backdrop-blur">{zoom ? "🔍 Detail" : v.tag}</span> : null}
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="text-[clamp(11px,3.6cqw,34px)] font-extrabold leading-tight tracking-tight">{T(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,1.9cqw,17px)] font-semibold text-[color:var(--sat)]">{T(slide.subtitle)}</p> : null}
          {shownB.length ? (
            <ul className="mt-[2.4cqw] flex flex-col gap-[1.4cqw]">
              {shownB.map((b, i) => <li key={i} className="flex gap-[1.6cqw] text-[clamp(6px,1.9cqw,17px)] leading-snug text-[rgb(var(--sfg)/.85)]"><span className="mt-[.9cqw] h-[1cqw] w-[1cqw] shrink-0 rounded-full bg-[var(--sa2)]" />{T(b)}</li>)}
            </ul>
          ) : null}
        </div>
        {ann}
      </div>
    );
  }

  // Layered explanation / system architecture — the points as STACKED horizontal bands,
  // reading top→bottom like layers of a system or an argument built up level by level.
  if ((lay === "layered_explanation" || lay === "system_architecture") && bullets.length >= 2) {
    const isArch = lay === "system_architecture";
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[7%] py-[6%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <h1 className="text-[clamp(11px,3.8cqw,38px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
        {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,2cqw,18px)] font-semibold text-[color:var(--sat)]">{md(slide.subtitle)}</p> : null}
        <div className="mt-[2.6cqw] flex flex-col gap-[1.2cqw]">
          {shownB.slice(0, 5).map((b, i) => {
            const op = 0.16 - i * 0.02;
            return (
              <div key={i} className="flex items-center gap-[2cqw] rounded-[1.2cqw] border border-[rgb(var(--sfg)/0.1)] px-[3%] py-[1.9cqw] duration-300 animate-in fade-in slide-in-from-left-2" style={{ background: `linear-gradient(90deg, rgb(255 255 255 / ${op}) 0%, transparent 85%)` } as CSSProperties}>
                <span className="grid h-[3.4cqw] w-[3.4cqw] shrink-0 place-items-center rounded-[.7cqw] bg-gradient-to-br from-[var(--sa)] to-[var(--sa2)] text-[clamp(6px,1.9cqw,17px)] font-black text-white">{isArch ? `L${shownB.length - i}` : i + 1}</span>
                <span className="min-w-0 text-[clamp(6px,2cqw,18px)] font-medium leading-snug text-[rgb(var(--sfg)/.90)]">{md(b)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Workshop — a hands-on activity: a clear prompt + the steps to do, framed as an exercise.
  if (lay === "workshop" && (slide.subtitle || bullets.length)) {
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[7%] py-[6%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <span className="mb-[1.6cqw] inline-flex w-fit items-center gap-1.5 rounded-full bg-[rgb(var(--sfg)/0.08)] px-[2.4cqw] py-[1cqw] text-[clamp(5px,1.7cqw,15px)] font-black uppercase tracking-wide text-[color:var(--sat)]">🛠 Your turn</span>
        <h1 className="text-[clamp(11px,4cqw,40px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
        {slide.subtitle ? <p className="mt-[1.2cqw] max-w-[52ch] text-[clamp(6px,2.2cqw,20px)] font-semibold text-[rgb(var(--sfg)/.85)]">{md(slide.subtitle)}</p> : null}
        {shownB.length ? (
          <ol className="mt-[2.6cqw] flex flex-col gap-[1.4cqw]">
            {shownB.map((b, i) => (
              <li key={i} className="flex items-start gap-[1.8cqw] text-[clamp(6px,2cqw,18px)] leading-snug text-[rgb(var(--sfg)/.90)] duration-300 animate-in fade-in slide-in-from-bottom-2">
                <span className="grid h-[3.2cqw] w-[3.2cqw] shrink-0 place-items-center rounded-full border-2 border-[var(--sa2)] text-[clamp(5px,1.7cqw,15px)] font-black text-[color:var(--sat)]">{i + 1}</span>
                <span className="min-w-0 pt-[.4cqw]">{md(b)}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    );
  }

  // A central 3D/photoreal visual with labeled callouts.
  if (lay === "concept_3d_callouts" && hasImg && bullets.length >= 1) {
    return (
      <div ref={hostRef} className={cn("relative grid h-full w-full grid-cols-[1.15fr_.85fr] items-center gap-[3%] overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[6%] py-[6%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <div className="relative h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v!.url} alt="" className={cn("absolute inset-0 h-full w-full", containImg ? "object-contain" : "object-cover rounded-[1.4cqw]")} />
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="text-[clamp(11px,3.6cqw,34px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
          <ul className="mt-[2.4cqw] flex flex-col gap-[1.4cqw]">
            {shownB.slice(0, 4).map((b, i) => (
              <li key={i} className="flex items-start gap-[1.6cqw] rounded-[1.2cqw] border border-[rgb(var(--sfg)/.10)] bg-[rgb(var(--sfg)/0.05)] px-[2.4cqw] py-[1.4cqw] text-[clamp(6px,1.8cqw,16px)] text-[rgb(var(--sfg)/.90)] duration-300 animate-in fade-in slide-in-from-right-2">
                <span className="grid h-[2.8cqw] w-[2.8cqw] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--sa)] to-[var(--sa2)] text-[clamp(5px,1.5cqw,13px)] font-black text-white">{i + 1}</span>
                {T(b)}
              </li>
            ))}
          </ul>
        </div>
        {ann}
      </div>
    );
  }

  // An ILLUSTRATION / DIAGRAM / DASHBOARD dominates the slide (big + full-width) instead of
  // sitting tiny in a side panel — a wide diagram is unreadable when boxed into a portrait.
  if (hasImg && containImg && !full) {
    return (
      <div className={cn("relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] px-[5%] py-[4.5%] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
        <div className="flex min-w-0 items-baseline gap-[2.5cqw]">
          <h1 className="text-[clamp(10px,3.2cqw,30px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="min-w-0 flex-1 truncate text-[clamp(6px,1.8cqw,16px)] font-semibold text-[color:var(--sat)]">{md(slide.subtitle)}</p> : null}
        </div>
        <div className="relative mt-[1.8cqw] min-h-0 flex-1 overflow-hidden rounded-[1.4cqw] bg-[rgb(var(--sfg)/0.04)] ring-1 ring-[rgb(var(--sfg)/.10)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v!.url} alt="" className="absolute inset-0 h-full w-full object-contain p-[1.6%]" />
          {v?.tag ? <span className="absolute bottom-[1.2cqw] left-[1.2cqw] rounded-md bg-black/55 px-[1.6cqw] py-[.6cqw] text-[clamp(4px,1.2cqw,11px)] font-black backdrop-blur">{v.tag}</span> : null}
        </div>
        {shownB.length ? (
          <div className="mt-[1.6cqw] grid grid-cols-2 gap-x-[3cqw] gap-y-[.8cqw]">
            {shownB.slice(0, 4).map((b, i) => <div key={i} className="flex gap-[1.2cqw] text-[clamp(5px,1.5cqw,13px)] leading-snug text-[rgb(var(--sfg)/.80)]"><span className="mt-[.7cqw] h-[.9cqw] w-[.9cqw] shrink-0 rounded-full bg-[var(--sa2)]" />{md(b)}</div>)}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={hostRef} className={cn("relative h-full w-full overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
      <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
      {full && v?.kind === "image" && v.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      ) : null}
      <div className={cn("relative grid h-full w-full gap-[5%] p-[6%] pl-[8%]", full ? "grid-cols-1" : left ? "grid-cols-[.85fr_1.15fr]" : "grid-cols-[1.15fr_.85fr]")}>
        <div className={cn("flex flex-col justify-center", left && "order-2")}>
          <h1 className="text-[clamp(8px,3.6cqw,36px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-1.5 text-[clamp(5px,1.7cqw,16px)] font-bold text-violet-300">{T(slide.subtitle)}</p> : null}
          {slide.bullets?.length ? (
            <ul className="mt-4 flex flex-col gap-2.5">
              {(reveal === undefined ? slide.bullets : slide.bullets.slice(0, reveal)).map((b, i) => (
                <li key={i} className="flex gap-2.5 text-[clamp(5px,1.6cqw,15px)] leading-snug text-[#cfcde0] duration-300 animate-in fade-in slide-in-from-bottom-2">
                  <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--sa2)]" />
                  {T(b)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {!full ? (
          <div className={cn("relative grid place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#2a2440] to-[#3a2f52]", left && "order-1")}>
            {v?.kind === "image" && v.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.url} alt="" className={cn("absolute inset-0 h-full w-full", containImg ? "object-contain p-[4%]" : "object-cover")} />
            ) : (
              <span className="text-[clamp(14px,8cqw,72px)] drop-shadow-lg">{v?.emoji ?? "🎯"}</span>
            )}
            {v?.tag ? <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[9px] font-extrabold">{v.tag}</span> : null}
          </div>
        ) : null}
      </div>
      {ann}
    </div>
  );
  })();

  return <div className="contents" style={styleVars(styleKey ?? slide.visualStyle)}>{body}</div>;
}

/** An endless horizontal teaching canvas. Revealed marks are static; when `animated`
 *  (Live Draw) the CURRENT mark visibly draws itself on (paths draw via
 *  stroke-dashoffset, labels pop in). The canvas can be several 16:9 frames wide and
 *  the viewport PANS to keep the freshly-revealed mark in view, so a long process
 *  reads left→right. Coords are 0..1 of the WIDE canvas (x already normalised by
 *  `wide`); y is 0..1 of the frame height. */
function DiagramBoard({ items, reveal, wide, animated, theme }: { items: BoardItem[]; reveal?: number; wide?: number; animated?: boolean; theme?: BoardTheme }) {
  const bt = theme ?? BOARD_ARCHETYPES.classic;
  const FRAME = 1000, H = 562;
  const frames = Math.max(1, wide ?? 1);
  const CW = FRAME * frames;
  const shown = reveal === undefined ? items : items.filter((it) => (("step" in it ? it.step : 0) ?? 0) < reveal);
  const current = reveal === undefined ? -2 : reveal - 1;
  const x = (v: number) => v * CW, y = (v: number) => v * H;

  // The whole board always fits in view (no panning) so nothing already revealed is
  // ever hidden — the reveal just fades elements in where they belong.
  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`@keyframes ld-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@keyframes ld-pop{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}@keyframes ld-follow{from{offset-distance:0%}to{offset-distance:100%}}@keyframes ld-handfade{from{opacity:1}to{opacity:0}}`}</style>
      <svg viewBox={`0 0 ${CW} ${H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
        <g>
          {shown.map((it) => {
            const isNow = !!animated && ("step" in it ? it.step : -3) === current;
            if (it.t === "shape") {
              const x1 = x(it.from.x), y1 = y(it.from.y), x2 = x(it.to.x), y2 = y(it.to.y);
              const sw = Math.max(2, (it.size ?? 0.003) * FRAME);
              const draw = isNow ? { strokeDasharray: 1, strokeDashoffset: 1, animation: "ld-draw .7s ease forwards" as const } : undefined;
              const pop = isNow ? { transformBox: "fill-box" as const, transformOrigin: "center", animation: "ld-pop .45s ease forwards" as const } : undefined;
              if (it.shape === "rect") {
                const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
                return <rect key={`${it.id}-${isNow}`} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={w} height={h} rx={Math.min(15, h / 2.4)} fill={bt.nodeFill} stroke={bt.nodeStroke} strokeWidth={sw} style={pop} />;
              }
              if (it.shape === "ellipse") {
                const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
                const ep = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy}`;
                return (
                  <g key={`${it.id}-${isNow}`}>
                    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} pathLength={1} fill="none" stroke={bt.nodeStroke} strokeWidth={sw} style={draw} />
                    {isNow ? <DrawingHand d={ep} /> : null}
                  </g>
                );
              }
              const ang = Math.atan2(y2 - y1, x2 - x1), ah = Math.max(12, sw * 4);
              return (
                <g key={`${it.id}-${isNow}`}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} stroke={bt.ink} strokeWidth={sw} strokeLinecap="round" style={draw} />
                  <polyline points={`${x2 - ah * Math.cos(ang - Math.PI / 6)},${y2 - ah * Math.sin(ang - Math.PI / 6)} ${x2},${y2} ${x2 - ah * Math.cos(ang + Math.PI / 6)},${y2 - ah * Math.sin(ang + Math.PI / 6)}`} pathLength={1} fill="none" stroke={bt.ink} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={draw} />
                  {isNow ? <DrawingHand d={`M ${x1} ${y1} L ${x2} ${y2}`} /> : null}
                </g>
              );
            }
            if (it.t === "image") {
              // A transparent 3D cutout — no box, no border. It just floats in the
              // design (preserveAspectRatio "meet" keeps the object un-cropped).
              const ix = x(it.at.x), iy = y(it.at.y), iw = it.w * CW, ih = it.h * H;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <image key={`${it.id}-${isNow}`} href={it.url} x={ix} y={iy} width={iw} height={ih} preserveAspectRatio="xMidYMid meet" style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,.18))" }} />
              );
            }
            if (it.t === "text") {
              const fs = Math.max(9, (it.size ?? 0.03) * H);
              // sticky-note callout — a yellow card with wrapped text
              if (it.note) {
                const cardW = 224, padX = 13, padY = 11, lh = fs * 1.3;
                const maxChars = Math.max(6, Math.floor((cardW - 2 * padX) / (fs * 0.52)));
                const lines = wrapLines(it.text, maxChars).slice(0, 4);
                const cardH = lines.length * lh + 2 * padY;
                const px = x(it.at.x), py = y(it.at.y);
                return (
                  <g key={`${it.id}-${isNow}`} style={isNow ? { transformBox: "fill-box", transformOrigin: "center", animation: "ld-pop .4s ease forwards" } : undefined}>
                    <rect x={px + 2} y={py + 3} width={cardW} height={cardH} rx={9} fill="rgba(0,0,0,.18)" />
                    <rect x={px} y={py} width={cardW} height={cardH} rx={9} fill={bt.sticky} stroke="rgba(0,0,0,.14)" strokeWidth={1.5} />
                    {lines.map((ln, i) => (
                      <text key={i} x={px + padX} y={py + padY + lh * (i + 0.82)} fontSize={fs} fontWeight={600} fill={bt.stickyText}>{ln}</text>
                    ))}
                  </g>
                );
              }
              return <text key={`${it.id}-${isNow}`} x={x(it.at.x)} y={y(it.at.y)} fontSize={fs} fontWeight={700} fill={bt.ink} textAnchor="middle" dominantBaseline="central" style={isNow ? { transformBox: "fill-box", transformOrigin: "center", animation: "ld-pop .4s ease forwards" } : undefined}>{it.text}</text>;
            }
            return null;
          })}
        </g>
      </svg>
    </div>
  );
}

/** Greedy word-wrap for sticky-note text (SVG has no auto-wrap). */
function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/), lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= maxChars) line += " " + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

