"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Sparkles, Loader2, Zap, Undo2, Redo2, Plus, FolderOpen, Save, Download } from "lucide-react";
import { SURFACES } from "@/components/marketing/surfaces";
import { cn } from "@/lib/utils/cn";

const STAGES = ["You describe", "The agent plans", "It produces", "You approve & ship"];

/**
 * The centerpiece: a faithful, scroll-scrubbed replica of the real FlowSmartly
 * app — left surface rail, the agent chat (prompt → Propose Plan → Confirm with
 * a credit cost → running) and the design canvas that renders the result. As you
 * scroll it plays the whole flow. Static finished state under reduced motion.
 */
export function WatchItWork() {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!root.current) return;
    const scope = root.current;
    const q = (sel: string) => Array.from(scope.querySelectorAll(sel));

    if (reduced) {
      gsap.set(q("[data-render]"), { opacity: 0 });
      gsap.set(q("[data-chat],[data-confirm],[data-run],[data-result],[data-shipped]"), { opacity: 1, y: 0 });
      setStage(STAGES.length - 1);
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context((self) => {
      const sq = self.selector!;
      gsap.set(sq("[data-chat]"), { opacity: 0, y: 8 });
      gsap.set(sq("[data-confirm]"), { opacity: 0, y: 10 });
      gsap.set(sq("[data-run]"), { opacity: 0, y: 6 });
      gsap.set(sq("[data-result]"), { opacity: 0 });
      gsap.set(sq("[data-render]"), { opacity: 1 });
      gsap.set(sq("[data-shipped]"), { opacity: 0, scale: 0.9 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sq("[data-stage]")[0], start: "top top", end: "+=2400", scrub: 0.6, pin: true, anticipatePin: 1,
          onUpdate: (st) => setStage(Math.min(STAGES.length - 1, Math.floor(st.progress * STAGES.length))),
        },
      });
      tl.to(sq("[data-chat]"), { opacity: 1, y: 0, duration: 0.6, stagger: 0.5 })
        .to(sq("[data-confirm]"), { opacity: 1, y: 0, duration: 0.6 }, "+=0.2")
        .to(sq("[data-run]"), { opacity: 1, y: 0, duration: 0.5 }, "+=0.2")
        .to(sq("[data-result]"), { opacity: 1, duration: 1 }, "+=0.2")
        .to(sq("[data-render]"), { opacity: 0, duration: 0.6 }, "<")
        .to(sq("[data-shipped]"), { opacity: 1, scale: 1, duration: 0.5 }, "+=0.1");
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  const rail = [{ key: "home", label: "Home", Icon: Sparkles }, ...SURFACES.map((s) => ({ key: s.key, label: s.label, Icon: s.icon }))];

  return (
    <section id="work" ref={root} className="relative">
      <div data-stage className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-20 sm:px-6">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[3px] text-brand-500">Watch the agent work</p>
          <h2 className="mt-3 max-w-3xl text-balance font-display text-3xl font-extrabold leading-tight sm:text-5xl">From a sentence to shipped — while you watch.</h2>
        </div>

        {/* ── app replica ── */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-black/5">
          {/* top bar */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple text-white"><Sparkles className="h-3.5 w-3.5" /></span>
              Flow<span className="text-brand-500">Smartly</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline">Brand Kit</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-bold text-brand-600 dark:text-brand-300"><Zap className="h-3 w-3" /> 250 credits</span>
            </div>
          </div>

          <div className="grid grid-cols-[46px_1fr] sm:grid-cols-[52px_minmax(0,1fr)_1.05fr]">
            {/* left rail */}
            <div className="flex flex-col items-center gap-0.5 border-r border-border py-2">
              {rail.map((r) => {
                const active = r.key === "create";
                return (
                  <div key={r.key} className={cn("grid h-8 w-8 place-items-center rounded-lg", active ? "bg-brand-500/15 text-brand-600 dark:text-brand-300" : "text-muted-foreground")}>
                    <r.Icon className="h-[17px] w-[17px]" />
                  </div>
                );
              })}
            </div>

            {/* agent chat */}
            <div className="flex flex-col gap-2 border-r border-border p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Agent · working on this canvas</p>
              <div className="self-end rounded-2xl rounded-br-sm bg-brand-500 px-3 py-2 text-[12.5px] text-white">Launch my bakery&apos;s fall promo across every channel.</div>
              <div data-chat className="flex items-start gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple text-white"><Sparkles className="h-3 w-3" /></span>
                <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-[12.5px] text-foreground">Got it — I&apos;ll design a branded flyer for your fall promo.</div>
              </div>
              <span data-chat className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Propose Plan</span>
              <div data-confirm className="rounded-xl border border-border bg-background/60 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground">Confirm action</span>
                  <span className="text-[10px] font-bold text-emerald-500">CONFIRMED</span>
                </div>
                <p className="mt-1 text-[11.5px] font-semibold text-foreground">Create a branded fall-promo flyer</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">Portrait 1080×1920 · your brand kit · pastry photo + offer</p>
                <p className="mt-1.5 text-[10.5px] text-muted-foreground">Estimated cost: <span className="font-bold text-foreground">15 credits</span></p>
              </div>
              <div data-run className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-600 dark:text-brand-300"><Loader2 className="h-3 w-3 animate-spin" /> Create Branded Design</div>
              <div className="mt-auto flex items-center gap-2 rounded-xl border border-border bg-background/60 px-2.5 py-2">
                <span className="flex-1 truncate text-[12px] text-muted-foreground">Ask FlowSmartly to do…</span>
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple text-white">↑</span>
              </div>
            </div>

            {/* canvas */}
            <div className="hidden flex-col p-3 sm:flex">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-foreground">Create · Design canvas</span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Undo2 className="h-3.5 w-3.5" /><Redo2 className="h-3.5 w-3.5" /><Plus className="h-3.5 w-3.5" /><FolderOpen className="h-3.5 w-3.5" />
                  <span className="mx-1 h-3 w-px bg-border" /><Save className="h-3.5 w-3.5" />
                  <span data-shipped className="ml-1 inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-brand-500 to-accent-purple px-1.5 py-0.5 text-[10px] font-bold text-white"><Download className="h-3 w-3" /> Export</span>
                </div>
              </div>
              <div className="relative grid flex-1 place-items-center rounded-xl border border-border bg-muted/50 p-4">
                <div className="relative aspect-[3/4] h-full max-h-[360px] overflow-hidden rounded-lg border border-border shadow-lg">
                  <div data-render className="absolute inset-0 z-10 grid place-items-center bg-card">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                      <p className="text-[11px] font-semibold text-foreground">Rendering your design…</p>
                      <p className="text-[10px] text-muted-foreground">Using your brand kit as the reference.</p>
                    </div>
                  </div>
                  <div data-result className="absolute inset-0">
                    <Image src="/marketing/generated/asset-flyer.webp" alt="Rendered flyer" fill unoptimized sizes="360px" className="object-cover" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* stage rail */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STAGES.map((label, i) => (
            <div key={label} className={cn("rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors sm:text-sm", i <= stage ? "border-brand-500/50 bg-brand-500/10 text-brand-600 dark:text-brand-300" : "border-border text-muted-foreground")}>
              <span className="mr-1.5 tabular-nums opacity-60">0{i + 1}</span>{label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
