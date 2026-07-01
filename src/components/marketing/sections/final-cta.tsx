"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraBackdrop, GradientText, Magnetic, Reveal } from "@/components/marketing/motion";

/** Closing call-to-action with an aurora wash. */
export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden px-4 py-28">
      <AuroraBackdrop intensity={1.2} />
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <Reveal>
          <h2 className="text-balance font-display text-4xl font-extrabold leading-tight sm:text-6xl">
            Tell the agent what you want.<br /><GradientText>It handles the rest.</GradientText>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Start free — your workspace is ready in seconds. Credits only spend on the work the agent delivers.
          </p>
        </Reveal>
        <Reveal delay={0.18}>
          <Magnetic className="mt-8">
            <Button asChild size="lg" className="min-h-14 gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-purple px-9 text-lg font-bold text-white hover:opacity-90">
              <Link href="/register">Start free <ArrowRight className="h-5 w-5" /></Link>
            </Button>
          </Magnetic>
        </Reveal>
      </div>
    </section>
  );
}
