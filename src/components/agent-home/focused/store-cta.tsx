"use client";

import { Store, Sparkles, Check, BadgePercent, CreditCard, Wallet, Gift } from "lucide-react";

/**
 * StoreCallToAction — the "no store yet" surface for the Sell workspace. Instead
 * of showing empty Products/Orders/Customers menus, a user without a store sees
 * what they get and exactly what it costs, then one button that has the agent
 * build the store (a heavy generative build → agent-driven). Used by the Sell
 * side panel and the Sell focused view. [[new-design-no-legacy]]
 */

// What the store gives them — grounded in the real ecommerce feature set.
const BENEFITS = [
  "AI builds your branded storefront — design, pages & products in minutes",
  "Product catalog & inventory you fully control",
  "Secure Stripe checkout — cards & Cash-on-Delivery",
  "Orders, customers & delivery tracking in one place",
  "AI product copy, images & ad creatives on tap",
];

// What it costs — exact, no surprises.
const CHARGES: { icon: typeof Gift; label: string; value: string; good?: boolean }[] = [
  { icon: Gift, label: "Activation & hosting", value: "Free — no monthly fee", good: true },
  { icon: BadgePercent, label: "Platform fee per sale", value: "3% of each order" },
  { icon: CreditCard, label: "Card processing", value: "Stripe 2.9% + $0.30" },
  { icon: Wallet, label: "AI store build", value: "~500 credits ($5) once" },
];

export function StoreCallToAction({ onBuild, compact }: { onBuild: () => void; compact?: boolean }) {
  return (
    <div className={compact ? "w-full" : "mx-auto w-full max-w-lg"}>
      <div className="rounded-2xl border border-border bg-card p-5 text-center sm:p-6">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500">
          <Store className="h-7 w-7" />
        </span>
        <h2 className="mt-3 text-[19px] font-extrabold leading-tight">Launch your online store</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Tell the agent what you sell and it builds the whole store — branded storefront, products, and secure checkout — in minutes.
        </p>

        {/* benefits */}
        <ul className="mt-4 space-y-2 text-left">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed">
              <span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-emerald-500/12 text-emerald-500"><Check className="h-3 w-3" /></span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* charges — transparent, exact */}
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-left">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">What it costs</p>
          <div className="space-y-1.5">
            {CHARGES.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="flex items-center gap-2.5">
                  <Icon className={c.good ? "h-3.5 w-3.5 shrink-0 text-emerald-500" : "h-3.5 w-3.5 shrink-0 text-muted-foreground"} />
                  <span className="flex-1 text-[12px] text-muted-foreground">{c.label}</span>
                  <span className={c.good ? "text-[12px] font-semibold text-emerald-500" : "text-[12px] font-semibold text-foreground"}>{c.value}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 border-t border-border/70 pt-2 text-[11px] text-muted-foreground">Store is on the <span className="font-semibold text-foreground">Pro plan</span> and up — the agent will help you switch if you’re not there yet.</p>
        </div>

        <button onClick={onBuild} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30">
          <Sparkles className="h-4 w-4" /> Create my store
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">No charge until you launch — you confirm before anything bills.</p>
      </div>
    </div>
  );
}

// The brief that kicks off the agent's generative store build.
export const STORE_BUILD_PROMPT =
  "Help me build my online store — ask me what I sell, my products and prices, my currency, then create the store.";
