"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Store, Sparkles, Check, BadgePercent, CreditCard, Wallet, Gift, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * StoreCallToAction — the "no store yet" surface for the Sell workspace. Instead
 * of showing empty Products/Orders/Customers menus, a user without a store sees
 * what they get and exactly what it costs, then one button that reveals an INLINE
 * brief. Only the brief's final "Build my store" button spins the agent with the
 * gathered details (mirrors the website builder — gather the brief in the UI
 * FIRST, then spin the agent; no back-and-forth in chat). Used by the Sell side
 * panel and the Sell focused view. [[new-design-no-legacy]]
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

const STORE_STYLES = ["Modern", "Bold", "Minimal", "Elegant", "Playful"];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NGN", "INR", "ZAR"];
const SC_FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

export function StoreCallToAction({ onBuild, compact }: { onBuild: (prompt: string) => void; compact?: boolean }) {
  // The CTA gathers a brief in the UI BEFORE spinning the agent. "Create my
  // store" reveals the inline form; only "Build my store" calls onBuild().
  const [briefing, setBriefing] = useState(false);

  return (
    <div className={compact ? "w-full" : "mx-auto w-full max-w-lg"}>
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        {/* Header — icon + headline. Collapses to a compact row once briefing. */}
        {briefing ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setBriefing(false)} aria-label="Back" className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold leading-tight">Tell us about your store</h2>
              <p className="text-[11.5px] text-muted-foreground">The agent builds the whole branded store with these details — no back-and-forth.</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500">
              <Store className="h-7 w-7" />
            </span>
            <h2 className="mt-3 text-[19px] font-extrabold leading-tight">Launch your online store</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Tell the agent what you sell and it builds the whole store — branded storefront, products, and secure checkout — in minutes.
            </p>
          </div>
        )}

        {briefing ? (
          <StoreBrief onBuild={onBuild} />
        ) : (
          <>
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
            <Charges />

            <button onClick={() => setBriefing(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <Sparkles className="h-4 w-4" /> Create my store
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">No charge until you launch — you confirm before anything bills.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── The transparent charges block (kept visible per the store-CTA product rule). */
function Charges({ className }: { className?: string }) {
  return (
    <div className={cn("mt-4 rounded-xl border border-border bg-muted/30 p-3 text-left", className)}>
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
      <p className="mt-2.5 border-t border-border/70 pt-2 text-[11px] text-muted-foreground">Available on <span className="font-semibold text-foreground">every plan</span> — no upgrade needed to launch.</p>
    </div>
  );
}

/* ── The inline brief — gathered in the UI, then assembled into a detailed prompt
      and handed to the agent via onBuild(). Mirrors the WebsiteBuilder pattern. */
function StoreBrief({ onBuild }: { onBuild: (prompt: string) => void }) {
  const [name, setName] = useState("");
  const [sells, setSells] = useState("");
  const [products, setProducts] = useState("");
  const [style, setStyle] = useState("Modern");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState("");

  // Prefill the store name from the Brand Kit so the user rarely types it.
  useEffect(() => {
    let alive = true;
    fetch("/api/brand").then((r) => r.json()).then((j) => { if (alive && j?.data?.brandKit?.name) setName((n) => n || String(j.data.brandKit.name)); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const build = () => {
    if (!name.trim()) { setError("Add your store name."); return; }
    if (!sells.trim()) { setError("Tell the agent what you sell."); return; }
    const prompt = [
      "Build me a complete, branded online STORE now using my brand kit. I've given you everything below — do NOT ask me questions; design and build the whole storefront, set it up, and add the starter products.",
      `- Store name: ${name.trim()}`,
      `- What I sell (products / category + who it's for): ${sells.trim()}`,
      products.trim() ? `- Starter products to add (with prices): ${products.trim()}` : "",
      `- Store style / vibe: ${style}`,
      `- Currency: ${currency}`,
      "Set up secure Stripe checkout (cards + Cash-on-Delivery). Before you bill anything, confirm the EXACT charges (the ~500-credit / $5 one-time AI store build, 3% platform fee per sale, and Stripe 2.9% + $0.30 card processing) and get my OK first. Confirm in ONE short sentence when the store is ready.",
    ].filter(Boolean).join("\n");
    onBuild(prompt);
  };

  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3.5 sm:grid-cols-2">
        <Field label="Store name *"><input value={name} onChange={(e) => setName(e.target.value)} className={SC_FIELD} placeholder="Acme Goods" /></Field>
        <Field label="Currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={SC_FIELD}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="What you sell *"><textarea value={sells} onChange={(e) => setSells(e.target.value)} rows={2} className={cn(SC_FIELD, "resize-y")} placeholder="e.g. handmade ceramic mugs & homeware for cozy kitchens" /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="A few starter products (optional)"><textarea value={products} onChange={(e) => setProducts(e.target.value)} rows={2} className={cn(SC_FIELD, "resize-y")} placeholder="List a few products with prices — e.g. Blue Mug $20, Mug Set of 4 $70, Espresso Cup $14" /></Field>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Store style / vibe</p>
          <div className="flex flex-wrap gap-1.5">
            {STORE_STYLES.map((s) => (
              <button key={s} onClick={() => setStyle(s)} className={cn("rounded-full border px-2.5 py-1 text-[12px] font-semibold transition", style === s ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{s}</button>
            ))}
          </div>
        </div>
        {error && <p className="text-[12px] text-rose-500 sm:col-span-2">{error}</p>}
      </div>

      {/* Keep the transparent charges visible so the user sees exact costs. */}
      <Charges />

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button onClick={build} className="inline-flex items-center gap-1.5 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Build my store</button>
        <span className="ms-auto hidden text-[11px] text-muted-foreground sm:block">Uses your brand kit · the agent confirms before anything bills.</span>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

// Fallback brief if a caller ever needs the generative kickoff without the form.
export const STORE_BUILD_PROMPT =
  "Help me build my online store — ask me what I sell, my products and prices, my currency, then create the store.";
