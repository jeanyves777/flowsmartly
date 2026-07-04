"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, DollarSign, TrendingUp, Clock, Target, CheckCircle2, XCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Deal { id: string; company: string | null; contact: string | null; title: string; status: string; value: number; createdAt: string; closedAt: string | null }
interface Roi {
  salesRoi: { leads: number; opportunities: number; wonRevenue: number };
  pipeline: { openValue: number; winRate: number; avgDeal: number; wonCount: number; lostCount: number };
  timeSaved: { minutesSaved: number; hoursSaved: number; daysSaved: number };
  activity: { enriched: number; pitchesSent: number; dealsClosed: number };
  deals: Deal[];
}

const usd = (n: number) => `$${(n || 0).toLocaleString()}`;
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-1 text-[13px]"><span className="text-muted-foreground">{label}</span><b className="text-foreground">{value}</b></div>;
}
function Metric({ icon: Icon, title, tone, children }: { icon: typeof DollarSign; title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground"><Icon className={cn("h-3.5 w-3.5", tone)} /> {title}</div>
      {children}
    </div>
  );
}

const statusBadge = (s: string) =>
  s === "won" ? <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> Closed Won</span>
    : s === "lost" ? <span className="inline-flex items-center gap-1 text-rose-500"><XCircle className="h-3.5 w-3.5" /> Lost</span>
      : <span className="inline-flex items-center gap-1 text-brand-500"><Circle className="h-3.5 w-3.5" /> Open</span>;

/** Lead-studio ROI view — real Sales ROI, pipeline health, an honest time-saved
 * estimate, and the deals table (Company · Contact · Status · Revenue · dates). */
export function RoiDashboard({ refreshKey }: { refreshKey?: number }) {
  const [roi, setRoi] = useState<Roi | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const j = await fetch("/api/leads/roi").then((r) => r.json()); if (j?.success) setRoi(j.data); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!roi) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={DollarSign} title="Sales ROI" tone="text-emerald-500">
          <Row label="Leads" value={roi.salesRoi.leads.toLocaleString()} />
          <Row label="Opportunities" value={roi.salesRoi.opportunities.toLocaleString()} />
          <div className="flex items-center justify-between py-1 text-[13px]"><span className="text-muted-foreground">Revenue</span><b className="text-emerald-500">{usd(roi.salesRoi.wonRevenue)}</b></div>
        </Metric>
        <Metric icon={TrendingUp} title="Pipeline" tone="text-brand-500">
          <Row label="Open value" value={usd(roi.pipeline.openValue)} />
          <Row label="Win rate" value={`${roi.pipeline.winRate}%`} />
          <Row label="Avg deal" value={usd(roi.pipeline.avgDeal)} />
        </Metric>
        <Metric icon={Clock} title="Time saved (est.)" tone="text-violet-500">
          <Row label="Hours" value={roi.timeSaved.hoursSaved.toLocaleString()} />
          <Row label="Days" value={String(roi.timeSaved.daysSaved)} />
          <Row label="Minutes" value={roi.timeSaved.minutesSaved.toLocaleString()} />
        </Metric>
        <Metric icon={Target} title="Activity" tone="text-fuchsia-500">
          <Row label="Enriched" value={roi.activity.enriched.toLocaleString()} />
          <Row label="Pitches sent" value={roi.activity.pitchesSent.toLocaleString()} />
          <Row label="Deals closed" value={roi.activity.dealsClosed.toLocaleString()} />
        </Metric>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5 text-[12.5px] font-semibold">Deals</div>
        {roi.deals.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11.5px] text-muted-foreground">
                <tr>{["Company", "Contact", "Status", "Revenue", "Created", "Closed"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {roi.deals.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{d.company || d.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{d.contact || "—"}</td>
                    <td className="px-4 py-2.5">{statusBadge(d.status)}</td>
                    <td className="px-4 py-2.5 font-semibold">{usd(d.value)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{shortDate(d.createdAt)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{shortDate(d.closedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">No deals yet — create opportunities in the Pipeline to see your ROI here.</p>
        )}
      </div>
    </div>
  );
}
