"use client";

/**
 * Renders one deck slide — the SAME component backs the builder stage and the live
 * room's Slides stage. A document slide is a title + talking points + a visual; a
 * whiteboard / live-draw slide is an endless horizontal teaching canvas: the diagram
 * marches left→right and the view pans across it as the reveal advances, so a long
 * process reads like a board the presenter fills in while they talk. Live-draw goes
 * one element at a time and the current mark visibly draws itself on. [[training-studio]]
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import type { BoardItem, DeckSlide } from "@/lib/training/types";

/** A stylized hand + pen whose NIB sits at the group origin (0,0) — dropped onto a stroke's
 *  path so it appears to draw the mark. Skin tone via the `--ld-skin` custom property. */
function HandPen({ color }: { color: string }) {
  return (
    <g>
      <path d="M0 0 L6 -4 L46 -56 L54 -50 L14 2 Z" fill="#403a54" stroke="#241f33" strokeWidth={1} />
      <path d="M46 -56 L54 -50 L61 -58 Q64 -62 59 -66 L52 -61 Z" fill={color} />
      <path d="M8 4 Q22 -5 31 5 Q46 20 33 39 Q18 55 -5 46 Q-20 38 -15 22 Q-11 8 8 4 Z" fill="var(--ld-skin,#e7b48a)" stroke="rgba(0,0,0,.16)" strokeWidth={1.2} />
      <path d="M12 6 Q24 0 31 8" fill="none" stroke="rgba(0,0,0,.1)" strokeWidth={1.5} />
      <circle cx="0" cy="0" r="2" fill="#111" />
    </g>
  );
}
/** The hand element that TRAVELS along `d` (the stroke) as it draws, then fades. */
function followHand(d: string, color: string) {
  return <g style={{ offsetPath: `path('${d}')`, offsetRotate: "0deg", animation: "ld-follow .7s ease forwards, ld-handfade .3s ease .78s forwards" } as CSSProperties}><HandPen color={color} /></g>;
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

export function DeckSlideView({ slide, reveal, className }: { slide: DeckSlide; reveal?: number; className?: string }) {
  // `reveal` = how many steps are shown (undefined = show everything, e.g. a builder
  // thumbnail). Drives the progressive "drawing as you talk" reveal.

  // The opening slide — the AI co-host takes the stage to introduce itself. On the live
  // stage the moving avatar replaces this; here (builder / no avatar) it's a warm welcome.
  if (slide.intro) {
    return (
      <div className={cn("relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br from-[#241f38] via-[#191627] to-[#0f0d17] [container-type:inline-size]", className)}>
        <div className="flex flex-col items-center px-[8%] text-center">
          <div className="mb-[3cqw] grid h-[14cqw] w-[14cqw] place-items-center rounded-full bg-gradient-to-br from-cyan-400/25 to-brand-500/25 ring-2 ring-brand-400/40"><span className="text-[7cqw]">👋</span></div>
          <h1 className="text-[clamp(11px,5.6cqw,56px)] font-extrabold leading-tight tracking-tight text-white">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-[1.5cqw] text-[clamp(6px,2.4cqw,22px)] font-semibold text-brand-300">{md(slide.subtitle)}</p> : null}
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
        <div className="mb-[2cqw] inline-flex items-center gap-2 self-start rounded-full bg-brand-500/20 px-[2.2cqw] py-[1cqw] text-[clamp(5px,1.7cqw,15px)] font-black uppercase tracking-wide text-brand-300">💡 Quick check</div>
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
  // Illustrations / diagrams carry meaning at their edges (arrows, labels), so they must FIT
  // inside their box (contain) — cropping them (cover) cuts off content. Photos still fill.
  const containImg = v?.style === "illustration" || /illustration|diagram|chart|infographic|graph|figure|flow/i.test(v?.tag ?? "");
  const hasImg = v?.kind === "image" && !!v.url;
  const bullets = slide.bullets ?? [];
  const shownB = reveal === undefined ? bullets : bullets.slice(0, reveal);
  const lay = slide.layout;

  // A DEMONSTRATION VIDEO slide — a short generated moving illustration beside the teaching text.
  if (slide.videoUrl || (slide.visualType === "video" && slide.videoPrompt)) {
    return (
      <div className={cn("relative grid h-full w-full grid-cols-[.92fr_1.08fr] items-center gap-[4%] overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] px-[6%] py-[6%] text-white [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="text-[clamp(11px,3.8cqw,38px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,2cqw,18px)] font-semibold text-brand-300">{md(slide.subtitle)}</p> : null}
          {shownB.length ? (
            <ul className="mt-[2.5cqw] flex flex-col gap-[1.4cqw]">
              {shownB.map((b, i) => <li key={i} className="flex gap-[1.6cqw] text-[clamp(6px,1.9cqw,17px)] leading-snug text-white/85"><span className="mt-[.9cqw] h-[1cqw] w-[1cqw] shrink-0 rounded-full bg-violet-400" />{md(b)}</li>)}
            </ul>
          ) : null}
        </div>
        <div className="relative aspect-video overflow-hidden rounded-[1.4cqw] bg-black ring-1 ring-white/10 shadow-2xl">
          {slide.videoUrl ? (
            <video src={slide.videoUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#241f38] to-[#14121f] text-center">
              <div className="px-[8%]">
                <div className="mx-auto mb-[2cqw] grid h-[8cqw] w-[8cqw] place-items-center rounded-full bg-brand-500/15 text-[4cqw] text-brand-300">▶</div>
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

  // A big centred statement: hero / section divider / quote / one big idea.
  if (lay === "hero_statement" || lay === "section_divider" || lay === "quote" || lay === "big_idea") {
    const isQuote = lay === "quote", isDivider = lay === "section_divider";
    return (
      <div className={cn("relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] text-white [container-type:inline-size]", className)}>
        {hasImg ? <img src={v!.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/55" />
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <div className="relative z-[3] max-w-[88%] px-[7%] text-center">
          {isDivider ? <div className="mb-[2cqw] text-[clamp(6px,2cqw,18px)] font-black uppercase tracking-[.22em] text-brand-300">Section</div> : null}
          {isQuote ? <div className="mb-[-3cqw] select-none text-[16cqw] font-black leading-none text-brand-500/45">&ldquo;</div> : null}
          <h1 style={{ textWrap: "balance" }} className={cn("font-extrabold leading-[1.05] tracking-tight", isQuote ? "text-[clamp(12px,4.8cqw,48px)] italic" : "text-[clamp(14px,6.4cqw,66px)]")}>{md(slide.title)}</h1>
          {slide.subtitle ? <p style={{ textWrap: "balance" }} className="mx-auto mt-[2cqw] max-w-[46ch] text-[clamp(7px,2.6cqw,24px)] font-semibold text-brand-200/90">{md(slide.subtitle)}</p> : null}
        </div>
      </div>
    );
  }

  // Data spotlight — one big number pulled from the content, with a short interpretation.
  const statMatch = (slide.subtitle && slide.subtitle.match(/\$?\d[\d.,]*\s?(%|x|k|m|bn?|billion|million)?/i))
    || bullets.map((b) => b.match(/\$?\d[\d.,]*\s?(%|x|k|m|bn?|billion|million)?/i)).find(Boolean);
  if (lay === "data_spotlight" && statMatch) {
    const stat = statMatch[0].trim();
    const caption = (slide.subtitle && !slide.subtitle.startsWith(stat) ? slide.subtitle : bullets[0]) || slide.title;
    return (
      <div className={cn("relative grid h-full w-full grid-cols-[1.1fr_.9fr] items-center overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] px-[7%] text-white [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <div>
          <div className="bg-gradient-to-br from-brand-300 to-violet-400 bg-clip-text text-[clamp(28px,16cqw,150px)] font-black leading-[.9] tracking-tight text-transparent">{stat}</div>
          <h1 className="mt-[1cqw] text-[clamp(10px,3.2cqw,30px)] font-extrabold leading-tight">{md(slide.title)}</h1>
        </div>
        <p style={{ textWrap: "balance" }} className="border-l-2 border-brand-500/40 pl-[4%] text-[clamp(7px,2.3cqw,20px)] font-medium text-white/80">{md(caption)}</p>
      </div>
    );
  }

  // Key takeaways / action plan — the points AS cards, not a bullet list.
  if ((lay === "key_takeaways" || lay === "action_plan") && bullets.length) {
    const two = bullets.length > 3;
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] px-[7%] py-[6%] text-white [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <h1 className="text-[clamp(11px,4cqw,40px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
        {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,2cqw,18px)] font-semibold text-brand-300">{md(slide.subtitle)}</p> : null}
        <div className={cn("mt-[3cqw] grid gap-[1.6cqw]", two ? "grid-cols-2" : "grid-cols-1")}>
          {shownB.map((b, i) => (
            <div key={i} className="flex items-start gap-[1.8cqw] rounded-[1.4cqw] border border-white/10 bg-white/[0.05] px-[2.6cqw] py-[2cqw] duration-300 animate-in fade-in slide-in-from-bottom-2">
              <span className="grid h-[3.6cqw] w-[3.6cqw] shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-[clamp(6px,1.9cqw,17px)] font-black text-white">{lay === "action_plan" ? i + 1 : "✓"}</span>
              <span className="min-w-0 text-[clamp(6px,2cqw,18px)] font-medium leading-snug text-white/90">{md(b)}</span>
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
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <div className="absolute inset-x-0 bottom-0 z-[3] px-[7%] pb-[6%] text-white">
          <h1 style={{ textWrap: "balance" }} className="max-w-[75%] text-[clamp(12px,4.8cqw,48px)] font-extrabold leading-tight">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-[1cqw] max-w-[62%] text-[clamp(7px,2.2cqw,20px)] font-semibold text-brand-200/90">{md(slide.subtitle)}</p> : null}
        </div>
      </div>
    );
  }

  // Two-column contrast — pros/cons, myth vs reality, comparison.
  if ((lay === "pros_cons" || lay === "myth_reality" || lay === "comparison_table") && bullets.length >= 2) {
    const heads = lay === "pros_cons" ? ["Pros", "Cons"] : lay === "myth_reality" ? ["The myth", "The reality"] : ["Before", "After"];
    const half = Math.ceil(bullets.length / 2);
    const cols = [bullets.slice(0, half), bullets.slice(half)];
    const tones = ["border-emerald-400/30 from-emerald-500/[0.12]", "border-rose-400/30 from-rose-500/[0.1]"];
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] px-[7%] py-[6%] text-white [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <h1 className="text-[clamp(11px,3.8cqw,38px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
        {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,2cqw,18px)] font-semibold text-brand-300">{md(slide.subtitle)}</p> : null}
        <div className="mt-[3cqw] grid grid-cols-2 gap-[2cqw]">
          {cols.map((c, ci) => (
            <div key={ci} className={cn("rounded-[1.6cqw] border bg-gradient-to-b to-transparent p-[3.4%]", tones[ci])}>
              <div className="mb-[1.6cqw] text-[clamp(6px,2cqw,18px)] font-black uppercase tracking-wide text-white/85">{heads[ci]}</div>
              <ul className="flex flex-col gap-[1.4cqw]">
                {c.map((b, i) => <li key={i} className="flex gap-[1.4cqw] text-[clamp(6px,1.9cqw,17px)] leading-snug text-white/85"><span className="mt-[.9cqw] h-[1cqw] w-[1cqw] shrink-0 rounded-full bg-white/45" />{md(b)}</li>)}
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
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] px-[7%] py-[6%] text-white [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <h1 className="text-[clamp(11px,3.8cqw,38px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
        <div className="mt-[3cqw] grid grid-cols-3 gap-[1.6cqw]">
          {heads.map((h, i) => (
            <div key={i} className="relative rounded-[1.4cqw] border border-white/10 bg-white/[0.05] p-[3.4%]">
              <div className="mb-[1cqw] text-[clamp(5px,1.7cqw,15px)] font-black uppercase tracking-wide text-brand-300">{h}</div>
              <p className="text-[clamp(6px,1.9cqw,17px)] leading-snug text-white/85">{md(pick[i] || "")}</p>
              {i < 2 ? <span className="absolute -right-[1.1cqw] top-1/2 z-[2] -translate-y-1/2 text-[clamp(8px,2.4cqw,22px)] text-brand-400">→</span> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Numbered steps — a process, customer journey or timeline.
  if ((lay === "step_process" || lay === "customer_journey" || lay === "timeline" || lay === "vertical_journey") && bullets.length >= 2) {
    const steps = shownB.slice(0, 5);
    return (
      <div className={cn("relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] px-[7%] py-[6%] text-white [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <h1 className="text-[clamp(11px,3.8cqw,38px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
        {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,2cqw,18px)] font-semibold text-brand-300">{md(slide.subtitle)}</p> : null}
        <div className="mt-[3.5cqw] grid gap-[1.6cqw]" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
          {steps.map((b, i) => (
            <div key={i} className="relative flex flex-col rounded-[1.4cqw] border border-white/10 bg-white/[0.05] p-[3.2%] duration-300 animate-in fade-in slide-in-from-bottom-2">
              <span className="mb-[1.2cqw] grid h-[3.6cqw] w-[3.6cqw] place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-[clamp(6px,1.8cqw,16px)] font-black text-white">{i + 1}</span>
              <p className="text-[clamp(5px,1.7cqw,15px)] leading-snug text-white/85">{md(b)}</p>
              {i < steps.length - 1 ? <span className="absolute -right-[1cqw] top-[3.4cqw] z-[2] text-[clamp(7px,2cqw,18px)] text-brand-400">→</span> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // A leading question; the answer reveals progressively.
  if (lay === "question_answer" && (slide.subtitle || bullets.length)) {
    return (
      <div className={cn("relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br from-[#1b2540] via-[#161a2c] to-[#100e18] px-[7%] text-white [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <div className="max-w-[88%] text-center">
          <div className="mb-[1cqw] select-none text-[10cqw] font-black leading-none text-brand-500/40">?</div>
          <h1 style={{ textWrap: "balance" }} className="text-[clamp(12px,4.8cqw,46px)] font-extrabold leading-tight">{md(slide.title)}</h1>
          {shownB.length ? (
            <ul className="mx-auto mt-[3cqw] flex max-w-[80%] flex-col gap-[1.4cqw] text-left">
              {shownB.map((b, i) => <li key={i} className="flex gap-[1.6cqw] rounded-[1.2cqw] border border-white/10 bg-white/[0.05] px-[2.6cqw] py-[1.6cqw] text-[clamp(6px,1.9cqw,17px)] text-white/90 duration-300 animate-in fade-in slide-in-from-bottom-2"><span className="font-black text-brand-300">{String.fromCharCode(65 + i)}</span>{md(b)}</li>)}
            </ul>
          ) : slide.subtitle ? <p className="mt-[2cqw] text-[clamp(7px,2.4cqw,22px)] font-semibold text-brand-200/90">{md(slide.subtitle)}</p> : null}
        </div>
      </div>
    );
  }

  // Case study / real-world scenario — a visual beside a structured outcome.
  if ((lay === "case_study" || lay === "real_world_scenario") && (hasImg || bullets.length >= 1)) {
    return (
      <div className={cn("relative grid h-full w-full grid-cols-[1fr_1fr] items-center gap-[4%] overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] px-[6%] py-[6%] text-white [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <div className="flex min-w-0 flex-col justify-center">
          <span className="mb-[1.5cqw] inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-500/15 px-[2.2cqw] py-[.9cqw] text-[clamp(5px,1.6cqw,14px)] font-black uppercase tracking-wide text-brand-300">{lay === "case_study" ? "Case study" : "In the field"}</span>
          <h1 className="text-[clamp(11px,3.6cqw,34px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
          {slide.subtitle ? <p className="mt-[1cqw] text-[clamp(6px,1.9cqw,17px)] font-semibold text-brand-300">{md(slide.subtitle)}</p> : null}
          {shownB.length ? (
            <ul className="mt-[2.4cqw] flex flex-col gap-[1.4cqw]">
              {shownB.map((b, i) => <li key={i} className="flex gap-[1.6cqw] text-[clamp(6px,1.9cqw,17px)] leading-snug text-white/85"><span className="mt-[.9cqw] h-[1cqw] w-[1cqw] shrink-0 rounded-full bg-violet-400" />{md(b)}</li>)}
            </ul>
          ) : null}
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.4cqw] bg-gradient-to-br from-[#2a2440] to-[#3a2f52] ring-1 ring-white/10">
          {hasImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v!.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : <span className="grid h-full w-full place-items-center text-[8cqw]">{v?.emoji ?? "🏢"}</span>}
        </div>
      </div>
    );
  }

  // A central 3D/photoreal visual with labeled callouts.
  if (lay === "concept_3d_callouts" && hasImg && bullets.length >= 1) {
    return (
      <div className={cn("relative grid h-full w-full grid-cols-[1.15fr_.85fr] items-center gap-[3%] overflow-hidden bg-gradient-to-br from-[#14121f] to-[#1c1830] px-[6%] py-[6%] text-white [container-type:inline-size]", className)}>
        <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-brand-500 to-violet-600" />
        <div className="relative h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v!.url} alt="" className={cn("absolute inset-0 h-full w-full", containImg ? "object-contain" : "object-cover rounded-[1.4cqw]")} />
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="text-[clamp(11px,3.6cqw,34px)] font-extrabold leading-tight tracking-tight">{md(slide.title)}</h1>
          <ul className="mt-[2.4cqw] flex flex-col gap-[1.4cqw]">
            {shownB.slice(0, 4).map((b, i) => (
              <li key={i} className="flex items-start gap-[1.6cqw] rounded-[1.2cqw] border border-white/10 bg-white/[0.05] px-[2.4cqw] py-[1.4cqw] text-[clamp(6px,1.8cqw,16px)] text-white/90 duration-300 animate-in fade-in slide-in-from-right-2">
                <span className="grid h-[2.8cqw] w-[2.8cqw] shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-[clamp(5px,1.5cqw,13px)] font-black text-white">{i + 1}</span>
                {md(b)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

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
              <img src={v.url} alt="" className={cn("absolute inset-0 h-full w-full", containImg ? "object-contain p-[4%]" : "object-cover")} />
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
                return <rect key={`${it.id}-${isNow}`} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={w} height={h} rx={Math.min(15, h / 2.4)} fill="#ffffff" stroke={it.color} strokeWidth={sw} style={pop} />;
              }
              if (it.shape === "ellipse") {
                const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
                const ep = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy}`;
                return (
                  <g key={`${it.id}-${isNow}`}>
                    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} pathLength={1} fill="none" stroke={it.color} strokeWidth={sw} style={draw} />
                    {isNow ? followHand(ep, it.color) : null}
                  </g>
                );
              }
              const ang = Math.atan2(y2 - y1, x2 - x1), ah = Math.max(12, sw * 4);
              return (
                <g key={`${it.id}-${isNow}`}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} stroke={it.color} strokeWidth={sw} strokeLinecap="round" style={draw} />
                  <polyline points={`${x2 - ah * Math.cos(ang - Math.PI / 6)},${y2 - ah * Math.sin(ang - Math.PI / 6)} ${x2},${y2} ${x2 - ah * Math.cos(ang + Math.PI / 6)},${y2 - ah * Math.sin(ang + Math.PI / 6)}`} pathLength={1} fill="none" stroke={it.color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={draw} />
                  {isNow ? followHand(`M ${x1} ${y1} L ${x2} ${y2}`, it.color) : null}
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

