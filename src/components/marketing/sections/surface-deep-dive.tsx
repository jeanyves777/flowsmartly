"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, FileCheck2, Ruler, Sparkles, SwatchBook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraBackdrop, GradientText, Magnetic, Parallax, Reveal, RevealGroup, RevealItem } from "@/components/marketing/motion";
import { SURFACES, SURFACE_BY_KEY, type Surface } from "@/components/marketing/surfaces";
import { FinalCta } from "@/components/marketing/sections/final-cta";
import { cn } from "@/lib/utils/cn";

const printProofItems = [
  { icon: Ruler, label: "Bleed guides" },
  { icon: SwatchBook, label: "Color proof" },
  { icon: FileCheck2, label: "Export ready" },
];

const galleryLabels: Record<string, string[]> = {
  print: ["Flyer proof", "Card system", "Brochure + product"],
};

/** A floating, parallaxed illustration for the surface (generated art, full-bleed). */
function FloatingArt({ surface }: { surface: Surface }) {
  const reduced = useReducedMotion();
  const isPrint = surface.key === "print";
  return (
    <Parallax speed={0.14} className="relative">
      <motion.div
        className="relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden rounded-[2rem] border border-border shadow-2xl"
        animate={reduced ? undefined : { y: [0, -12, 0] }}
        transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image src={surface.image} alt={`${surface.label} illustration`} fill unoptimized sizes="440px" className="object-cover" priority />
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,0.28)_45%,transparent_68%)]"
          animate={reduced ? undefined : { x: ["-120%", "120%"] }}
          transition={reduced ? undefined : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Generated preview
        </span>
        {isPrint && (
          <>
            <div className="absolute left-4 top-4 rounded-2xl border border-white/55 bg-white/82 px-3 py-2 text-xs font-bold text-slate-900 shadow-lg backdrop-blur">
              300 DPI proof
            </div>
            <div className="absolute bottom-4 right-4 grid gap-2">
              {printProofItems.map((item, index) => {
                const ItemIcon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={reduced ? false : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.08 }}
                    className="flex items-center gap-2 rounded-xl border border-white/50 bg-slate-950/72 px-3 py-2 text-[11px] font-semibold text-white shadow-lg backdrop-blur"
                  >
                    <ItemIcon className="h-3.5 w-3.5 text-cyan-200" />
                    {item.label}
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
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
  const gallery = [1, 2, 3].map((n) => `/marketing/generated/gallery-${surface.key}-${n}.webp`);
  const labels = galleryLabels[surface.key] || surface.samples.slice(0, 3);

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
            {surface.key === "print" && (
              <div className="mt-5 grid max-w-xl gap-2 sm:grid-cols-3">
                {printProofItems.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 px-3 py-2 text-xs font-bold text-foreground backdrop-blur">
                      <ItemIcon className="h-4 w-4 text-cyan-500" />
                      {item.label}
                    </div>
                  );
                })}
              </div>
            )}
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

      {/* sample-output gallery — surface-specific, so every product page is visually distinct */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal><p className="text-sm font-bold uppercase tracking-[3px] text-brand-500">Sample output</p></Reveal>
          <Reveal delay={0.06}><h2 className="mt-3 max-w-2xl text-balance font-display text-3xl font-extrabold leading-tight sm:text-4xl">A taste of what the agent ships on <span className="text-brand-600 dark:text-brand-300">{surface.label}</span>.</h2></Reveal>
          <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-3" stagger={0.08}>
            {gallery.map((src, i) => (
              <RevealItem key={src}>
                <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
                  <Image src={src} alt={`${surface.label} sample ${i + 1}`} fill unoptimized sizes="(min-width:1024px) 30vw, 90vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  <span className={cn("absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br text-white shadow", surface.accent)}><Icon className="h-4 w-4" /></span>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/82 via-slate-950/30 to-transparent p-4 text-white opacity-95">
                    <p className="text-sm font-bold">{labels[i] || surface.samples[i] || "Sample output"}</p>
                    <p className="mt-1 text-xs text-white/75">{surface.key === "print" ? "Generated print proof with safe-zone aware composition." : "Generated by the FlowSmartly agent."}</p>
                  </div>
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
