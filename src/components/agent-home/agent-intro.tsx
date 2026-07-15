"use client";

import { useState } from "react";
import { Palette, Clapperboard, Megaphone, ArrowRight, Check, Minus, Plus, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * First-run "Meet your agent" overlay shown once on the home (localStorage-gated
 * by the parent). Lets the user pick where to start — Creation / Film / Marketing
 * — and previews a REAL monthly credit estimate built from the actual per-action
 * costs in `@/lib/credits/costs.ts` (100 credits = $1). The choice becomes the
 * home composer's default agent. Purely presentational + a client-side estimate;
 * no work runs and nothing is charged here.
 */

// Real per-action credit costs mirrored from DEFAULT_CREDIT_COSTS (labelled as an
// estimate in the UI). Kept as plain numbers so this stays a client component.
type Item = { key: string; label: string; unit: number; def: number };
const AGENTS: { key: string; label: string; blurb: string; Icon: LucideIcon; items: Item[] }[] = [
  {
    key: "creation", label: "Creation", blurb: "Design, logos, sites & print", Icon: Palette,
    items: [
      { key: "design", label: "Branded designs", unit: 15, def: 12 }, // AI_VISUAL_DESIGN
      { key: "logo", label: "Logos", unit: 60, def: 1 },              // AI_LOGO_GENERATION
    ],
  },
  {
    key: "film", label: "Film", blurb: "Cinematic films & UGC creator videos", Icon: Clapperboard,
    items: [
      { key: "video", label: "Film scenes (8s shots)", unit: 30, def: 6 }, // AI_VIDEO_LITE
      { key: "ugc", label: "UGC creator videos (8s)", unit: 8, def: 4 },   // AI_VIDEO_LITE
    ],
  },
  {
    key: "marketing", label: "Marketing", blurb: "Leads, campaigns & publishing", Icon: Megaphone,
    items: [
      { key: "post", label: "Campaign posts (caption + image)", unit: 15, def: 16 }, // AI_POST + image
      { key: "lead", label: "Lead lookups", unit: 3, def: 50 },                       // AI_WEB_SEARCH
    ],
  },
];

export function AgentIntro({ onDone }: { onDone: (agentKey: string | null) => void }) {
  const [sel, setSel] = useState("creation");
  // Per-agent volumes keyed `${agentKey}:${itemKey}` so switching preserves each.
  const [vol, setVol] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    AGENTS.forEach((a) => a.items.forEach((it) => { v[`${a.key}:${it.key}`] = it.def; }));
    return v;
  });

  const agent = AGENTS.find((a) => a.key === sel)!;
  const total = agent.items.reduce((sum, it) => sum + it.unit * (vol[`${sel}:${it.key}`] ?? it.def), 0);
  const dollars = total / 100; // 100 credits = $1.00
  const setV = (itemKey: string, next: number) => setVol((v) => ({ ...v, [`${sel}:${itemKey}`]: Math.max(0, next) }));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-[860px] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <button onClick={() => onDone(null)} aria-label="Skip" className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px]">
          {/* left — pick + estimate */}
          <div className="p-6 sm:p-8">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-500">
              ✦ Set up your agent
            </div>
            <h2 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[30px]">
              Meet your agent. <span className="bg-gradient-to-r from-brand-500 to-violet-500 bg-clip-text text-transparent">It works. You pay for the work.</span>
            </h2>
            <p className="mt-2 text-[13.5px] text-muted-foreground">Pick where to start — you can switch anytime in the composer.</p>

            {/* agent picker */}
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {AGENTS.map((a) => {
                const on = a.key === sel;
                return (
                  <button key={a.key} onClick={() => setSel(a.key)} className={cn("flex flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition-all", on ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40 hover:bg-muted/40")}>
                    <span className={cn("grid h-9 w-9 place-items-center rounded-xl", on ? "bg-gradient-to-br from-brand-500 to-violet-500 text-white" : "bg-muted text-muted-foreground")}>
                      <a.Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="flex items-center gap-1 text-[13.5px] font-bold">{a.label}{on && <Check className="h-3.5 w-3.5 text-brand-500" />}</span>
                    <span className="text-[11.5px] leading-snug text-muted-foreground">{a.blurb}</span>
                  </button>
                );
              })}
            </div>

            {/* estimator */}
            <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Your expected month</div>
              <div className="divide-y divide-border">
                {agent.items.map((it) => {
                  const q = vol[`${sel}:${it.key}`] ?? it.def;
                  return (
                    <div key={it.key} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium">{it.label}</div>
                        <div className="text-[11px] text-muted-foreground">{it.unit} credits each</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setV(it.key, q - 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-8 text-center text-[13px] font-bold tabular-nums">{q}</span>
                        <button onClick={() => setV(it.key, q + 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* right — credits promise + estimate + CTA */}
          <div className="flex flex-col gap-4 border-t border-border bg-muted/20 p-6 sm:p-8 md:border-l md:border-t-0">
            <div>
              <h3 className="text-[18px] font-extrabold">Credits. Not contracts.</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                Start free and only pay for the work the agent does. No per-seat fees, no lock-in — and every action shows its <span className="font-semibold text-foreground">exact cost before it runs</span>.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Estimated average / month</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="bg-gradient-to-r from-brand-500 to-violet-500 bg-clip-text text-[34px] font-black leading-none tracking-tight text-transparent">{total.toLocaleString()}</span>
                <span className="text-[13px] font-semibold text-muted-foreground">credits / mo</span>
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">≈ ${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in credits · pay-as-you-go</div>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px]">
                🎁 You start with <b className="text-emerald-600 dark:text-emerald-400">free credits</b> to try it.
              </div>
            </div>
            <button onClick={() => onDone(sel)} className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-3 text-[14.5px] font-bold text-white shadow-lg shadow-brand-500/20 transition hover:brightness-105">
              Start with {agent.label} <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => onDone(null)} className="text-center text-[12px] text-muted-foreground hover:text-foreground">Skip for now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
