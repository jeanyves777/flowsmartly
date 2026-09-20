"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Sparkles, ArrowUp, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraBackdrop, GradientText, Magnetic } from "@/components/marketing/motion";
import { AssetPreview, type AssetKind } from "@/components/marketing/asset-preview";
import { cn } from "@/lib/utils/cn";

const proofItems = ["Human approval built in", "No credit card", "Pay for outcomes, not seats"];

type DemoScript = {
  id: string;
  chip: string;
  prompt: string;
  match: RegExp;
  steps: string[];
  assets: { label: string; kind: AssetKind }[];
};

const DEMOS: DemoScript[] = [
  {
    id: "bakery",
    chip: "Fall promo campaign",
    prompt: "Launch my bakery's fall promo — designs, a flyer, posts and an ad.",
    match: /baker|fall|promo|flyer|campaign/i,
    steps: ["Planning the campaign", "Designing 3 creatives", "Writing 5 posts", "Building the flyer", "Drafting the ad"],
    assets: [
      { label: "Design", kind: "design" },
      { label: "Video", kind: "video" },
      { label: "Website", kind: "website" },
    ],
  },
  {
    id: "store",
    chip: "Open a store",
    prompt: "Spin up a store for my handmade jewelry — products, copy, and checkout.",
    match: /store|shop|ecommerce|product|jewelry|sell/i,
    steps: ["Scoping the storefront", "Writing product copy", "Building product imagery", "Wiring checkout", "Polishing the theme"],
    assets: [
      { label: "Website", kind: "website" },
      { label: "Design", kind: "design" },
      { label: "Posts", kind: "posts" },
    ],
  },
  {
    id: "video",
    chip: "Story-ad video",
    prompt: "Make a 15s story-ad for my fitness studio with native audio.",
    match: /video|reel|story|ad|fitness|audio/i,
    steps: ["Casting the scene", "Writing the script", "Generating the story-ad", "Mixing native audio", "Exporting social cuts"],
    assets: [
      { label: "Video", kind: "video" },
      { label: "Ad", kind: "ad" },
      { label: "Posts", kind: "posts" },
    ],
  },
];

const DEFAULT_DEMO = DEMOS[0];

function pickDemo(text: string): DemoScript {
  const t = text.trim();
  if (!t) return DEFAULT_DEMO;
  return DEMOS.find((d) => d.match.test(t)) ?? {
    ...DEFAULT_DEMO,
    id: "custom",
    prompt: t,
  };
}

/** Interactive agent composer — auto-demo on load; visitors can type or pick a chip. */
function AgentComposer() {
  const reduced = useReducedMotion();
  const [demo, setDemo] = useState<DemoScript>(DEFAULT_DEMO);
  const [typed, setTyped] = useState(reduced ? DEFAULT_DEMO.prompt.length : 0);
  const [activeStep, setActiveStep] = useState(reduced ? DEFAULT_DEMO.steps.length : -1);
  const [revealed, setRevealed] = useState(reduced ? DEFAULT_DEMO.assets.length : 0);
  const [input, setInput] = useState("");
  const timers = useRef<number[]>([]);
  const fastTypeRef = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    timers.current = [];
  }, []);

  const startRun = useCallback(
    (script: DemoScript) => {
      clearTimers();
      setDemo(script);
      if (reduced) {
        setTyped(script.prompt.length);
        setActiveStep(script.steps.length);
        setRevealed(script.assets.length);
        return;
      }
      setTyped(0);
      setActiveStep(-1);
      setRevealed(0);
      const t = timers.current;
      let i = 0;
      const typeMs = fastTypeRef.current ? 14 : 22;
      const typeId = window.setInterval(() => {
        setTyped((i += 1));
        if (i >= script.prompt.length) {
          window.clearInterval(typeId);
          setActiveStep(0);
          script.steps.forEach((_, s) =>
            t.push(window.setTimeout(() => setActiveStep(s + 1), 550 + s * 520)),
          );
          const afterSteps = 550 + script.steps.length * 520 + 280;
          script.assets.forEach((_, c) =>
            t.push(window.setTimeout(() => setRevealed(c + 1), afterSteps + c * 420)),
          );
        }
      }, typeMs);
      t.push(typeId);
    },
    [clearTimers, reduced],
  );

  useEffect(() => {
    startRun(DEFAULT_DEMO);
    return clearTimers;
  }, [startRun, clearTimers]);

  function runPrompt(text: string) {
    const script = pickDemo(text);
    fastTypeRef.current = true;
    setInput("");
    startRun(script);
  }

  function onComposerSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim() || DEFAULT_DEMO.prompt;
    runPrompt(text);
  }

  const stepsShown = activeStep < 0 ? 0 : Math.min(demo.steps.length, activeStep + 1);
  const working = activeStep >= 0 && activeStep < demo.steps.length;
  const producing = activeStep >= demo.steps.length && revealed < demo.assets.length;
  const showOutputs = activeStep >= demo.steps.length;
  const done = !working && !producing && typed >= demo.prompt.length;

  return (
    <div className="relative rounded-3xl border border-border bg-card/70 p-3.5 shadow-2xl backdrop-blur-xl ring-1 ring-brand-500/15 sm:p-4">
      <div className="flex items-center gap-2 px-1 pb-3 text-xs text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 font-medium">FlowSmartly · agent</span>
        {(working || producing) && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-400">
            <Loader2 className="h-3 w-3 animate-spin" /> working…
          </span>
        )}
        {done && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <Check className="h-3 w-3" /> done
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {DEMOS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => runPrompt(d.prompt)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              demo.id === d.id
                ? "border-brand-500/50 bg-brand-500/15 text-brand-300"
                : "border-border bg-muted/40 text-muted-foreground hover:border-brand-500/40 hover:text-foreground",
            )}
          >
            {d.chip}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple text-white">
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
          <p className="min-h-[3.2rem] pt-1 text-[15px] leading-relaxed text-foreground">
            {demo.prompt.slice(0, typed)}
            {typed < demo.prompt.length && (
              <span className="ml-0.5 inline-block h-[1.05em] w-0.5 -translate-y-0.5 animate-pulse bg-emerald-400 align-middle" />
            )}
          </p>
        </div>

        {stepsShown > 0 && (
          <div className="mt-4 space-y-2">
            {demo.steps.slice(0, stepsShown).map((label, s) => {
              const stepDone = s < activeStep;
              return (
                <motion.div
                  key={`${demo.id}-${label}`}
                  initial={reduced ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex items-center gap-2 text-[13px]",
                    stepDone ? "text-muted-foreground" : "font-medium text-foreground",
                  )}
                >
                  {stepDone ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500/15 text-brand-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </span>
                  )}
                  {label}
                </motion.div>
              );
            })}
          </div>
        )}

        {showOutputs && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {demo.assets.map((a, i) => (
              <div key={`${demo.id}-${a.kind}-${a.label}`}>
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border">
                  {i < revealed ? (
                    <motion.div
                      initial={reduced ? false : { opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="h-full w-full"
                    >
                      <AssetPreview kind={a.kind} className="h-full w-full rounded-none border-0" />
                    </motion.div>
                  ) : (
                    <div className="grid h-full w-full animate-pulse place-items-center bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="mt-1 text-center text-[10px] font-semibold text-muted-foreground">{a.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onComposerSubmit} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/60 px-3 py-2 focus-within:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/20">
        <label className="sr-only" htmlFor="hero-agent-prompt">
          Ask the agent
        </label>
        <input
          id="hero-agent-prompt"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Try it — describe what you want…"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Run agent demo"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple text-white transition-opacity hover:opacity-90"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-2 px-1 text-[11px] text-muted-foreground">
        Interactive preview — start free to run the real agent on your brand.
      </p>
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
    <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#050b0a] px-4 pb-20 pt-32 sm:px-6 sm:pt-40 lg:px-8">
      <AuroraBackdrop />
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center lg:text-left"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-1.5 text-xs font-semibold text-emerald-200 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]" />
            Autonomous growth, with you in control
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
            Turn every signal into
            <br />
            <GradientText>your next growth action.</GradientText>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-muted-foreground lg:mx-0">
            FlowSmartly connects customer data, content, conversations, campaigns, commerce and local discovery—then prepares the next best move for your approval.
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
              <Button
                type="submit"
                size="lg"
                className="min-h-14 gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-purple px-8 text-base font-bold text-white hover:opacity-90"
              >
                Start building <ArrowRight className="h-5 w-5" />
              </Button>
            </Magnetic>
          </form>
          <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground lg:justify-start">
            {proofItems.map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {item}
              </span>
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
