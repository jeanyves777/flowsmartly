"use client";

import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";
import Image from "next/image";
import { Coins, FileText, Target, TrendingUp, TrendingDown, Eye, Heart, Users, BarChart3, Mail, MessageSquare, MessageCircle, Workflow, RefreshCw, RadioTower, CheckCircle2, AlertTriangle, Clock, KeyRound, Activity, MousePointerClick, Megaphone, DollarSign, Zap, type LucideIcon } from "lucide-react";
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
interface AnStats {
  views?: number; viewsChange?: number;
  likes?: number; likesChange?: number;
  comments?: number; commentsChange?: number;
  shares?: number; sharesChange?: number;
  clicks?: number; clicksChange?: number;
  engagementRate?: number;
  followers?: number; followersChange?: number;
  postsThisPeriod?: number;
}
interface ChartPoint { date: string; views?: number; likes?: number; comments?: number; shares?: number; clicks?: number; posts?: number; boostedViews?: number; organicViews?: number }
interface BoostedSlice { posts?: number; views?: number; likes?: number; comments?: number; shares?: number }
interface BoostedVsOrganic { boosted?: BoostedSlice; organic?: BoostedSlice }
interface AdStats { activeCampaigns?: number; totalSpent?: number; totalImpressions?: number; totalEarned?: number }
interface Analytics {
  stats?: AnStats;
  boostedVsOrganic?: BoostedVsOrganic | null;
  adStats?: AdStats | null;
  chartData?: ChartPoint[];
  platformStats?: Array<{ platform: string; posts?: number; views?: number; likes?: number; comments?: number; shares?: number; clicks?: number; boostedPosts?: number; lastPostAt?: string | null }>;
  topPosts?: Array<{ id: string; content?: string; views?: number; likes?: number; comments?: number; shares?: number; clicks?: number }>;
}

/** Vertical section nav buckets the surface into focused master/detail views. */
type Section = "overview" | "performance" | "channels" | "activity";

/** Chart display modes mirror the legacy /analytics surface, driven off chartData. */
type ChartMode = "views" | "engagement" | "distribution";
const CHART_MODES: Array<{ id: ChartMode; label: string }> = [
  { id: "views", label: "Views" },
  { id: "engagement", label: "Engagement" },
  { id: "distribution", label: "Boosted / organic" },
];

/** Per-account health from GET /api/social-accounts/analytics (see route for shape). */
type HealthStatus = "synced" | "limited" | "needs_token" | "token_expired" | "unsupported" | "sync_failed" | "needs_refresh";
interface SocialHealthAccount {
  id: string;
  platform: string;
  platformKey?: string;
  platformUsername?: string | null;
  platformDisplayName?: string | null;
  platformAvatarUrl?: string | null;
  followersCount?: number | null;
  followingCount?: number | null;
  postsCount?: number | null;
  engagementRate?: number | null;
  impressions?: number | null;
  reach?: number | null;
  profileViews?: number | null;
  analyticsUpdatedAt?: string | null;
  connectedAt?: string | null;
  tokenExpiresAt?: string | null;
  hasAccessToken?: boolean;
  tokenExpired?: boolean;
  analyticsRefreshSupported?: boolean;
  analyticsStatus?: string;
  analyticsMessage?: string;
}
interface RefreshSummary { synced: number; partial: number; blocked: number }

const fmtNum = (value: number | null | undefined): string => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};
const fmtOptional = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : fmtNum(value);
const fmtMoney = (value: number | null | undefined): string =>
  `$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtRate = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  // The social-accounts/analytics route already stores engagementRate as a
  // percentage number (e.g. 5.0 → "5.0%", 0.5 → "0.5%"), matching the analytics
  // KPI convention. Render it as-is — never re-scale sub-1% rates by 100.
  return `${Number(value).toFixed(1)}%`;
};
const timeAgo = (value: string | null | undefined): string => {
  if (!value) return "Never synced";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "Just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
};

function deriveStatus(a: SocialHealthAccount): HealthStatus {
  if (a.analyticsStatus) return a.analyticsStatus as HealthStatus;
  if (a.tokenExpired) return "token_expired";
  if (!a.hasAccessToken) return "needs_token";
  if (!a.analyticsRefreshSupported) return "unsupported";
  if (!a.analyticsUpdatedAt) return "needs_refresh";
  return "synced";
}
const STATUS_META: Record<HealthStatus, { label: string; icon: LucideIcon; tone: string }> = {
  synced: { label: "Synced", icon: CheckCircle2, tone: "text-emerald-500 bg-emerald-500/10" },
  limited: { label: "Partial", icon: Activity, tone: "text-amber-500 bg-amber-500/10" },
  needs_refresh: { label: "Needs refresh", icon: Clock, tone: "text-amber-500 bg-amber-500/10" },
  unsupported: { label: "Connector pending", icon: Clock, tone: "text-muted-foreground bg-muted/40" },
  needs_token: { label: "Missing token", icon: KeyRound, tone: "text-rose-500 bg-rose-500/10" },
  token_expired: { label: "Token expired", icon: AlertTriangle, tone: "text-rose-500 bg-rose-500/10" },
  sync_failed: { label: "Sync failed", icon: AlertTriangle, tone: "text-rose-500 bg-rose-500/10" },
};

export function FocusedAnalytics({ refreshKey, onOpenView }: { refreshKey?: number; onOpenView?: (key: string) => void }) {
  const [range, setRange] = useState<Range>("30d");
  const [section, setSection] = useState<Section>("overview");
  const [chartMode, setChartMode] = useState<ChartMode>("views");
  const [dash, setDash] = useState<Dash | null>(null);
  const [an, setAn] = useState<Analytics | null>(null);
  const [score, setScore] = useState<{ score: number; hasStrategy: boolean } | null>(null);
  const [health, setHealth] = useState<SocialHealthAccount[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [refreshSummary, setRefreshSummary] = useState<RefreshSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [anLoading, setAnLoading] = useState(false);
  // Internal bump re-runs every fetch effect after a live sync, on top of the
  // parent-controlled refreshKey.
  const [bump, setBump] = useState(0);
  const cycle = `${refreshKey ?? 0}:${bump}`;

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
  }, [cycle]);

  useEffect(() => {
    let alive = true;
    setAnLoading(true);
    fetch(`/api/analytics?range=${range}`)
      .then((r) => r.json())
      .then((j) => { if (alive && j?.success && j.data) setAn(j.data); })
      .catch(() => {})
      .finally(() => { if (alive) setAnLoading(false); });
    return () => { alive = false; };
  }, [range, cycle]);

  // Cached per-account health (no provider hit) on mount + after each bump.
  useEffect(() => {
    let alive = true;
    setHealthLoading(true);
    fetch("/api/social-accounts/analytics")
      .then((r) => r.json())
      .then((j) => { if (alive && j?.success) setHealth(Array.isArray(j.analytics) ? j.analytics : []); })
      .catch(() => {})
      .finally(() => { if (alive) setHealthLoading(false); });
    return () => { alive = false; };
  }, [cycle]);

  // Live refresh: hits each connected platform, re-syncs cached metrics, then
  // re-pulls the dashboard, analytics, and health so the whole surface updates.
  const refreshLive = useCallback(async () => {
    setRefreshing(true);
    setRefreshSummary(null);
    try {
      const res = await fetch("/api/social-accounts/analytics?refresh=true");
      const j = await res.json().catch(() => null);
      if (j?.success) {
        if (Array.isArray(j.analytics)) setHealth(j.analytics);
        if (j.refreshSummary) setRefreshSummary(j.refreshSummary as RefreshSummary);
      }
    } catch {
      /* leave cached state in place */
    } finally {
      setRefreshing(false);
      // Re-pull aggregate analytics + dashboard so KPIs reflect the fresh sync.
      setBump((n) => n + 1);
    }
  }, []);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your numbers…" /></div>;
  }

  const credits = dash?.user?.aiCredits ?? 0;
  const usedThisMonth = dash?.aiUsage?.thisMonth ?? 0;
  const posts = dash?.stats?.postsCount ?? 0;
  const chartData = an?.chartData ?? [];
  // The headline area chart tracks the primary metric for the active mode so the
  // big trend line still reads at a glance; the grouped bars below break it out.
  const series = chartData.map((p) =>
    chartMode === "views"
      ? p.views ?? 0
      : chartMode === "engagement"
        ? (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.clicks ?? 0)
        : (p.boostedViews ?? 0) + (p.organicViews ?? 0)
  );
  const bvo = an?.boostedVsOrganic ?? null;
  const ads = an?.adStats ?? null;
  const platformCount = (an?.platformStats ?? []).length;

  const nav: { id: Section; label: string; icon: ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "performance", label: "Performance", icon: Megaphone },
    { id: "channels", label: "Channels", icon: RadioTower },
    { id: "activity", label: "Activity", icon: Activity },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky controls + summary + section nav */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          {/* range toggle + live refresh */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="px-1 text-[11.5px] text-muted-foreground">Performance &amp; usage at a glance.</p>
            <div className="mt-2.5 inline-flex w-full rounded-[10px] border border-border p-0.5">
              {(["7d", "30d", "90d"] as Range[]).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={cn("flex-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition", range === r ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>{r}</button>
              ))}
            </div>
            <button
              onClick={refreshLive}
              disabled={refreshing}
              className={cn(
                "mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold transition",
                refreshing ? "cursor-not-allowed text-muted-foreground" : "hover:border-brand-500/60 hover:text-brand-500"
              )}
              title="Pull the latest followers, reach &amp; engagement from your connected platforms"
            >
              {refreshing ? <FlowLoader size={13} /> : <RefreshCw className="h-3.5 w-3.5" />}
              {refreshing ? "Syncing…" : "Refresh live"}
            </button>

            {/* live refresh summary */}
            {refreshSummary && (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px]">
                <span className="inline-flex w-full items-center gap-1.5 font-semibold"><RadioTower className="h-3.5 w-3.5 text-brand-500" />Live sync complete.</span>
                <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" />{refreshSummary.synced} synced</span>
                {refreshSummary.partial > 0 && <span className="inline-flex items-center gap-1 text-amber-500"><Activity className="h-3.5 w-3.5" />{refreshSummary.partial} partial</span>}
                {refreshSummary.blocked > 0 && <span className="inline-flex items-center gap-1 text-rose-500"><AlertTriangle className="h-3.5 w-3.5" />{refreshSummary.blocked} need attention</span>}
              </div>
            )}
          </div>

          {/* headline KPI summary */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 px-1 pb-2"><BarChart3 className="h-4 w-4 text-brand-500" /><span className="text-[12.5px] font-bold">Headline</span></div>
            <div className="space-y-1.5">
              <StatRow icon={Eye} label="Views" value={(an?.stats?.views ?? 0).toLocaleString()} delta={an?.stats?.viewsChange} />
              <StatRow icon={Heart} label="Engagement" value={`${(an?.stats?.engagementRate ?? 0).toFixed(1)}%`} delta={an?.stats?.likesChange} />
              <StatRow icon={Users} label="Followers" value={(an?.stats?.followers ?? dash?.stats?.followers ?? 0).toLocaleString()} delta={an?.stats?.followersChange} />
              <StatRow icon={Coins} label="Credits" value={credits.toLocaleString()} sub={`${usedThisMonth.toLocaleString()} used this month`} />
            </div>
          </div>

          {/* section nav */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {nav.map((n) => {
              const active = section === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setSection(n.id)}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-start">{n.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Grow tools — entry to the marketing channels */}
          {onOpenView && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <p className="px-1 pb-2 text-[12.5px] font-bold">Grow tools</p>
              <div className="grid grid-cols-2 gap-2">
                <GrowTool icon={Mail} label="Email" onClick={() => onOpenView("email")} />
                <GrowTool icon={MessageSquare} label="SMS" onClick={() => onOpenView("sms")} />
                <GrowTool icon={MessageCircle} label="WhatsApp" onClick={() => onOpenView("whatsapp")} />
                <GrowTool icon={Workflow} label="Follow-ups" onClick={() => onOpenView("automations")} />
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT: the selected section, full width */}
        <div className="min-w-0 flex-1 space-y-4">
          {section === "overview" ? (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                <Kpi icon={Coins} label="Credits" value={credits.toLocaleString()} sub={`${usedThisMonth.toLocaleString()} used this month`} />
                <Kpi icon={Eye} label="Views" value={(an?.stats?.views ?? 0).toLocaleString()} delta={an?.stats?.viewsChange} />
                <Kpi icon={Heart} label="Engagement" value={`${(an?.stats?.engagementRate ?? 0).toFixed(1)}%`} delta={an?.stats?.likesChange} />
                <Kpi icon={FileText} label="Posts" value={posts.toLocaleString()} sub={`${an?.stats?.postsThisPeriod ?? 0} this period`} />
                <Kpi icon={Users} label="Followers" value={(an?.stats?.followers ?? dash?.stats?.followers ?? 0).toLocaleString()} delta={an?.stats?.followersChange} />
                <Kpi icon={MousePointerClick} label="Clicks" value={(an?.stats?.clicks ?? 0).toLocaleString()} delta={an?.stats?.clicksChange} sub="feed taps & CTA clicks" />
                <Kpi icon={Heart} label="Likes" value={(an?.stats?.likes ?? 0).toLocaleString()} delta={an?.stats?.likesChange} />
                <Kpi icon={Target} label="Strategy score" value={score?.hasStrategy ? `${score.score}/100` : "—"} sub={score?.hasStrategy ? undefined : "No strategy yet"} />
                <Kpi icon={BarChart3} label="Platforms" value={String(platformCount)} sub="connected" />
              </div>

              {/* chart with mode toggle */}
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-brand-500" />
                    <h3 className="text-[13px] font-bold">
                      {chartMode === "views" ? "Views over time" : chartMode === "engagement" ? "Engagement over time" : "Boosted vs organic"}
                    </h3>
                    {anLoading && <FlowLoader size={14} className="ms-1" />}
                  </div>
                  <div className="inline-flex rounded-[10px] border border-border p-0.5">
                    {CHART_MODES.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setChartMode(m.id)}
                        className={cn("rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition", chartMode === m.id ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {series.some((v) => v > 0) ? (
                  chartMode === "views" ? (
                    <AreaChart points={series} />
                  ) : (
                    <ModeBars data={chartData} mode={chartMode} />
                  )
                ) : (
                  <Empty
                    text={
                      chartMode === "views"
                        ? "No view data for this range yet — it fills in as your content gets seen."
                        : chartMode === "engagement"
                          ? "No engagement yet — likes, comments, shares and clicks show here as people interact."
                          : "No boosted or organic activity yet for this range."
                    }
                  />
                )}
              </section>
            </>
          ) : section === "performance" ? (
            /* boosted vs organic distribution + ad spend / earnings */
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-brand-500" />
                  <h3 className="text-[13px] font-bold">Boosted vs organic</h3>
                </div>
                <BoostedOrganicMix data={bvo} />
              </section>

              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-brand-500" />
                  <h3 className="text-[13px] font-bold">Ad spend &amp; earnings</h3>
                </div>
                <AdSummary data={ads} />
              </section>
            </div>
          ) : section === "channels" ? (
            <>
              {/* connected account health */}
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RadioTower className="h-4 w-4 text-brand-500" />
                    <h3 className="text-[13px] font-bold">Connected account health</h3>
                    {(healthLoading || refreshing) && <FlowLoader size={14} className="ms-1" />}
                  </div>
                  {health.length > 0 && (
                    <button
                      onClick={refreshLive}
                      disabled={refreshing}
                      className={cn("inline-flex items-center gap-1 text-[11.5px] font-semibold transition", refreshing ? "cursor-not-allowed text-muted-foreground" : "text-brand-500 hover:text-brand-600")}
                    >
                      <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
                      Sync now
                    </button>
                  )}
                </div>
                {healthLoading ? (
                  <div className="grid place-items-center py-8"><FlowLoader size={22} /></div>
                ) : health.length ? (
                  <div className="grid gap-2.5 xl:grid-cols-2">
                    {health.map((a) => (
                      <AccountHealthRow key={a.id} account={a} />
                    ))}
                  </div>
                ) : (
                  <Empty text="Connect a social account to track followers, reach, engagement and sync status here." />
                )}
              </section>

              {/* platform + top posts */}
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <h3 className="mb-3 text-[13px] font-bold">By platform</h3>
                  {(an?.platformStats ?? []).length ? (
                    <div className="space-y-2">
                      {an!.platformStats!.map((p) => (
                        <div key={p.platform} className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="font-medium capitalize">{p.platform.replace(/_/g, " ")}</span>
                            <span className="text-[11px] text-muted-foreground">{(p.posts ?? 0).toLocaleString()} posts</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{(p.views ?? 0).toLocaleString()}</span>
                            <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{(p.likes ?? 0).toLocaleString()}</span>
                            <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{(p.clicks ?? 0).toLocaleString()} clicks</span>
                          </div>
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
            </>
          ) : (
            /* recent activity */
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
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact summary row for the sticky left rail; optional % delta indicator. */
function StatRow({ icon: Icon, label, value, sub, delta }: { icon: ElementType; label: string; value: string; sub?: string; delta?: number }) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta) && delta !== 0;
  const up = (delta ?? 0) >= 0;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        {sub && <p className="truncate text-[10px] text-muted-foreground/80">{sub}</p>}
      </div>
      <div className="flex shrink-0 items-baseline gap-1.5">
        <span className="text-[15px] font-extrabold tabular-nums">{value}</span>
        {hasDelta && (
          <span className={cn("inline-flex items-center gap-0.5 text-[10.5px] font-semibold", up ? "text-emerald-500" : "text-rose-500")}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(delta!).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

function GrowTool({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-2.5 py-2 text-left transition hover:border-brand-500/60">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Icon className="h-4 w-4" /></span>
      <span className="truncate text-[12px] font-semibold">{label}</span>
    </button>
  );
}

function AccountHealthRow({ account }: { account: SocialHealthAccount }) {
  const status = deriveStatus(account);
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const platformKey = account.platformKey || account.platform;
  const name = account.platformDisplayName || account.platformUsername || platformKey;
  const handle = account.platformUsername ? `@${account.platformUsername}` : platformKey.replace(/_/g, " ");

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-3">
        {account.platformAvatarUrl ? (
          <Image src={account.platformAvatarUrl} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg object-cover" unoptimized />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-[13px] font-bold uppercase text-brand-500">{platformKey.slice(0, 2)}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{name}</p>
          <p className="truncate text-[11.5px] capitalize text-muted-foreground">{handle}</p>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.tone)}>
          <StatusIcon className="h-3 w-3" />{meta.label}
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        <HealthStat icon={Users} label="Followers" value={fmtOptional(account.followersCount)} />
        <HealthStat icon={Eye} label="Reach" value={fmtOptional(account.reach ?? account.impressions ?? account.profileViews)} />
        <HealthStat icon={Heart} label="Engagement" value={fmtRate(account.engagementRate)} />
        <HealthStat icon={FileText} label="Posts" value={fmtOptional(account.postsCount)} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />Last synced {timeAgo(account.analyticsUpdatedAt)}</span>
        <span aria-hidden>·</span>
        <span className={cn("inline-flex items-center gap-1", account.tokenExpired && "text-rose-500")}>
          <KeyRound className="h-3 w-3" />
          {account.tokenExpired ? "Token expired" : account.tokenExpiresAt ? `Token valid until ${new Date(account.tokenExpiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : account.hasAccessToken ? "Token active" : "No token"}
        </span>
      </div>
      {account.analyticsMessage && status !== "synced" && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{account.analyticsMessage}</p>
      )}
    </div>
  );
}

function HealthStat({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[10.5px] font-medium">{label}</span>
      </div>
      <p className="mt-0.5 text-[14px] font-bold leading-none">{value}</p>
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

/** Grouped daily bars for Engagement (likes/comments/shares/clicks) and
 * Boosted-vs-organic modes, sharing the same chartData the area chart reads. */
function ModeBars({ data, mode }: { data: ChartPoint[]; mode: Exclude<ChartMode, "views"> }) {
  const max = Math.max(
    1,
    ...data.map((d) =>
      mode === "engagement"
        ? (d.likes ?? 0) + (d.comments ?? 0) + (d.shares ?? 0) + (d.clicks ?? 0)
        : (d.boostedViews ?? 0) + (d.organicViews ?? 0)
    )
  );
  const legend =
    mode === "engagement"
      ? [
          { color: "bg-pink-500", label: "Likes" },
          { color: "bg-amber-500", label: "Comments" },
          { color: "bg-emerald-500", label: "Shares" },
          { color: "bg-violet-500", label: "Clicks" },
        ]
      : [
          { color: "bg-violet-500", label: "Boosted" },
          { color: "bg-emerald-500", label: "Organic" },
        ];
  const h = (v: number) => `${Math.max(v > 0 ? 4 : 1, (v / max) * 100)}%`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", l.color)} />
            {l.label}
          </span>
        ))}
      </div>
      <div className="flex h-40 items-end gap-1.5 overflow-x-auto rounded-xl border border-border bg-muted/30 p-3">
        {data.map((d, i) => (
          <div key={`${d.date}-${i}`} className="group flex min-w-[26px] flex-1 flex-col items-center gap-1.5">
            <div className="flex h-32 w-full items-end justify-center gap-0.5">
              {mode === "engagement" ? (
                <>
                  <span className="w-1/4 rounded-t bg-pink-500" style={{ height: h(d.likes ?? 0) }} />
                  <span className="w-1/4 rounded-t bg-amber-500" style={{ height: h(d.comments ?? 0) }} />
                  <span className="w-1/4 rounded-t bg-emerald-500" style={{ height: h(d.shares ?? 0) }} />
                  <span className="w-1/4 rounded-t bg-violet-500" style={{ height: h(d.clicks ?? 0) }} />
                </>
              ) : (
                <>
                  <span className="w-1/2 rounded-t bg-violet-500" style={{ height: h(d.boostedViews ?? 0) }} />
                  <span className="w-1/2 rounded-t bg-emerald-500" style={{ height: h(d.organicViews ?? 0) }} />
                </>
              )}
            </div>
            <span className="truncate text-[9.5px] text-muted-foreground">{d.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stacked boosted/organic split across each engagement dimension. */
function BoostedOrganicMix({ data }: { data: BoostedVsOrganic | null | undefined }) {
  if (!data || (!data.boosted && !data.organic)) {
    return <Empty text="Boost a post to compare boosted vs organic reach here." />;
  }
  const b = data.boosted ?? {};
  const o = data.organic ?? {};
  const rows: Array<{ label: string; boosted: number; organic: number }> = [
    { label: "Posts", boosted: b.posts ?? 0, organic: o.posts ?? 0 },
    { label: "Views", boosted: b.views ?? 0, organic: o.views ?? 0 },
    { label: "Likes", boosted: b.likes ?? 0, organic: o.likes ?? 0 },
    { label: "Comments", boosted: b.comments ?? 0, organic: o.comments ?? 0 },
    { label: "Shares", boosted: b.shares ?? 0, organic: o.shares ?? 0 },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />Boosted</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Organic</span>
      </div>
      {rows.map((row) => {
        const total = row.boosted + row.organic;
        const boostedPct = total ? (row.boosted / total) * 100 : 0;
        return (
          <div key={row.label} className="space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium">{row.label}</span>
              <span className="text-[11px] text-muted-foreground">{fmtNum(row.boosted)} boosted · {fmtNum(row.organic)} organic</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="bg-violet-500" style={{ width: `${boostedPct}%` }} />
              <div className="bg-emerald-500" style={{ width: `${100 - boostedPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Ad spend / earnings / impressions / active campaigns summary. */
function AdSummary({ data }: { data: AdStats | null | undefined }) {
  const items: Array<{ label: string; value: string; icon: LucideIcon }> = [
    { label: "Active campaigns", value: fmtNum(data?.activeCampaigns), icon: Megaphone },
    { label: "Impressions", value: fmtNum(data?.totalImpressions), icon: Eye },
    { label: "Spend", value: fmtMoney(data?.totalSpent), icon: DollarSign },
    { label: "Earned", value: fmtMoney(data?.totalEarned), icon: Zap },
  ];
  const isEmpty =
    !data ||
    ((data.activeCampaigns ?? 0) === 0 &&
      (data.totalImpressions ?? 0) === 0 &&
      (data.totalSpent ?? 0) === 0 &&
      (data.totalEarned ?? 0) === 0);
  if (isEmpty) {
    return <Empty text="Run an ad campaign or earn from ad views to see spend and earnings here." />;
  }
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-xl border border-border bg-muted/30 p-3">
          <Icon className="mb-1.5 h-4 w-4 text-muted-foreground" />
          <p className="text-[18px] font-bold leading-none">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }): ReactNode {
  return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">{text}</p>;
}
