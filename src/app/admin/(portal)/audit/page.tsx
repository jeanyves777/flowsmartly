"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Search,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  User,
  Clock,
  MapPin,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AuditLogEntry {
  id: string;
  action: string;
  category: string;
  severity: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  userId: string | null;
  userName: string | null;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  metadata: string;
  createdAt: string;
}

interface AuditStats {
  total: number;
  errors: number;
  warnings: number;
  auth: number;
}

const severityConfig: Record<string, { color: string; icon: React.ElementType }> = {
  DEBUG: { color: "bg-gray-500/20 text-gray-400", icon: Info },
  INFO: { color: "bg-blue-500/20 text-blue-400", icon: Info },
  WARNING: { color: "bg-yellow-500/20 text-yellow-400", icon: AlertTriangle },
  ERROR: { color: "bg-red-500/20 text-red-400", icon: AlertCircle },
  CRITICAL: { color: "bg-red-600/20 text-red-500", icon: XCircle },
};

const categoryColors: Record<string, string> = {
  AUTH: "bg-green-500/20 text-green-400",
  USER: "bg-blue-500/20 text-blue-400",
  POST: "bg-purple-500/20 text-purple-400",
  ADMIN: "bg-orange-500/20 text-orange-400",
  API: "bg-cyan-500/20 text-cyan-400",
  SYSTEM: "bg-gray-500/20 text-gray-400",
};

const deviceIcons: Record<string, React.ElementType> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats>({ total: 0, errors: 0, warnings: 0, auth: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsPerPage = 20;

  const fetchLogs = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (searchQuery) params.append("search", searchQuery);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (severityFilter !== "all") params.append("severity", severityFilter);

      const response = await fetch(`/api/admin/audit?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch audit logs");
      }

      setLogs(data.data.logs || []);
      setStats(data.data.stats || { total: 0, errors: 0, warnings: 0, auth: 0 });
      setTotalPages(data.data.pagination?.pages || 1);
      setTotalItems(data.data.pagination?.total || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, searchQuery, categoryFilter, severityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const parseMetadata = (metadata: string) => {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  };

  if (error && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4 text-foreground">{error}</p>
          <Button onClick={() => fetchLogs()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="w-7 h-7 text-orange-500" />
            Audit Logs
          </h1>
          <p className="mt-1 text-muted-foreground">
            Complete activity log of all system events
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => fetchLogs(true)}
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
              )}
              <p className="text-xs text-muted-foreground">Total Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats.errors}</p>
              )}
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats.warnings}</p>
              )}
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-green-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats.auth}</p>
              )}
              <p className="text-xs text-muted-foreground">Auth Events</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by action, user, IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-muted/50 border-input text-foreground"
            >
              <option value="all">All Categories</option>
              <option value="AUTH">Auth</option>
              <option value="USER">User</option>
              <option value="POST">Post</option>
              <option value="ADMIN">Admin</option>
              <option value="API">API</option>
              <option value="SYSTEM">System</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-muted/50 border-input text-foreground"
            >
              <option value="all">All Severity</option>
              <option value="DEBUG">Debug</option>
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="ERROR">Error</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => {
                const SeverityIcon = severityConfig[log.severity]?.icon || Info;
                const DeviceIcon = deviceIcons[log.deviceType || "desktop"] || Monitor;
                const metadata = parseMetadata(log.metadata);
                const isExpanded = expandedLog === log.id;

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-muted/50"
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center gap-4">
                        {/* Severity Icon */}
                        <div className={`w-8 h-8 rounded-lg ${severityConfig[log.severity]?.color} flex items-center justify-center shrink-0`}>
                          <SeverityIcon className="w-4 h-4" />
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{log.action}</span>
                            <Badge className={categoryColors[log.category] || "bg-gray-500/20"}>
                              {log.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {log.userName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {log.userName}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(log.createdAt)}
                            </span>
                            {log.ipAddress && (
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {log.ipAddress}
                              </span>
                            )}
                            {log.country && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {log.city}, {log.country}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Device */}
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DeviceIcon className="w-4 h-4" />
                          <span className="text-xs">{log.browser}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 border-t border-border"
                      >
                        <div className="pt-4 grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-medium mb-2 text-muted-foreground">Event Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Event ID:</span>
                                <span className="font-mono text-xs text-muted-foreground">{log.id}</span>
                              </div>
                              {log.resourceType && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Resource:</span>
                                  <span className="text-muted-foreground">{log.resourceType} #{log.resourceId}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Timestamp:</span>
                                <span className="text-muted-foreground">{new Date(log.createdAt).toISOString()}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-medium mb-2 text-muted-foreground">Device & Location</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Browser:</span>
                                <span className="text-muted-foreground">{log.browser} / {log.os}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">IP Address:</span>
                                <span className="font-mono text-xs text-muted-foreground">{log.ipAddress}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Location:</span>
                                <span className="text-muted-foreground">{log.city}, {log.country}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {Object.keys(metadata).length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-xs font-medium mb-2 text-muted-foreground">Metadata</h4>
                            <pre className="rounded-lg p-3 text-xs overflow-x-auto bg-muted text-muted-foreground">
                              {JSON.stringify(metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && logs.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, totalItems)} of{" "}
                {totalItems} events
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
