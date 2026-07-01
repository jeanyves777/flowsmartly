"use client";

import { Bot, Coins, PenLine, type LucideIcon } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/marketing/motion";
import { cn } from "@/lib/utils/cn";

const POINTS: { icon: LucideIcon; title: string; body: string; accent: string }[] = [
  { icon: Bot, title: "One agent, not ten tools", body: "Design, print, social, ads, store, site, email, SMS and leads — the same agent operates every surface from one chat.", accent: "from-brand-500 to-accent-purple" },
  { icon: Coins, title: "Pay for work, not seats", body: "No per-seat subscriptions. Buy credits and the agent spends them only on the work it delivers — every action shows its price first.", accent: "from-emerald-500 to-teal-500" },
  { icon: PenLine, title: "You stay in control", body: "Every asset lands in a live editor. Tweak the copy, colours and layout, then approve — nothing ships until you say so.", accent: "from-fuchsia-500 to-violet-500" },
];

export function WhyDifferent() {
  return (
    <section className="relative px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal><h2 className="max-w-2xl text-balance font-display text-3xl font-extrabold leading-tight sm:text-4xl">Built to actually do the work — not just suggest it.</h2></Reveal>
        <RevealGroup className="mt-10 grid gap-4 md:grid-cols-3" stagger={0.08}>
          {POINTS.map((p) => {
            const Icon = p.icon;
            return (
              <RevealItem key={p.title}>
                <div className="h-full rounded-3xl border border-border bg-card/60 p-7 backdrop-blur">
                  <span className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg", p.accent)}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-xl font-bold text-foreground">{p.title}</h3>
                  <p className="mt-2 leading-7 text-muted-foreground">{p.body}</p>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
