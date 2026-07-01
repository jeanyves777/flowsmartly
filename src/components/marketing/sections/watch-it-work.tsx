"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useInView, useReducedMotion } from "framer-motion";
import { Sparkles, Loader2, Check, Zap, Undo2, Redo2, Plus, FolderOpen, Save, Download } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { SURFACES } from "@/components/marketing/surfaces";
import { Reveal } from "@/components/marketing/motion";
import { cn } from "@/lib/utils/cn";

const STAGES = ["You describe", "The agent plans", "It produces", "You approve & ship"];

/**
 * The centerpiece: a faithful, SELF-PLAYING replica of the real FlowSmartly app.
 * When it scrolls into view it loops the whole agent flow on its own (no scroll
 * scrubbing) — prompt → Propose Plan → Confirm (with a credit cost) → the design
 * canvas shows the real system loader, then reveals the produced flyer. Static
 * finished state under reduced motion.
 */
export function WatchItWork() {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: "-15% 0px -15% 0px" });
  const [phase, setPhase] = useState(0); // 0 describe · 1 plan · 2 produce(loader) · 3 shipped
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (reduced) { setPhase(3); return; }
    if (!inView) return;
    const t = timers.current;
    const seq: [number, number][] = [[0, 1700], [1, 2000], [2, 2200], [3, 4200]];
    let i = 0;
    const tick = () => {
      setPhase(seq[i][0]);
      const dur = seq[i][1];
      i = (i + 1) % seq.length;
      t.push(window.setTimeout(tick, dur));
    };
    tick();
    return () => { t.forEach((id) => window.clearTimeout(id)); timers.current = []; };
  }, [inView, reduced]);

  const rail = [{ key: "home", Icon: Sparkles }, ...SURFACES.map((s) => ({ key: s.key, Icon: s.icon }))];
  const shipped = phase >= 3;

  return (
    <section id="work" ref={root} className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Reveal><p className="text-sm font-bold uppercase tracking-[3px] text-brand-500">Watch the agent work</p></Reveal>
          <Reveal delay={0.06}><h2 className="mt-3 max-w-3xl text-balance font-display text-3xl font-extrabold leading-tight sm:text-5xl">From a sentence to shipped — while you watch.</h2></Reveal>
        </div>

        {/* ── app replica ── */}
        <Reveal delay={0.12}>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-black/5">
            {/* top bar */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <Image src="/logo.png" alt="FlowSmartly" width={150} height={34} unoptimized priority className="h-6 w-auto" />
              <div className="flex items-center gap-2">
                <span className="hidden rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline">Brand Kit</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-bold text-brand-600 dark:text-brand-300"><Zap className="h-3 w-3" /> 250 credits</span>
              </div>
            </div>

            <div className="grid grid-cols-[44px_1fr] sm:grid-cols-[52px_minmax(0,300px)_minmax(0,1fr)]">
              {/* left rail */}
              <div className="flex flex-col items-center gap-0.5 border-r border-border py-2">
                {rail.map((r) => (
                  <div key={r.key} className={cn("grid h-8 w-8 place-items-center rounded-lg", r.key === "create" ? "bg-brand-500/15 text-brand-600 dark:text-brand-300" : "text-muted-foreground")}>
                    <r.Icon className="h-[17px] w-[17px]" />
                  </div>
                ))}
              </div>

              {/* agent chat — compact */}
              <div className="flex min-h-[420px] flex-col gap-2 border-r border-border p-3 text-[12px]">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Agent · working on this canvas</p>
                <div className="self-end rounded-2xl rounded-br-sm bg-brand-500 px-3 py-1.5 text-white">Launch my bakery&apos;s fall promo.</div>

                <div className={cn("flex items-start gap-2 transition-all duration-500", phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")}>
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-accent-purple text-white"><Sparkles className="h-3 w-3" /></span>
                  <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-1.5 text-foreground">Got it — I&apos;ll design a branded flyer.</div>
                </div>
                <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 transition-all duration-500 dark:text-emerald-400", phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")}><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Propose Plan</span>

                <div className={cn("rounded-xl border border-border bg-background/60 p-2.5 transition-all duration-500", phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground">Confirm action</span>
                    <span className="text-[10px] font-bold text-emerald-500">CONFIRMED</span>
                  </div>
                  <p className="mt-1 text-[11.5px] font-semibold text-foreground">Create a branded fall-promo flyer</p>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">Estimated cost: <span className="font-bold text-foreground">15 credits</span></p>
                </div>

                <div className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-500", phase >= 2 ? "opacity-100" : "opacity-0", shipped ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-brand-500/10 text-brand-600 dark:text-brand-300")}>
                  {shipped ? <Check className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />} {shipped ? "Design created" : "Create Branded Design"}
                </div>

                <div className="mt-auto flex items-center gap-2 rounded-xl border border-border bg-background/60 px-2.5 py-2">
                  <span className="flex-1 truncate text-[12px] text-muted-foreground">Ask FlowSmartly to do…</span>
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple text-white">↑</span>
                </div>
              </div>

              {/* canvas — full & animated */}
              <div className="hidden flex-col p-3 sm:flex">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground">Create · Design canvas</span>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Undo2 className="h-3.5 w-3.5" /><Redo2 className="h-3.5 w-3.5" /><Plus className="h-3.5 w-3.5" /><FolderOpen className="h-3.5 w-3.5" />
                    <span className="mx-0.5 h-3 w-px bg-border" /><Save className="h-3.5 w-3.5" />
                    <span className={cn("ml-1 inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-brand-500 to-accent-purple px-1.5 py-0.5 text-[10px] font-bold text-white transition-opacity duration-500", shipped ? "opacity-100" : "opacity-40")}><Download className="h-3 w-3" /> Export</span>
                  </div>
                </div>
                <div className="relative grid flex-1 place-items-center rounded-xl border border-border bg-[radial-gradient(circle_at_50%_0%,hsl(var(--muted)),transparent)] p-5">
                  <div className="relative aspect-[3/4] h-full max-h-[440px] overflow-hidden rounded-lg border border-border bg-card shadow-xl">
                    {/* real system loader */}
                    <div className={cn("absolute inset-0 z-10 grid place-items-center bg-card transition-opacity duration-700", shipped ? "pointer-events-none opacity-0" : "opacity-100")}>
                      <div className="flex flex-col items-center gap-3 text-center">
                        <FlowLoader size={40} withMark />
                        <p className="text-[12px] font-semibold text-foreground">Rendering your design…</p>
                        <p className="text-[10.5px] text-muted-foreground">Using your brand kit as the reference.</p>
                      </div>
                    </div>
                    {/* produced result */}
                    <div className={cn("absolute inset-0 transition-all duration-700", shipped ? "scale-100 opacity-100" : "scale-105 opacity-0")}>
                      <Image src="/marketing/generated/asset-flyer.webp" alt="Rendered flyer" fill unoptimized sizes="440px" className="object-cover" priority />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* stage indicator */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STAGES.map((label, i) => (
            <div key={label} className={cn("rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors duration-500 sm:text-sm", i <= phase ? "border-brand-500/50 bg-brand-500/10 text-brand-600 dark:text-brand-300" : "border-border text-muted-foreground")}>
              <span className="mr-1.5 tabular-nums opacity-60">0{i + 1}</span>{label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
