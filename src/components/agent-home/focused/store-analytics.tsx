"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, ShoppingBag, TrendingUp, Users, Eye } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { SectionCard, StatTile, EmptyState, money } from "./store-ui";
import { cn } from "@/lib/utils/cn";

/**
 * Store analytics — sales + traffic over a selectable range, from
 * /api/ecommerce/analytics (orders/revenue) and /visitor-analytics (page views).
 * Read-only. Graceful empty states for fresh stores.
 */

interface Summary { totalRevenueCents?: number; totalOrders?: number; averageOrderValueCents?: number; conversionRate?: number; repeatCustomerPercent?: number; revenueChange?: number; orderChange?: number; }
interface TopProduct { id: string; name: string; orderCount?: number; revenueCents?: number; viewCount?: number; }
interface TimelinePoint { date: string; revenueCents?: number; orderCount?: number; }
interface Referrer { source?: string; referrer?: string; count?: number; }

const RANGES = [["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"]] as const;

export function StoreAnalytics({ currency }: { currency: string }) {
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary>({});
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [visits, setVisits] = useState<{ totalViews?: number; uniqueVisitors?: number; realtimeVisitors?: number } | null>(null);
  const [referrers, setReferrers] = useState<Referrer[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const [a, v] = await Promise.all([
        fetch(`/api/ecommerce/analytics?range=${range}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/ecommerce/visitor-analytics?range=${range}`).then((r) => r.json()).catch(() => null),
      ]);
      if (!alive) return;
      const d = a?.data;
      if (d) { setSummary(d.summary || {}); setTimeline(Array.isArray(d.revenueTimeline) ? d.revenueTimeline : []); setTopProducts(Array.isArray(d.topProducts) ? d.topProducts : []); }
      const vov = v?.overview || v?.data?.overview;
      if (vov) setVisits({ totalViews: vov.totalViews ?? vov.periodViews, uniqueVisitors: vov.uniqueVisitors, realtimeVisitors: vov.realtimeVisitors });
      const refs = v?.referrers || v?.data?.referrers;
      if (Array.isArray(refs)) setReferrers(refs.slice(0, 6));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [range]);

  const pct = (n?: number) => (n == null ? null : { up: n >= 0, text: `${Math.abs(Math.round(n))}%` });
  const totalRefs = referrers.reduce((s, r) => s + (r.count || 0), 0) || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-bold">Analytics</h3>
        <div className="ms-auto flex rounded-[10px] border border-border p-0.5">
          {RANGES.map(([id, label]) => (
            <button key={id} onClick={() => setRange(id)} className={cn("rounded-[8px] px-2.5 py-1 text-[11.5px] font-semibold", range === id ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <SectionCard><div className="grid place-items-center py-12"><FlowLoader size={24} label="Loading analytics…" /></div></SectionCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatTile icon={Coins} label="Revenue" value={money(summary.totalRevenueCents, currency)} delta={pct(summary.revenueChange)} />
            <StatTile icon={ShoppingBag} label="Orders" value={String(summary.totalOrders ?? 0)} delta={pct(summary.orderChange)} />
            <StatTile icon={TrendingUp} label="Avg order" value={money(summary.averageOrderValueCents, currency)} />
            <StatTile icon={Eye} label="Conversion" value={`${(summary.conversionRate ?? 0).toFixed(1)}%`} />
            <StatTile icon={Users} label="Repeat buyers" value={`${Math.round(summary.repeatCustomerPercent ?? 0)}%`} />
          </div>

          <SectionCard title={`Revenue · last ${range}`}>
            {timeline.some((t) => (t.revenueCents ?? 0) > 0) ? <AreaChart points={timeline} /> : <EmptyState title="No sales in this range yet" sub="Revenue will chart here once orders come in." />}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Top products">
              {topProducts.length ? (
                <table className="w-full text-[12.5px]">
                  <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground"><th className="pb-2 text-left font-bold">Product</th><th className="pb-2 text-right font-bold">Units</th><th className="pb-2 text-right font-bold">Revenue</th></tr></thead>
                  <tbody>{topProducts.slice(0, 6).map((p) => (
                    <tr key={p.id} className="border-t border-border"><td className="py-2 pr-2"><span className="line-clamp-1">{p.name}</span></td><td className="py-2 text-right tabular-nums">{p.orderCount ?? 0}</td><td className="py-2 text-right font-semibold tabular-nums">{money(p.revenueCents, currency)}</td></tr>
                  ))}</tbody>
                </table>
              ) : <EmptyState title="No product sales yet" />}
            </SectionCard>

            <SectionCard title="Traffic">
              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Views" value={visits?.totalViews ?? 0} />
                <MiniStat label="Visitors" value={visits?.uniqueVisitors ?? 0} />
                <MiniStat label="Live now" value={visits?.realtimeVisitors ?? 0} accent />
              </div>
              {referrers.length ? (
                <div className="space-y-1.5">
                  {referrers.map((r, i) => {
                    const label = r.source || r.referrer || "Direct";
                    const p = Math.round(((r.count || 0) / totalRefs) * 100);
                    return (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <span className="w-24 shrink-0 truncate capitalize">{label}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-500" style={{ width: `${p}%` }} /></div>
                        <span className="w-9 text-right tabular-nums text-muted-foreground">{p}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-[12px] text-muted-foreground">No traffic data yet for this range.</p>}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 py-2.5">
      <div className={cn("text-[18px] font-extrabold tabular-nums", accent && "text-emerald-500")}>{value.toLocaleString()}</div>
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function AreaChart({ points }: { points: TimelinePoint[] }) {
  const { path, area } = useMemo(() => {
    const vals = points.map((p) => p.revenueCents ?? 0);
    const max = Math.max(1, ...vals);
    const w = 100, h = 34, n = vals.length;
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * w);
    const y = (v: number) => h - (v / max) * (h - 2) - 1;
    const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
    return { path: line, area: `${line} L${w},${h} L0,${h} Z` };
  }, [points]);
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="h-40 w-full">
      <defs><linearGradient id="storeRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(99 102 241 / 0.28)" /><stop offset="100%" stopColor="rgb(99 102 241 / 0)" /></linearGradient></defs>
      <path d={area} fill="url(#storeRev)" />
      <path d={path} fill="none" stroke="rgb(99 102 241)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
