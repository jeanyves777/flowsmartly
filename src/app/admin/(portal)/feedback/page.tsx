"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type FeedbackUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  plan: string;
};

type FeedbackReport = {
  id: string;
  referenceCode: string;
  userId: string;
  category: string;
  message: string;
  screenshotUrls: string[];
  pageUrl: string | null;
  userAgent: string | null;
  viewport: string | null;
  status: string;
  priority: string;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: FeedbackUser;
};

type Stats = {
  total: number;
  new: number;
  inProgress: number;
  resolved: number;
  urgent: number;
};

const statusOptions = ["NEW", "TRIAGED", "IN_PROGRESS", "RESOLVED", "ARCHIVED"];
const priorityOptions = ["LOW", "NORMAL", "HIGH", "URGENT"];

const statusStyles: Record<string, string> = {
  NEW: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  TRIAGED: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  IN_PROGRESS: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  RESOLVED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  ARCHIVED: "border-border bg-muted text-muted-foreground",
};

const priorityStyles: Record<string, string> = {
  LOW: "border-border bg-muted text-muted-foreground",
  NORMAL: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  HIGH: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-300",
  URGENT: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300",
};

const categoryLabels: Record<string, string> = {
  GENERAL: "General",
  BUG: "Bug",
  DISPLAY: "Display",
  POSTING: "Posting",
  ACCOUNT: "Account",
  BILLING: "Billing",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getErrorMessage(data: any, fallback: string) {
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

export default function AdminFeedbackPage() {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);

      const response = await fetch(`/api/admin/feedback?${params}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, "Failed to fetch feedback reports"));
      }

      const nextReports = data.data.reports as FeedbackReport[];
      setReports(nextReports);
      setExpandedId((current) =>
        current && nextReports.some((report) => report.id === current)
          ? current
          : nextReports[0]?.id || null
      );
      setStats(data.data.stats);
      setCategories(data.data.categories || []);
      setTotalPages(data.data.pagination.totalPages || 1);
      setNotesDraft((current) => {
        const next = { ...current };
        nextReports.forEach((report) => {
          if (next[report.id] === undefined) next[report.id] = report.adminNotes || "";
        });
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feedback reports");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [categoryFilter, currentPage, searchQuery, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateReport = async (
    report: FeedbackReport,
    patch: { status?: string; priority?: string; adminNotes?: string }
  ) => {
    setActionLoading(report.id);
    try {
      const response = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: report.id, ...patch }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, "Failed to update report"));
      }

      const updated = data.data.report as FeedbackReport;
      setReports((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNotesDraft((current) => ({ ...current, [updated.id]: updated.adminNotes || "" }));
      setError(null);
      fetchData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update report");
    } finally {
      setActionLoading(null);
    }
  };

  const copyReference = async (report: FeedbackReport) => {
    const text = [
      `${report.referenceCode} ${report.category} ${report.status} ${report.priority}`,
      `User: ${report.user.name} <${report.user.email}>`,
      report.pageUrl ? `Page: ${report.pageUrl}` : null,
      `Message: ${report.message}`,
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-full space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <Bug className="h-7 w-7 text-sky-500" />
            Feedback Reports
          </h1>
          <p className="mt-1 text-muted-foreground">
            Review user bug reports, screenshots, and page context from the app.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchData(true)} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { label: "Total", value: stats.total, icon: Bug },
            { label: "New", value: stats.new, icon: Clock3 },
            { label: "In Progress", value: stats.inProgress, icon: Wrench },
            { label: "Resolved", value: stats.resolved, icon: CheckCircle2 },
            { label: "Urgent", value: stats.urgent, icon: AlertTriangle },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
                    <Icon className="h-5 w-5 text-sky-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search reference, message, user, email, or page..."
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              {[...new Set([...Object.keys(categoryLabels), ...categories])].map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category] || category}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {[...Array(5)].map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Bug className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p>No feedback reports found</p>
            </div>
          ) : (
            <div className="divide-y">
              {reports.map((report) => {
                const isExpanded = expandedId === report.id;
                return (
                  <div key={report.id} className="transition-colors hover:bg-muted/30">
                    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.7fr)_minmax(260px,0.8fr)_auto] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{report.referenceCode}</p>
                          <Badge variant="outline" className={statusStyles[report.status] || statusStyles.NEW}>
                            {report.status}
                          </Badge>
                          <Badge variant="outline" className={priorityStyles[report.priority] || priorityStyles.NORMAL}>
                            {report.priority}
                          </Badge>
                          <Badge variant="secondary">{categoryLabels[report.category] || report.category}</Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{report.message}</p>
                      </div>

                      <div className="min-w-0 text-sm">
                        <p className="font-medium">{report.user.name}</p>
                        <p className="truncate text-muted-foreground">{report.user.email}</p>
                        <p className="text-xs text-muted-foreground">{report.user.plan} Plan</p>
                      </div>

                      <div className="min-w-0 text-sm text-muted-foreground">
                        <p>{formatDate(report.createdAt)}</p>
                        {report.pageUrl ? (
                          <a
                            href={report.pageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sky-600 hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{report.pageUrl}</span>
                          </a>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => copyReference(report)}>
                          <Copy className="h-4 w-4" />
                          <span className="sr-only">Copy report reference</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : report.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          Details
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4">
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_480px]">
                          <div className="space-y-4">
                            <div>
                              <p className="mb-2 text-sm font-semibold">User message</p>
                              <div className="whitespace-pre-wrap rounded-xl border bg-background p-3 text-sm leading-relaxed">
                                {report.message}
                              </div>
                            </div>

                            {report.screenshotUrls.length > 0 && (
                              <div>
                                <p className="mb-2 text-sm font-semibold">Screenshot</p>
                                <div className="grid gap-3">
                                  {report.screenshotUrls.map((url) => (
                                    <a
                                      key={url}
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block overflow-hidden rounded-xl border bg-background"
                                    >
                                      <img src={url} alt="Feedback screenshot" className="max-h-[70vh] min-h-[280px] w-full object-contain" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
                              <div className="rounded-xl border bg-background p-3">
                                <p className="font-semibold text-foreground">Viewport</p>
                                <p className="mt-1">{report.viewport || "-"}</p>
                              </div>
                              <div className="rounded-xl border bg-background p-3">
                                <p className="font-semibold text-foreground">Browser</p>
                                <p className="mt-1 break-words">{report.userAgent || "-"}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Status</label>
                                <select
                                  value={report.status}
                                  onChange={(event) => updateReport(report, { status: event.target.value })}
                                  disabled={actionLoading === report.id}
                                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  {statusOptions.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                                <select
                                  value={report.priority}
                                  onChange={(event) => updateReport(report, { priority: event.target.value })}
                                  disabled={actionLoading === report.id}
                                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  {priorityOptions.map((priority) => (
                                    <option key={priority} value={priority}>
                                      {priority}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-semibold">Admin notes</label>
                              <Textarea
                                value={notesDraft[report.id] || ""}
                                onChange={(event) =>
                                  setNotesDraft((current) => ({ ...current, [report.id]: event.target.value }))
                                }
                                rows={7}
                                placeholder="Add debugging notes, resolution details, or next steps..."
                              />
                              <Button
                                className="w-full"
                                onClick={() => updateReport(report, { adminNotes: notesDraft[report.id] || "" })}
                                disabled={actionLoading === report.id}
                              >
                                Save notes
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
