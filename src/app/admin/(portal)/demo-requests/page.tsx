"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type DemoRequest = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  companySize: string | null;
  productInterest: string[];
  preferredTime: string | null;
  timezone: string | null;
  message: string | null;
  source: string;
  status: string;
  adminNotes: string | null;
  contactedAt: string | null;
  scheduledAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  total: number;
  new: number;
  contacted: number;
  scheduled: number;
  closed: number;
};

const statusOptions = ["NEW", "CONTACTED", "SCHEDULED", "CLOSED", "ARCHIVED"];

const statusStyles: Record<string, string> = {
  NEW: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300",
  CONTACTED: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-300",
  SCHEDULED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-300",
  CLOSED: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-300",
  ARCHIVED: "bg-muted text-muted-foreground border-border",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminDemoRequestsPage() {
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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

      const response = await fetch(`/api/admin/demo-requests?${params}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch demo requests");
      }

      const nextRequests = data.data.requests as DemoRequest[];
      setRequests(nextRequests);
      setStats(data.data.stats);
      setTotalPages(data.data.pagination.totalPages || 1);
      setNotesDraft((current) => {
        const next = { ...current };
        nextRequests.forEach((request) => {
          if (next[request.id] === undefined) {
            next[request.id] = request.adminNotes || "";
          }
        });
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demo requests");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, searchQuery, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateRequest = async (request: DemoRequest, status: string, adminNotes?: string) => {
    setActionLoading(request.id);
    try {
      const response = await fetch("/api/admin/demo-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: request.id,
          status,
          adminNotes,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to update request");
      }

      const updated = data.data.request as DemoRequest;
      setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNotesDraft((current) => ({ ...current, [updated.id]: updated.adminNotes || "" }));
      setError(null);
      fetchData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update request");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <CalendarCheck className="h-7 w-7 text-sky-500" />
            Demo Requests
          </h1>
          <p className="mt-1 text-muted-foreground">
            Review public demo requests and move them through the follow-up queue.
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
            { label: "Total", value: stats.total, icon: MessageSquare },
            { label: "New", value: stats.new, icon: Clock3 },
            { label: "Contacted", value: stats.contacted, icon: Phone },
            { label: "Scheduled", value: stats.scheduled, icon: CalendarCheck },
            { label: "Closed", value: stats.closed, icon: Mail },
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name, email, or company..."
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {[...Array(5)].map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CalendarCheck className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p>No demo requests found</p>
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((request) => {
                const isExpanded = expandedId === request.id;
                return (
                  <div key={request.id} className="transition-colors hover:bg-muted/30">
                    <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{request.name}</p>
                          <Badge variant="outline" className={statusStyles[request.status] || statusStyles.NEW}>
                            {request.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {request.email}
                          </span>
                          {request.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {request.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-sm">
                        <p className="inline-flex items-center gap-1 font-medium">
                          <Building2 className="h-3.5 w-3.5" />
                          {request.company || "No company"}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {[request.role, request.companySize].filter(Boolean).join(" | ") || "Role not provided"}
                        </p>
                      </div>

                      <div className="text-sm">
                        <p className="font-medium">{request.preferredTime || "No preferred time"}</p>
                        <p className="mt-1 text-muted-foreground">
                          {request.timezone || "No timezone"} | {formatDate(request.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={request.status}
                          disabled={actionLoading === request.id}
                          onChange={(event) => updateRequest(request, event.target.value)}
                          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setExpandedId(isExpanded ? null : request.id)}
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4">
                        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                          <div className="space-y-4">
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Product focus
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {request.productInterest.length > 0 ? request.productInterest.map((item) => (
                                  <Badge key={item} variant="secondary">
                                    {item}
                                  </Badge>
                                )) : (
                                  <span className="text-sm text-muted-foreground">General walkthrough</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Message
                              </p>
                              <p className="rounded-lg border bg-background p-3 text-sm leading-6 text-muted-foreground">
                                {request.message || "No message provided."}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Admin notes
                            </p>
                            <Textarea
                              value={notesDraft[request.id] || ""}
                              onChange={(event) => setNotesDraft((current) => ({
                                ...current,
                                [request.id]: event.target.value,
                              }))}
                              rows={5}
                              placeholder="Add follow-up details, meeting notes, or owner assignment."
                            />
                            <Button
                              size="sm"
                              onClick={() => updateRequest(request, request.status, notesDraft[request.id] || "")}
                              disabled={actionLoading === request.id}
                            >
                              Save notes
                            </Button>
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
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
