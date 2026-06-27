"use client";

import { useEffect, useState, type ElementType, type ReactNode } from "react";
import Image from "next/image";
import { Coins, FileText, Target, TrendingUp, TrendingDown, Eye, Heart, Users, BarChart3 } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Analytics / Overview — a deep new-design surface (the Grow workspace canvas)
 * aggregating REAL data: credits, content, strategy, and performance over a
 * selectable range, with an inline area chart + graceful empty states for fresh
 * users. No legacy links; agent on the left can explain/act. [[new-design-no-legacy]]
 */

type Range = "7d" | "30d" | "90d";

interface Dash {
  user?: { aiCredits?: number };
  stats?: { postsCount?: number; followers?: number };
  aiUsage?: { thisMonth?: number };
  recentActivity?: Array<{ id: string; type?: string; title?: string; content?: string; mediaUrl?: string | null; views?: number; likes?: number; createdAt?: string }>;
}
interface Analytics {
  stats?: { views?: number; viewsChange?: number; likes?: number; likesChange?: number; engagementRate?: number; followers?: number; followersChange?: number; postsThisPeriod?: number };
  chartData?: Array<{ date: string; views?: number }>;
  platformStats?: Array<{ platform: string; posts?: number; views?: number; likes?: number }>;
  topPosts?: Array<{ id: string; content?: string; views?: number; likes?: number; comments?: number }>;
}

export function FocusedAnalytics({ refreshKey }: { refreshKey?: number }) {
  const [range, setRange] = useState<Range>("30d");
  const [dash, setDash] = useState<Dash | null>(null);
  const [an, setAn] = useState<Analytics | null>(null);
  const [score, setScore] = useState<{ score: number; hasStrategy: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [anLoading, setAnLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()).catch(() => null),
      fetch("/api/content/strategy/score").then((r) => r.json()).catch(() => null),
    ]).then(([d, s]) => {
      if (!alive) return;
      if (d?.success && d.data) setDash(d.data);
      if (s?.success && s.data) setScore({ score: s.data.score ?? 0, hasStrategy: !!s.data.hasStrategy });
      setLoading(false);
    });
    return () => { alive = false; };
  }, [refreshKey]);

  useEffect(() => {
    let alive = true;
    setAnLoading(true);
    fetch(`/api/analytics?range=${range}`)
      .then((r) => r.json())
      .then((j) => { if (alive && j?.success && j.data) setAn(j.data); })
      .catch(() => {})
      .finally(() => { if (alive) setAnLoading(false); });
    return () => { alive = false; };
  }, [range, refreshKey]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your numbers…" /></div>;
  }

  const credits = dash?.user?.aiCredits ?? 0;
  const usedThisMonth = dash?.aiUsage?.thisMonth ?? 0;
  const posts = dash?.stats?.postsCount ?? 0;
  const series = (an?.chartData ?? []).map((p) => p.views ?? 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* range toggle */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">Performance &amp; usage at a glance.</p>
          <div className="inline-flex rounded-[10px] border border-border p-0.5">
            {(["7d", "30d", "90d"] as Range[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition", range === r ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>{r}</button>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Coins} label="Credits" value={credits.toLocaleString()} sub={`${usedThisMonth.toLocaleString()} used this month`} />
          <Kpi icon={Eye} label="Views" value={(an?.stats?.views ?? 0).toLocaleString()} delta={an?.stats?.viewsChange} />
          <Kpi icon={Heart} label="Engagement" value={`${(an?.stats?.engagementRate ?? 0).toFixed(1)}%`} delta={an?.stats?.likesChange} />
          <Kpi icon={FileText} label="Posts" value={posts.toLocaleString()} sub={`${an?.stats?.postsThisPeriod ?? 0} this period`} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Users} label="Followers" value={(an?.stats?.followers ?? dash?.stats?.followers ?? 0).toLocaleString()} delta={an?.stats?.followersChange} />
          <Kpi icon={Target} label="Strategy score" value={score?.hasStrategy ? `${score.score}/100` : "—"} sub={score?.hasStrategy ? undefined : "No strategy yet"} />
          <Kpi icon={Heart} label="Likes" value={(an?.stats?.likes ?? 0).toLocaleString()} delta={an?.stats?.likesChange} />
          <Kpi icon={BarChart3} label="Platforms" value={String((an?.platformStats ?? []).length)} sub="connected" />
        </div>

        {/* chart */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-brand-500" />
            <h3 className="text-[13px] font-bold">Views over time</h3>
            {anLoading && <FlowLoader size={14} className="ms-1" />}
          </div>
          {series.some((v) => v > 0) ? (
            <AreaChart points={series} />
          ) : (
            <Empty text="No view data for this range yet — it fills in as your content gets seen." />
          )}
        </section>

        {/* platform + top posts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h3 className="mb-3 text-[13px] font-bold">By platform</h3>
            {(an?.platformStats ?? []).length ? (
              <div className="space-y-2">
                {an!.platformStats!.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-[13px]">
                    <span className="font-medium capitalize">{p.platform}</span>
                    <span className="text-muted-foreground">{(p.views ?? 0).toLocaleString()} views · {(p.likes ?? 0).toLocaleString()} likes</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="Connect a social account to see per-platform performance." />
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h3 className="mb-3 text-[13px] font-bold">Top content</h3>
            {(an?.topPosts ?? []).length ? (
              <div className="space-y-2">
                {an!.topPosts!.slice(0, 5).map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <p className="truncate text-[13px]">{p.content || "Untitled post"}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">{(p.views ?? 0).toLocaleString()} views · {(p.likes ?? 0).toLocaleString()} likes · {(p.comments ?? 0).toLocaleString()} comments</p>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="Your best-performing posts will show up here." />
            )}
          </section>
        </div>

        {/* recent activity */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">Recent activity</h3>
          {(dash?.recentActivity ?? []).length ? (
            <div className="space-y-2">
              {dash!.recentActivity!.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2">
                  {a.mediaUrl ? <Image src={a.mediaUrl} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg object-cover" unoptimized /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><FileText className="h-4 w-4" /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{a.title || a.content || "Activity"}</p>
                    <p className="text-[11.5px] text-muted-foreground">{(a.views ?? 0).toLocaleString()} views · {(a.likes ?? 0).toLocaleString()} likes</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Create your first post or design — activity shows up here." />
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, delta }: { icon: ElementType; label: string; value: string; sub?: string; delta?: number }) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta) && delta !== 0;
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[11.5px] font-medium">{label}</span>
      </div>
      <div className="mt-1.5 flex items-end gap-2">
        <span className="text-[22px] font-extrabold leading-none">{value}</span>
        {hasDelta && (
          <span className={cn("mb-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold", up ? "text-emerald-500" : "text-rose-500")}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(delta!).toFixed(0)}%
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AreaChart({ points }: { points: number[] }) {
  const w = 720, h = 160, pad = 6;
  const max = Math.max(...points, 1);
  const n = points.length;
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="acgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#acgrad)" />
      <path d={line} fill="none" stroke="#0ea5e9" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Empty({ text }: { text: string }): ReactNode {
  return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">{text}</p>;
}
