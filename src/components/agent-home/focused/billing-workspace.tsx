"use client";

import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { Coins, CreditCard, Sparkles, ArrowUpRight, ArrowDownRight, Receipt, Gift, Zap, RefreshCw } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Billing & credits — a deep new-design surface (the Business workspace canvas):
 * credit balance, plan, recent usage by type, and the transaction ledger. Real
 * data (GET /api/user/credits + /api/user/credits/history). Buy credits / Manage
 * plan open NATIVE /home focus views (credits / plans) — no legacy links; the
 * final charge is handled by Stripe inside those surfaces. [[new-design-no-legacy]]
 */

interface Txn { id: string; type: string; amount: number; balanceAfter?: number; description?: string | null; referenceType?: string | null; createdAt: string; }

const PLAN_LABEL: Record<string, string> = { STARTER: "Starter", PRO: "Pro", BUSINESS: "Business", ENTERPRISE: "Enterprise", FREE: "Free" };

// Per-type display: sign is taken from the amount, not the type.
const TYPE_META: Record<string, { label: string; icon: ElementType; tone: string }> = {
  PURCHASE: { label: "Purchase", icon: CreditCard, tone: "text-emerald-500" },
  USAGE: { label: "Usage", icon: Zap, tone: "text-rose-500" },
  BONUS: { label: "Bonus", icon: Gift, tone: "text-emerald-500" },
  REFUND: { label: "Refund", icon: RefreshCw, tone: "text-emerald-500" },
  REFERRAL: { label: "Referral", icon: Gift, tone: "text-emerald-500" },
  SUBSCRIPTION: { label: "Subscription", icon: Sparkles, tone: "text-brand-500" },
  WELCOME: { label: "Welcome", icon: Gift, tone: "text-emerald-500" },
  ADMIN_ADJUSTMENT: { label: "Adjustment", icon: Receipt, tone: "text-muted-foreground" },
};
const typeMeta = (t: string) => TYPE_META[t] ?? { label: t.replace(/_/g, " ").toLowerCase(), icon: Receipt, tone: "text-muted-foreground" };

function whenLabel(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

export function FocusedBilling({ refreshKey, onOpenView }: { refreshKey?: number; onOpenView?: (key: string) => void }) {
  const [credits, setCredits] = useState(0);
  const [plan, setPlan] = useState("STARTER");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/user/credits").then((r) => r.json()).catch(() => null),
      fetch("/api/user/credits/history?limit=50").then((r) => r.json()).catch(() => null),
    ]).then(([c, h]) => {
      if (!alive) return;
      if (c?.success && c.data) { setCredits(c.data.credits ?? 0); setPlan(String(c.data.plan ?? "STARTER")); }
      if (h?.success && h.data?.transactions) setTxns(h.data.transactions as Txn[]);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [refreshKey]);

  // Recent (last 50) rollups: spent = sum of negatives, added = sum of positives.
  const { spent, added, byType } = useMemo(() => {
    let spent = 0, added = 0;
    const byType: Record<string, number> = {};
    for (const t of txns) {
      if (t.amount < 0) spent += -t.amount; else added += t.amount;
      byType[t.type] = (byType[t.type] ?? 0) + Math.abs(t.amount);
    }
    return { spent, added, byType };
  }, [txns]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your credits…" /></div>;
  }

  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxType = topTypes.length ? topTypes[0][1] : 1;
  const planLabel = PLAN_LABEL[plan.toUpperCase()] ?? plan;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: balance + usage summary */}
        <aside className="space-y-4 lg:sticky lg:top-0 lg:w-[320px] lg:shrink-0">
        {/* balance hero */}
        <section className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-violet-500/5 to-transparent p-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/25 to-violet-500/20 text-brand-500"><Coins className="h-6 w-6" /></span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-muted-foreground">Credit balance</p>
              <p className="text-[30px] font-extrabold leading-none">{credits.toLocaleString()}<span className="ms-1.5 text-[14px] font-semibold text-muted-foreground">credits</span></p>
            </div>
            <span className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-[12px] font-semibold"><Sparkles className="h-3.5 w-3.5 text-brand-500" /> {planLabel} plan</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => onOpenView?.("credits")} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <CreditCard className="h-4 w-4" /> Buy credits
            </button>
            <button onClick={() => onOpenView?.("plans")} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60 hover:text-foreground">
              <Sparkles className="h-4 w-4" /> Manage plan
            </button>
          </div>
        </section>

        {/* usage by type */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">Where your credits go</h3>
          {topTypes.length ? (
            <div className="space-y-2.5">
              {topTypes.map(([type, total]) => {
                const m = typeMeta(type);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className={cn("inline-flex w-28 shrink-0 items-center gap-1.5 text-[12px] font-medium", m.tone)}><m.icon className="h-3.5 w-3.5" /> {m.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${Math.max(4, (total / maxType) * 100)}%` }} />
                    </div>
                    <span className="w-14 shrink-0 text-end text-[12px] font-semibold tabular-nums">{total.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty text="No credit activity yet — your usage breakdown shows up here once you start creating." />
          )}
        </section>
        </aside>

        {/* RIGHT: recent KPIs + transaction ledger (full width) */}
        <div className="min-w-0 flex-1 space-y-4">
        {/* KPIs (recent) */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi icon={ArrowDownRight} tone="text-rose-500" label="Spent (recent)" value={spent.toLocaleString()} />
          <Kpi icon={ArrowUpRight} tone="text-emerald-500" label="Added (recent)" value={added.toLocaleString()} />
          <Kpi icon={Receipt} tone="text-muted-foreground" label="Transactions" value={txns.length.toLocaleString()} />
        </div>
        {/* ledger */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">Recent transactions</h3>
          {txns.length ? (
            <div className="space-y-1.5">
              {txns.slice(0, 25).map((t) => {
                const m = typeMeta(t.type);
                const pos = t.amount >= 0;
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background", m.tone)}><m.icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium">{t.description || m.label}</p>
                      <p className="text-[11px] text-muted-foreground">{m.label} · {whenLabel(t.createdAt)}</p>
                    </div>
                    <span className={cn("shrink-0 text-[13px] font-bold tabular-nums", pos ? "text-emerald-500" : "text-rose-500")}>{pos ? "+" : "−"}{Math.abs(t.amount).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty text="No transactions yet." />
          )}
        </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className={cn("flex items-center gap-2", tone)}>
        <Icon className="h-4 w-4" />
        <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }): ReactNode {
  return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">{text}</p>;
}
