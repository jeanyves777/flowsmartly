"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Image from "next/image";
import {
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  FileEdit,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  Image as ImageIcon,
  Clock,
  Plus,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Content calendar — a deep new-design content surface (the Calendar workspace
 * canvas): the user's scheduled + published posts laid out by date. Real data
 * (GET /api/content/posts) drives KPIs, a month grid, and an upcoming-by-date
 * list. "Schedule a post" opens the composer (onOpenView), the agent stays in
 * the chat for generative help. No legacy links. [[new-design-no-legacy]]
 */

interface Post {
  id: string;
  caption: string | null;
  mediaUrls?: string[];
  platforms?: string[];
  status: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
}

type ViewMode = "list" | "month";

// Best date to place a post on the calendar: scheduled time, else published, else created.
function postDate(p: Post): Date | null {
  const iso = p.scheduledAt || p.publishedAt || null;
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(d: Date): string {
  try { return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}

function dayHeading(d: Date, today: Date): string {
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  try { return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); } catch { return dayKey(d); }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function statusMeta(status?: string): { Icon: ElementType; tone: string; dot: string } {
  const st = (status || "").toUpperCase();
  if (st === "PUBLISHED") return { Icon: CheckCircle2, tone: "text-emerald-500", dot: "bg-emerald-500" };
  if (st === "SCHEDULED") return { Icon: CalendarClock, tone: "text-brand-500", dot: "bg-brand-500" };
  return { Icon: FileEdit, tone: "text-muted-foreground", dot: "bg-muted-foreground" };
}

export function FocusedCalendar({ refreshKey, onAsk, onOpenView }: { refreshKey?: number; onAsk?: (prompt: string) => void; onOpenView?: (key: string) => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewMode>("month");
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/content/posts?status=ALL&limit=100").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.posts)) {
        setPosts(j.data.posts as Post[]);
        setError("");
      } else {
        setError(j?.error?.message || "Could not load your calendar.");
      }
    } catch {
      setError("Could not load your calendar.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const counts = useMemo(() => {
    let scheduled = 0, published = 0, drafts = 0;
    for (const p of posts) {
      const st = (p.status || "").toUpperCase();
      if (st === "SCHEDULED") scheduled++;
      else if (st === "PUBLISHED") published++;
      else drafts++;
    }
    return { scheduled, published, drafts };
  }, [posts]);

  // Posts that can be placed on a calendar (have a date), sorted ascending by date.
  const dated = useMemo(() => {
    return posts
      .map((p) => ({ p, d: postDate(p) }))
      .filter((x): x is { p: Post; d: Date } => x.d !== null)
      .sort((a, b) => a.d.getTime() - b.d.getTime());
  }, [posts]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  // Upcoming-by-date: today onward, grouped by day (scheduled + anything dated in the future).
  const upcomingGroups = useMemo(() => {
    const groups = new Map<string, { date: Date; items: Post[] }>();
    for (const { p, d } of dated) {
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      if (dayStart.getTime() < today.getTime()) continue;
      const key = dayKey(d);
      const g = groups.get(key);
      if (g) g.items.push(p);
      else groups.set(key, { date: dayStart, items: [p] });
    }
    return Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [dated, today]);

  // Recently published: in the past, newest first (shown below upcoming so the list isn't empty).
  const recent = useMemo(() => {
    return dated
      .filter(({ d }) => { const ds = new Date(d); ds.setHours(0, 0, 0, 0); return ds.getTime() < today.getTime(); })
      .map(({ p }) => p)
      .reverse()
      .slice(0, 12);
  }, [dated, today]);

  // Month grid cells (6 weeks) for the current cursor month.
  const monthCells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay(); // 0 = Sun
    const gridStart = new Date(year, month, 1 - startOffset);
    const byDay = new Map<string, Post[]>();
    for (const { p, d } of dated) {
      const key = dayKey(d);
      const arr = byDay.get(key);
      if (arr) arr.push(p); else byDay.set(key, [p]);
    }
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return { date, inMonth: date.getMonth() === month, items: byDay.get(dayKey(date)) ?? [] };
    });
  }, [monthCursor, dated]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your calendar…" /></div>;
  }

  const monthLabel = (() => {
    try { return monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }); } catch { return ""; }
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/30 px-4 py-2.5">
        <div className="inline-flex rounded-[10px] border border-border p-0.5">
          <button onClick={() => setView("list")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition", view === "list" ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>
            <List className="h-3.5 w-3.5" /> Upcoming
          </button>
          <button onClick={() => setView("month")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition", view === "month" ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>
            <LayoutGrid className="h-3.5 w-3.5" /> Month
          </button>
        </div>
        <button onClick={() => onOpenView?.("compose")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5" /> Schedule a post
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <Kpi icon={CalendarClock} label="Scheduled" value={counts.scheduled.toLocaleString()} />
            <Kpi icon={CheckCircle2} label="Published" value={counts.published.toLocaleString()} />
            <Kpi icon={FileEdit} label="Drafts" value={counts.drafts.toLocaleString()} />
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-[12.5px] text-rose-500">{error}</div>
          )}

          {view === "month" ? (
            <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-[14px] font-bold">{monthLabel}</h3>
                <div className="inline-flex items-center gap-1">
                  <button onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setMonthCursor(d); }} className="rounded-[8px] border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground">Today</button>
                  <button onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
                </div>
                <span className="ms-auto hidden text-[11px] text-muted-foreground sm:inline">Click any day to schedule a post</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="pb-1 text-center text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{w}</div>
                ))}
                {monthCells.map(({ date, inMonth, items }) => {
                  const isToday = sameDay(date, today);
                  return (
                    <button
                      key={dayKey(date)}
                      onClick={() => onOpenView?.("compose")}
                      title={`Schedule a post for ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                      className={cn(
                        "group min-h-[92px] rounded-[10px] border p-1.5 text-left align-top transition sm:min-h-[108px]",
                        inMonth ? "border-border bg-muted/20 hover:border-brand-500/50 hover:bg-muted/40" : "border-transparent bg-transparent hover:bg-muted/20",
                        isToday && "border-brand-500/60 bg-brand-500/5",
                      )}
                    >
                      <div className="mb-1 flex items-center">
                        <span className={cn("grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[11.5px] font-semibold", inMonth ? (isToday ? "bg-brand-500 text-white" : "text-foreground") : "text-muted-foreground/40")}>{date.getDate()}</span>
                        <Plus className="ms-auto h-3.5 w-3.5 text-brand-500 opacity-0 transition group-hover:opacity-100" />
                      </div>
                      <div className="space-y-0.5">
                        {items.slice(0, 3).map((p) => {
                          const meta = statusMeta(p.status);
                          return (
                            <div key={p.id} className="flex items-center gap-1 truncate rounded-[6px] bg-card px-1 py-0.5 text-[10px]">
                              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                              <span className="truncate text-muted-foreground">{p.caption?.trim() || "Post"}</span>
                            </div>
                          );
                        })}
                        {items.length > 3 && <div className="px-1 text-[10px] font-medium text-muted-foreground">+{items.length - 3} more</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-500" /> Scheduled</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Published</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Draft</span>
                {!posts.length && (
                  <span className="ms-auto inline-flex items-center gap-1.5 text-muted-foreground/80">
                    Nothing scheduled yet — click a day{onAsk ? ", or " : "."}
                    {onAsk && <button onClick={() => onAsk("Plan a week of social posts for me — suggest topics and the best times to publish, then schedule them.")} className="font-semibold text-brand-500 hover:underline">plan my week</button>}
                  </span>
                )}
              </div>
            </section>
          ) : !posts.length && !error ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-border px-4 py-16 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><CalendarDays className="h-7 w-7" /></span>
                <h2 className="mt-3 text-[16px] font-bold">Your calendar is empty</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Schedule your first post and it shows up here by date — so you always know what is going out when.</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button onClick={() => onOpenView?.("compose")} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                    <Sparkles className="h-4 w-4" /> Schedule a post
                  </button>
                  {onAsk && (
                    <button onClick={() => onAsk("Plan a week of social posts for me — suggest topics and the best times to publish, then schedule them.")} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                      <Sparkles className="h-4 w-4 text-brand-500" /> Plan my week
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Upcoming by date */}
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-brand-500" />
                  <h3 className="text-[13px] font-bold">Upcoming</h3>
                </div>
                {upcomingGroups.length ? (
                  <div className="space-y-4">
                    {upcomingGroups.map((g) => (
                      <div key={dayKey(g.date)}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-[12px] font-bold">{dayHeading(g.date, today)}</span>
                          <span className="h-px flex-1 bg-border" />
                          <span className="text-[11px] text-muted-foreground">{g.items.length} {g.items.length === 1 ? "post" : "posts"}</span>
                        </div>
                        <div className="space-y-2">
                          {g.items.map((p) => <PostRow key={p.id} post={p} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <p className="text-[13px] font-medium">Nothing scheduled ahead</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">Schedule a post and it will appear here on its day.</p>
                    <button onClick={() => onOpenView?.("compose")} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                      <Sparkles className="h-4 w-4" /> Schedule a post
                    </button>
                  </div>
                )}
              </section>

              {/* Recently published */}
              {recent.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-[13px] font-bold">Recently published</h3>
                  </div>
                  <div className="space-y-2">
                    {recent.map((p) => <PostRow key={p.id} post={p} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PostRow({ post }: { post: Post }) {
  const d = postDate(post);
  const meta = statusMeta(post.status);
  const media = post.mediaUrls?.[0];
  const platforms = post.platforms ?? [];
  const st = (post.status || "").toUpperCase();
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-background">
        {media ? <Image src={media} alt="" width={48} height={48} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px]">{post.caption?.trim() || "Untitled post"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1 font-medium", meta.tone)}>
            <meta.Icon className="h-3.5 w-3.5" />
            {st === "PUBLISHED" ? "Published" : st === "SCHEDULED" ? "Scheduled" : "Draft"}
          </span>
          {d && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtTime(d)}</span>
          )}
          {platforms.length > 0 && <span className="capitalize">{platforms.join(" · ")}</span>}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-[11.5px] font-medium">{label}</span></div>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none">{value}</p>
    </div>
  );
}
