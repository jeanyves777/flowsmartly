"use client";

import { useEffect, useState } from "react";
import { Coins, ShoppingBag, TrendingUp, Eye, Users, AlertTriangle, ArrowUpRight, Landmark, ChevronRight } from "lucide-react";
import { SectionCard, StatTile, EmptyState, money } from "./store-ui";
import { AreaChart } from "./store-analytics";
import { cn } from "@/lib/utils/cn";

/**
 * Overview — the store dashboard: KPIs + revenue trend, recent orders, and a
 * "needs attention" list (low stock, unfulfilled orders, payout ready). Reads
 * the parent's already-loaded orders/products/stats and fetches the analytics
 * summary for the trend. Buttons jump to the relevant section.
 */

interface OrderLite { id: string; orderNumber?: string; customerName?: string; status?: string; totalCents?: number; currency?: string; }
interface ProductLite { id: string; name: string; trackInventory?: boolean; quantity?: number; lowStockThreshold?: number; status?: string; }
interface Stats { totalOrders?: number; totalRevenueCents?: number; pendingCount?: number; }
interface Summary { totalRevenueCents?: number; totalOrders?: number; averageOrderValueCents?: number; conversionRate?: number; repeatCustomerPercent?: number; revenueChange?: number; orderChange?: number; }

function tone(status?: string): string {
  const s = (status || "").toUpperCase();
  if (s === "DELIVERED") return "bg-emerald-500/10 text-emerald-500";
  if (s === "CANCELLED" || s === "REFUNDED") return "bg-rose-500/10 text-rose-500";
  if (s === "SHIPPED") return "bg-violet-500/10 text-violet-500";
  return "bg-brand-500/10 text-brand-500";
}

export function StoreOverview({ currency, orders, products, stats, onSection }: {
  currency: string;
  orders: OrderLite[];
  products: ProductLite[];
  stats: Stats;
  onSection: (s: string) => void;
}) {
  const [summary, setSummary] = useState<Summary>({});
  const [timeline, setTimeline] = useState<{ date: string; revenueCents?: number }[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/ecommerce/analytics?range=30d").then((r) => r.json()).then((j) => {
      if (!alive) return;
      const d = j?.data;
      if (d) { setSummary(d.summary || {}); setTimeline(Array.isArray(d.revenueTimeline) ? d.revenueTimeline : []); }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const lowStock = products.filter((p) => p.trackInventory && p.quantity != null && p.quantity <= (p.lowStockThreshold ?? 5));
  const pending = stats.pendingCount ?? 0;
  const pct = (n?: number) => (n == null ? null : { up: n >= 0, text: `${Math.abs(Math.round(n))}%` });
  const revenue = summary.totalRevenueCents ?? stats.totalRevenueCents;

  const attention: { icon: typeof AlertTriangle; tint: string; title: string; sub: string; to: string; cta: string }[] = [];
  if (lowStock.length) attention.push({ icon: AlertTriangle, tint: "bg-amber-500/10 text-amber-500", title: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} low on stock`, sub: lowStock.slice(0, 3).map((p) => p.name).join(" · "), to: "products", cta: "Review" });
  if (pending) attention.push({ icon: ArrowUpRight, tint: "bg-brand-500/10 text-brand-500", title: `${pending} order${pending === 1 ? "" : "s"} awaiting fulfillment`, sub: "Confirm and ship to keep buyers happy", to: "orders", cta: "Fulfill" });
  attention.push({ icon: Landmark, tint: "bg-emerald-500/10 text-emerald-500", title: "Track your earnings & payouts", sub: "Balance, payout history and bank setup", to: "payments", cta: "View" });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile icon={Coins} label="Revenue (30d)" value={money(revenue, currency)} delta={pct(summary.revenueChange)} />
        <StatTile icon={ShoppingBag} label="Orders" value={String(summary.totalOrders ?? stats.totalOrders ?? 0)} delta={pct(summary.orderChange)} />
        <StatTile icon={TrendingUp} label="Avg order" value={money(summary.averageOrderValueCents, currency)} />
        <StatTile icon={Eye} label="Conversion" value={`${(summary.conversionRate ?? 0).toFixed(1)}%`} />
        <StatTile icon={Users} label="Repeat buyers" value={`${Math.round(summary.repeatCustomerPercent ?? 0)}%`} />
      </div>

      <SectionCard title="Revenue · last 30 days">
        {timeline.some((t) => (t.revenueCents ?? 0) > 0) ? <AreaChart points={timeline} /> : <EmptyState title="No sales yet" sub="Your revenue trend will chart here once orders come in." />}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent orders" right={<button onClick={() => onSection("orders")} className="text-[11.5px] font-semibold text-brand-500 hover:underline">View all</button>}>
          {orders.length ? (
            <div className="space-y-1.5">
              {orders.slice(0, 5).map((o) => (
                <button key={o.id} onClick={() => onSection("orders")} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-muted/50">
                  <span className="text-[12.5px] font-semibold">{o.orderNumber || o.id.slice(0, 8)}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{o.customerName || "Customer"}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tone(o.status))}>{(o.status || "pending").toLowerCase()}</span>
                  <span className="text-[12.5px] font-bold tabular-nums">{money(o.totalCents, o.currency || currency)}</span>
                </button>
              ))}
            </div>
          ) : <EmptyState title="No orders yet" sub="Share your storefront to get your first sale." />}
        </SectionCard>

        <SectionCard title="Needs attention">
          <div className="space-y-2">
            {attention.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", a.tint)}><a.icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-semibold">{a.title}</p><p className="truncate text-[11.5px] text-muted-foreground">{a.sub}</p></div>
                <button onClick={() => onSection(a.to)} className="inline-flex shrink-0 items-center gap-1 rounded-[9px] border border-border px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60"><span>{a.cta}</span><ChevronRight className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
