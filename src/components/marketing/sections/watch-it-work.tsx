"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Sparkles, Palette, FileText, Megaphone, Printer, CheckCircle2 } from "lucide-react";
import { AssetPreview, type AssetKind } from "@/components/marketing/asset-preview";
import { cn } from "@/lib/utils/cn";

const STAGES = ["You describe", "The agent plans", "It produces", "You approve & ship"];

const AGENT_STEPS = ["Reading your brand kit", "Planning the campaign", "Assigning each surface", "Producing the assets"];

const OUTPUTS: { label: string; icon: typeof Palette; accent: string; kind: AssetKind }[] = [
  { label: "Design", icon: Palette, accent: "from-sky-400 to-blue-500", kind: "design" },
  { label: "5 posts", icon: FileText, accent: "from-violet-400 to-fuchsia-500", kind: "posts" },
  { label: "Ad", icon: Megaphone, accent: "from-emerald-400 to-teal-500", kind: "ad" },
  { label: "Flyer", icon: Printer, accent: "from-amber-400 to-orange-500", kind: "flyer" },
];

/**
 * The centerpiece: a GSAP-pinned, scroll-scrubbed sequence. As the reader scrolls
 * the section pins and the agent walks from a one-line prompt → plan → produced
 * assets → shipped. Degrades to a static, fully-visible stack under reduced motion.
 */
export function WatchItWork() {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (reduced || !root.current) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context((self) => {
      const q = self.selector!;
      gsap.set(q("[data-step]"), { opacity: 0.25, x: -8 });
      gsap.set(q("[data-output]"), { opacity: 0, scale: 0.85, y: 24 });
      gsap.set(q("[data-shipped]"), { opacity: 0, scale: 0.9 });
      gsap.set(q("[data-prompt]"), { opacity: 0, y: 10 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: q("[data-stage]")[0],
          start: "top top",
          end: "+=2200",
          scrub: 0.6,
          pin: true,
          anticipatePin: 1,
          onUpdate: (st) => setStage(Math.min(STAGES.length - 1, Math.floor(st.progress * STAGES.length))),
        },
      });

      tl.to(q("[data-prompt]"), { opacity: 1, y: 0, duration: 0.6 })
        .to(q("[data-step]"), { opacity: 1, x: 0, duration: 0.6, stagger: 0.5 }, 0.4)
        .to(q("[data-output]"), { opacity: 1, scale: 1, y: 0, duration: 0.6, stagger: 0.5 }, "+=0.1")
        .to(q("[data-shipped]"), { opacity: 1, scale: 1, duration: 0.6 }, "+=0.2");
    }, root);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section id="work" ref={root} className="relative">
      <div data-stage className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-20 sm:px-6">
        <div className="mb-10">
          <p className="text-sm font-bold uppercase tracking-[3px] text-brand-500">Watch the agent work</p>
          <h2 className="mt-3 max-w-3xl text-balance font-display text-3xl font-extrabold leading-tight sm:text-5xl">
            From a sentence to shipped — while you watch.
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* agent panel */}
          <div className="rounded-3xl border border-border bg-card/70 p-5 shadow-xl backdrop-blur">
            <div data-prompt className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple text-white"><Sparkles className="h-[18px] w-[18px]" /></span>
              <p className="pt-1 text-[15px] leading-relaxed text-foreground">Launch my bakery&apos;s fall promo across every channel.</p>
            </div>
            <div className="mt-4 space-y-3">
              {AGENT_STEPS.map((s) => (
                <div key={s} data-step className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* workspace output */}
          <div className="rounded-3xl border border-border bg-card/70 p-5 shadow-xl backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace</span>
              <span data-shipped className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> Shipped</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {OUTPUTS.map((o) => {
                const Icon = o.icon;
                return (
                  <div key={o.label} data-output className="flex flex-col gap-2 rounded-2xl border border-border bg-background/50 p-3">
                    <span className={cn("grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white", o.accent)}><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="text-sm font-semibold text-foreground">{o.label}</span>
                    <AssetPreview kind={o.kind} accent={o.accent} className="aspect-[4/3]" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* stage rail */}
        <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
