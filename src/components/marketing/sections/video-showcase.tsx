"use client";

import { Sparkles } from "lucide-react";
import { AuroraBackdrop, GradientText, Reveal } from "@/components/marketing/motion";

const chips = ["Video ads", "Story-ads", "Product reels", "Native audio"];

/** Featured full-bleed video — agent-produced motion as the product. */
export function VideoShowcase() {
  return (
    <section className="relative isolate overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
      <AuroraBackdrop intensity={0.7} />
      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[3px] text-brand-500">See it in motion</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-3 text-balance font-display text-3xl font-extrabold leading-tight sm:text-5xl">
              Static isn&apos;t enough — the agent makes <GradientText>video ads</GradientText> too.
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-4 text-lg text-muted-foreground">
              Promo videos, story-ads and product reels — generated with native audio, branded, and ready to post. Same agent, same chat, priced in credits.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.16}>
          <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl ring-1 ring-brand-500/15">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-2 rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                flowsmartly.com · Video studio
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-bold text-brand-400">
                <Sparkles className="h-3 w-3" /> Made by the agent · ~40 credits
              </span>
            </div>
            <div className="relative aspect-video bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                autoPlay
                muted
                loop
                playsInline
                poster="/marketing/generated/asset-ad.webp"
                className="h-full w-full object-cover"
              >
                <source src="/marketing/generated/showcase-hero.mp4" type="video/mp4" />
              </video>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-xs font-semibold text-white/90">Story-ad · branded · ready to post</p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-6 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur"
              >
                {c}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
