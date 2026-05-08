"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  DollarSign,
  Eye,
  Heart,
  Link2,
  Maximize2,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  RefreshCw,
  Rss,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";
import { useSocialPlatforms } from "@/hooks/use-social-platforms";
import { cn } from "@/lib/utils/cn";

type TimeRange = "today" | "7d" | "30d" | "90d";
type ChartMode = "views" | "engagement" | "distribution";
type SectionId = "chart" | "platforms" | "mix" | "posts";

type Stats = {
  views: number;
  viewsChange: number;
  likes: number;
  likesChange: number;
  comments: number;
  commentsChange: number;
  shares: number;
  sharesChange?: number;
  clicks: number;
  clicksChange: number;
  followers: number;
  followersChange: number;
  engagementRate: number;
  postsThisPeriod: number;
};

type BoostedOrganic = {
  boosted: { posts: number; views: number; likes: number; comments: number; shares: number };
  organic: { posts: number; views: number; likes: number; comments: number; shares: number };
};

type AdStats = {
  activeCampaigns: number;
  totalSpent: number;
  totalImpressions: number;
  totalEarned: number;
};

type ChartData = {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  posts: number;
  boostedViews: number;
  organicViews: number;
};

type PlatformPostStats = {
  platform: string;
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  boostedPosts: number;
  lastPostAt: string | null;
};

type TopPost = {
  id: string;
  content: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  createdAt: string;
};

type AnalyticsData = {
  stats: Stats;
  boostedVsOrganic: BoostedOrganic | null;
  adStats: AdStats | null;
  chartData: ChartData[];
  platformStats: PlatformPostStats[];
  topPosts: TopPost[];
};

type SocialAnalytics = {
  id: string;
  platform: string;
  platformKey?: string;
  platformUserId?: string | null;
  platformUsername?: string | null;
  platformDisplayName: string | null;
  platformAvatarUrl: string | null;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  engagementRate: number | null;
  impressions: number | null;
  reach: number | null;
  profileViews: number | null;
  analyticsUpdatedAt: string | null;
  connectedAt?: string | null;
  tokenExpiresAt?: string | null;
  hasAccessToken?: boolean;
  tokenExpired?: boolean;
  analyticsRefreshSupported?: boolean;
  analyticsStatus?: string;
  analyticsMessage?: string;
};

const RANGE_OPTIONS: Array<{ id: TimeRange; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "90d", label: "90 Days" },
];

const CHART_OPTIONS: Array<{ id: ChartMode; label: string }> = [
  { id: "views", label: "Views" },
  { id: "engagement", label: "Engagement" },
  { id: "distribution", label: "Boosted / organic" },
];

const normalizePlatformKey = (platform: string) => {
  if (platform.startsWith("facebook_")) return "facebook";
  if (platform.startsWith("instagram_")) return "instagram";
  if (platform === "x") return "twitter";
  return platform;
};

const formatNumber = (value: number | null | undefined) => {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const formatCurrency = (value: number | null | undefined) =>
  `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatOptional = (value: number | null | undefined) =>
  value === null || value === undefined ? "Not available" : formatNumber(value);

const formatRate = (value: number | null | undefined, alreadyPercent = false) => {
  if (value === null || value === undefined) return "Not available";
  const normalized = alreadyPercent || value > 1 ? value : value * 100;
  return `${normalized.toFixed(1)}%`;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatTimeAgo = (value: string | null | undefined) => {
  if (!value) return "Never synced";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

const getAccountStatus = (account: SocialAnalytics) => {
  if (account.analyticsStatus) return account.analyticsStatus;
  if (account.tokenExpired) return "token_expired";
  if (!account.hasAccessToken) return "needs_token";
  if (!account.analyticsRefreshSupported) return "unsupported";
  if (!account.analyticsUpdatedAt) return "needs_refresh";
  return "synced";
};

const getAccountStatusCopy = (account: SocialAnalytics) => {
  const status = getAccountStatus(account);
  if (status === "synced") return `synced ${formatTimeAgo(account.analyticsUpdatedAt)}`;
  if (status === "token_expired") return "token expired, reconnect";
  if (status === "needs_token") return "missing access token";
  if (status === "unsupported") return "refresh connector pending";
  if (status === "sync_failed") return "sync failed";
  if (status === "limited") return "partial metrics";
  return "needs live refresh";
};

function getPlatformMeta(platform: string) {
  const key = normalizePlatformKey(platform);
  const fallback = PLATFORM_META.feed;
  const meta = PLATFORM_META[key] || fallback;
  return {
    key,
    label: meta.label || key.replace(/_/g, " "),
    Icon: meta.icon || Link2,
    color: meta.color || fallback.color,
    bgClass: meta.bgClass || fallback.bgClass,
    borderClass: meta.borderClass || fallback.borderClass,
  };
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [chartMode, setChartMode] = useState<ChartMode>("views");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [socialAnalytics, setSocialAnalytics] = useState<SocialAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionId, boolean>>({
    chart: false,
    platforms: false,
    mix: false,
    posts: false,
  });
  const { platforms, isLoading: platformsLoading, refetch: refetchPlatforms } = useSocialPlatforms();

  const connectedPlatforms = useMemo(() => platforms.filter((platform) => platform.connected), [platforms]);
  const selectedAccount = useMemo(
    () => socialAnalytics.find((account) => account.id === selectedAccountId) || socialAnalytics[0] || null,
    [selectedAccountId, socialAnalytics]
  );

  const socialTotals = useMemo(() => {
    return socialAnalytics.reduce(
      (totals, account) => ({
        followers: totals.followers + (account.followersCount || 0),
        posts: totals.posts + (account.postsCount || 0),
        impressions: totals.impressions + (account.impressions || 0),
        reach: totals.reach + (account.reach || 0),
        profileViews: totals.profileViews + (account.profileViews || 0),
        unavailable: totals.unavailable + (account.analyticsUpdatedAt ? 0 : 1),
      }),
      { followers: 0, posts: 0, impressions: 0, reach: 0, profileViews: 0, unavailable: 0 }
    );
  }, [socialAnalytics]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/analytics?range=${timeRange}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to fetch analytics");
      setAnalytics({
        ...data.data,
        platformStats: data.data.platformStats || [],
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  const fetchSocialAnalytics = useCallback(async (refresh = false) => {
    try {
      setIsSocialLoading(true);
      const response = await fetch(`/api/social-accounts/analytics${refresh ? "?refresh=true" : ""}`);
      const data = await response.json();
      if (data.success) {
        setSocialAnalytics(data.analytics || []);
      }
    } catch (err) {
      console.error("Failed to fetch social analytics:", err);
    } finally {
      setIsSocialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchSocialAnalytics();
  }, [fetchSocialAnalytics]);

  const refreshEverything = async () => {
    await Promise.all([fetchAnalytics(), fetchSocialAnalytics(true), refetchPlatforms()]);
  };

  const toggleSection = (section: SectionId) => {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  if (error && !analytics) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="rounded-lg border bg-background p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <p className="mb-4 font-medium">{error}</p>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const stats = analytics?.stats;
  const connectedCount = socialAnalytics.length || connectedPlatforms.length;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="rounded-lg border bg-background p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="flex rounded-lg border bg-muted/20 p-1">
              {RANGE_OPTIONS.map((range) => (
                <button
                  key={range.id}
                  onClick={() => setTimeRange(range.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition",
                    timeRange === range.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setWorkspaceOpen(true)}>
              <Maximize2 className="mr-2 h-4 w-4 text-violet-600" />
              Movable workspace
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={refreshEverything} disabled={isLoading || isSocialLoading || platformsLoading} className="bg-gradient-to-r from-cyan-500 to-blue-600 shadow-sm hover:from-cyan-600 hover:to-blue-700">
              {isLoading || isSocialLoading ? <AISpinner className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh live data
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Connected platforms"
          value={connectedCount.toString()}
          helper={socialTotals.unavailable > 0 ? `${socialTotals.unavailable} need a live refresh` : "Active accounts only"}
          icon={Link2}
          tone="cyan"
          loading={platformsLoading && socialAnalytics.length === 0}
        />
        <MetricCard
          label="Internal views"
          value={formatNumber(stats?.views)}
          change={stats?.viewsChange}
          helper={`${formatNumber(stats?.postsThisPeriod)} posts in range`}
          icon={Eye}
          tone="blue"
          loading={isLoading}
        />
        <MetricCard
          label="Internal clicks"
          value={formatNumber(stats?.clicks)}
          change={stats?.clicksChange}
          helper="Tracked feed taps, media opens, and CTA clicks"
          icon={MousePointerClick}
          tone="emerald"
          loading={isLoading}
        />
        <MetricCard
          label="Engagement"
          value={formatRate(stats?.engagementRate, true)}
          change={stats?.likesChange}
          helper={`${formatNumber((stats?.likes || 0) + (stats?.comments || 0) + (stats?.shares || 0) + (stats?.clicks || 0))} actions`}
          icon={Sparkles}
          tone="violet"
          loading={isLoading}
        />
        <MetricCard
          label="Platform followers"
          value={formatNumber(socialTotals.followers)}
          helper={socialAnalytics.length ? "From connected accounts" : "Connect platforms to populate"}
          icon={Users}
          tone="emerald"
          loading={isSocialLoading && socialAnalytics.length === 0}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        <SectionBlock
          id="chart"
          title="Performance flow"
          description="Internal feed performance from your real post records."
          icon={TrendingUp}
          tone="cyan"
          collapsed={collapsedSections.chart}
          onToggle={toggleSection}
          action={
            <div className="flex rounded-lg border bg-muted/20 p-1">
              {CHART_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setChartMode(option.id)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-semibold transition",
                    chartMode === option.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        >
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : analytics?.chartData.length ? (
            <AnalyticsBars data={analytics.chartData} mode={chartMode} />
          ) : (
            <EmptyState icon={BarChart3} title="No internal activity yet" helper="Publish posts or import platform results to build this chart." />
          )}
        </SectionBlock>

        <SectionBlock
          id="platforms"
          title="Connected platform health"
          description="Only the active accounts in this user's workspace."
          icon={Link2}
          tone="blue"
          collapsed={collapsedSections.platforms}
          onToggle={toggleSection}
          action={
            <Button variant="outline" size="sm" onClick={() => fetchSocialAnalytics(true)} disabled={isSocialLoading}>
              {isSocialLoading ? <AISpinner className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          }
        >
          {isSocialLoading && socialAnalytics.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full" />)}
            </div>
          ) : socialAnalytics.length ? (
            <div className="space-y-3">
              {socialAnalytics.map((account) => (
                <PlatformAccountRow
                  key={account.id}
                  account={account}
                  selected={selectedAccountId === account.id}
                  onInspect={() => {
                    setSelectedAccountId(account.id);
                    setWorkspaceOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-5">
              <EmptyState
                icon={Link2}
                title="No connected social platforms"
                helper="Connect Instagram, Facebook, LinkedIn, YouTube, TikTok, X, or WhatsApp to see real account data here."
              />
              <div className="mt-4 text-center">
                <Button onClick={() => (window.location.href = "/social-accounts")}>Connect accounts</Button>
              </div>
            </div>
          )}
        </SectionBlock>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <SectionBlock
          id="mix"
          title="Distribution and spend"
          description="Organic, boosted, and ad performance without mixing in fake platform totals."
          icon={Megaphone}
          tone="violet"
          collapsed={collapsedSections.mix}
          onToggle={toggleSection}
        >
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : analytics ? (
            <div className="space-y-4">
              <BoostedOrganicMix data={analytics.boostedVsOrganic} />
              <AdSummary data={analytics.adStats} />
            </div>
          ) : null}
        </SectionBlock>

        <SectionBlock
          id="posts"
          title="Content and platform results"
          description="Where posts were published and which posts are carrying performance."
          icon={Rss}
          tone="emerald"
          collapsed={collapsedSections.posts}
          onToggle={toggleSection}
        >
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <PlatformPostBreakdown rows={analytics?.platformStats || []} />
              <TopPostsList posts={analytics?.topPosts || []} />
            </div>
          )}
        </SectionBlock>
      </div>

      <FloatingPanel
        open={workspaceOpen}
        onOpenChange={setWorkspaceOpen}
        title="Analytics Workspace"
        description="Drag, resize, collapse sections, and inspect connected account data."
        icon={<BarChart3 className="h-4 w-4" />}
        defaultSize={{ width: 920, height: 700 }}
        minSize={{ width: 420, height: 360 }}
        contentClassName="space-y-4"
      >
        <AnalyticsWorkspace
          accounts={socialAnalytics}
          selectedAccount={selectedAccount}
          platformStats={analytics?.platformStats || []}
          onSelectAccount={setSelectedAccountId}
          onRefresh={() => fetchSocialAnalytics(true)}
          refreshing={isSocialLoading}
        />
      </FloatingPanel>
    </motion.div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  change,
  loading,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ElementType;
  tone: "cyan" | "blue" | "violet" | "emerald";
  change?: number;
  loading?: boolean;
}) {
  const toneClass = {
    cyan: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    violet: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  }[tone];

  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      {loading ? (
        <>
          <Skeleton className="mb-3 h-9 w-9 rounded-lg" />
          <Skeleton className="mb-2 h-7 w-24" />
          <Skeleton className="h-4 w-32" />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", toneClass)}>
              <Icon className="h-4 w-4" />
            </div>
            {change !== undefined && change !== 0 && (
              <Badge variant="outline" className={cn(change > 0 ? "border-emerald-500/30 text-emerald-600" : "border-red-500/30 text-red-600")}>
                {change > 0 ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
                {Math.abs(change)}%
              </Badge>
            )}
          </div>
          <p className="mt-3 text-2xl font-bold">{value}</p>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </>
      )}
    </div>
  );
}

function SectionBlock({
  id,
  title,
  description,
  icon: Icon,
  tone = "cyan",
  collapsed,
  onToggle,
  action,
  children,
}: {
  id: SectionId;
  title: string;
  description: string;
  icon: ElementType;
  tone?: "cyan" | "blue" | "violet" | "emerald";
  collapsed: boolean;
  onToggle: (id: SectionId) => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  const iconClass = {
    cyan: "bg-cyan-500/10 text-cyan-600",
    blue: "bg-blue-500/10 text-blue-600",
    violet: "bg-violet-500/10 text-violet-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
  }[tone];

  return (
    <section className="rounded-lg border bg-background shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => onToggle(id)} className="flex min-w-0 items-center gap-3 text-left">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconClass)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold">{title}</h2>
            <p className="truncate text-sm text-muted-foreground">{description}</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition", collapsed && "-rotate-90")} />
        </button>
        {action}
      </div>
      {!collapsed && <div className="p-4">{children}</div>}
    </section>
  );
}

function AnalyticsBars({ data, mode }: { data: ChartData[]; mode: ChartMode }) {
  const max = Math.max(
    1,
    ...data.map((item) =>
      mode === "views"
        ? item.views
        : mode === "engagement"
          ? item.likes + item.comments + item.shares + item.clicks
          : item.boostedViews + item.organicViews
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {mode === "views" && <LegendItem color="bg-cyan-500" label="Views" />}
        {mode === "engagement" && (
          <>
            <LegendItem color="bg-pink-500" label="Likes" />
            <LegendItem color="bg-amber-500" label="Comments" />
            <LegendItem color="bg-emerald-500" label="Shares" />
            <LegendItem color="bg-violet-500" label="Clicks" />
          </>
        )}
        {mode === "distribution" && (
          <>
            <LegendItem color="bg-violet-500" label="Boosted" />
            <LegendItem color="bg-emerald-500" label="Organic" />
          </>
        )}
      </div>
      <div className="flex h-72 items-end gap-2 overflow-x-auto rounded-lg border bg-muted/20 p-4">
        {data.map((item, index) => {
          const viewsHeight = Math.max(4, (item.views / max) * 100);
          const likesHeight = Math.max(2, (item.likes / max) * 100);
          const commentsHeight = Math.max(2, (item.comments / max) * 100);
          const sharesHeight = Math.max(2, (item.shares / max) * 100);
          const clicksHeight = Math.max(2, (item.clicks / max) * 100);
          const boostedHeight = Math.max(2, (item.boostedViews / max) * 100);
          const organicHeight = Math.max(2, (item.organicViews / max) * 100);

          return (
            <div key={`${item.date}-${index}`} className="group flex min-w-[44px] flex-1 flex-col items-center gap-2">
              <div className="relative flex h-56 w-full items-end justify-center gap-1">
                <div className="absolute bottom-full mb-2 hidden whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-sm group-hover:block">
                  {mode === "views" && `${formatNumber(item.views)} views`}
                  {mode === "engagement" && `${formatNumber(item.likes)} likes, ${formatNumber(item.comments)} comments, ${formatNumber(item.shares)} shares, ${formatNumber(item.clicks)} clicks`}
                  {mode === "distribution" && `${formatNumber(item.boostedViews)} boosted, ${formatNumber(item.organicViews)} organic`}
                </div>
                {mode === "views" && (
                  <motion.div initial={{ height: 0 }} animate={{ height: `${viewsHeight}%` }} className="w-full rounded-t-md bg-cyan-500" />
                )}
                {mode === "engagement" && (
                  <>
                    <motion.div initial={{ height: 0 }} animate={{ height: `${likesHeight}%` }} className="w-1/4 rounded-t-md bg-pink-500" />
                    <motion.div initial={{ height: 0 }} animate={{ height: `${commentsHeight}%` }} className="w-1/4 rounded-t-md bg-amber-500" />
                    <motion.div initial={{ height: 0 }} animate={{ height: `${sharesHeight}%` }} className="w-1/4 rounded-t-md bg-emerald-500" />
                    <motion.div initial={{ height: 0 }} animate={{ height: `${clicksHeight}%` }} className="w-1/4 rounded-t-md bg-violet-500" />
                  </>
                )}
                {mode === "distribution" && (
                  <>
                    <motion.div initial={{ height: 0 }} animate={{ height: `${boostedHeight}%` }} className="w-1/2 rounded-t-md bg-violet-500" />
                    <motion.div initial={{ height: 0 }} animate={{ height: `${organicHeight}%` }} className="w-1/2 rounded-t-md bg-emerald-500" />
                  </>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">{item.date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      {label}
    </span>
  );
}

function PlatformAccountRow({ account, selected, onInspect }: { account: SocialAnalytics; selected: boolean; onInspect: () => void }) {
  const meta = getPlatformMeta(account.platformKey || account.platform);
  const status = getAccountStatus(account);
  const statusCopy = account.analyticsMessage || getAccountStatusCopy(account);

  return (
    <button
      type="button"
      onClick={onInspect}
      className={cn(
        "w-full rounded-lg border bg-background p-3 text-left transition hover:border-cyan-500/50 hover:bg-cyan-500/5",
        selected && "border-cyan-500 bg-cyan-500/5"
      )}
    >
      <div className="flex items-center gap-3">
        <AccountAvatar account={account} meta={meta} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{account.platformDisplayName || account.platformUsername || meta.label}</p>
            <Badge variant="outline" className={cn("shrink-0 text-[10px]", meta.borderClass)} style={{ color: meta.color }}>
              {meta.label}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {account.platformUsername || "Connected account"} / {statusCopy}
          </p>
        </div>
        {status !== "synced" && (
          <Badge variant="outline" className="hidden shrink-0 text-[10px] sm:inline-flex">
            {status === "limited" ? "Partial" : status === "sync_failed" ? "Check sync" : status === "unsupported" ? "Pending" : "Needs setup"}
          </Badge>
        )}
        <div className="hidden grid-cols-3 gap-3 text-right text-xs sm:grid">
          <MiniStat label="Followers" value={formatOptional(account.followersCount)} />
          <MiniStat label="Reach" value={formatOptional(account.reach)} />
          <MiniStat label="Eng." value={formatRate(account.engagementRate)} />
        </div>
      </div>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-bold">{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}

function AccountAvatar({ account, meta }: { account: SocialAnalytics; meta: ReturnType<typeof getPlatformMeta> }) {
  const [imageFailed, setImageFailed] = useState(false);
  const Icon = meta.Icon;
  const showImage = Boolean(account.platformAvatarUrl) && !imageFailed;

  return (
    <div className={cn("relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border", meta.bgClass, meta.borderClass)}>
      {showImage ? (
        <img
          src={account.platformAvatarUrl || ""}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Icon className="h-5 w-5" style={{ color: meta.color }} />
      )}
      <span className={cn("absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md border bg-background", meta.borderClass)}>
        <Icon className="h-3 w-3" style={{ color: meta.color }} />
      </span>
    </div>
  );
}

function BoostedOrganicMix({ data }: { data: BoostedOrganic | null }) {
  if (!data) return <EmptyState icon={Megaphone} title="No distribution data" helper="Boosted and organic post data will appear after publishing." />;
  const rows = [
    { label: "Posts", boosted: data.boosted.posts, organic: data.organic.posts },
    { label: "Views", boosted: data.boosted.views, organic: data.organic.views },
    { label: "Likes", boosted: data.boosted.likes, organic: data.organic.likes },
    { label: "Comments", boosted: data.boosted.comments, organic: data.organic.comments },
    { label: "Shares", boosted: data.boosted.shares, organic: data.organic.shares },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const total = row.boosted + row.organic;
        const boostedPct = total ? (row.boosted / total) * 100 : 0;
        return (
          <div key={row.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="text-muted-foreground">
                {formatNumber(row.boosted)} boosted / {formatNumber(row.organic)} organic
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              <div className="bg-violet-500" style={{ width: `${boostedPct}%` }} />
              <div className="bg-emerald-500" style={{ width: `${100 - boostedPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdSummary({ data }: { data: AdStats | null }) {
  const items = [
    { label: "Active campaigns", value: formatNumber(data?.activeCampaigns), icon: Megaphone },
    { label: "Impressions", value: formatNumber(data?.totalImpressions), icon: Eye },
    { label: "Spend", value: formatCurrency(data?.totalSpent), icon: DollarSign },
    { label: "Earned", value: formatCurrency(data?.totalEarned), icon: Zap },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-lg border bg-muted/20 p-3">
          <Icon className="mb-2 h-4 w-4 text-muted-foreground" />
          <p className="text-lg font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

function PlatformPostBreakdown({ rows }: { rows: PlatformPostStats[] }) {
  if (!rows.length) return <EmptyState icon={Rss} title="No platform publishing data" helper="When posts are published, this will show which destinations received them." />;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">Publishing destinations</h3>
      {rows.slice(0, 8).map((row) => {
        const meta = getPlatformMeta(row.platform);
        const Icon = meta.Icon;
        return (
          <div key={row.platform} className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", meta.bgClass, meta.borderClass)}>
              <Icon className="h-4 w-4" style={{ color: meta.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{row.posts} posts / last {formatTimeAgo(row.lastPostAt)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-right text-sm">
              <div>
                <p className="font-bold">{formatNumber(row.views)}</p>
                <p className="text-xs text-muted-foreground">views</p>
              </div>
              <div>
                <p className="font-bold">{formatNumber(row.clicks)}</p>
                <p className="text-xs text-muted-foreground">clicks</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopPostsList({ posts }: { posts: TopPost[] }) {
  if (!posts.length) return <EmptyState icon={Sparkles} title="No top posts yet" helper="Create and publish posts to rank them here." />;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">Top posts</h3>
      {posts.slice(0, 6).map((post, index) => (
        <div key={post.id} className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background text-sm font-bold">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{post.content || "No caption"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatTimeAgo(post.createdAt)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
            <MiniPill icon={Eye} label={formatNumber(post.views)} />
            <MiniPill icon={Heart} label={formatNumber(post.likes)} />
            <MiniPill icon={MessageCircle} label={formatNumber(post.comments)} />
            <MiniPill icon={MousePointerClick} label={formatNumber(post.clicks)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniPill({ icon: Icon, label }: { icon: ElementType; label: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-1 rounded-md border bg-background px-2 py-1 font-medium">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {label}
    </span>
  );
}

function AnalyticsWorkspace({
  accounts,
  selectedAccount,
  platformStats,
  onSelectAccount,
  onRefresh,
  refreshing,
}: {
  accounts: SocialAnalytics[];
  selectedAccount: SocialAnalytics | null;
  platformStats: PlatformPostStats[];
  onSelectAccount: (id: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [collapsed, setCollapsed] = useState({ accounts: false, details: false, content: false });
  const selectedMeta = selectedAccount ? getPlatformMeta(selectedAccount.platformKey || selectedAccount.platform) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
        <div>
          <p className="font-bold">Connected account workspace</p>
          <p className="text-sm text-muted-foreground">This panel is free floating, draggable, resizable, and non-blocking.</p>
        </div>
        <Button size="sm" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <AISpinner className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sync accounts
        </Button>
      </div>

      <WorkspaceSection title="Accounts" collapsed={collapsed.accounts} onToggle={() => setCollapsed((current) => ({ ...current, accounts: !current.accounts }))}>
        {accounts.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {accounts.map((account) => {
              const meta = getPlatformMeta(account.platformKey || account.platform);
              const Icon = meta.Icon;
              return (
                <button
                  key={account.id}
                  onClick={() => onSelectAccount(account.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition hover:border-cyan-500/50",
                    selectedAccount?.id === account.id && "border-cyan-500 bg-cyan-500/5"
                  )}
                >
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", meta.bgClass, meta.borderClass)}>
                    <Icon className="h-4 w-4" style={{ color: meta.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{account.platformDisplayName || account.platformUsername || meta.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{meta.label} / {account.platformUsername || "no handle saved"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={Link2} title="No accounts connected" helper="Connect social accounts to inspect them here." />
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Selected account details" collapsed={collapsed.details} onToggle={() => setCollapsed((current) => ({ ...current, details: !current.details }))}>
        {selectedAccount && selectedMeta ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
              <AccountAvatar account={selectedAccount} meta={selectedMeta} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{selectedAccount.platformDisplayName || selectedAccount.platformUsername || selectedMeta.label}</p>
                <p className="text-sm text-muted-foreground">{selectedMeta.label} / connected {formatDate(selectedAccount.connectedAt)}</p>
              </div>
              <Badge variant={selectedAccount.tokenExpired ? "destructive" : "outline"}>
                {selectedAccount.tokenExpired ? "Reconnect" : selectedAccount.hasAccessToken ? "Token active" : "No token"}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <WorkspaceStat icon={Users} label="Followers" value={formatOptional(selectedAccount.followersCount)} />
              <WorkspaceStat icon={Eye} label="Impressions" value={formatOptional(selectedAccount.impressions)} />
              <WorkspaceStat icon={MousePointerClick} label="Reach" value={formatOptional(selectedAccount.reach)} />
              <WorkspaceStat icon={TrendingUp} label="Engagement" value={formatRate(selectedAccount.engagementRate)} />
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
              Last analytics sync: <span className="font-medium text-foreground">{formatTimeAgo(selectedAccount.analyticsUpdatedAt)}</span>.
              {" "}
              {selectedAccount.analyticsMessage || (selectedAccount.analyticsRefreshSupported
                ? "This platform supports backend refresh in FlowSmartly."
                : "This platform is connected, but live platform analytics refresh still needs provider API support.")}
            </div>
          </div>
        ) : (
          <EmptyState icon={Link2} title="Select an account" helper="Pick a connected account to inspect its real saved metrics." />
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Content mapped to platforms" collapsed={collapsed.content} onToggle={() => setCollapsed((current) => ({ ...current, content: !current.content }))}>
        <PlatformPostBreakdown rows={platformStats} />
      </WorkspaceSection>
    </div>
  );
}

function WorkspaceSection({
  title,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="font-bold">{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition", collapsed && "-rotate-90")} />
      </button>
      {!collapsed && <div className="border-t p-3">{children}</div>}
    </div>
  );
}

function WorkspaceStat({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <Icon className="mb-2 h-4 w-4 text-muted-foreground" />
      <p className="font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, helper }: { icon: ElementType; title: string; helper: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center text-center">
      <div>
        <Icon className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" />
        <p className="font-bold">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{helper}</p>
      </div>
    </div>
  );
}
