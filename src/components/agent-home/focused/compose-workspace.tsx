"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Image from "next/image";
import { PenSquare, Sparkles, Send, CalendarClock, FileEdit, CheckCircle2, ImageIcon, Link2, Plug, Rss, Hash, Clock, X, AlertTriangle, RefreshCw, XCircle, Ban } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { cn } from "@/lib/utils/cn";

/**
 * Compose — a deep new-design post composer surface (the Compose workspace
 * canvas): write a caption, pick which connected destinations (plus the always-on
 * in-app "feed") to post to, optionally attach media, then post now or schedule
 * for later. Real data + real action — destinations come from GET /api/social-accounts
 * (one selectable target per CONNECTED account, via the publisher's "account:<id>"
 * destination contract) and posting is a direct POST /api/content/posts. The
 * response's per-destination publishResults drive a success/failure breakdown,
 * and failed destinations can be retried via POST /api/content/posts/[id]/retry.
 * Stale / insufficient-scope accounts surface a reconnect prompt, and channels
 * that can't take the attached media auto-disable with a short why. "Ask AI to
 * write it" is the one generative escape hatch (onAsk). No legacy links.
 * [[surface-buttons-are-ui-actions]]
 */

// ─── API shapes (from GET /api/social-accounts data.platforms[]) ──────────
interface PlatformAccount {
  id: string;
  platform: string; // raw row platform, e.g. "instagram_123" / "facebook_456"
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  missingScopes?: string[];
  needsReconnect?: boolean;
}
interface PlatformAcc {
  platform: string; // base platform id, e.g. "instagram"
  name?: string;
  connected?: boolean;
  connectedCount?: number;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  accounts?: PlatformAccount[];
}

// A selectable destination. `id` is what we send to the API:
//   "feed" → in-app feed; "account:<id>" → a specific connected row;
//   "<platform>" → legacy base-platform fallback (no per-account detail).
interface Target {
  id: string;
  platform: string; // base platform ("feed" for the in-app feed)
  label: string;
  username?: string | null;
  avatarUrl?: string | null;
  feed?: boolean;
  needsReconnect?: boolean;
  missingScopes?: string[];
}

// POST /api/content/posts → data.publishResults / retry → data.publishResults
type PublishResult = { success: boolean; postId?: string; error?: string };
type PublishResults = Record<string, PublishResult>;
interface PostedResult {
  postId?: string;
  status: string;
  scheduledAt?: string | null;
  platforms?: string[];
  publishResults?: PublishResults;
}

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
const CAPTION_MAX = 2200;
const FEED: Target = { id: "feed", platform: "feed", label: "In-app feed", feed: true };

// ─── Per-platform media compatibility (mirrors src/lib/social/publisher.ts) ──
// Some networks reject a post that lacks the media type they require. We mirror
// those server-side rules so we can disable an unpostable channel up front with
// a short reason, instead of letting the publish silently fail.
type MediaNeed = "none" | "any" | "image" | "video";
const PLATFORM_MEDIA_NEED: Record<string, MediaNeed> = {
  feed: "none",
  facebook: "none",
  twitter: "none",
  linkedin: "none",
  threads: "none",
  instagram: "any", // requires at least one image or video
  whatsapp: "any", // WhatsApp Status requires an image or video
  youtube: "video", // requires a video file
  tiktok: "video", // requires a video file
  pinterest: "image", // requires an image
};

interface MediaState { hasImage: boolean; hasVideo: boolean; count: number }

// Returns a short reason a platform can't take the current media, or "" if it can.
function incompatibleReason(platform: string, m: MediaState): string {
  const need = PLATFORM_MEDIA_NEED[platform] ?? "none";
  if (need === "none") return "";
  if (m.count === 0) {
    if (need === "image") return "needs an image";
    if (need === "video") return "needs a video";
    return "needs an image or video";
  }
  if (need === "image") {
    if (!m.hasImage) return "needs an image (you attached a video)";
    // Image-only networks (e.g. Pinterest) reject the post outright if any video
    // is attached — the publisher refuses video pins, so disable it up front.
    if (m.hasVideo) return "can't include a video — attach only images";
  }
  if (need === "video" && !m.hasVideo) return "needs a video (you attached an image)";
  return "";
}

function fmtWhen(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}

// The post API takes a single mediaType — infer it from the first attachment.
function isVideoUrl(url: string): boolean {
  const u = url.toLowerCase();
  return /\.(mp4|webm|mov|avi|mkv)/.test(u) || u.includes("/video/");
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time — build a sensible default (now + 1h).
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Human label for a destination id, used in the publish-results breakdown.
function destinationLabel(id: string, targets: Target[]): string {
  if (id === "feed") return "In-app feed";
  const t = targets.find((x) => x.id === id);
  if (t) return t.username ? `${t.label} @${t.username}` : t.label;
  return id.replace(/^account:/, "");
}

export function FocusedCompose({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [accounts, setAccounts] = useState<PlatformAcc[]>([]);
  const [loading, setLoading] = useState(true);

  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(["feed"]);
  const [mode, setMode] = useState<"now" | "schedule" | "draft">("now");
  const [scheduleAt, setScheduleAt] = useState("");

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<PostedResult | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/social-accounts").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.platforms)) setAccounts(j.data.platforms as PlatformAcc[]);
    } catch { /* ignore — feed is always available */ }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  // Build one target per CONNECTED account. A user may have two Instagram
  // accounts — each is its own selectable destination ("account:<id>"). For a
  // connected platform that didn't return per-account rows, fall back to the
  // base-platform destination so it's still postable.
  const targets = useMemo<Target[]>(() => {
    const list: Target[] = [FEED];
    for (const a of accounts) {
      const isConnected = a.connected || (a.connectedCount ?? 0) > 0;
      if (!isConnected) continue;
      const rows = a.accounts || [];
      if (rows.length > 0) {
        for (const row of rows) {
          list.push({
            id: `account:${row.id}`,
            platform: a.platform,
            label: row.displayName || a.name || a.platform,
            username: row.username,
            avatarUrl: row.avatarUrl,
            needsReconnect: row.needsReconnect,
            missingScopes: row.missingScopes,
          });
        }
      } else {
        list.push({
          id: a.platform,
          platform: a.platform,
          label: a.name || a.platform,
          username: a.username,
          avatarUrl: a.avatarUrl,
        });
      }
    }
    return list;
  }, [accounts]);

  // Current media composition, used for per-platform compatibility checks.
  const mediaState = useMemo<MediaState>(() => {
    const hasVideo = media.some(isVideoUrl);
    const hasImage = media.some((u) => !isVideoUrl(u));
    return { hasImage, hasVideo, count: media.length };
  }, [media]);

  // Disable channels that can't take the attached media, with a short reason.
  const incompatibleById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const t of targets) {
      const reason = incompatibleReason(t.platform, mediaState);
      if (reason) map[t.id] = reason;
    }
    return map;
  }, [targets, mediaState]);

  // Auto-deselect any selected destination that became incompatible (e.g. the
  // user attached a video to a channel that needs an image).
  useEffect(() => {
    setSelected((prev) => {
      const next = prev.filter((id) => !incompatibleById[id]);
      return next.length === prev.length ? prev : next;
    });
  }, [incompatibleById]);

  // Selected destinations that are stale / missing scopes — warn before posting.
  const staleSelected = useMemo<Target[]>(
    () => targets.filter((t) => t.needsReconnect && selected.includes(t.id)),
    [targets, selected],
  );

  const toggle = (id: string) => {
    if (incompatibleById[id]) return; // can't select an unpostable channel
    setDone(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const reconnect = (platform: string) => {
    if (!platform || platform === "feed") return;
    window.location.href = `/api/social/${platform}/connect`;
  };

  const reset = () => {
    setCaption(""); setMedia([]); setSelected(["feed"]);
    setMode("now"); setScheduleAt(""); setError("");
  };

  const post = async () => {
    const text = caption.trim();
    if (!text) { setError("Write a caption first."); return; }
    if (!selected.length) { setError("Pick at least one place to post — the in-app feed is always available."); return; }
    let scheduledAt: string | undefined;
    if (mode === "schedule") {
      if (!scheduleAt) { setError("Pick a date and time to schedule for."); return; }
      const d = new Date(scheduleAt);
      if (isNaN(d.getTime())) { setError("That schedule time isn't valid."); return; }
      if (d.getTime() <= Date.now()) { setError("Pick a time in the future to schedule, or switch to Post now."); return; }
      scheduledAt = d.toISOString();
    }

    setPosting(true); setError(""); setDone(null);
    try {
      const body: Record<string, unknown> = {
        caption: text,
        platforms: selected,
      };
      if (media.length) { body.mediaUrls = media; body.mediaType = isVideoUrl(media[0]) ? "video" : "image"; }
      if (scheduledAt) body.scheduledAt = scheduledAt;
      if (mode === "draft") body.status = "DRAFT"; // best-effort — the response status is the source of truth

      const r = await fetch("/api/content/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok && j?.success && j.data?.post) {
        const p = j.data.post as { id?: string; status?: string; scheduledAt?: string | null; platforms?: string[] };
        const publishResults = (j.data.publishResults as PublishResults | undefined) || undefined;
        setDone({ postId: p.id, status: p.status || "PUBLISHED", scheduledAt: p.scheduledAt, platforms: p.platforms, publishResults });
        reset();
      } else {
        setError(j?.error?.message || "Couldn't publish that post. Try again.");
      }
    } catch {
      setError("Couldn't publish that post. Try again.");
    } finally {
      setPosting(false);
    }
  };

  // Re-publish just the destinations that failed on the first attempt.
  const retryFailed = async (failedIds: string[]) => {
    if (!done?.postId || failedIds.length === 0) return;
    setRetrying(true);
    try {
      const r = await fetch(`/api/content/posts/${done.postId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: failedIds }),
      });
      const j = await r.json();
      if (r.ok && j?.success && j.data?.publishResults) {
        const fresh = j.data.publishResults as PublishResults;
        setDone((prev) => (prev ? { ...prev, publishResults: { ...(prev.publishResults || {}), ...fresh } } : prev));
      } else {
        setError(j?.error?.message || "Couldn't retry those platforms. Try again.");
      }
    } catch {
      setError("Couldn't retry those platforms. Try again.");
    } finally {
      setRetrying(false);
    }
  };

  const askAi = () => {
    if (!onAsk) return;
    const hint = caption.trim() ? ` Here's my rough idea: "${caption.trim()}".` : "";
    onAsk(`Help me write an engaging social post. Ask me the goal, vibe, and which platforms, then draft the caption with hashtags.${hint}`);
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading the composer…" /></div>;
  }

  const chars = caption.length;
  const over = chars > CAPTION_MAX;
  const canPost = !!caption.trim() && selected.length > 0 && !over;

  // External (non-feed) entries of the last publish, split into wins / fails.
  const resultEntries = done?.publishResults ? Object.entries(done.publishResults) : [];
  const failedIds = resultEntries.filter(([, r]) => !r.success).map(([id]) => id);
  const succeededIds = resultEntries.filter(([, r]) => r.success).map(([id]) => id);
  const hasResults = resultEntries.length > 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* header */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><PenSquare className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="text-[16px] font-bold">New post</h2>
              <p className="text-[12px] text-muted-foreground">Write it, choose where it goes, then post now or schedule.</p>
            </div>
            {onAsk && (
              <button onClick={askAi} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Ask AI to write it
              </button>
            )}
          </div>
        </section>

        {/* success confirmation + per-destination publish results */}
        {done && (
          <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500">
                {done.status === "SCHEDULED" ? <CalendarClock className="h-4.5 w-4.5" /> : done.status === "DRAFT" ? <FileEdit className="h-4.5 w-4.5" /> : <CheckCircle2 className="h-4.5 w-4.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">
                  {done.status === "SCHEDULED" ? `Scheduled for ${fmtWhen(done.scheduledAt)}` : done.status === "DRAFT" ? "Saved as a draft" : "Posted"}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {done.status === "PUBLISHED"
                    ? hasResults
                      ? `${succeededIds.length} of ${resultEntries.length} ${resultEntries.length === 1 ? "channel" : "channels"} published${failedIds.length ? `, ${failedIds.length} failed` : ""} — also live on your in-app feed.`
                      : "It's live on your in-app feed now."
                    : (done.platforms?.length ? done.platforms : ["feed"]).map((p) => (p === "feed" ? "in-app feed" : p.replace(/^account:/, ""))).join(" · ")}
                </p>
              </div>
              <button onClick={() => setDone(null)} className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            {/* per-platform breakdown */}
            {hasResults && (
              <div className="mt-3 space-y-1.5 border-t border-emerald-500/20 pt-3">
                {resultEntries.map(([id, res]) => (
                  <div key={id} className="flex items-start gap-2 rounded-lg bg-card/60 px-2.5 py-1.5">
                    {res.success
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium capitalize">{destinationLabel(id, targets)}</p>
                      {!res.success && res.error && <p className="mt-0.5 text-[11px] leading-snug text-rose-500">{res.error}</p>}
                      {res.success && <p className="mt-0.5 text-[11px] text-emerald-500">Published</p>}
                    </div>
                  </div>
                ))}

                {failedIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => retryFailed(failedIds)}
                      disabled={retrying}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/40 bg-rose-500/5 px-3 py-1.5 text-[12px] font-semibold text-rose-500 hover:bg-rose-500/10 disabled:opacity-60"
                    >
                      {retrying ? <FlowLoader size={13} /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Retry {failedIds.length} failed {failedIds.length === 1 ? "channel" : "channels"}
                    </button>
                    <span className="text-[11px] text-muted-foreground">We&apos;ll only re-attempt the ones that didn&apos;t go through.</span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* composer */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          {/* caption */}
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-muted-foreground">Caption</span>
              <span className={cn("text-[11px] tabular-nums", over ? "text-rose-500 font-semibold" : "text-muted-foreground")}>{chars.toLocaleString()} / {CAPTION_MAX.toLocaleString()}</span>
            </span>
            <textarea
              rows={5}
              value={caption}
              onChange={(e) => { setCaption(e.target.value); setDone(null); }}
              placeholder="What do you want to say? Use #hashtags and @mentions — they're picked up automatically."
              className={cn(FIELD, "resize-y leading-relaxed")}
            />
          </label>

          {/* targets — one chip per connected account */}
          <div className="mt-4">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground"><Plug className="h-3.5 w-3.5" /> Post to</span>
            <div className="flex flex-wrap gap-2">
              {targets.map((t) => {
                const on = selected.includes(t.id);
                const why = incompatibleById[t.id];
                const disabled = !!why;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    aria-pressed={on}
                    disabled={disabled}
                    title={why ? `Can't post here — ${why}` : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition",
                      disabled
                        ? "cursor-not-allowed border-border bg-muted/20 text-muted-foreground opacity-60"
                        : on
                          ? "border-brand-500/60 bg-brand-500/10 text-brand-500"
                          : "border-border bg-muted/40 text-foreground hover:border-brand-500/40",
                    )}
                  >
                    {disabled ? (
                      <Ban className="h-3.5 w-3.5" />
                    ) : t.feed ? (
                      <Rss className="h-3.5 w-3.5" />
                    ) : t.avatarUrl ? (
                      <Image src={t.avatarUrl} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full object-cover" unoptimized />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                    <span className="capitalize">{t.label}</span>
                    {t.username && <span className={cn("font-normal", on ? "text-brand-500/80" : "text-muted-foreground")}>@{t.username}</span>}
                    {t.needsReconnect && !disabled && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                    {on && !disabled && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>

            {/* why a channel is disabled */}
            {Object.keys(incompatibleById).length > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>
                  Some channels are off because of your media:{" "}
                  {targets
                    .filter((t) => incompatibleById[t.id])
                    .map((t) => `${t.label} ${incompatibleById[t.id]}`)
                    .join("; ")}
                  .
                </span>
              </p>
            )}

            {targets.length === 1 && (
              <p className="mt-2 text-[11.5px] text-muted-foreground">No social accounts connected yet — your post goes to the in-app feed. Connect Instagram, X, LinkedIn… from Connections to cross-post.</p>
            )}
          </div>

          {/* reconnect awareness — selected accounts that are stale / missing scopes */}
          {staleSelected.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" /> Some connections need attention
              </p>
              <div className="mt-2 space-y-1.5">
                {staleSelected.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 text-[11.5px]">
                    <span className="font-medium capitalize">{t.label}{t.username ? ` @${t.username}` : ""}</span>
                    <span className="text-muted-foreground">
                      {t.missingScopes && t.missingScopes.length > 0
                        ? `is missing permission (${t.missingScopes.join(", ")}) — posting may fail`
                        : "may be expired — posting may fail"}
                    </span>
                    <button
                      onClick={() => reconnect(t.platform)}
                      className="ms-auto inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-amber-600 hover:text-amber-500 dark:text-amber-500"
                    >
                      <RefreshCw className="h-3 w-3" /> Reconnect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* media (optional) — real upload + media library + preview */}
          <div className="mt-4">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Media <span className="font-normal">(optional)</span></span>
            <MediaUploader
              value={media}
              onChange={(urls) => { setMedia(urls); setDone(null); }}
              multiple
              maxFiles={4}
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime"
              filterTypes={["image", "video"]}
              variant="gallery"
              placeholder="Upload or pick from your library"
              libraryTitle="Your media library"
            />
            {mediaState.hasImage && mediaState.hasVideo && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">You&apos;ve attached both images and a video — channels that need only one type stay available.</p>
            )}
          </div>

          {/* timing */}
          <div className="mt-4">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground"><Clock className="h-3.5 w-3.5" /> When</span>
            <div className="inline-flex rounded-[10px] border border-border p-0.5">
              {([
                { id: "now", label: "Post now" },
                { id: "schedule", label: "Schedule" },
                { id: "draft", label: "Save as draft" },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMode(m.id); setDone(null); if (m.id === "schedule" && !scheduleAt) setScheduleAt(defaultScheduleValue()); }}
                  className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition", mode === m.id ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {mode === "schedule" && (
              <label className="mt-2.5 block sm:max-w-xs">
                <span className="mb-1.5 block text-[11.5px] font-medium text-muted-foreground">Schedule for</span>
                <input type="datetime-local" value={scheduleAt} onChange={(e) => { setScheduleAt(e.target.value); setDone(null); }} className={FIELD} />
              </label>
            )}
          </div>

          {error && <p className="mt-3 flex items-center gap-1.5 text-[12px] text-rose-500"><X className="h-3.5 w-3.5" /> {error}</p>}

          {/* actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button
              onClick={post}
              disabled={posting || !canPost}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60"
            >
              {posting ? <FlowLoader size={15} tone="white" /> : mode === "schedule" ? <CalendarClock className="h-4 w-4" /> : mode === "draft" ? <FileEdit className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {mode === "schedule" ? "Schedule post" : mode === "draft" ? "Save draft" : "Post now"}
            </button>
            {(caption || media.length > 0) && (
              <button onClick={reset} disabled={posting} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"><X className="h-3.5 w-3.5" /> Clear</button>
            )}
            <span className="ms-auto inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Hash className="h-3.5 w-3.5" /> Posting to {selected.length} {selected.length === 1 ? "place" : "places"}
            </span>
          </div>
        </section>

        {/* tips */}
        <section className="grid gap-2.5 sm:grid-cols-3">
          <Tip icon={Sparkles} title="Let AI draft it" desc="Stuck on words? Ask the agent to write a caption you can tweak." />
          <Tip icon={Rss} title="Always-on feed" desc="Even with no accounts connected, posts land on your in-app feed." />
          <Tip icon={CalendarClock} title="Schedule ahead" desc="Pick a future time and it publishes itself automatically." />
        </section>
      </div>
    </div>
  );
}

function Tip({ icon: Icon, title, desc }: { icon: ElementType; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-brand-500"><Icon className="h-4 w-4" /><span className="text-[12px] font-semibold text-foreground">{title}</span></div>
      <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{desc}</p>
    </div>
  );
}
