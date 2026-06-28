"use client";

import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";
import Image from "next/image";
import {
  Sparkles, CalendarClock, CheckCircle2, FileEdit, Link2, Plug, Image as ImageIcon,
  ChevronRight, Pencil, Trash2, X, Check, AlertTriangle, RefreshCw, CalendarX2, Save, RotateCcw,
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
  status: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
}
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
  const [accounts, setAccounts] = useState<PlatformAcc[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Local bump to re-fetch posts after a mutation, independent of the parent refreshKey.
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((j) => { if (alive && j?.success && Array.isArray(j.data?.platforms)) setAccounts(j.data.platforms); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refreshKey]);

  useEffect(() => {
    let alive = true;
    setPostsLoading(true);
    fetch(`/api/content/posts?status=${status}&limit=30`)
      .then((r) => r.json())
      .then((j) => { if (alive && j?.success && Array.isArray(j.data?.posts)) setPosts(j.data.posts); })
      .catch(() => {})
      .finally(() => { if (alive) setPostsLoading(false); });
    return () => { alive = false; };
  }, [status, refreshKey, reload]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your content…" /></div>;
  }

  const connected = accounts.filter((a) => a.connected || (a.connectedCount ?? 0) > 0);
  // Connectable external destinations for the editor's platform picker (always include feed).
  const connectedPlatforms = connected.map((a) => a.platform).filter(isExternal);

  const refetch = () => setReload((n) => n + 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/30 px-4 py-2.5">
        <div className="inline-flex rounded-[10px] border border-border p-0.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setStatus(t.id); setOpenId(null); }} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition", status === t.id ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>{t.label}</button>
          ))}
        </div>
        <button onClick={() => onOpenView("compose")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5" /> New post
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* connected accounts */}
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Plug className="h-4 w-4 text-brand-500" />
              <h3 className="text-[13px] font-bold">Connected accounts</h3>
            </div>
            {connected.length ? (
              <div className="flex flex-wrap gap-2">
                {connected.map((a) => (
                  <span key={a.platform} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[12.5px]">
                    {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full object-cover" unoptimized /> : <Link2 className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="font-medium capitalize">{a.name || a.platform}</span>
                    {a.username && <span className="text-muted-foreground">@{a.username}</span>}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-4">
                <p className="text-[12.5px] text-muted-foreground">No social accounts connected — you can still post to your in-app feed. Connect Instagram, Facebook, X… to cross-post.</p>
                <button onClick={onConnect} className="shrink-0 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">Connect</button>
              </div>
            )}
          </section>

          {/* posts */}
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[13px] font-bold">{status === "ALL" ? "Your posts" : TABS.find((t) => t.id === status)?.label}</h3>
              {postsLoading && <FlowLoader size={14} className="ms-1" />}
            </div>
            {posts.length ? (
              <div className="space-y-2.5">
                {posts.map((p) => (
                  <PostRow
                    key={p.id}
                    post={p}
                    open={openId === p.id}
                    onToggle={() => setOpenId((id) => (id === p.id ? null : p.id))}
                    connectedPlatforms={connectedPlatforms}
                    onChanged={refetch}
                    onRemoved={() => { setOpenId(null); setPosts((prev) => prev.filter((x) => x.id !== p.id)); refetch(); }}
                  />
                ))}
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
      if (scheduleAt) body.scheduledAt = new Date(scheduleAt).toISOString();
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

          {/* default actions bar */}
          {mode === null && (
            <div className="flex flex-wrap items-center gap-2">
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
