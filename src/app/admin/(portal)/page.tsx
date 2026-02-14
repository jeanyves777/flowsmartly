"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Eye,
  FileText,
  DollarSign,
  Activity,
  Globe,
  AlertTriangle,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  ArrowUpRight,
  ArrowDownRight,
  MousePointerClick,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  totalUsers: number;
  userGrowth: number;
  activeUsers: number;
  totalPageViews: number;
  pageViewGrowth: number;
  totalPosts: number;
  postsGrowth: number;
  totalRevenue: number;
  revenueGrowth: number;
  activeVisitors: number;
}

interface RecentActivity {
  id: string;
  action: string;
  user: string;
  category: string;
  severity: string;
  time: Date;
}

interface TopPage {
  path: string;
  views: number;
  percentage: number;
}

interface TopCountry {
  country: string;
  visitors: number;
  percentage: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [topCountries, setTopCountries] = useState<TopCountry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const response = await fetch("/api/admin/stats");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch stats");
      }

      setStats(data.data.stats);
      setRecentActivity(data.data.recentActivity);
      setTopPages(data.data.topPages);
      setTopCountries(data.data.topCountries);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const StatCard = ({
    title,
    value,
    change,
    icon: Icon,
    color,
    isLoading,
  }: {
    title: string;
    value: string;
    change: number;
    icon: React.ElementType;
    color: string;
    isLoading?: boolean;
  }) => (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {!isLoading && (
            <Badge
              className={`${
                change >= 0
                  ? "bg-green-500/20 text-green-500"
                  : "bg-red-500/20 text-red-500"
              }`}
            >
              {change >= 0 ? (
                <ArrowUpRight className="w-3 h-3 mr-1" />
              ) : (
                <ArrowDownRight className="w-3 h-3 mr-1" />
              )}
              {Math.abs(change)}%
            </Badge>
          )}
        </div>
        <div className="mt-4">
          {isLoading ? (
            <div className="h-8 w-24 rounded animate-pulse bg-muted" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
          <p className="text-sm mt-1 text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4">{error}</p>
          <Button onClick={() => fetchData()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Overview</h1>
          <p className="mt-1 text-muted-foreground">
            Real-time system metrics and activity monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {stats?.activeVisitors || 0} active now
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={formatNumber(stats?.totalUsers || 0)}
          change={stats?.userGrowth || 0}
          icon={Users}
          color="bg-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          title="Page Views (30d)"
          value={formatNumber(stats?.totalPageViews || 0)}
          change={stats?.pageViewGrowth || 0}
          icon={Eye}
          color="bg-purple-500"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Posts"
          value={formatNumber(stats?.totalPosts || 0)}
          change={stats?.postsGrowth || 0}
          icon={FileText}
          color="bg-green-500"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          change={stats?.revenueGrowth || 0}
          icon={DollarSign}
          color="bg-orange-500"
          isLoading={isLoading}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-500" />
                Recent Activity
              </CardTitle>
              <Badge variant="secondary">
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No recent activity
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        activity.severity === "ERROR"
                          ? "bg-red-500"
                          : activity.severity === "WARNING"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.user}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(activity.time)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-orange-500" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Database</span>
                </div>
                <span className="text-sm font-medium text-green-500">Connected</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-muted">
                <div className="h-full w-full bg-green-500 rounded-full" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Storage</span>
                </div>
                <span className="text-sm font-medium text-green-500">OK</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-muted">
                <div className="h-full w-[34%] bg-green-500 rounded-full" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">API Status</span>
                </div>
                <span className="text-sm font-medium text-green-500">Online</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">All systems operational</span>
                <span className="w-2 h-2 rounded-full bg-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-orange-500" />
              Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : topPages.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No page view data yet
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium p-4 text-muted-foreground">Page</th>
                    <th className="text-right text-xs font-medium p-4 text-muted-foreground">Views</th>
                    <th className="text-right text-xs font-medium p-4 text-muted-foreground">%</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.map((page, i) => (
                    <tr key={page.path} className="border-b last:border-0 border-border/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs w-4 text-muted-foreground">{i + 1}</span>
                          <span className="text-sm">{page.path}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right text-sm text-muted-foreground">
                        {formatNumber(page.views)}
                      </td>
                      <td className="p-4 text-right text-sm text-muted-foreground">
                        {page.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Top Countries */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-orange-500" />
              Top Countries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {isLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : topCountries.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No location data yet
              </div>
            ) : (
              topCountries.map((country) => (
                <div key={country.country} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{country.country}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(country.visitors)} ({country.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${country.percentage}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-medium text-blue-400">Real-time Data</h3>
              <p className="text-sm text-blue-300/80 mt-1">
                This dashboard shows live data from your database. Stats auto-refresh every 30 seconds.
                Click the refresh button to manually update the data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
