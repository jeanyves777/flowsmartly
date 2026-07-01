"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import { portraitImages } from "@/components/marketing/public-page-visuals";
import { Reveal } from "@/components/marketing/motion";

const avatars = [
  { src: portraitImages.sarah, alt: "Creator" },
  { src: portraitImages.james, alt: "Local owner" },
  { src: portraitImages.maria, alt: "Agency lead" },
  { src: portraitImages.priya, alt: "Store owner" },
  { src: portraitImages.david, alt: "Marketer" },
  { src: portraitImages.alex, alt: "Founder" },
];

/** An honest social-proof band: the people the one agent is built for, plus a
 * rating — no fabricated named quotes. */
export function SocialProof() {
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <Reveal>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-3xl border border-border bg-card/60 px-6 py-8 text-center backdrop-blur sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center -space-x-3">
            {avatars.map((a) => (
              <span key={a.src} className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-background bg-muted">
                <Image src={a.src} alt={a.alt} fill sizes="44px" className="object-cover" />
              </span>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 sm:justify-start">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="ml-2 text-sm font-bold text-foreground">Built for creators, agencies, local shops &amp; stores</span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">One agent, one workspace — whatever you&apos;re growing, it runs the busywork.</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
