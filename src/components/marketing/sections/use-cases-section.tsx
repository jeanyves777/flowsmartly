"use client";

import { User, Store, Users, ShoppingCart, type LucideIcon } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/marketing/motion";
import { cn } from "@/lib/utils/cn";

const CASES: { icon: LucideIcon; who: string; line: string; accent: string }[] = [
  { icon: User, who: "Solo creators", line: "Post daily, sell products and grow — without hiring a team or juggling ten apps.", accent: "from-brand-500 to-blue-500" },
  { icon: Store, who: "Local businesses", line: "Flyers, promos, reviews and a booking site — the agent keeps your presence fresh.", accent: "from-emerald-500 to-teal-500" },
  { icon: Users, who: "Agencies", line: "Run every client from one account; the agent does the production, you do the strategy.", accent: "from-violet-500 to-fuchsia-500" },
  { icon: ShoppingCart, who: "E-commerce", line: "Storefront, product copy, ads and email flows — launched and optimised for you.", accent: "from-amber-500 to-orange-500" },
];

export function UseCasesSection() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal><p className="text-sm font-bold uppercase tracking-[3px] text-brand-500">Who it&apos;s for</p></Reveal>
        <Reveal delay={0.06}><h2 className="mt-3 max-w-2xl text-balance font-display text-3xl font-extrabold leading-tight sm:text-4xl">One workspace, whatever you&apos;re growing.</h2></Reveal>
        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.07}>
          {CASES.map((c) => {
            const Icon = c.icon;
            return (
              <RevealItem key={c.who}>
                <div className="h-full rounded-3xl border border-border bg-card/60 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40">
                  <span className={cn("grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg", c.accent)}>
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-foreground">{c.who}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{c.line}</p>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
