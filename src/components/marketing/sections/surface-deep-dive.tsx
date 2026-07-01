"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraBackdrop, GradientText, Magnetic, Parallax, Reveal, RevealGroup, RevealItem } from "@/components/marketing/motion";
import { SURFACES, SURFACE_BY_KEY, type Surface } from "@/components/marketing/surfaces";
import { FinalCta } from "@/components/marketing/sections/final-cta";
import { cn } from "@/lib/utils/cn";

/** A floating, parallaxed illustration for the surface (generated art, full-bleed). */
function FloatingArt({ surface }: { surface: Surface }) {
  const reduced = useReducedMotion();
  return (
    <Parallax speed={0.14} className="relative">
      <motion.div
        className="relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden rounded-[2rem] border border-border shadow-2xl"
        animate={reduced ? undefined : { y: [0, -12, 0] }}
        transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image src={surface.image} alt={`${surface.label} illustration`} fill unoptimized sizes="440px" className="object-cover" priority />
      </motion.div>
    </Parallax>
  );
}

export function SurfaceDeepDive({ surfaceKey }: { surfaceKey: string }) {
  // Look the surface up on the client so the lucide icon (a function/component)
  // never has to cross the server -> client props boundary.
  const surface = SURFACE_BY_KEY[surfaceKey];
  const others = SURFACES.filter((s) => s.key !== surface.key);
  const Icon = surface.icon;

  return (
    <>
      {/* hero */}
      <section className="relative isolate overflow-hidden px-4 pb-16 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <AuroraBackdrop intensity={0.9} />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <Reveal>
            <Link href="/#surfaces" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> All surfaces
            </Link>
            <div className="mt-5 flex items-center gap-3">
              <span className={cn("grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg", surface.accent)}>
                <Icon className="h-7 w-7" />
              </span>
              <span className="text-sm font-bold uppercase tracking-[3px] text-brand-500">{surface.tagline}</span>
            </div>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.06] sm:text-5xl lg:text-6xl">
              <GradientText>{surface.label}.</GradientText> Done by the agent.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">{surface.pitch}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {surface.samples.map((s) => (
                <span key={s} className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur">{s}</span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Button asChild size="lg" className="min-h-13 gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-purple px-7 font-bold text-white hover:opacity-90">
                  <Link href="/register">Start free <ArrowRight className="h-5 w-5" /></Link>
                </Button>
              </Magnetic>
              <Button asChild variant="outline" size="lg" className="min-h-13 rounded-2xl font-semibold">
                <Link href="/#work">Watch it work</Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <FloatingArt surface={surface} />
          </Reveal>
        </div>
      </section>

      {/* capabilities */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal><h2 className="max-w-2xl text-balance font-display text-3xl font-extrabold leading-tight sm:text-4xl">What the agent does on <span className="text-brand-600 dark:text-brand-300">{surface.label}</span>.</h2></Reveal>
          <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-2" stagger={0.07}>
            {surface.capabilities.map((c) => (
              <RevealItem key={c}>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
                  <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white", surface.accent)}><Check className="h-4 w-4" /></span>
                  <p className="text-[15px] font-medium text-foreground">{c}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* other surfaces */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal><div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[3px] text-brand-500"><Sparkles className="h-4 w-4" /> One agent, more surfaces</div></Reveal>
          <RevealGroup className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
            {others.map((s) => {
              const OIcon = s.icon;
              return (
                <RevealItem key={s.key}>
                  <Link href={`/surfaces/${s.key}`} className="flex h-full items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40">
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white", s.accent)}><OIcon className="h-5 w-5" /></span>
                    <span className="min-w-0"><span className="block text-sm font-bold text-foreground">{s.label}</span><span className="block truncate text-xs text-muted-foreground">{s.tagline}</span></span>
                  </Link>
                </RevealItem>
              );
            })}
          </RevealGroup>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
