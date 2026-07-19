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

export function DeckSlideView({ slide, reveal, className }: { slide: DeckSlide; reveal?: number; className?: string }) {
  // `reveal` = how many steps are shown (undefined = show everything, e.g. a builder
  // thumbnail). Drives the progressive "drawing as you talk" reveal.

  // Whiteboard & Live Draw share one renderer — a wide horizontal canvas that pans
  // to follow the reveal. Live Draw additionally animates the CURRENT element on.
  if (slide.type === "whiteboard" || slide.type === "livedraw") {
    return (
      <div
        className={cn("relative h-full w-full overflow-hidden bg-[#f7f7f2]", className)}
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px,#dad9d0 1px,transparent 0)", backgroundSize: "22px 22px" }}
      >
        <div className="absolute left-[6%] top-[5%] z-[3] text-[clamp(18px,3vw,32px)] font-extrabold text-[#1a1a1a]" style={{ fontFamily: '"Segoe Print","Comic Sans MS",cursive' }}>{slide.title}</div>
        <DiagramBoard items={slide.board ?? []} reveal={reveal} wide={slide.wide} animated={slide.type === "livedraw"} />
      </div>
    );
  }

  const v = slide.visual;
  const left = v?.layout === "left";
  const full = v?.layout === "full";
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] text-white", className)}>
      <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
      {full && v?.kind === "image" && v.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      ) : null}
      <div className={cn("relative grid h-full w-full gap-[5%] p-[6%] pl-[8%]", full ? "grid-cols-1" : left ? "grid-cols-[.85fr_1.15fr]" : "grid-cols-[1.15fr_.85fr]")}>
        <div className={cn("flex flex-col justify-center", left && "order-2")}>
          <h1 className="text-[clamp(18px,3.1vw,34px)] font-extrabold leading-tight tracking-tight">{slide.title}</h1>
          {slide.subtitle ? <p className="mt-1.5 text-[clamp(11px,1.5vw,16px)] font-bold text-violet-300">{slide.subtitle}</p> : null}
          {slide.bullets?.length ? (
            <ul className="mt-4 flex flex-col gap-2.5">
              {(reveal === undefined ? slide.bullets : slide.bullets.slice(0, reveal)).map((b, i) => (
                <li key={i} className="flex gap-2.5 text-[clamp(11px,1.35vw,15px)] leading-snug text-[#cfcde0] duration-300 animate-in fade-in slide-in-from-bottom-2">
                  <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-violet-400" />
                  {b}
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
              <span className="text-[clamp(38px,7vw,72px)] drop-shadow-lg">{v?.emoji ?? "🎯"}</span>
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
  const centerX = (it: BoardItem): number => (it.t === "text" ? it.at.x : it.t === "shape" ? (it.from.x + it.to.x) / 2 : 0.5);

  // Pan the viewport to keep the freshly-revealed mark centred (wide canvases only).
  const overview = reveal === undefined; // builder thumbnail — show the whole board
  const cur = overview ? undefined : items.find((it) => ("step" in it ? it.step : -3) === current);
  const targetX = cur ? centerX(cur) * CW : CW; // nothing current → rest at the end
  const panX = frames <= 1 || overview ? 0 : Math.max(0, Math.min(CW - FRAME, targetX - FRAME / 2));
  const x = (v: number) => v * CW, y = (v: number) => v * H;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`@keyframes ld-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@keyframes ld-pop{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}`}</style>
      <svg viewBox={overview ? `0 0 ${CW} ${H}` : `0 0 ${FRAME} ${H}`} preserveAspectRatio={overview ? "xMidYMid meet" : "none"} className="absolute inset-0 h-full w-full">
        <g style={{ transform: `translateX(${-panX}px)`, transition: "transform .6s cubic-bezier(.4,0,.2,1)" }}>
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
              const ix = x(it.at.x), iy = y(it.at.y), iw = it.w * CW, ih = it.h * H, cid = `dc-${it.id}`;
              return (
                <g key={`${it.id}-${isNow}`}>
                  <defs><clipPath id={cid}><rect x={ix} y={iy} width={iw} height={ih} rx={16} /></clipPath></defs>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <image href={it.url} x={ix} y={iy} width={iw} height={ih} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${cid})`} />
                  <rect x={ix} y={iy} width={iw} height={ih} rx={16} fill="none" stroke="rgba(0,0,0,.16)" strokeWidth={2.5} />
                </g>
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
      {frames > 1 && !overview ? <CanvasMap panX={panX} frameW={FRAME} canvasW={CW} /> : null}
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

/** A tiny "you are here" strip for the endless canvas — the whole board as a track
 *  with a lit window marking the visible section. Mirrors the mock's canvas mini-map. */
function CanvasMap({ panX, frameW, canvasW }: { panX: number; frameW: number; canvasW: number }) {
  const left = (panX / canvasW) * 100;
  const w = Math.min(100, (frameW / canvasW) * 100);
  return (
    <div className="pointer-events-none absolute bottom-2.5 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/10 bg-white/85 px-3 py-1 shadow-sm backdrop-blur">
      <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-black/45">Reveal ▸</span>
      <div className="relative h-[5px] w-28 rounded-full bg-black/10">
        <div className="absolute inset-y-0 rounded-full bg-[#1e293b] transition-[left] duration-500 ease-out" style={{ left: `${left}%`, width: `${w}%` }} />
      </div>
    </div>
  );
}
