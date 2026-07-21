import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { toCents as toCentsCur, fromCents as fromCentsCur, isZeroDecimalCurrency } from "@/lib/store/currency";

/**
 * Shared presentational primitives for the /home/sell management surfaces
 * (Overview, Categories, Shipping, Settings, Payments, Analytics). One copy of
 * the field styles, money formatter, section card, toggle, stat tile and empty
 * state so every store surface reads as one system. Money helpers are
 * currency-aware (zero-decimal currencies like XOF/JPY/KRW are NOT ×100).
 */

export const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
export const LABEL = "mb-1 block text-[11px] font-medium text-muted-foreground";

export function money(cents?: number | null, currency = "USD"): string {
  const c = cents ?? 0;
  const value = isZeroDecimalCurrency(currency) ? c : c / 100;
  try { return value.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: isZeroDecimalCurrency(currency) ? 0 : 2 }); }
  catch { return `${value.toFixed(isZeroDecimalCurrency(currency) ? 0 : 2)}`; }
}

/** Parse a typed amount string to integer cents (undefined for blank). */
export function toCents(v: string, currency = "USD"): number | undefined {
  if (!v || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? toCentsCur(v, currency) : undefined;
}

export function dollars(cents?: number | null, currency = "USD"): string {
  return cents != null ? fromCentsCur(cents, currency) : "";
}

export function SectionCard({ title, hint, right, icon: Icon, children, className }: { title?: string; hint?: string; right?: ReactNode; icon?: ElementType; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title && <h3 className="text-[13px] font-bold">{title}</h3>}
          {hint && <p className="w-full text-[11.5px] text-muted-foreground">{hint}</p>}
          {right && <div className="ms-auto flex items-center gap-2">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  // Matches the app's canonical Switch (components/ui/switch.tsx): h-6 w-11
  // track, h-5 w-5 thumb, flex-centered so the knob never overhangs the pill.
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} disabled={disabled} className={cn("inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-brand-500" : "bg-input")}>
      <span className={cn("pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform", on ? "translate-x-5" : "translate-x-0")} />
    </button>
  );
}

export function StatTile({ label, value, delta, icon: Icon }: { label: string; value: string; delta?: { up: boolean; text: string } | null; icon?: ElementType }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</div>
      <div className="mt-1.5 text-[22px] font-extrabold tabular-nums tracking-tight">{value}</div>
      {delta && <div className={cn("mt-0.5 text-[11px] font-semibold tabular-nums", delta.up ? "text-emerald-500" : "text-rose-500")}>{delta.up ? "▲" : "▼"} {delta.text}</div>}
    </div>
  );
}

export function EmptyState({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      {sub && <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function MoneyInput({ currency, value, onChange, placeholder }: { currency: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">{currency}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder={placeholder || "0.00"} className={cn(FIELD, "pl-11")} />
    </div>
  );
}
