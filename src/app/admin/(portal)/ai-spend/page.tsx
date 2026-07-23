"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign, RefreshCw, Coins, ArrowDownUp, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

interface SpendRow {
  feature: string;
  model: string;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  calls: number;
}
interface SpendData {
  windowDays: number;
  since: string;
  totals: { costCents: number; inputTokens: number; outputTokens: number; calls: number };
  rows: SpendRow[];
}

const WINDOWS = [7, 30, 90] as const;

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function toks(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AdminAISpendPage() {
  const [data, setData] = useState<SpendData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState<number>(30);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/ai-spend?days=${days}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (error) {
      console.error("Failed to fetch AI spend:", error);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const total = data?.totals.costCents ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Spend</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real Claude API cost from actual usage — grouped by feature and model. Reconcile against credits charged.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex gap-1 rounded-lg border bg-card p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setDays(w)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  days === w ? "bg-brand-500/10 text-brand-600" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {w}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={<DollarSign className="h-4 w-4" />} label={`Total spend (${days}d)`} value={isLoading ? null : usd(total)} accent />
        <StatTile icon={<ArrowDownUp className="h-4 w-4" />} label="Input tokens" value={isLoading ? null : toks(data?.totals.inputTokens ?? 0)} />
        <StatTile icon={<ArrowDownUp className="h-4 w-4" />} label="Output tokens" value={isLoading ? null : toks(data?.totals.outputTokens ?? 0)} />
        <StatTile icon={<Cpu className="h-4 w-4" />} label="API calls" value={isLoading ? null : (data?.totals.calls ?? 0).toLocaleString()} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 text-sm font-bold">Spend by feature</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-bold">Feature</th>
                  <th className="px-4 py-2.5 text-left font-bold">Model</th>
                  <th className="px-4 py-2.5 text-right font-bold">Calls</th>
                  <th className="px-4 py-2.5 text-right font-bold">Input tok</th>
                  <th className="px-4 py-2.5 text-right font-bold">Output tok</th>
                  <th className="px-4 py-2.5 text-right font-bold">Cost</th>
                  <th className="px-4 py-2.5 text-right font-bold">Share</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-t">
                      <td colSpan={7} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !data || data.rows.length === 0 ? (
                  <tr className="border-t">
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No AI usage recorded in this window yet.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((r, i) => {
                    const share = total > 0 ? Math.round((r.costCents / total) * 100) : 0;
                    return (
                      <tr key={`${r.feature}-${r.model}-${i}`} className="border-t">
                        <td className="px-4 py-2.5 font-semibold">{r.feature}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.model}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.calls.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{toks(r.inputTokens)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{toks(r.outputTokens)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{usd(r.costCents)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center justify-end gap-2">
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-brand-400" style={{ width: `${share}%` }} />
                            </span>
                            <span className="w-8 tabular-nums text-muted-foreground">{share}%</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {data && data.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="px-4 py-3">Total</td>
                    <td />
                    <td className="px-4 py-3 text-right tabular-nums">{data.totals.calls.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{toks(data.totals.inputTokens)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{toks(data.totals.outputTokens)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{usd(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Coins className="h-3.5 w-3.5" />
        Cost is computed at Anthropic list prices (cache reads billed ~0.1×, writes ~1.25×). After prompt caching ships,
        flow_ai_agent cost per call should drop ~85–90%.
      </p>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        {value === null ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <div className={cn("mt-1.5 text-2xl font-bold tracking-tight", accent && "text-brand-600")}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
