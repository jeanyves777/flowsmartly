"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AISpinner } from "@/components/shared/ai-generation-loader";

type Sentiment = "POSITIVE" | "NEGATIVE";

type FeedbackUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  plan: string;
};

type FeedbackItem = {
  id: string;
  userId: string;
  conversationId: string | null;
  messageId: string;
  sentiment: Sentiment;
  category: string | null;
  comment: string | null;
  snapshot: unknown;
  reviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  user: FeedbackUser;
};

type Counts = {
  total: number;
  pending: number;
  byType: { POSITIVE: number; NEGATIVE: number };
};

const SENTIMENT_FILTERS: { value: "ALL" | Sentiment; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "POSITIVE", label: "Positive" },
  { value: "NEGATIVE", label: "Negative" },
];

const REVIEWED_FILTERS: { value: "false" | "true" | "all"; label: string }[] = [
  { value: "false", label: "Pending" },
  { value: "true", label: "Reviewed" },
  { value: "all", label: "All" },
];

const CATEGORY_LABELS: Record<string, string> = {
  incorrect: "Incorrect",
  not_helpful: "Not helpful",
  too_long: "Too long",
  too_short: "Too short",
  off_topic: "Off topic",
  other: "Other",
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

function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getErrorMessage(data: any, fallback: string) {
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Surface the load-bearing snapshot fields if present, then dump the rest.
function SnapshotView({ snapshot }: { snapshot: unknown }) {
  if (!snapshot || typeof snapshot !== "object") {
    return (
      <pre className="overflow-auto rounded-md border bg-background p-3 text-xs">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    );
  }
  const snap = snapshot as Record<string, any>;
  const known = {
    assistantText:
      snap.assistantText || snap.assistantMessage || snap.aiText || snap.response || null,
    userText:
      snap.userText || snap.userMessage || snap.prompt || snap.userPrompt || null,
    history: snap.history || snap.previousMessages || snap.recentMessages || null,
    tools: snap.tools || snap.toolCalls || null,
  };
  const rest: Record<string, any> = {};
  for (const key of Object.keys(snap)) {
    if (
      key !== "assistantText" &&
      key !== "assistantMessage" &&
      key !== "aiText" &&
      key !== "response" &&
      key !== "userText" &&
      key !== "userMessage" &&
      key !== "prompt" &&
      key !== "userPrompt" &&
      key !== "history" &&
      key !== "previousMessages" &&
      key !== "recentMessages" &&
      key !== "tools" &&
      key !== "toolCalls"
    ) {
      rest[key] = snap[key];
    }
  }

  return (
    <div className="space-y-3">
      {known.userText ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">User message</p>
          <div className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
            {String(known.userText)}
          </div>
        </div>
      ) : null}
      {known.assistantText ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Assistant reply</p>
          <div className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
            {String(known.assistantText)}
          </div>
        </div>
      ) : null}
      {known.history ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Recent history</p>
          <pre className="overflow-auto rounded-md border bg-background p-3 text-xs">
            {JSON.stringify(known.history, null, 2)}
          </pre>
        </div>
      ) : null}
      {known.tools ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Tools</p>
          <pre className="overflow-auto rounded-md border bg-background p-3 text-xs">
            {JSON.stringify(known.tools, null, 2)}
          </pre>
        </div>
      ) : null}
      {Object.keys(rest).length > 0 ? (
        <details className="rounded-md border bg-background p-3 text-xs">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            Other snapshot fields
          </summary>
          <pre className="mt-2 overflow-auto">{JSON.stringify(rest, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}

export default function AdminAIFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<"ALL" | Sentiment>("ALL");
  const [reviewedFilter, setReviewedFilter] = useState<"false" | "true" | "all">("false");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setIsRefreshing(true);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: "25",
          sentiment: sentimentFilter,
          reviewed: reviewedFilter,
        });
        if (searchQuery) params.set("search", searchQuery);

        const response = await fetch(`/api/admin/flow-ai/feedback?${params.toString()}`);
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(getErrorMessage(data, "Failed to fetch AI feedback"));
        }

        const nextItems = data.data.items as FeedbackItem[];
        setItems(nextItems);
        setCounts(data.data.counts);
        setTotalPages(data.data.pagination.totalPages || 1);
        setNoteDraft((current) => {
          const next = { ...current };
          nextItems.forEach((item) => {
            if (next[item.id] === undefined) next[item.id] = item.reviewNote || "";
          });
          return next;
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load AI feedback");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentPage, reviewedFilter, searchQuery, sentimentFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateReviewed = async (item: FeedbackItem, reviewed: boolean) => {
    setActionLoading(item.id);
    try {
      const response = await fetch(`/api/admin/flow-ai/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewed,
          reviewNote: noteDraft[item.id] || "",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, "Failed to update feedback"));
      }
      setError(null);
      fetchData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update feedback");
    } finally {
      setActionLoading(null);
    }
  };

  const headerCounts = useMemo(
    () => [
      { label: "Total", value: counts?.total ?? 0, icon: MessageSquare, tint: "sky" },
      { label: "Pending", value: counts?.pending ?? 0, icon: Sparkles, tint: "amber" },
      { label: "Positive", value: counts?.byType.POSITIVE ?? 0, icon: ThumbsUp, tint: "emerald" },
      { label: "Negative", value: counts?.byType.NEGATIVE ?? 0, icon: ThumbsDown, tint: "rose" },
    ],
    [counts]
  );

  return (
    <div className="min-h-full space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <Sparkles className="h-7 w-7 text-sky-500" />
            AI Chat Feedback
          </h1>
          <p className="mt-1 text-muted-foreground">
            Thumbs-up / thumbs-down ratings on Flow-AI replies, with the surrounding chat context.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchData(true)} disabled={isRefreshing}>
          {isRefreshing ? (
            <AISpinner className="mr-2 h-4 w-4" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {headerCounts.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${item.tint}-500/10`}
                >
                  <Icon className={`h-5 w-5 text-${item.tint}-500`} />
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

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search user, email, comment, or snapshot..."
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {SENTIMENT_FILTERS.map((pill) => (
              <Button
                key={pill.value}
                size="sm"
                variant={sentimentFilter === pill.value ? "default" : "outline"}
                onClick={() => {
                  setSentimentFilter(pill.value);
                  setCurrentPage(1);
                }}
              >
                {pill.label}
              </Button>
            ))}
            <span className="mx-1 h-8 w-px self-center bg-border" />
            {REVIEWED_FILTERS.map((pill) => (
              <Button
                key={pill.value}
                size="sm"
                variant={reviewedFilter === pill.value ? "default" : "outline"}
                onClick={() => {
                  setReviewedFilter(pill.value);
                  setCurrentPage(1);
                }}
              >
                {pill.label}
              </Button>
            ))}
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
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Sparkles className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p>No AI feedback found for the current filter.</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => {
                const isExpanded = expandedId === item.id;
                const isPositive = item.sentiment === "POSITIVE";
                return (
                  <div key={item.id} className="transition-colors hover:bg-muted/30">
                    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.7fr)_minmax(180px,0.6fr)_auto] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              isPositive
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                                : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isPositive ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            {isPositive ? "Positive" : "Negative"}
                          </span>
                          {item.category ? (
                            <Badge variant="secondary">
                              {CATEGORY_LABELS[item.category] || item.category}
                            </Badge>
                          ) : null}
                          {item.reviewed ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                            >
                              Reviewed
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            >
                              Pending
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {item.comment || "(no comment)"}
                        </p>
                      </div>

                      <div className="flex min-w-0 items-center gap-3 text-sm">
                        <Avatar className="h-9 w-9">
                          {item.user.avatarUrl ? (
                            <AvatarImage src={item.user.avatarUrl} alt={item.user.name} />
                          ) : null}
                          <AvatarFallback>{initials(item.user.name || item.user.email)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.user.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.user.email}</p>
                        </div>
                      </div>

                      <div className="min-w-0 text-xs text-muted-foreground">
                        <p>{timeAgo(item.createdAt)}</p>
                        <p className="mt-0.5">{formatDate(item.createdAt)}</p>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          Details
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4">
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                          <div className="space-y-4">
                            {item.comment ? (
                              <div>
                                <p className="mb-2 text-sm font-semibold">User comment</p>
                                <div className="whitespace-pre-wrap rounded-xl border bg-background p-3 text-sm leading-relaxed">
                                  {item.comment}
                                </div>
                              </div>
                            ) : null}

                            <div>
                              <p className="mb-2 text-sm font-semibold">Snapshot</p>
                              <SnapshotView snapshot={item.snapshot} />
                            </div>

                            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                              <div className="rounded-xl border bg-background p-3">
                                <p className="font-semibold text-foreground">Message ID</p>
                                <p className="mt-1 break-all">{item.messageId}</p>
                              </div>
                              <div className="rounded-xl border bg-background p-3">
                                <p className="font-semibold text-foreground">Conversation ID</p>
                                <p className="mt-1 break-all">{item.conversationId || "-"}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-semibold">Review note</label>
                              <Textarea
                                value={noteDraft[item.id] ?? ""}
                                onChange={(event) =>
                                  setNoteDraft((current) => ({
                                    ...current,
                                    [item.id]: event.target.value,
                                  }))
                                }
                                rows={6}
                                placeholder="Optional internal note about this rating..."
                              />
                              {item.reviewed ? (
                                <Button
                                  className="w-full"
                                  variant="outline"
                                  onClick={() => updateReviewed(item, false)}
                                  disabled={actionLoading === item.id}
                                >
                                  {actionLoading === item.id ? (
                                    <AISpinner className="mr-2 h-4 w-4" />
                                  ) : null}
                                  Re-open for review
                                </Button>
                              ) : (
                                <Button
                                  className="w-full"
                                  onClick={() => updateReviewed(item, true)}
                                  disabled={actionLoading === item.id}
                                >
                                  {actionLoading === item.id ? (
                                    <AISpinner className="mr-2 h-4 w-4" />
                                  ) : (
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                  )}
                                  Mark reviewed
                                </Button>
                              )}
                            </div>

                            {item.reviewed ? (
                              <div className="rounded-xl border bg-background p-3 text-xs text-muted-foreground">
                                <p>
                                  <span className="font-semibold text-foreground">Reviewed by:</span>{" "}
                                  {item.reviewedBy || "-"}
                                </p>
                                <p>
                                  <span className="font-semibold text-foreground">When:</span>{" "}
                                  {formatDate(item.reviewedAt)}
                                </p>
                              </div>
                            ) : null}
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
