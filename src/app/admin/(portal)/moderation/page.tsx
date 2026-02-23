"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Search,
  MoreVertical,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Trash2,
  Ban,
  Eye,
  Calendar,
  User,
  MessageCircle,
  FileText,
  Flag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FlagItem {
  id: string;
  contentType: string;
  postId: string | null;
  commentId: string | null;
  content: string;
  author: { id: string; name: string; email: string } | null;
  reporter: { id: string; name: string; email: string };
  reason: string;
  description: string | null;
  status: string;
  resolution: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  isDeleted: boolean;
}

interface ModerationStats {
  pending: number;
  reviewedToday: number;
  autoRemoved: number;
  total: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  reviewed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  dismissed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  actioned: "bg-red-500/20 text-red-400 border-red-500/30",
};

const reasonLabels: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate_speech: "Hate Speech",
  nudity: "Nudity",
  violence: "Violence",
  misinformation: "Misinfo",
  other: "Other",
};

const reasonColors: Record<string, string> = {
  spam: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  harassment: "bg-red-500/20 text-red-400 border-red-500/30",
  hate_speech: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  nudity: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  violence: "bg-red-600/20 text-red-500 border-red-600/30",
  misinformation: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  other: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function ModerationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [stats, setStats] = useState<ModerationStats>({ pending: 0, reviewedToday: 0, autoRemoved: 0, total: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<string | null>(null);

  const fetchFlags = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);
      params.set("page", String(page));
      params.set("limit", "20");

      const response = await fetch(`/api/admin/moderation?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch flags");
      }

      setFlags(data.data.flags);
      setStats(data.data.stats);
      setPagination(data.data.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load moderation data");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFlags();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchFlags]);

  const handleAction = async (flagId: string, action: string, reason?: string) => {
    try {
      setActionLoading(flagId);
      const response = await fetch(`/api/admin/moderation/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Action failed");
      }

      // Refresh the list
      await fetchFlags(pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
      setConfirmSuspend(null);
    }
  };

  if (error && flags.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4 text-foreground">{error}</p>
          <Button onClick={() => fetchFlags()} variant="outline">
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
          <h1 className="text-2xl font-bold text-foreground">
            Content Moderation
          </h1>
          <p className="mt-1 text-muted-foreground">
            Review and manage flagged content across the platform
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Flags", value: stats.pending, icon: Flag, color: "text-yellow-500", bg: "bg-yellow-500/20" },
          { label: "Reviewed Today", value: stats.reviewedToday, icon: Eye, color: "text-blue-500", bg: "bg-blue-500/20" },
          { label: "Content Removed", value: stats.autoRemoved, icon: Trash2, color: "text-red-500", bg: "bg-red-500/20" },
          { label: "Total Flags", value: stats.total, icon: ShieldCheck, color: "text-orange-500", bg: "bg-orange-500/20" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "reviewed", label: "Reviewed" },
          { value: "dismissed", label: "Dismissed" },
          { value: "actioned", label: "Actioned" },
        ].map((tab) => (
          <Button
            key={tab.value}
            variant={filterStatus === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(tab.value)}
          >
            {tab.label}
            {tab.value === "pending" && stats.pending > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-500">
                {stats.pending}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by content or reporter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flags Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            Flagged Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : flags.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No flagged content found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Content
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Author
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Reason
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Reporter
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((flag) => (
                    <tr
                      key={flag.id}
                      className="border-b border-border hover:bg-muted/50"
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium truncate max-w-[200px] text-foreground">
                          {flag.content}
                        </p>
                        {flag.isDeleted && (
                          <span className="text-xs text-red-400">[deleted]</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm text-foreground">
                              {flag.author?.name || "Unknown"}
                            </span>
                            {flag.author?.email && (
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {flag.author.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={flag.contentType === "post"
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                        }>
                          {flag.contentType === "post" ? (
                            <><FileText className="w-3 h-3 mr-1" /> Post</>
                          ) : (
                            <><MessageCircle className="w-3 h-3 mr-1" /> Comment</>
                          )}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={reasonColors[flag.reason] || reasonColors.other}>
                          {reasonLabels[flag.reason] || flag.reason}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {flag.reporter.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[flag.status] || statusColors.pending}>
                          {flag.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {new Date(flag.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {flag.status === "pending" ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                disabled={actionLoading === flag.id}
                              >
                                {actionLoading === flag.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="w-4 h-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => handleAction(flag.id, "approve")}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                                Approve (Clear flag)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAction(flag.id, "remove")}
                              >
                                <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                                Remove content
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAction(flag.id, "warn")}
                              >
                                <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
                                Warn user
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setConfirmSuspend(flag.id)}
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Suspend user
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {flag.resolution || flag.status}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} flags
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchFlags(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchFlags(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suspend Confirmation Modal */}
      {confirmSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Suspend User</h3>
                <p className="text-sm text-muted-foreground">This action cannot be easily undone</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              This will remove the flagged content and suspend the author&#39;s account.
              The user will no longer be able to access the platform.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmSuspend(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={actionLoading === confirmSuspend}
                onClick={() => handleAction(confirmSuspend, "suspend")}
              >
                {actionLoading === confirmSuspend ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Suspending...</>
                ) : (
                  "Confirm Suspend"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
