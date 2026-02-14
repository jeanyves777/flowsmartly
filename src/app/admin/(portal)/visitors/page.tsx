"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  Globe,
  Monitor,
  Smartphone,
  Mail,
  Phone,
  MapPin,
  RefreshCw,
  Download,
  Star,
  UserPlus,
  ExternalLink,
  Hash,
  Activity,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Types
interface Visitor {
  id: string;
  fingerprint: string;
  email?: string;
  phone?: string;
  country: string;
  city: string;
  region: string;
  device: string;
  deviceType: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
  firstSeen: string;
  lastSeen: string;
  totalVisits: number;
  totalPageViews: number;
  totalTimeOnSite: number;
  leadScore: number;
  isLead: boolean;
  source?: string;
  referrer?: string;
  sessions: VisitorSession[];
}

interface VisitorSession {
  id: string;
  startedAt: string;
  duration: number;
  pageViews: number;
  pages: { path: string; title: string; time: number }[];
}

interface VisitorStats {
  totalVisitors: number;
  newToday: number;
  leads: number;
  activeNow: number;
}

// Lead score thresholds
const getLeadScoreColor = (score: number) => {
  if (score >= 80) return "text-green-400 bg-green-500/20";
  if (score >= 60) return "text-yellow-400 bg-yellow-500/20";
  if (score >= 40) return "text-orange-400 bg-orange-500/20";
  return "text-gray-400 bg-gray-500/20";
};

const getLeadScoreLabel = (score: number) => {
  if (score >= 80) return "Hot Lead";
  if (score >= 60) return "Warm Lead";
  if (score >= 40) return "Cool Lead";
  return "Visitor";
};

export default function VisitorsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [stats, setStats] = useState<VisitorStats>({ totalVisitors: 0, newToday: 0, leads: 0, activeNow: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedVisitor, setExpandedVisitor] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "leads" | "new">("all");
  const [sortBy, setSortBy] = useState<"recent" | "score" | "visits">("recent");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVisitors = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const params = new URLSearchParams({
        filter: filterType,
        sort: sortBy,
      });
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(`/api/admin/visitors?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch visitors");
      }

      setVisitors(data.data.visitors);
      setStats(data.data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load visitors");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterType, sortBy, searchQuery]);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery !== "") {
        fetchVisitors();
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const DeviceIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "mobile":
        return <Smartphone className="w-4 h-4" />;
      case "tablet":
        return <Monitor className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  if (error && visitors.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4 text-foreground">{error}</p>
          <Button onClick={() => fetchVisitors()} variant="outline">
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
          <h1 className="text-2xl font-bold text-foreground">Visitor Tracking</h1>
          <p className="mt-1 text-muted-foreground">
            Track and manage individual visitors with lead scoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => fetchVisitors(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Visitors</p>
                {isLoading ? (
                  <div className="h-8 w-20 rounded animate-pulse bg-muted" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{formatNumber(stats.totalVisitors)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">New Today</p>
                {isLoading ? (
                  <div className="h-8 w-20 rounded animate-pulse bg-muted" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{formatNumber(stats.newToday)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads Captured</p>
                {isLoading ? (
                  <div className="h-8 w-20 rounded animate-pulse bg-muted" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{formatNumber(stats.leads)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Now</p>
                {isLoading ? (
                  <div className="h-8 w-20 rounded animate-pulse bg-muted" />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-foreground">{stats.activeNow}</p>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, phone, fingerprint, or location..."
                className="pl-10 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Type */}
            <div className="flex gap-2">
              {[
                { value: "all", label: "All" },
                { value: "leads", label: "Leads Only" },
                { value: "new", label: "New (24h)" },
              ].map((filter) => (
                <Button
                  key={filter.value}
                  variant={filterType === filter.value ? "default" : "outline"}
                  className={
                    filterType === filter.value
                      ? "bg-orange-500 hover:bg-orange-600 text-white"
                      : ""
                  }
                  onClick={() => setFilterType(filter.value as typeof filterType)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="border rounded-lg px-3 py-2 text-sm bg-muted/50 border-input text-foreground"
              >
                <option value="recent">Most Recent</option>
                <option value="score">Lead Score</option>
                <option value="visits">Most Visits</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visitors List */}
      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Visitors ({visitors.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : visitors.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No visitors found matching your criteria</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visitors.map((visitor) => (
                <div key={visitor.id} className="transition-colors hover:bg-muted/50">
                  {/* Visitor Row */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() =>
                      setExpandedVisitor(expandedVisitor === visitor.id ? null : visitor.id)
                    }
                  >
                    {/* Expand Icon */}
                    <div className="w-6 text-muted-foreground">
                      {expandedVisitor === visitor.id ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>

                    {/* Lead Score */}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${getLeadScoreColor(
                        visitor.leadScore
                      )}`}
                    >
                      {visitor.leadScore}
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {visitor.email ? (
                          <span className="font-medium text-foreground">{visitor.email}</span>
                        ) : visitor.phone ? (
                          <span className="font-medium text-foreground">{visitor.phone}</span>
                        ) : (
                          <span className="font-mono text-sm text-muted-foreground">{visitor.fingerprint}</span>
                        )}
                        {visitor.isLead && (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                            <Star className="w-3 h-3 mr-1" />
                            {getLeadScoreLabel(visitor.leadScore)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {visitor.city}, {visitor.country}
                        </span>
                        <span className="flex items-center gap-1">
                          <DeviceIcon type={visitor.deviceType} />
                          {visitor.browser}
                        </span>
                        {visitor.source && (
                          <span className="flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {visitor.source}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-medium text-foreground">{visitor.totalVisits}</p>
                        <p className="text-xs text-muted-foreground">visits</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">{visitor.totalPageViews}</p>
                        <p className="text-xs text-muted-foreground">pages</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">{formatDuration(visitor.totalTimeOnSite)}</p>
                        <p className="text-xs text-muted-foreground">time</p>
                      </div>
                    </div>

                    {/* Last Seen */}
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{formatDate(visitor.lastSeen)}</p>
                      <p className="text-xs text-muted-foreground">last seen</p>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedVisitor === visitor.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 ml-10 grid md:grid-cols-3 gap-4">
                          {/* Contact Info */}
                          <div className="rounded-xl p-4 bg-muted">
                            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Contact Info</h4>
                            <div className="space-y-2">
                              {visitor.email && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-foreground">{visitor.email}</span>
                                </div>
                              )}
                              {visitor.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-foreground">{visitor.phone}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-sm">
                                <Hash className="w-4 h-4 text-muted-foreground" />
                                <span className="font-mono text-xs text-muted-foreground">{visitor.fingerprint}</span>
                              </div>
                            </div>
                          </div>

                          {/* Device & Location */}
                          <div className="rounded-xl p-4 bg-muted">
                            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Device & Location</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <DeviceIcon type={visitor.deviceType} />
                                <span className="text-foreground">{visitor.device}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">{visitor.browser} / {visitor.os}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {visitor.city}, {visitor.region}, {visitor.country}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Activity Summary */}
                          <div className="rounded-xl p-4 bg-muted">
                            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Activity Summary</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">First seen:</span>
                                <span className="text-foreground">{new Date(visitor.firstSeen).toLocaleDateString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Source:</span>
                                <span className="capitalize text-foreground">{visitor.source || "Direct"}</span>
                              </div>
                              {visitor.referrer && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Referrer:</span>
                                  <span className="text-foreground">{visitor.referrer}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Avg session:</span>
                                <span className="text-foreground">
                                  {formatDuration(Math.round(visitor.totalTimeOnSite / (visitor.totalVisits || 1)))}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Recent Session Pages */}
                          {visitor.sessions && visitor.sessions.length > 0 && (
                            <div className="md:col-span-3 rounded-xl p-4 bg-muted">
                              <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                                Latest Session - {formatDate(visitor.sessions[0].startedAt)}
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {visitor.sessions[0].pages.map((page, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 bg-background border border-border"
                                  >
                                    <span className="text-sm text-foreground">{page.path}</span>
                                    <span className="text-xs text-muted-foreground">{page.time}s</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
