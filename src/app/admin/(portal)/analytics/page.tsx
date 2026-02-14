"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Eye,
  Clock,
  MousePointerClick,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  ChevronDown,
  BarChart3,
  Activity,
  UserPlus,
  UserCheck,
  ExternalLink,
  Search,
  Share2,
  Mail,
  Bookmark,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Types
interface AnalyticsStats {
  visitors: number;
  visitorsChange: number;
  pageViews: number;
  pageViewsChange: number;
  avgSessionDuration: number;
  durationChange: number;
  bounceRate: number;
  bounceRateChange: number;
  newUsers: number;
  newUsersChange: number;
  returningUsers: number;
  activeNow: number;
}

interface TimeSeriesData {
  date: string;
  visitors: number;
  pageViews: number;
  sessions: number;
}

interface TrafficSource {
  source: string;
  visitors: number;
  percentage: number;
}

interface TopPage {
  path: string;
  title: string;
  views: number;
  uniqueVisitors: number;
  avgTime: number;
  bounceRate: number;
}

interface DeviceData {
  device: string;
  sessions: number;
  percentage: number;
}

interface BrowserData {
  browser: string;
  sessions: number;
  percentage: number;
}

interface CountryData {
  country: string;
  code: string;
  visitors: number;
  percentage: number;
}

// Traffic source icons
const sourceIcons: Record<string, React.ElementType> = {
  "Organic Search": Search,
  "Direct": Bookmark,
  "Social": Share2,
  "Referral": ExternalLink,
  "Email": Mail,
};

const sourceColors: Record<string, string> = {
  "Organic Search": "bg-green-500",
  "Direct": "bg-blue-500",
  "Social": "bg-purple-500",
  "Referral": "bg-orange-500",
  "Email": "bg-red-500",
};

// Device icons
const deviceIconMap: Record<string, React.ElementType> = {
  Desktop: Monitor,
  Mobile: Smartphone,
  Tablet: Tablet,
};

// Browser colors
const browserColors: Record<string, string> = {
  Chrome: "bg-yellow-500",
  Safari: "bg-blue-500",
  Firefox: "bg-orange-500",
  Edge: "bg-cyan-500",
  Other: "bg-gray-500",
};

// Date range options
const dateRanges = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "This year", value: "year" },
];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [deviceData, setDeviceData] = useState<DeviceData[]>([]);
  const [browserData, setBrowserData] = useState<BrowserData[]>([]);
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [dateRange, setDateRange] = useState("7d");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const response = await fetch(`/api/admin/analytics?range=${dateRange}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch analytics");
      }

      setStats(data.data.stats || null);
      setTimeSeriesData(data.data.timeSeriesData || data.data.timeSeries || []);
      setTrafficSources(data.data.trafficSources || []);
      setTopPages(data.data.topPages || []);
      setDeviceData(data.data.deviceStats || data.data.devices || []);
      setBrowserData(data.data.browserStats || data.data.browsers || []);
      setCountryData(data.data.countryStats || data.data.countries || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchAnalytics(), 60000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Simple chart component using CSS
  const SimpleLineChart = ({ data }: { data: TimeSeriesData[] }) => {
    if (data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No data available for this period
        </div>
      );
    }

    const maxValue = Math.max(...data.map((d) => d.pageViews));
    const minValue = Math.min(...data.map((d) => d.pageViews));
    const range = maxValue - minValue || 1;

    return (
      <div className="relative h-64 w-full">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full w-12 flex flex-col justify-between text-xs py-2 text-muted-foreground">
          <span>{formatNumber(maxValue)}</span>
          <span>{formatNumber(Math.round((maxValue + minValue) / 2))}</span>
          <span>{formatNumber(minValue)}</span>
        </div>

        {/* Chart area */}
        <div className="ml-14 h-full flex items-end gap-2">
          {data.map((point, i) => {
            const height = ((point.pageViews - minValue) / range) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex gap-1 h-48 items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="flex-1 bg-gradient-to-t from-orange-500 to-orange-400 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer relative group"
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 bg-gray-800 text-white">
                      {formatNumber(point.pageViews)} views
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${((point.visitors - minValue / 3) / range) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 + 0.1 }}
                    className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer relative group"
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 bg-gray-800 text-white">
                      {formatNumber(point.visitors)} visitors
                    </div>
                  </motion.div>
                </div>
                <span className="text-xs text-muted-foreground">{point.date.split(" ")[1] || point.date}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="absolute bottom-0 right-0 flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-orange-500" />
            <span className="text-muted-foreground">Page Views</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-muted-foreground">Visitors</span>
          </div>
        </div>
      </div>
    );
  };

  const StatCard = ({
    title,
    value,
    change,
    icon: Icon,
    subtext,
    isLoading,
  }: {
    title: string;
    value: string;
    change: number;
    icon: React.ElementType;
    subtext?: string;
    isLoading?: boolean;
  }) => (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted">
              <Icon className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              {isLoading ? (
                <div className="h-8 w-20 rounded animate-pulse mt-0.5 bg-muted" />
              ) : (
                <p className="text-2xl font-bold mt-0.5">{value}</p>
              )}
              {subtext && !isLoading && <p className="text-xs mt-0.5 text-muted-foreground">{subtext}</p>}
            </div>
          </div>
          {!isLoading && (
            <Badge
              className={`${
                change >= 0
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : "bg-red-500/20 text-red-400 border-red-500/30"
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
      </CardContent>
    </Card>
  );

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4">{error}</p>
          <Button onClick={() => fetchAnalytics()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Detailed insights into your website traffic and user behavior
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Real-time indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-green-400">{stats?.activeNow || 0} active now</span>
          </div>

          {/* Date Range Picker */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {dateRanges.find((r) => r.value === dateRange)?.label}
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
            {showDatePicker && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-xl z-50 bg-card border border-border">
                {dateRanges.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => {
                      setDateRange(range.value);
                      setShowDatePicker(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      dateRange === range.value
                        ? "text-orange-500 bg-muted"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchAnalytics(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Visitors"
          value={formatNumber(stats?.visitors || 0)}
          change={stats?.visitorsChange || 0}
          icon={Users}
          isLoading={isLoading}
        />
        <StatCard
          title="Page Views"
          value={formatNumber(stats?.pageViews || 0)}
          change={stats?.pageViewsChange || 0}
          icon={Eye}
          isLoading={isLoading}
        />
        <StatCard
          title="Avg. Session"
          value={formatDuration(stats?.avgSessionDuration || 0)}
          change={stats?.durationChange || 0}
          icon={Clock}
          isLoading={isLoading}
        />
        <StatCard
          title="Bounce Rate"
          value={`${stats?.bounceRate || 0}%`}
          change={stats?.bounceRateChange || 0}
          icon={MousePointerClick}
          isLoading={isLoading}
        />
        <StatCard
          title="New Users"
          value={formatNumber(stats?.newUsers || 0)}
          change={stats?.newUsersChange || 0}
          icon={UserPlus}
          subtext={stats ? `${Math.round((stats.newUsers / stats.visitors) * 100) || 0}% of total` : undefined}
          isLoading={isLoading}
        />
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              Traffic Overview
            </CardTitle>
            {!isLoading && timeSeriesData && timeSeriesData.length > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {formatNumber(timeSeriesData.reduce((a, b) => a + b.pageViews, 0))}
                  </span>{" "}
                  total page views
                </div>
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {formatNumber(timeSeriesData.reduce((a, b) => a + b.visitors, 0))}
                  </span>{" "}
                  total visitors
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <SimpleLineChart data={timeSeriesData} />
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Traffic Sources */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-orange-500" />
              Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 rounded animate-pulse bg-muted" />
                ))}
              </div>
            ) : trafficSources.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No traffic data yet</div>
            ) : (
              trafficSources.map((source) => {
                const Icon = sourceIcons[source.source] || ExternalLink;
                const color = sourceColors[source.source] || "bg-gray-500";
                return (
                  <div key={source.source} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${color} bg-opacity-20 flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${color.replace("bg-", "text-")}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm truncate">{source.source}</span>
                        <span className="text-sm text-muted-foreground">{source.percentage}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${source.percentage}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-full ${color} rounded-full`}
                        />
                      </div>
                    </div>
                    <span className="text-sm w-14 text-right text-muted-foreground">
                      {formatNumber(source.visitors)}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-orange-500" />
              Devices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center gap-8 py-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-24 h-24 rounded-full animate-pulse bg-muted" />
                ))}
              </div>
            ) : deviceData.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No device data yet</div>
            ) : (
              <div className="flex items-center justify-center gap-8 py-6">
                {deviceData.map((device) => {
                  const Icon = deviceIconMap[device.device] || Monitor;
                  return (
                    <div key={device.device} className="text-center">
                      <div className="relative inline-flex">
                        <svg className="w-24 h-24 transform -rotate-90">
                          <circle
                            className="text-muted"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="48"
                            cy="48"
                          />
                          <motion.circle
                            className="text-orange-500"
                            strokeWidth="8"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="48"
                            cy="48"
                            initial={{ strokeDasharray: "0 251.2" }}
                            animate={{ strokeDasharray: `${device.percentage * 2.512} 251.2` }}
                            transition={{ duration: 1 }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-muted-foreground" />
                        </div>
                      </div>
                      <p className="text-xl font-bold mt-2">{device.percentage}%</p>
                      <p className="text-sm text-muted-foreground">{device.device}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Browsers */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-orange-500" />
              Browsers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-6 rounded animate-pulse bg-muted" />
                ))}
              </div>
            ) : browserData.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No browser data yet</div>
            ) : (
              browserData.map((browser) => (
                <div key={browser.browser} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${browserColors[browser.browser] || "bg-gray-500"}`} />
                  <span className="text-sm flex-1">{browser.browser}</span>
                  <span className="text-sm text-muted-foreground">{browser.percentage}%</span>
                  <span className="text-sm w-12 text-right text-muted-foreground">
                    {formatNumber(browser.sessions)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Pages & Countries */}
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
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 rounded animate-pulse bg-muted" />
                ))}
              </div>
            ) : topPages.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No page data yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium px-4 py-3 text-muted-foreground">Page</th>
                      <th className="text-right text-xs font-medium px-4 py-3 text-muted-foreground">Views</th>
                      <th className="text-right text-xs font-medium px-4 py-3 text-muted-foreground">Unique</th>
                      <th className="text-right text-xs font-medium px-4 py-3 text-muted-foreground">Avg Time</th>
                      <th className="text-right text-xs font-medium px-4 py-3 text-muted-foreground">Bounce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPages.map((page) => (
                      <tr key={page.path} className="border-b last:border-0 transition-colors border-border hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm">{page.path}</p>
                            <p className="text-xs text-muted-foreground">{page.title}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {formatNumber(page.views)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {formatNumber(page.uniqueVisitors)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {formatTime(page.avgTime)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`text-sm ${
                              page.bounceRate < 30
                                ? "text-green-400"
                                : page.bounceRate < 50
                                ? "text-yellow-400"
                                : "text-red-400"
                            }`}
                          >
                            {page.bounceRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Countries */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-orange-500" />
              Geographic Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 rounded animate-pulse bg-muted" />
                ))}
              </div>
            ) : countryData.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No location data yet</div>
            ) : (
              <div className="space-y-3">
                {countryData.map((country, i) => (
                  <div key={country.code} className="flex items-center gap-3">
                    <span className="text-xs w-5 text-muted-foreground">{i + 1}</span>
                    <span className="text-sm flex-1">{country.country}</span>
                    <div className="w-24 h-1.5 rounded-full overflow-hidden bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${country.percentage}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                      />
                    </div>
                    <span className="text-sm w-10 text-right text-muted-foreground">{country.percentage}%</span>
                    <span className="text-sm w-12 text-right text-muted-foreground">
                      {formatNumber(country.visitors)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Engagement */}
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-500" />
            User Engagement
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="grid md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-xl animate-pulse bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                  <UserPlus className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-2xl font-bold">
                  {stats ? Math.round((stats.newUsers / (stats.visitors || 1)) * 100) : 0}%
                </p>
                <p className="text-sm mt-1 text-muted-foreground">New Visitors</p>
                <p className="text-xs text-muted-foreground">{formatNumber(stats?.newUsers || 0)} users</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-2xl font-bold">
                  {stats ? Math.round((stats.returningUsers / (stats.visitors || 1)) * 100) : 0}%
                </p>
                <p className="text-sm mt-1 text-muted-foreground">Returning Visitors</p>
                <p className="text-xs text-muted-foreground">{formatNumber(stats?.returningUsers || 0)} users</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                  <Eye className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-2xl font-bold">
                  {stats ? ((stats.pageViews / (stats.visitors || 1))).toFixed(1) : "0.0"}
                </p>
                <p className="text-sm mt-1 text-muted-foreground">Pages / Session</p>
                <p className="text-xs text-muted-foreground">avg per user</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-orange-400" />
                </div>
                <p className="text-2xl font-bold">{formatDuration(stats?.avgSessionDuration || 0)}</p>
                <p className="text-sm mt-1 text-muted-foreground">Avg. Session Duration</p>
                <p className="text-xs text-muted-foreground">time on site</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
