"use client";

/**
 * Renders one deck slide — the SAME component backs the builder stage and the live
 * room's Slides stage. A document slide is a title + talking points + a visual; a
 * whiteboard slide reuses the read-only TrainingBoard to draw its diagram, so the
 * host's live ink lands on top in exactly the same coordinate space. [[training-studio]]
 */
import { TrainingBoard } from "./training-board";
import { cn } from "@/lib/utils/cn";
import type { BoardItem, DeckSlide } from "@/lib/training/types";

export function DeckSlideView({ slide, reveal, className }: { slide: DeckSlide; reveal?: number; className?: string }) {
  // `reveal` = how many steps are shown (undefined = show everything, e.g. in the
  // builder preview). Drives the progressive "drawing as you talk" reveal.

  // Live Draw — each element appears ONE AT A TIME and the current one visibly
  // draws itself on; future elements stay hidden.
  if (slide.type === "livedraw") {
    return (
      <div
        className={cn("relative h-full w-full bg-[#f7f7f2]", className)}
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px,#dad9d0 1px,transparent 0)", backgroundSize: "22px 22px" }}
      >
        <div className="absolute left-[6%] top-[5%] z-[2] text-[clamp(18px,3vw,32px)] font-extrabold text-[#1a1a1a]" style={{ fontFamily: '"Segoe Print","Comic Sans MS",cursive' }}>{slide.title}</div>
        <LiveDrawBoard items={slide.board ?? []} reveal={reveal} />
      </div>
    );
  }

  if (slide.type === "whiteboard") {
    const items = reveal === undefined ? (slide.board ?? []) : (slide.board ?? []).filter((it) => (("step" in it ? it.step : 0) ?? 0) < reveal);
    return (
      <div
        className={cn("relative h-full w-full bg-[#f7f7f2]", className)}
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px,#dad9d0 1px,transparent 0)", backgroundSize: "22px 22px" }}
      >
        <div
          className="absolute left-[6%] top-[5%] z-[2] text-[clamp(18px,3vw,32px)] font-extrabold text-[#1a1a1a]"
          style={{ fontFamily: '"Segoe Print","Comic Sans MS",cursive' }}
        >
          {slide.title}
        </div>
        <div className="absolute inset-0">
          <TrainingBoard
            doc={{ v: 1, bg: "blank", items }}
            tool="sel"
            color="#1e293b"
            canDraw={false}
            cursors={[]}
            onAdd={() => {}}
            onRemove={() => {}}
            onUpdate={() => {}}
            onPing={() => {}}
            className="!border-transparent !bg-transparent"
          />
        </div>
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

/** An animated whiteboard for Live Draw slides: revealed elements are static; the
 *  CURRENT element visibly draws itself on (paths draw via stroke-dashoffset, labels
 *  pop in); future elements are hidden. Coords are fractional (0..1) → a 16:9 viewBox. */
function LiveDrawBoard({ items, reveal }: { items: BoardItem[]; reveal?: number }) {
  const W = 1000, H = 562;
  const shown = reveal === undefined ? items : items.filter((it) => (("step" in it ? it.step : 0) ?? 0) < reveal);
  const current = reveal === undefined ? -2 : reveal - 1;
  return (
    <div className="absolute inset-0">
      <style>{`@keyframes ld-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@keyframes ld-pop{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}`}</style>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {shown.map((it) => {
          const isNow = ("step" in it ? it.step : -3) === current;
          if (it.t === "shape") {
            const x1 = it.from.x * W, y1 = it.from.y * H, x2 = it.to.x * W, y2 = it.to.y * H;
            const sw = Math.max(2, (it.size ?? 0.003) * W);
            const draw = isNow ? { strokeDasharray: 1, strokeDashoffset: 1, animation: "ld-draw .7s ease forwards" } : undefined;
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
          if (it.t === "text") {
            const fs = Math.max(11, (it.size ?? 0.03) * H);
            return <text key={`${it.id}-${isNow}`} x={it.at.x * W} y={it.at.y * H + fs} fontSize={fs} fontWeight={700} fill={it.color} style={isNow ? { animation: "ld-pop .4s ease forwards" } : undefined}>{it.text}</text>;
          }
          return null;
        })}
      </svg>
    </div>
  );
}
