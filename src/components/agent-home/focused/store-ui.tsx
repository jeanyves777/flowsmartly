import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared presentational primitives for the /home/sell management surfaces
 * (Overview, Categories, Shipping, Settings, Payments, Analytics). One copy of
 * the field styles, money formatter, section card, toggle, stat tile and empty
 * state so every store surface reads as one system.
 */

export const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
export const LABEL = "mb-1 block text-[11px] font-medium text-muted-foreground";

export function money(cents?: number | null, currency = "USD"): string {
  try { return ((cents ?? 0) / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 }); }
  catch { return `${((cents ?? 0) / 100).toFixed(2)}`; }
}

/** Parse a dollar string to integer cents (undefined for blank/invalid). */
export function toCents(v: string): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && v.trim() !== "" ? Math.round(n * 100) : undefined;
}

export function dollars(cents?: number | null): string {
  return cents != null ? String(cents / 100) : "";
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
  return (
    <button onClick={onClick} disabled={disabled} className={cn("relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-brand-500" : "bg-muted")}>
      <span className={cn("absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
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
