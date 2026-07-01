"use client";

import { Counter, GradientText, Reveal } from "@/components/marketing/motion";

const STATS: { value: number; prefix?: string; suffix?: string; label: string }[] = [
  { value: 9, label: "surfaces the agent runs" },
  { value: 1, label: "chat to run them all" },
  { value: 0, prefix: "$", label: "per-seat fees — pay per work" },
  { value: 100, suffix: "%", label: "of assets stay editable" },
];

/** A compact band of honest, count-up outcome numbers. */
export function OutcomesSection() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="mb-10 max-w-2xl text-balance font-display text-3xl font-extrabold leading-tight sm:text-4xl">
            One agent. Every surface. <GradientText>Zero busywork.</GradientText>
          </h2>
        </Reveal>
        <div className="grid grid-cols-2 gap-6 rounded-3xl border border-border bg-card/60 p-8 backdrop-blur sm:grid-cols-4 sm:gap-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <Counter to={s.value} prefix={s.prefix} suffix={s.suffix} className="font-display text-4xl font-extrabold text-foreground sm:text-5xl" />
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
