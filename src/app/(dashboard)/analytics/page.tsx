"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Megaphone,
  DollarSign,
  Zap,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type TimeRange = "today" | "7d" | "30d" | "90d";
type ChartMode = "views" | "engagement" | "boosted";

interface Stats {
  views: number;
  viewsChange: number;
  likes: number;
  likesChange: number;
  comments: number;
  commentsChange: number;
  shares: number;
  followers: number;
  followersChange: number;
  engagementRate: number;
  postsThisPeriod: number;
}

interface BoostedOrganic {
  boosted: { posts: number; views: number; likes: number; comments: number; shares: number };
  organic: { posts: number; views: number; likes: number; comments: number; shares: number };
}

interface AdStats {
  activeCampaigns: number;
  totalSpent: number;
  totalImpressions: number;
  totalEarned: number;
}

interface ChartData {
  date: string;
  views: number;
  likes: number;
  comments: number;
  posts: number;
  boostedViews: number;
  organicViews: number;
}

interface TopPost {
  id: string;
  content: string;
  views: number;
  likes: number;
  comments: number;
  createdAt: string;
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [chartMode, setChartMode] = useState<ChartMode>("views");
  const [stats, setStats] = useState<Stats | null>(null);
  const [boostedVsOrganic, setBoostedVsOrganic] = useState<BoostedOrganic | null>(null);
  const [adStats, setAdStats] = useState<AdStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/analytics?range=${timeRange}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch analytics");
      }

      setStats(data.data.stats);
      setBoostedVsOrganic(data.data.boostedVsOrganic || null);
      setAdStats(data.data.adStats || null);
      setChartData(data.data.chartData || []);
      setTopPosts(data.data.topPosts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (num: number) => `$${num.toFixed(2)}`;

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Track your content performance and audience growth
          </p>
        </div>
        <div className="flex rounded-lg border p-1">
          {[
            { id: "today", label: "Today" },
            { id: "7d", label: "7 Days" },
            { id: "30d", label: "30 Days" },
            { id: "90d", label: "90 Days" },
          ].map((range) => (
            <button
              key={range.id}
              onClick={() => setTimeRange(range.id as TimeRange)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                timeRange === range.id
                  ? "bg-brand-500 text-white"
                  : "hover:bg-muted"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid - 6 cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-10 w-10 rounded-lg mb-3" />
                <Skeleton className="h-8 w-20 mb-1" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            {
              title: "Views",
              value: formatNumber(stats.views),
              change: stats.viewsChange,
              icon: Eye,
              color: "text-blue-500 bg-blue-500/10",
            },
            {
              title: "Likes",
              value: formatNumber(stats.likes),
              change: stats.likesChange,
              icon: Heart,
              color: "text-pink-500 bg-pink-500/10",
            },
            {
              title: "Comments",
              value: formatNumber(stats.comments),
              change: stats.commentsChange,
              icon: MessageCircle,
              color: "text-orange-500 bg-orange-500/10",
            },
            {
              title: "Shares",
              value: formatNumber(stats.shares),
              change: 0,
              icon: Share2,
              color: "text-cyan-500 bg-cyan-500/10",
            },
            {
              title: "Followers",
              value: formatNumber(stats.followers),
              change: stats.followersChange,
              icon: Users,
              color: "text-green-500 bg-green-500/10",
            },
            {
              title: "Engagement",
              value: `${stats.engagementRate}%`,
              change: 0,
              icon: Sparkles,
              color: "text-purple-500 bg-purple-500/10",
            },
          ].map((metric, index) => (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${metric.color}`}>
                      <metric.icon className="w-5 h-5" />
                    </div>
                    {metric.change !== 0 && (
                      <Badge
                        className={
                          metric.change > 0
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        }
                      >
                        {metric.change > 0 ? (
                          <ArrowUpRight className="w-3 h-3 mr-1" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 mr-1" />
                        )}
                        {Math.abs(metric.change)}%
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-bold">{metric.value}</p>
                    <p className="text-sm text-muted-foreground">{metric.title}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Chart & Summary */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        {/* Chart */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand-500" />
                Performance Overview
              </CardTitle>
              <div className="flex rounded-md border p-0.5">
                {[
                  { id: "views", label: "Views" },
                  { id: "engagement", label: "Engagement" },
                  { id: "boosted", label: "Boosted vs Organic" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setChartMode(mode.id as ChartMode)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                      chartMode === mode.id
                        ? "bg-brand-500 text-white"
                        : "hover:bg-muted"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No data for this period</p>
                </div>
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex items-center gap-4 mb-4 text-xs">
                  {chartMode === "views" && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-brand-500" />
                      <span className="text-muted-foreground">Views</span>
                    </div>
                  )}
                  {chartMode === "engagement" && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-pink-500" />
                        <span className="text-muted-foreground">Likes</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-orange-500" />
                        <span className="text-muted-foreground">Comments</span>
                      </div>
                    </>
                  )}
                  {chartMode === "boosted" && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-purple-500" />
                        <span className="text-muted-foreground">Boosted</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                        <span className="text-muted-foreground">Organic</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="h-56 flex items-end justify-around gap-1.5">
                  {chartData.map((data, index) => {
                    if (chartMode === "views") {
                      const maxViews = Math.max(...chartData.map(d => d.views), 1);
                      const heightPercent = (data.views / maxViews) * 100;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-2 group relative">
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            {formatNumber(data.views)} views
                          </div>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPercent}%` }}
                            transition={{ delay: index * 0.05 }}
                            className="w-full bg-brand-500/80 rounded-t-md min-h-[4px]"
                          />
                          <span className="text-[10px] text-muted-foreground">{data.date}</span>
                        </div>
                      );
                    }

                    if (chartMode === "engagement") {
                      const maxEng = Math.max(...chartData.map(d => d.likes + d.comments), 1);
                      const likesH = ((data.likes) / maxEng) * 100;
                      const commentsH = ((data.comments) / maxEng) * 100;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-2 group relative">
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            {data.likes} likes, {data.comments} comments
                          </div>
                          <div className="w-full flex flex-col justify-end h-full">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${commentsH}%` }}
                              transition={{ delay: index * 0.05 }}
                              className="w-full bg-orange-500/80 min-h-[2px] rounded-t-md"
                            />
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${likesH}%` }}
                              transition={{ delay: index * 0.05 + 0.02 }}
                              className="w-full bg-pink-500/80 min-h-[2px]"
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{data.date}</span>
                        </div>
                      );
                    }

                    // boosted vs organic
                    const maxB = Math.max(...chartData.map(d => d.boostedViews + d.organicViews), 1);
                    const boostedH = ((data.boostedViews) / maxB) * 100;
                    const organicH = ((data.organicViews) / maxB) * 100;
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center gap-2 group relative">
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {formatNumber(data.boostedViews)} boosted, {formatNumber(data.organicViews)} organic
                        </div>
                        <div className="w-full flex flex-col justify-end h-full">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${boostedH}%` }}
                            transition={{ delay: index * 0.05 }}
                            className="w-full bg-purple-500/80 min-h-[2px] rounded-t-md"
                          />
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${organicH}%` }}
                            transition={{ delay: index * 0.05 + 0.02 }}
                            className="w-full bg-emerald-500/80 min-h-[2px]"
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{data.date}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-500" />
              Period Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Posts Created</span>
                  <span className="font-semibold">{stats.postsThisPeriod}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Engagement</span>
                  <span className="font-semibold">{formatNumber(stats.likes + stats.comments + stats.shares)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Avg. Views/Post</span>
                  <span className="font-semibold">
                    {stats.postsThisPeriod > 0
                      ? formatNumber(Math.round(stats.views / stats.postsThisPeriod))
                      : "0"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Avg. Likes/Post</span>
                  <span className="font-semibold">
                    {stats.postsThisPeriod > 0
                      ? formatNumber(Math.round(stats.likes / stats.postsThisPeriod))
                      : "0"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Avg. Comments/Post</span>
                  <span className="font-semibold">
                    {stats.postsThisPeriod > 0
                      ? formatNumber(Math.round(stats.comments / stats.postsThisPeriod))
                      : "0"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Boosted vs Organic */}
      {!isLoading && boostedVsOrganic && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-brand-500" />
              Boosted vs Organic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {[
                { label: "Posts", boosted: boostedVsOrganic.boosted.posts, organic: boostedVsOrganic.organic.posts },
                { label: "Views", boosted: boostedVsOrganic.boosted.views, organic: boostedVsOrganic.organic.views },
                { label: "Likes", boosted: boostedVsOrganic.boosted.likes, organic: boostedVsOrganic.organic.likes },
                { label: "Comments", boosted: boostedVsOrganic.boosted.comments, organic: boostedVsOrganic.organic.comments },
                { label: "Shares", boosted: boostedVsOrganic.boosted.shares, organic: boostedVsOrganic.organic.shares },
              ].map((row) => {
                const total = row.boosted + row.organic;
                const boostedPct = total > 0 ? (row.boosted / total) * 100 : 0;
                const organicPct = total > 0 ? (row.organic / total) * 100 : 0;
                return (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{row.label}</span>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          {formatNumber(row.boosted)} boosted
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {formatNumber(row.organic)} organic
                        </span>
                      </div>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                      {boostedPct > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${boostedPct}%` }}
                          transition={{ duration: 0.5 }}
                          className="bg-purple-500 h-full"
                        />
                      )}
                      {organicPct > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${organicPct}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          className="bg-emerald-500 h-full"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ad Performance */}
      {!isLoading && adStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-brand-500" />
              Ad Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  title: "Active Campaigns",
                  value: adStats.activeCampaigns.toString(),
                  icon: Megaphone,
                  gradient: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
                  iconColor: "text-blue-500",
                },
                {
                  title: "Total Impressions",
                  value: formatNumber(adStats.totalImpressions),
                  icon: Eye,
                  gradient: "from-purple-500/10 to-purple-600/5 border-purple-500/20",
                  iconColor: "text-purple-500",
                },
                {
                  title: "Ad Spend",
                  value: formatCurrency(adStats.totalSpent),
                  icon: DollarSign,
                  gradient: "from-orange-500/10 to-orange-600/5 border-orange-500/20",
                  iconColor: "text-orange-500",
                },
                {
                  title: "Earned from Ads",
                  value: formatCurrency(adStats.totalEarned),
                  icon: TrendingUp,
                  gradient: "from-green-500/10 to-green-600/5 border-green-500/20",
                  iconColor: "text-green-500",
                },
              ].map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`rounded-xl border bg-gradient-to-br ${card.gradient} p-4`}
                >
                  <card.icon className={`w-6 h-6 ${card.iconColor} mb-3`} />
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-500" />
            Top Performing Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : topPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No posts yet</p>
              <p className="text-sm mt-1">Create your first post to see analytics</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{post.content || "No caption"}</p>
                    <p className="text-sm text-muted-foreground">{formatTimeAgo(post.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <span>{formatNumber(post.views)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-muted-foreground" />
                      <span>{formatNumber(post.likes)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      <span>{formatNumber(post.comments)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
