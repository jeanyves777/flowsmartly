"use client";

/**
 * Renders one deck slide — the SAME component backs the builder stage and the live
 * room's Slides stage. A document slide is a title + talking points + a visual; a
 * whiteboard / live-draw slide is an endless horizontal teaching canvas: the diagram
 * marches left→right and the view pans across it as the reveal advances, so a long
 * process reads like a board the presenter fills in while they talk. Live-draw goes
 * one element at a time and the current mark visibly draws itself on. [[training-studio]]
 */
import { cn } from "@/lib/utils/cn";
import type { BoardItem, DeckSlide } from "@/lib/training/types";

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

export function DeckSlideView({ slide, reveal, className }: { slide: DeckSlide; reveal?: number; className?: string }) {
  // `reveal` = how many steps are shown (undefined = show everything, e.g. a builder
  // thumbnail). Drives the progressive "drawing as you talk" reveal.

  // An on-screen quiz — the question + lettered options; the correct one lights up green
  // (with an explanation) once the host reveals it (reveal step 2).
  if (slide.quiz) {
    const q = slide.quiz;
    const revealed = reveal === undefined || reveal >= 2;
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[#1b2540] via-[#161a2c] to-[#100e18] px-[7%] py-[6%] [container-type:inline-size]", className)}>
        <div className="mb-[2cqw] inline-flex items-center gap-2 self-start rounded-full bg-brand-500/20 px-[2.2cqw] py-[1cqw] text-[clamp(5px,1.7cqw,15px)] font-black uppercase tracking-wide text-brand-300">💡 Quick check</div>
        <h1 className="text-[clamp(9px,3.4cqw,34px)] font-extrabold leading-tight text-white">{md(q.question)}</h1>
        <div className="mt-[3cqw] grid grid-cols-1 gap-[1.6cqw] sm:grid-cols-2">
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
          <p className="mt-[2.6cqw] text-[clamp(5px,1.7cqw,15px)] font-semibold text-brand-300/90">Raise your hand ✋ with your answer — the host reveals it next.</p>
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
          {slide.subtitle ? <p className="mt-[1.5cqw] text-[clamp(6px,2.4cqw,22px)] font-semibold text-brand-300">{md(slide.subtitle)}</p> : null}
          <p className="mt-[3cqw] inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-[2.5cqw] py-[1.2cqw] text-[clamp(5px,1.9cqw,16px)] font-semibold text-white/80">Raise your hand ✋ or use “Ask the presenter”</p>
        </div>
      </div>
    );
  }

  // Whiteboard & Live Draw share one renderer — a wide horizontal canvas that pans
  // to follow the reveal. Live Draw additionally animates the CURRENT element on.
  if (slide.type === "whiteboard" || slide.type === "livedraw") {
    return (
      <div
        className={cn("relative h-full w-full overflow-hidden bg-[#f7f7f2] [container-type:inline-size]", className)}
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px,#dad9d0 1px,transparent 0)", backgroundSize: "22px 22px" }}
      >
        <div className="absolute left-[6%] top-[5%] z-[3] text-[clamp(8px,3.6cqw,32px)] font-extrabold text-[#1a1a1a]" style={{ fontFamily: '"Segoe Print","Comic Sans MS",cursive' }}>{md(slide.title)}</div>
        <DiagramBoard items={slide.board ?? []} reveal={reveal} wide={slide.wide} animated={slide.type === "livedraw"} />
      </div>
    );
  }

  const v = slide.visual;
  const left = v?.layout === "left";
  const full = v?.layout === "full";
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] text-white [container-type:inline-size]", className)}>
      <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
      {full && v?.kind === "image" && v.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      ) : null}
      <div className={cn("relative grid h-full w-full gap-[5%] p-[6%] pl-[8%]", full ? "grid-cols-1" : left ? "grid-cols-[.85fr_1.15fr]" : "grid-cols-[1.15fr_.85fr]")}>
        <div className={cn("flex flex-col justify-center", left && "order-2")}>
          <h1 className="text-[clamp(8px,3.6cqw,36px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-1.5 text-[clamp(5px,1.7cqw,16px)] font-bold text-violet-300">{md(slide.subtitle)}</p> : null}
          {slide.bullets?.length ? (
            <ul className="mt-4 flex flex-col gap-2.5">
              {(reveal === undefined ? slide.bullets : slide.bullets.slice(0, reveal)).map((b, i) => (
                <li key={i} className="flex gap-2.5 text-[clamp(5px,1.6cqw,15px)] leading-snug text-[#cfcde0] duration-300 animate-in fade-in slide-in-from-bottom-2">
                  <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-violet-400" />
                  {md(b)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {!full ? (
          <div className={cn("relative grid place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#2a2440] to-[#3a2f52]", left && "order-1")}>
            {v?.kind === "image" && v.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="text-[clamp(14px,8cqw,72px)] drop-shadow-lg">{v?.emoji ?? "🎯"}</span>
            )}
            {v?.tag ? <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[9px] font-extrabold">{v.tag}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** An endless horizontal teaching canvas. Revealed marks are static; when `animated`
 *  (Live Draw) the CURRENT mark visibly draws itself on (paths draw via
 *  stroke-dashoffset, labels pop in). The canvas can be several 16:9 frames wide and
 *  the viewport PANS to keep the freshly-revealed mark in view, so a long process
 *  reads left→right. Coords are 0..1 of the WIDE canvas (x already normalised by
 *  `wide`); y is 0..1 of the frame height. */
function DiagramBoard({ items, reveal, wide, animated }: { items: BoardItem[]; reveal?: number; wide?: number; animated?: boolean }) {
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
      <style>{`@keyframes ld-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@keyframes ld-pop{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}`}</style>
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
                return <rect key={`${it.id}-${isNow}`} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={w} height={h} rx={Math.min(15, h / 2.4)} fill="#ffffff" stroke={it.color} strokeWidth={sw} style={pop} />;
              }
              if (it.shape === "ellipse") {
                return <ellipse key={`${it.id}-${isNow}`} cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.abs(x2 - x1) / 2} ry={Math.abs(y2 - y1) / 2} pathLength={1} fill="none" stroke={it.color} strokeWidth={sw} style={draw} />;
              }
              const ang = Math.atan2(y2 - y1, x2 - x1), ah = Math.max(12, sw * 4);
              return (
                <g key={`${it.id}-${isNow}`}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} stroke={it.color} strokeWidth={sw} strokeLinecap="round" style={draw} />
                  <polyline points={`${x2 - ah * Math.cos(ang - Math.PI / 6)},${y2 - ah * Math.sin(ang - Math.PI / 6)} ${x2},${y2} ${x2 - ah * Math.cos(ang + Math.PI / 6)},${y2 - ah * Math.sin(ang + Math.PI / 6)}`} pathLength={1} fill="none" stroke={it.color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={draw} />
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
                    <rect x={px + 2} y={py + 3} width={cardW} height={cardH} rx={9} fill="rgba(0,0,0,.12)" />
                    <rect x={px} y={py} width={cardW} height={cardH} rx={9} fill={it.note} stroke="rgba(0,0,0,.12)" strokeWidth={1.5} />
                    {lines.map((ln, i) => (
                      <text key={i} x={px + padX} y={py + padY + lh * (i + 0.82)} fontSize={fs} fontWeight={600} fill={it.color}>{ln}</text>
                    ))}
                  </g>
                );
              }
              return <text key={`${it.id}-${isNow}`} x={x(it.at.x)} y={y(it.at.y)} fontSize={fs} fontWeight={700} fill={it.color} textAnchor="middle" dominantBaseline="central" style={isNow ? { transformBox: "fill-box", transformOrigin: "center", animation: "ld-pop .4s ease forwards" } : undefined}>{it.text}</text>;
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

