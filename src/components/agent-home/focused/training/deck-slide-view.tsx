"use client";

/**
 * Renders one deck slide — the SAME component backs the builder stage and the live
 * room's Slides stage. A document slide is a title + talking points + a visual; a
 * whiteboard slide reuses the read-only TrainingBoard to draw its diagram, so the
 * host's live ink lands on top in exactly the same coordinate space. [[training-studio]]
 */
import { TrainingBoard } from "./training-board";
import { cn } from "@/lib/utils/cn";
import type { DeckSlide } from "@/lib/training/types";

export function DeckSlideView({ slide, reveal, className }: { slide: DeckSlide; reveal?: number; className?: string }) {
  // `reveal` = how many steps are shown (undefined = show everything, e.g. in the
  // builder preview). Drives the progressive "drawing as you talk" reveal.
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
