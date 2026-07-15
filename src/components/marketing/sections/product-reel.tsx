"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ProductMedia } from "@/components/marketing/product-media";
import { GradientText, Reveal, RevealGroup, RevealItem } from "@/components/marketing/motion";
import { SURFACE_BY_KEY } from "@/components/marketing/surfaces";

const REELS = [
  {
    key: "create",
    credits: "~15 credits",
    blurb: "Brand-matched designs on a live canvas.",
  },
  {
    key: "grow",
    credits: "~40 credits",
    blurb: "Story-ads and campaigns ready to launch.",
  },
  {
    key: "sell",
    credits: "~25 credits",
    blurb: "Storefront, products, and checkout.",
  },
  {
    key: "publish",
    credits: "~8 credits",
    blurb: "Captions, calendar, and multi-channel posts.",
  },
] as const;

/** Horizontal product proof reel — short autoplaying clips of real agent output. */
export function ProductReel() {
  return (
    <section id="reel" className="relative px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <Reveal>
              <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[3px] text-brand-500">
                <Sparkles className="h-3.5 w-3.5" /> Product in motion
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="mt-3 text-balance font-display text-3xl font-extrabold leading-tight sm:text-5xl">
                Real output. <GradientText>Not stock footage.</GradientText>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 text-lg text-muted-foreground">
                Designs, ads, stores, and posts the agent actually ships — each priced in credits before it runs.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.12}>
            <Link
              href="/#work"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-400 transition-colors hover:text-brand-300"
            >
              Watch the full flow <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>

        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.07}>
          {REELS.map((reel) => {
            const surface = SURFACE_BY_KEY[reel.key];
            if (!surface) return null;
            return (
              <RevealItem key={reel.key}>
                <Link
                  href={`/surfaces/${surface.key}`}
                  className="group block overflow-hidden rounded-3xl border border-border bg-card/50 shadow-lg ring-1 ring-white/5 transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-xl"
                >
                  <ProductMedia
                    src={surface.video}
                    poster={surface.image}
                    alt={`${surface.label} agent output`}
                    className="aspect-[4/5] transition-transform duration-500 group-hover:scale-[1.02]"
                    caption={`${surface.label} · ${reel.credits}`}
                    sizes="(min-width:1024px) 22vw, 45vw"
                  />
                  <div className="p-4">
                    <p className="text-sm font-bold text-foreground">{surface.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{reel.blurb}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
                      Explore <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
