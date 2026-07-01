"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Sparkles, ArrowUp, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraBackdrop, GradientText, Magnetic } from "@/components/marketing/motion";
import { AssetPreview } from "@/components/marketing/asset-preview";
import { cn } from "@/lib/utils/cn";

const proofItems = ["No credit card", "Free workspace", "Pay per work, not seats"];

const PROMPT = "Launch my bakery's fall promo — designs, a flyer, posts and an ad.";
const STEPS = ["Planning the campaign", "Designing 3 creatives", "Writing 5 posts", "Building the flyer", "Drafting the ad"];
const ASSETS = [
  { label: "Design", accent: "from-sky-400 to-blue-500", kind: "design" as const },
  { label: "Video", accent: "from-rose-400 to-pink-500", kind: "video" as const },
  { label: "Website", accent: "from-emerald-400 to-teal-500", kind: "website" as const },
];

/** The hero's animated "agent at work" composer — a real streaming loader: types
 * the prompt, works each step (spinner → check), then produces each asset
 * (skeleton shimmer → the real generated image). Never shows an empty area;
 * jumps to the finished state under reduced motion. */
function AgentComposer() {
  const reduced = useReducedMotion();
  const [typed, setTyped] = useState(reduced ? PROMPT.length : 0);
  const [activeStep, setActiveStep] = useState(reduced ? STEPS.length : -1);
  const [revealed, setRevealed] = useState(reduced ? ASSETS.length : 0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (reduced) return;
    const t = timers.current;
    let i = 0;
    const typeId = window.setInterval(() => {
      setTyped((i += 1));
      if (i >= PROMPT.length) {
        window.clearInterval(typeId);
        setActiveStep(0);
        STEPS.forEach((_, s) => t.push(window.setTimeout(() => setActiveStep(s + 1), 700 + s * 650)));
        const afterSteps = 700 + STEPS.length * 650 + 300;
        ASSETS.forEach((_, c) => t.push(window.setTimeout(() => setRevealed(c + 1), afterSteps + c * 520)));
      }
    }, 24);
    t.push(typeId);
    return () => { t.forEach((id) => { window.clearTimeout(id); window.clearInterval(id); }); timers.current = []; };
  }, [reduced]);

  const stepsShown = activeStep < 0 ? 0 : Math.min(STEPS.length, activeStep + 1);
  const working = activeStep >= 0 && activeStep < STEPS.length;
  const producing = activeStep >= STEPS.length && revealed < ASSETS.length;
  const showOutputs = activeStep >= STEPS.length;

  return (
    <div className="relative rounded-3xl border border-border bg-card/70 p-3.5 shadow-2xl backdrop-blur-xl ring-1 ring-brand-500/10 sm:p-4">
      <div className="flex items-center gap-2 px-1 pb-3 text-xs text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 font-medium">FlowSmartly · agent</span>
        {(working || producing) && <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-500"><Loader2 className="h-3 w-3 animate-spin" /> working…</span>}
        {!working && !producing && typed >= PROMPT.length && <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500"><Check className="h-3 w-3" /> done</span>}
      </div>

      <div className="rounded-2xl bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple text-white"><Sparkles className="h-[18px] w-[18px]" /></span>
          <p className="pt-1 text-[15px] leading-relaxed text-foreground">
            {PROMPT.slice(0, typed)}
            {typed < PROMPT.length && <span className="ml-0.5 inline-block h-[1.05em] w-0.5 -translate-y-0.5 animate-pulse bg-emerald-400 align-middle" />}
          </p>
        </div>

        {stepsShown > 0 && (
          <div className="mt-4 space-y-2">
            {STEPS.slice(0, stepsShown).map((label, s) => {
              const done = s < activeStep;
              return (
                <motion.div key={label} initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={cn("flex items-center gap-2 text-[13px]", done ? "text-muted-foreground" : "font-medium text-foreground")}>
                  {done ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><Check className="h-3 w-3" /></span>
                  ) : (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500/15 text-brand-500"><Loader2 className="h-3 w-3 animate-spin" /></span>
                  )}
                  {label}
                </motion.div>
              );
            })}
          </div>
        )}

        {showOutputs && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {ASSETS.map((a, i) => (
              <div key={a.kind}>
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border">
                  {i < revealed ? (
                    <motion.div initial={reduced ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="h-full w-full">
                      <AssetPreview kind={a.kind} className="h-full w-full rounded-none border-0" />
                    </motion.div>
                  ) : (
                    <div className="grid h-full w-full animate-pulse place-items-center bg-muted"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  )}
                </div>
                <p className="mt-1 text-center text-[10px] font-semibold text-muted-foreground">{a.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/60 px-3 py-2.5">
        <span className="flex-1 truncate text-sm text-muted-foreground">Ask FlowSmartly to do something…</span>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple text-white"><ArrowUp className="h-4 w-4" /></span>
      </div>
    </div>
  );
}

export function HeroSection() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const reduced = useReducedMotion();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    router.push(trimmed ? `/register?email=${encodeURIComponent(trimmed)}` : "/register");
  }

  return (
    <section className="relative isolate overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pt-40 lg:px-8">
      <AuroraBackdrop />
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center lg:text-left"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]" />
            Your AI marketing team — in one chat
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
            One agent runs<br /><GradientText>your whole marketing.</GradientText>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-muted-foreground lg:mx-0">
            Describe the outcome. The agent designs, prints, publishes, advertises, builds your store &amp; site, and chases leads — across every surface. You only pay for the work it does.
          </p>
          <form onSubmit={handleSubmit} className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:flex-row lg:mx-0">
            <label className="flex min-h-14 flex-1 items-center rounded-2xl border border-input bg-card px-4 text-left text-sm shadow-lg focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
              <span className="sr-only">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <Magnetic>
              <Button type="submit" size="lg" className="min-h-14 gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-purple px-8 text-base font-bold text-white hover:opacity-90">
                Try free <ArrowRight className="h-5 w-5" />
              </Button>
            </Magnetic>
          </form>
          <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground lg:justify-start">
            {proofItems.map((item) => (
              <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{item}</span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <AgentComposer />
        </motion.div>
      </div>
    </section>
  );
}
