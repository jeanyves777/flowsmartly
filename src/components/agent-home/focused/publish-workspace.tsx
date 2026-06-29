"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import Image from "next/image";
import {
  Sparkles, CalendarClock, CheckCircle2, FileEdit, Link2, Plug, Image as ImageIcon,
  ChevronRight, Pencil, Trash2, X, Check, AlertTriangle, RefreshCw, CalendarX2, Save, RotateCcw,
  Search, Filter, Hash, Eye, Heart, MessageCircle, Share2, Send, Loader2,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { cn } from "@/lib/utils/cn";

/**
 * Publish — a deep new-design content surface (the Publish workspace canvas):
 * the user's posts by status + connected social accounts, with agent-driven
 * compose. Real data (GET /api/content/posts, GET /api/social-accounts). Each
 * post row expands into an inline detail/actions area — edit the caption, media,
 * platforms & schedule (PATCH /api/content/posts/[id]), reschedule or unschedule a
 * scheduled post, retry failed cross-posts (POST .../retry), and delete (DELETE).
 * No legacy links — management happens in-surface; only compose drives the agent.
 * [[new-design-no-legacy]] [[agent-operates-account-full-crud]]
 */

type Status = "ALL" | "SCHEDULED" | "PUBLISHED" | "DRAFT";

interface Post {
  id: string;
  caption: string | null;
  mediaUrls?: string[];
  mediaType?: string | null;
  platforms?: string[];
  hashtags?: string[];
  mentions?: string[];
  status: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
}
// Pagination envelope from GET /api/content/posts.
interface Pagination { total: number; page: number; limit: number; hasMore: boolean }
interface PlatformAcc {
  platform: string;
  name?: string;
  connected?: boolean;
  connectedCount?: number;
  username?: string | null;
  avatarUrl?: string | null;
}
// Per-platform publish result returned by the retry endpoint.
interface RetryResult { success: boolean; postId?: string; error?: string }

const TABS: { id: Status; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "PUBLISHED", label: "Published" },
  { id: "DRAFT", label: "Drafts" },
];

// "feed" is the in-app destination; everything else is an external social platform.
const isExternal = (p: string) => p && p.toLowerCase() !== "feed";
const prettyPlatform = (p: string) => (p === "feed" ? "Feed" : p.charAt(0).toUpperCase() + p.slice(1));

const PAGE_SIZE = 30;

function fmt(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}

// A datetime-local string (local TZ, no seconds) for an ISO timestamp.
function toLocalInput(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FocusedPublish({ onConnect, onOpenView, refreshKey }: { onConnect: () => void; onOpenView: (key: string) => void; refreshKey?: number }) {
  const [status, setStatus] = useState<Status>("ALL");
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [accounts, setAccounts] = useState<PlatformAcc[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Local bump to re-fetch posts after a mutation, independent of the parent refreshKey.
  const [reload, setReload] = useState(0);

  // Client-side search + platform filter. The list API only filters by status &
  // paginates, so caption/platform narrowing happens over the loaded pages.
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");

  useEffect(() => {
    let alive = true;
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((j) => { if (alive && j?.success && Array.isArray(j.data?.platforms)) setAccounts(j.data.platforms); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refreshKey]);

  // Fetch the first page whenever the status / refresh inputs change. Page 1 replaces.
  useEffect(() => {
    let alive = true;
    setPostsLoading(true);
    setOpenId(null);
    fetch(`/api/content/posts?status=${status}&page=1&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.success) return;
        setPosts(Array.isArray(j.data?.posts) ? j.data.posts : []);
        setPagination(j.data?.pagination ?? null);
      })
      .catch(() => {})
      .finally(() => { if (alive) setPostsLoading(false); });
    return () => { alive = false; };
  }, [status, refreshKey, reload]);

  // Append the next page (load-more beyond the page cap).
  const loadMore = useCallback(() => {
    if (loadingMore || !pagination?.hasMore) return;
    const next = pagination.page + 1;
    setLoadingMore(true);
    fetch(`/api/content/posts?status=${status}&page=${next}&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j?.success) return;
        const more: Post[] = Array.isArray(j.data?.posts) ? j.data.posts : [];
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...more.filter((p) => !seen.has(p.id))];
        });
        setPagination(j.data?.pagination ?? null);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, pagination, status]);

  const connected = accounts.filter((a) => a.connected || (a.connectedCount ?? 0) > 0);
  // Connectable external destinations for the editor's platform picker (always include feed).
  const connectedPlatforms = connected.map((a) => a.platform).filter(isExternal);

  // Distinct platforms actually present on the loaded posts → filter chips.
  const presentPlatforms = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) for (const pl of p.platforms ?? []) set.add(pl);
    return Array.from(set).sort((a, b) => (a === "feed" ? -1 : b === "feed" ? 1 : a.localeCompare(b)));
  }, [posts]);

  // Apply the in-surface search + platform narrowing over the loaded pages.
  const visiblePosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (platformFilter !== "ALL" && !(p.platforms ?? []).includes(platformFilter)) return false;
      if (!q) return true;
      const hay = `${p.caption ?? ""} ${(p.hashtags ?? []).join(" ")} ${(p.platforms ?? []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [posts, query, platformFilter]);

  const filtering = query.trim().length > 0 || platformFilter !== "ALL";

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your content…" /></div>;
  }

  const refetch = () => setReload((n) => n + 1);

  // Compact left-rail summary counts over the loaded pages.
  const scheduledCount = posts.filter((p) => p.status?.toUpperCase() === "SCHEDULED").length;
  const publishedCount = posts.filter((p) => p.status?.toUpperCase() === "PUBLISHED").length;
  const draftCount = posts.filter((p) => p.status?.toUpperCase() === "DRAFT").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky summary + section nav + primary action + filters */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          <button
            onClick={() => onOpenView("compose")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
          >
            <Sparkles className="h-4 w-4" /> New post
          </button>

          {/* summary stats */}
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Scheduled" value={scheduledCount.toLocaleString()} />
            <MiniStat label="Published" value={publishedCount.toLocaleString()} />
            <MiniStat label="Drafts" value={draftCount.toLocaleString()} />
          </div>

          {/* status section nav */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {TABS.map((t) => {
              const active = status === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setStatus(t.id); setOpenId(null); setQuery(""); setPlatformFilter("ALL"); }}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  <span className="flex-1 text-start">{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* connected accounts */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <Plug className="h-4 w-4 text-brand-500" />
              <h3 className="text-[12.5px] font-bold">Connected accounts</h3>
            </div>
            {connected.length ? (
              <div className="flex flex-wrap gap-1.5">
                {connected.map((a) => (
                  <span key={a.platform} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11.5px]">
                    {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={16} height={16} className="h-4 w-4 rounded-full object-cover" unoptimized /> : <Link2 className="h-3 w-3 text-muted-foreground" />}
                    <span className="font-medium capitalize">{a.name || a.platform}</span>
                    {a.username && <span className="text-muted-foreground">@{a.username}</span>}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-3 py-3">
                <p className="text-[11.5px] text-muted-foreground">No social accounts connected — you can still post to your in-app feed. Connect Instagram, Facebook, X… to cross-post.</p>
                <button onClick={onConnect} className="mt-2 w-full rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">Connect</button>
              </div>
            )}
          </div>

          {/* search + platform filter (in-surface narrowing over loaded pages) */}
          {(posts.length > 0 || filtering) && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search captions, hashtags…"
                    className="w-full rounded-[10px] border border-border bg-background ps-9 pe-9 py-2 text-[12.5px] outline-none focus:border-brand-500/60"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {presentPlatforms.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <FilterChip label="All platforms" active={platformFilter === "ALL"} onClick={() => setPlatformFilter("ALL")} />
                    {presentPlatforms.map((p) => (
                      <FilterChip key={p} label={prettyPlatform(p)} active={platformFilter === p} onClick={() => setPlatformFilter(p)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT: posts list — full width */}
        <div className="min-w-0 flex-1 space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[13px] font-bold">{status === "ALL" ? "Your posts" : TABS.find((t) => t.id === status)?.label}</h3>
              {pagination && <span className="text-[11.5px] text-muted-foreground">{filtering ? `${visiblePosts.length} of ${posts.length} loaded` : `${posts.length} of ${pagination.total}`}</span>}
              {postsLoading && <FlowLoader size={14} className="ms-1" />}
            </div>

            {visiblePosts.length ? (
              <>
                <div className="space-y-2.5">
                  {visiblePosts.map((p) => (
                    <PostRow
                      key={p.id}
                      post={p}
                      open={openId === p.id}
                      onToggle={() => setOpenId((id) => (id === p.id ? null : p.id))}
                      connectedPlatforms={connectedPlatforms}
                      onChanged={refetch}
                      onRemoved={() => { setOpenId(null); setPosts((prev) => prev.filter((x) => x.id !== p.id)); }}
                    />
                  ))}
                </div>
                {pagination?.hasMore && (
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[12.5px] font-semibold text-muted-foreground transition hover:border-brand-500/60 hover:text-foreground disabled:opacity-60"
                    >
                      {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}
                {filtering && pagination?.hasMore && (
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">Filtering only the loaded posts — load more to search the rest.</p>
                )}
              </>
            ) : filtering ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <p className="text-[13px] font-medium">No matches</p>
                <p className="mt-1 text-[12px] text-muted-foreground">No loaded posts match your search or platform filter.</p>
                <button onClick={() => { setQuery(""); setPlatformFilter("ALL"); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <p className="text-[13px] font-medium">{status === "SCHEDULED" ? "Nothing scheduled yet" : status === "DRAFT" ? "No drafts" : "No posts yet"}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Create your first post and the agent will write, design, and schedule it.</p>
                <button onClick={() => onOpenView("compose")} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                  <Sparkles className="h-4 w-4" /> Create a post
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

type RowMode = null | "edit" | "delete" | "reschedule" | "unschedule" | "retry";

function PostRow({
  post, open, onToggle, connectedPlatforms, onChanged, onRemoved,
}: {
  post: Post;
  open: boolean;
  onToggle: () => void;
  connectedPlatforms: string[];
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const st = post.status?.toUpperCase();
  const media = post.mediaUrls?.[0];
  const when = st === "PUBLISHED" ? `Published ${fmt(post.publishedAt)}` : st === "SCHEDULED" ? `Scheduled · ${fmt(post.scheduledAt)}` : "Draft";
  const Badge = st === "PUBLISHED" ? CheckCircle2 : st === "SCHEDULED" ? CalendarClock : FileEdit;
  const badgeColor = st === "PUBLISHED" ? "text-emerald-500" : st === "SCHEDULED" ? "text-brand-500" : "text-muted-foreground";

  const postPlatforms = post.platforms ?? [];
  const externalPlatforms = postPlatforms.filter(isExternal);

  // ── in-row mutation state ──────────────────────────────────────────────
  const [mode, setMode] = useState<RowMode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // edit form (seeded from the post when entering edit mode)
  const [caption, setCaption] = useState(post.caption ?? "");
  const [mediaUrls, setMediaUrls] = useState<string[]>(post.mediaUrls ?? []);
  const [platforms, setPlatforms] = useState<string[]>(postPlatforms.length ? postPlatforms : ["feed"]);
  const [scheduleAt, setScheduleAt] = useState<string>("");

  // reschedule
  const [rescheduleAt, setRescheduleAt] = useState<string>("");

  // retry — chosen external platforms + last results keyed by platform
  const [retryTargets, setRetryTargets] = useState<string[]>([]);
  const [retryResults, setRetryResults] = useState<Record<string, RetryResult> | null>(null);

  const resetActions = useCallback(() => {
    setMode(null); setBusy(false); setError(null);
  }, []);

  // Collapse / reset everything when the row is closed from outside.
  useEffect(() => {
    if (!open) { resetActions(); setNotice(null); setRetryResults(null); }
  }, [open, resetActions]);

  const startEdit = useCallback(() => {
    setError(null); setNotice(null);
    setCaption(post.caption ?? "");
    setMediaUrls(post.mediaUrls ?? []);
    setPlatforms(postPlatforms.length ? postPlatforms : ["feed"]);
    setScheduleAt(post.scheduledAt ? toLocalInput(post.scheduledAt) : "");
    setMode("edit");
  }, [post.caption, post.mediaUrls, post.scheduledAt, postPlatforms]);

  const startReschedule = useCallback(() => {
    setError(null); setNotice(null);
    setRescheduleAt(toLocalInput(post.scheduledAt));
    setMode("reschedule");
  }, [post.scheduledAt]);

  const startRetry = useCallback(() => {
    setError(null); setNotice(null); setRetryResults(null);
    setRetryTargets(externalPlatforms);
    setMode("retry");
  }, [externalPlatforms]);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };
  const toggleRetryTarget = (p: string) => {
    setRetryTargets((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  // PATCH /api/content/posts/[id] — caption / media / platforms / schedule.
  const saveEdit = useCallback(async () => {
    if (!caption.trim() && mediaUrls.length === 0) { setError("Add a caption or media."); return; }
    if (platforms.length === 0) { setError("Pick at least one destination."); return; }
    setBusy(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        caption: caption.trim(),
        mediaUrls,
        mediaType: mediaUrls.some((u) => /\.(mp4|webm|mov|avi|mkv)/i.test(u)) ? "video" : "image",
        platforms,
      };
      // Only touch the schedule when the post is/was scheduled, or the user set one.
      if (scheduleAt) {
        const when = new Date(scheduleAt);
        if (Number.isNaN(when.getTime())) { setError("Pick a valid date and time."); setBusy(false); return; }
        if (when.getTime() <= Date.now()) { setError("Choose a future time, or cancel the schedule instead."); setBusy(false); return; }
        body.scheduledAt = when.toISOString();
      }
      const j = await fetch(`/api/content/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (!j?.success) { setError(j?.error?.message || "Could not save changes."); setBusy(false); return; }
      setMode(null); setBusy(false); setNotice("Post updated.");
      onChanged();
    } catch { setError("Could not save changes."); setBusy(false); }
  }, [caption, mediaUrls, platforms, scheduleAt, post.id, onChanged]);

  // PATCH scheduledAt — move a scheduled post to a new date/time.
  const saveReschedule = useCallback(async () => {
    if (!rescheduleAt) { setError("Pick a date and time."); return; }
    const next = new Date(rescheduleAt);
    if (Number.isNaN(next.getTime())) { setError("Pick a valid date and time."); return; }
    if (next.getTime() <= Date.now()) { setError("Choose a future time."); return; }
    setBusy(true); setError(null);
    try {
      const j = await fetch(`/api/content/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: next.toISOString(), status: "SCHEDULED" }),
      }).then((r) => r.json());
      if (!j?.success) { setError(j?.error?.message || "Could not reschedule."); setBusy(false); return; }
      setMode(null); setBusy(false); setNotice(`Rescheduled for ${fmt(next.toISOString())}.`);
      onChanged();
    } catch { setError("Could not reschedule."); setBusy(false); }
  }, [rescheduleAt, post.id, onChanged]);

  // PATCH status=DRAFT + clear scheduledAt — cancel/unschedule a scheduled post.
  const confirmUnschedule = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const j = await fetch(`/api/content/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT", scheduledAt: null }),
      }).then((r) => r.json());
      if (!j?.success) { setError(j?.error?.message || "Could not cancel the schedule."); setBusy(false); return; }
      setMode(null); setBusy(false); setNotice("Schedule cancelled — saved as a draft.");
      onChanged();
    } catch { setError("Could not cancel the schedule."); setBusy(false); }
  }, [post.id, onChanged]);

  // DELETE /api/content/posts/[id] — soft-delete the post.
  const confirmDelete = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const j = await fetch(`/api/content/posts/${post.id}`, { method: "DELETE" }).then((r) => r.json());
      if (!j?.success) { setError(j?.error?.message || "Could not delete this post."); setBusy(false); return; }
      onRemoved();
    } catch { setError("Could not delete this post."); setBusy(false); }
  }, [post.id, onRemoved]);

  // POST /api/content/posts/[id]/retry — re-publish to the chosen external platforms.
  const submitRetry = useCallback(async () => {
    if (retryTargets.length === 0) { setError("Pick at least one platform to retry."); return; }
    setBusy(true); setError(null);
    try {
      const j = await fetch(`/api/content/posts/${post.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: retryTargets }),
      }).then((r) => r.json());
      if (!j?.success) { setError(j?.error?.message || "Retry failed."); setBusy(false); return; }
      const results = (j.data?.publishResults ?? {}) as Record<string, RetryResult>;
      setRetryResults(results);
      setBusy(false);
      const ok = Object.values(results).filter((r) => r?.success).length;
      const total = Object.keys(results).length;
      setNotice(total ? `Retried ${total} platform${total === 1 ? "" : "s"} — ${ok} succeeded.` : "Retry complete.");
      onChanged();
    } catch { setError("Retry failed."); setBusy(false); }
  }, [retryTargets, post.id, onChanged]);

  const isScheduled = st === "SCHEDULED";
  const isPublished = st === "PUBLISHED";

  return (
    <div className={cn("rounded-xl border bg-muted/30 transition", open ? "border-brand-500/40" : "border-border")}>
      {/* summary row (click to expand) */}
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-3 text-left">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-background">
          {media ? <Image src={media} alt="" width={48} height={48} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px]">{post.caption || "Untitled post"}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1 font-medium", badgeColor)}><Badge className="h-3.5 w-3.5" /> {when}</span>
            {postPlatforms.length > 0 && <span className="capitalize">{postPlatforms.map(prettyPlatform).join(" · ")}</span>}
            {isPublished && <span>{(post.viewCount ?? 0).toLocaleString()} views · {(post.likeCount ?? 0).toLocaleString()} likes</span>}
          </div>
        </div>
        <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-90")} />
      </button>

      {/* inline detail + actions */}
      {open && (
        <div className="border-t border-border/60 px-3 py-3">
          {notice && (
            <div className="mb-3 flex items-center gap-1.5 rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5 shrink-0" /> {notice}
            </div>
          )}

          {/* ── detail view (read-only summary built from the list payload) ─ */}
          {mode === null && <PostDetail post={post} />}

          {/* default actions bar */}
          {mode === null && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ActionBtn icon={Pencil} label="Edit" onClick={startEdit} />
              {isScheduled && <ActionBtn icon={CalendarClock} label="Reschedule" onClick={startReschedule} />}
              {isScheduled && <ActionBtn icon={CalendarX2} label="Cancel schedule" onClick={() => { setError(null); setNotice(null); setMode("unschedule"); }} />}
              {isPublished && externalPlatforms.length > 0 && <ActionBtn icon={RefreshCw} label="Retry cross-post" onClick={startRetry} />}
              <button
                onClick={() => { setError(null); setNotice(null); setMode("delete"); }}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-2.5 py-1.5 text-[12px] font-semibold text-rose-500 transition hover:border-rose-500/50 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}

          {/* ── edit form ───────────────────────────────────────────────── */}
          {mode === "edit" && (
            <div className="space-y-3">
              <Field label="Caption">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  placeholder="Write your caption…"
                  className="w-full resize-y rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60"
                />
              </Field>
              <Field label="Media">
                <MediaUploader
                  value={mediaUrls}
                  onChange={setMediaUrls}
                  multiple
                  maxFiles={10}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  filterTypes={["image", "video"]}
                  variant="small"
                  disabled={busy}
                />
              </Field>
              <Field label="Destinations">
                <div className="flex flex-wrap gap-1.5">
                  <PlatformChip label="Feed" active={platforms.includes("feed")} onClick={() => togglePlatform("feed")} />
                  {connectedPlatforms.map((p) => (
                    <PlatformChip key={p} label={prettyPlatform(p)} active={platforms.includes(p)} onClick={() => togglePlatform(p)} />
                  ))}
                  {/* keep any already-selected external platform that's no longer connected so it isn't silently dropped */}
                  {platforms.filter((p) => isExternal(p) && !connectedPlatforms.includes(p)).map((p) => (
                    <PlatformChip key={p} label={prettyPlatform(p)} active onClick={() => togglePlatform(p)} />
                  ))}
                </div>
              </Field>
              {isScheduled && (
                <Field label="Scheduled time">
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60"
                  />
                </Field>
              )}
              {error && <ErrorNote msg={error} />}
              <div className="flex items-center gap-2">
                <PrimaryBtn onClick={saveEdit} busy={busy} icon={Save} label="Save changes" />
                <GhostBtn onClick={resetActions} disabled={busy} label="Cancel" />
              </div>
            </div>
          )}

          {/* ── reschedule ──────────────────────────────────────────────── */}
          {mode === "reschedule" && (
            <div className="space-y-3">
              <Field label="New date & time">
                <input
                  type="datetime-local"
                  value={rescheduleAt}
                  onChange={(e) => setRescheduleAt(e.target.value)}
                  className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60"
                />
              </Field>
              {error && <ErrorNote msg={error} />}
              <div className="flex items-center gap-2">
                <PrimaryBtn onClick={saveReschedule} busy={busy} icon={CalendarClock} label="Reschedule" />
                <GhostBtn onClick={resetActions} disabled={busy} label="Cancel" />
              </div>
            </div>
          )}

          {/* ── unschedule (two-step confirm) ───────────────────────────── */}
          {mode === "unschedule" && (
            <Confirm
              tone="amber"
              icon={CalendarX2}
              title="Cancel this schedule?"
              body="The post won't publish at its scheduled time. It will be saved as a draft you can reschedule or publish later."
              confirmLabel="Cancel schedule"
              busy={busy}
              error={error}
              onConfirm={confirmUnschedule}
              onCancel={resetActions}
            />
          )}

          {/* ── delete (two-step confirm) ───────────────────────────────── */}
          {mode === "delete" && (
            <Confirm
              tone="rose"
              icon={Trash2}
              title="Delete this post?"
              body="This removes the post from your content. This can't be undone."
              confirmLabel="Delete post"
              busy={busy}
              error={error}
              onConfirm={confirmDelete}
              onCancel={resetActions}
            />
          )}

          {/* ── retry failed cross-posts ────────────────────────────────── */}
          {mode === "retry" && (
            <div className="space-y-3">
              <p className="text-[12.5px] text-muted-foreground">Re-publish this post to the selected social platforms. Pick the ones that failed or you want to push again.</p>
              <div className="flex flex-wrap gap-1.5">
                {externalPlatforms.map((p) => {
                  const res = retryResults?.[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleRetryTarget(p)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                        retryTargets.includes(p) ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {res?.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : res ? <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> : null}
                      {prettyPlatform(p)}
                    </button>
                  );
                })}
              </div>

              {/* per-platform results from the last retry */}
              {retryResults && (
                <div className="space-y-1.5 rounded-[10px] border border-border bg-background p-2.5">
                  {Object.entries(retryResults).map(([p, res]) => (
                    <div key={p} className="flex items-start gap-2 text-[12px]">
                      {res?.success
                        ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />}
                      <span className="font-medium capitalize">{prettyPlatform(p)}</span>
                      <span className={cn(res?.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
                        {res?.success ? "Posted" : (res?.error || "Failed")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {error && <ErrorNote msg={error} />}
              <div className="flex items-center gap-2">
                <PrimaryBtn onClick={submitRetry} busy={busy} icon={retryResults ? RotateCcw : RefreshCw} label={retryResults ? "Retry again" : "Retry now"} />
                <GhostBtn onClick={resetActions} disabled={busy} label="Done" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── small presentational helpers ─────────────────────────────────────── */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-1.5 py-2 text-center">
      <p className="text-[16px] font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: { icon: ElementType; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-2.5 py-1.5 text-[12px] font-semibold transition hover:border-brand-500/60 hover:text-foreground">
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function PrimaryBtn({ onClick, busy, icon: Icon, label }: { onClick: () => void; busy: boolean; icon: ElementType; label: string }) {
  return (
    <button onClick={onClick} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
      {busy ? <FlowLoader size={14} /> : <Icon className="h-3.5 w-3.5" />} {label}
    </button>
  );
}

function GhostBtn({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className="rounded-[10px] border border-border px-3 py-2 text-[12.5px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60">
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function PlatformChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
        active ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {active && <Check className="h-3 w-3" />} {label}
    </button>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize transition",
        active ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/**
 * Read-only post detail. Built entirely from the list payload (caption, media,
 * platforms, hashtags/mentions, engagement) — there is no GET /api/content/posts/[id]
 * endpoint to fetch a richer record, and persisted per-platform publishResults are
 * only returned by the retry action (surfaced in the retry panel below).
 */
function PostDetail({ post }: { post: Post }) {
  const st = post.status?.toUpperCase();
  const media = post.mediaUrls ?? [];
  const hashtags = post.hashtags ?? [];
  const mentions = post.mentions ?? [];
  const platforms = post.platforms ?? [];
  const isPublished = st === "PUBLISHED";

  const meta: { label: string; value: string }[] = [];
  if (post.publishedAt) meta.push({ label: "Published", value: fmt(post.publishedAt) });
  if (post.scheduledAt) meta.push({ label: "Scheduled", value: fmt(post.scheduledAt) });
  if (post.createdAt) meta.push({ label: "Created", value: fmt(post.createdAt) });
  if (post.updatedAt && post.updatedAt !== post.createdAt) meta.push({ label: "Updated", value: fmt(post.updatedAt) });

  const stats: { icon: ElementType; value: number }[] = [
    { icon: Eye, value: post.viewCount ?? 0 },
    { icon: Heart, value: post.likeCount ?? 0 },
    { icon: MessageCircle, value: post.commentCount ?? 0 },
    { icon: Share2, value: post.shareCount ?? 0 },
  ];

  return (
    <div className="mb-3 space-y-3 rounded-[10px] border border-border bg-background p-3">
      {/* media gallery */}
      {media.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {media.slice(0, 8).map((url, i) => (
            <div key={`${url}-${i}`} className="relative h-16 w-16 overflow-hidden rounded-lg bg-muted/40">
              {/\.(mp4|webm|mov|avi|mkv)/i.test(url)
                ? <video src={url} className="h-full w-full object-cover" muted playsInline />
                : <Image src={url} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized />}
            </div>
          ))}
          {media.length > 8 && (
            <div className="grid h-16 w-16 place-items-center rounded-lg border border-border bg-muted/30 text-[12px] font-semibold text-muted-foreground">+{media.length - 8}</div>
          )}
        </div>
      )}

      {/* full caption */}
      {post.caption
        ? <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">{post.caption}</p>
        : <p className="text-[12.5px] italic text-muted-foreground">No caption.</p>}

      {/* hashtags / mentions */}
      {(hashtags.length > 0 || mentions.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {hashtags.slice(0, 12).map((h, i) => (
            <span key={`h-${i}`} className="inline-flex items-center gap-0.5 rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-500">
              <Hash className="h-2.5 w-2.5" />{h.replace(/^#/, "")}
            </span>
          ))}
          {mentions.slice(0, 8).map((m, i) => (
            <span key={`m-${i}`} className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{m.startsWith("@") ? m : `@${m}`}</span>
          ))}
        </div>
      )}

      {/* destinations */}
      {platforms.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Destinations</p>
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((p) => (
              <span key={p} className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium",
                isExternal(p) ? "border-border bg-muted/40" : "border-brand-500/40 bg-brand-500/10 text-brand-500",
              )}>
                {isExternal(p) ? <Send className="h-3 w-3 text-muted-foreground" /> : <Sparkles className="h-3 w-3" />}
                {prettyPlatform(p)}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Per-platform publish results appear when you run a cross-post retry below.
          </p>
        </div>
      )}

      {/* engagement (published only) */}
      {isPublished && (
        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-2.5">
          {stats.map(({ icon: Icon, value }, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {value.toLocaleString()}
            </span>
          ))}
        </div>
      )}

      {/* timestamps */}
      {meta.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
          {meta.map((m) => (
            <span key={m.label}><span className="font-medium text-foreground/70">{m.label}:</span> {m.value}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-[10px] border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] font-medium text-rose-500">
      <X className="h-3.5 w-3.5 shrink-0" /> {msg}
    </div>
  );
}

function Confirm({
  tone, icon: Icon, title, body, confirmLabel, busy, error, onConfirm, onCancel,
}: {
  tone: "rose" | "amber";
  icon: ElementType;
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const toneCls = tone === "rose"
    ? { border: "border-rose-500/30", bg: "bg-rose-500/10", text: "text-rose-500", btn: "bg-rose-500 hover:bg-rose-600" }
    : { border: "border-amber-500/30", bg: "bg-amber-500/10", text: "text-amber-500", btn: "bg-amber-500 hover:bg-amber-600" };
  return (
    <div className={cn("rounded-[10px] border p-3", toneCls.border, toneCls.bg)}>
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneCls.text)} />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{body}</p>
        </div>
      </div>
      {error && <p className="mt-2 text-[12px] font-medium text-rose-500">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={onConfirm} disabled={busy} className={cn("inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60", toneCls.btn)}>
          {busy ? <FlowLoader size={14} /> : <Icon className="h-3.5 w-3.5" />} {confirmLabel}
        </button>
        <GhostBtn onClick={onCancel} disabled={busy} label="Keep it" />
      </div>
    </div>
  );
}
