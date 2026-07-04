"use client";

import Link from "next/link";
import { Check, ArrowRight, Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraBackdrop, GradientText, Magnetic, Reveal } from "@/components/marketing/motion";

const freePerks = ["Full workspace, all surfaces", "The agent, ready in the composer", "No credit card to start"];
const creditPerks = ["Top up whenever you need more", "Every action shows its price first", "Credits spend only on delivered work"];

/** Credit-based pricing preview — no hardcoded amounts (admins set costs). */
export function PricingPreview() {
  return (
    <section id="pricing" className="relative isolate overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
      <AuroraBackdrop intensity={0.8} />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <Reveal><h2 className="text-balance font-display text-3xl font-extrabold leading-tight sm:text-5xl">Credits. <GradientText>Not contracts.</GradientText></h2></Reveal>
        <Reveal delay={0.08}><p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">Start free and only pay for the work the agent does. No per-seat fees, no lock-in — and every action shows its exact cost before it runs.</p></Reveal>
      </div>

      <div className="relative z-10 mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
        <Reveal dir="right">
          <div className="flex h-full flex-col rounded-3xl border border-border bg-card/70 p-8 backdrop-blur">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-brand-500/10 px-3 py-1 text-xs font-bold text-brand-600 dark:text-brand-300"><Sparkles className="h-3.5 w-3.5" /> Free workspace</span>
            <div className="mt-4 font-display text-5xl font-extrabold text-foreground">$0</div>
            <p className="mt-1 text-sm text-muted-foreground">to open your workspace</p>
            <ul className="mt-6 space-y-3 text-left">
              {freePerks.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{p}</li>
              ))}
            </ul>
            <Magnetic className="mt-8">
              <Button asChild size="lg" className="w-full gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-purple font-bold text-white hover:opacity-90">
                <Link href="/register">Start free <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </Magnetic>
          </div>
        </Reveal>

        <Reveal dir="left" delay={0.08}>
          <div className="flex h-full flex-col rounded-3xl border border-border bg-card/70 p-8 backdrop-blur">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-accent-purple/10 px-3 py-1 text-xs font-bold text-accent-purple"><Coins className="h-3.5 w-3.5" /> Credits</span>
            <div className="mt-4 font-display text-5xl font-extrabold text-foreground">Pay per work</div>
            <p className="mt-1 text-sm text-muted-foreground">top up any time</p>
            <ul className="mt-6 space-y-3 text-left">
              {creditPerks.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{p}</li>
              ))}
            </ul>
            <Button asChild variant="outline" size="lg" className="mt-8 w-full gap-2 rounded-2xl font-bold">
              <Link href="/pricing">See credit packs <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
