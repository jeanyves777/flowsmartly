"use client";

import { Marquee } from "@/components/marketing/motion";

const WORDS = ["Designs", "Print", "Social posts", "Ads", "Storefronts", "Websites", "Email", "SMS", "Leads", "Automations"];

/** A quiet band of everything the one agent produces — reads as capability breadth. */
export function ProofMarquee() {
  return (
    <section aria-label="What the agent produces" className="border-y border-border bg-muted/20 py-6">
      <Marquee
        className="[mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]"
        items={WORDS.map((w) => (
          <span key={w} className="font-display text-xl font-bold text-muted-foreground/50">{w}</span>
        ))}
      />
    </section>
  );
}
