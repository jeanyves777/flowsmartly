"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Image from "next/image";
import { PenSquare, Sparkles, Send, CalendarClock, FileEdit, CheckCircle2, ImageIcon, Link2, Plug, Rss, Hash, Clock, X } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Compose — a deep new-design post composer surface (the Compose workspace
 * canvas): write a caption, pick which connected platforms (plus the always-on
 * in-app "feed") to post to, optionally attach media, then post now or schedule
 * for later. Real data + real action — targets come from GET /api/social-accounts
 * and posting is a direct POST /api/content/posts (no scheduledAt / a past time =
 * posts now, a future time = SCHEDULED). "Ask AI to write it" is the one
 * generative escape hatch (onAsk). No legacy links. [[surface-buttons-are-ui-actions]]
 */

interface PlatformAcc {
  platform: string;
  name?: string;
  connected?: boolean;
  connectedCount?: number;
  username?: string | null;
  avatarUrl?: string | null;
}
interface Target { id: string; label: string; username?: string | null; avatarUrl?: string | null; feed?: boolean; }
interface PostedResult { status: string; scheduledAt?: string | null; platforms?: string[]; }

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
const CAPTION_MAX = 2200;
const FEED: Target = { id: "feed", label: "In-app feed", feed: true };

function fmtWhen(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time — build a sensible default (now + 1h).
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FocusedCompose({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [accounts, setAccounts] = useState<PlatformAcc[]>([]);
  const [loading, setLoading] = useState(true);

  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [selected, setSelected] = useState<string[]>(["feed"]);
  const [mode, setMode] = useState<"now" | "schedule" | "draft">("now");
  const [scheduleAt, setScheduleAt] = useState("");

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<PostedResult | null>(null);

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

  // Always offer the in-app feed; add every connected platform on top.
  const targets = useMemo<Target[]>(() => {
    const connected = accounts.filter((a) => a.connected || (a.connectedCount ?? 0) > 0);
    return [
      FEED,
      ...connected.map((a) => ({ id: a.platform, label: a.name || a.platform, username: a.username, avatarUrl: a.avatarUrl })),
    ];
  }, [accounts]);

  const toggle = (id: string) => {
    setDone(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const reset = () => {
    setCaption(""); setMediaUrl(""); setMediaType("image"); setSelected(["feed"]);
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
      if (mediaUrl.trim()) { body.mediaUrls = [mediaUrl.trim()]; body.mediaType = mediaType; }
      if (scheduledAt) body.scheduledAt = scheduledAt;
      if (mode === "draft") body.status = "DRAFT"; // best-effort — the response status is the source of truth

      const r = await fetch("/api/content/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok && j?.success && j.data?.post) {
        const p = j.data.post as { status?: string; scheduledAt?: string | null; platforms?: string[] };
        setDone({ status: p.status || "PUBLISHED", scheduledAt: p.scheduledAt, platforms: p.platforms });
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

        {/* success confirmation */}
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
                  {(done.platforms?.length ? done.platforms : ["feed"]).map((p) => (p === "feed" ? "in-app feed" : p)).join(" · ")}
                  {done.status === "PUBLISHED" ? " — it's live now." : ""}
                </p>
              </div>
              <button onClick={() => setDone(null)} className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
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

          {/* targets */}
          <div className="mt-4">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground"><Plug className="h-3.5 w-3.5" /> Post to</span>
            <div className="flex flex-wrap gap-2">
              {targets.map((t) => {
                const on = selected.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition",
                      on ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-muted/40 text-foreground hover:border-brand-500/40",
                    )}
                  >
                    {t.feed ? (
                      <Rss className="h-3.5 w-3.5" />
                    ) : t.avatarUrl ? (
                      <Image src={t.avatarUrl} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full object-cover" unoptimized />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                    <span className="capitalize">{t.label}</span>
                    {t.username && <span className={cn("font-normal", on ? "text-brand-500/80" : "text-muted-foreground")}>@{t.username}</span>}
                    {on && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
            {targets.length === 1 && (
              <p className="mt-2 text-[11.5px] text-muted-foreground">No social accounts connected yet — your post goes to the in-app feed. Connect Instagram, X, LinkedIn… from Connections to cross-post.</p>
            )}
          </div>

          {/* media (optional) */}
          <div className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Media URL <span className="font-normal">(optional)</span></span>
              <input value={mediaUrl} onChange={(e) => { setMediaUrl(e.target.value); setDone(null); }} placeholder="https://…/image.jpg" inputMode="url" className={FIELD} />
            </label>
            <label className="block sm:w-32">
              <span className="mb-1.5 block text-[11.5px] font-medium text-muted-foreground">Type</span>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value as "image" | "video")} disabled={!mediaUrl.trim()} className={cn(FIELD, "disabled:opacity-50")}>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </label>
          </div>
          {mediaUrl.trim() && mediaType === "image" && (
            <div className="mt-2.5 overflow-hidden rounded-xl border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl.trim()} alt="Attachment preview" className="max-h-56 w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}

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
            {(caption || mediaUrl) && (
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
