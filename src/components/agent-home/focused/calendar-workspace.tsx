"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
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
  X,
  Trash2,
  Pencil,
  Save,
  Heart,
  MessageCircle,
  Eye,
  Share2,
  Rss,
  Link2,
  Plug,
  AlertTriangle,
  Search,
  Filter,
  CalendarRange,
  Columns3,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { AgentWorkingCard } from "./agent-working-card";
import { cn } from "@/lib/utils/cn";

/**
 * Content calendar — a deep new-design content surface (the Calendar workspace
 * canvas): the user's scheduled + published posts laid out by date. Real data
 * (GET /api/content/posts) drives KPIs, a month grid, and an upcoming-by-date
 * list. Clicking any post opens an in-surface detail panel where the user can
 * read the caption/media/engagement, edit the caption + platforms, reschedule,
 * or delete — all via PATCH/DELETE /api/content/posts/[id]. "Schedule a post"
 * opens the composer (onOpenView); the agent stays in chat for generative help.
 * No legacy links. [[new-design-no-legacy]] [[agent-operates-account-full-crud]]
 */

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
  shareCount?: number;
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

// Per-platform publish result (returned fresh by the retry endpoint).
interface PublishResult { success: boolean; postId?: string; error?: string }

type ViewMode = "list" | "month" | "week" | "day";
type StatusFilter = "ALL" | "SCHEDULED" | "PUBLISHED" | "DRAFT";

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
const CAPTION_MAX = 2200;
const DAY_START_HOUR = 6; // timeline starts at 6am, runs to midnight (compact but covers business hours)
const HOUR_PX = 52; // height of one hour row in the week/day timeline

// "feed" is the in-app destination; everything else is an external social platform.
const isExternalPlatform = (p: string) => !!p && p.toLowerCase() !== "feed";
const prettyPlatform = (p: string) => (p === "feed" ? "In-app feed" : p.charAt(0).toUpperCase() + p.slice(1));

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

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}

function dayHeading(d: Date, today: Date): string {
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  try { return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); } catch { return dayKey(d); }
}

// Start-of-week (Sunday) at 00:00 for the week containing `d`.
function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

// The 7 day-starts (Sun…Sat) for the week containing `d`.
function weekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

// Fractional hour-of-day (e.g. 14.5 for 2:30pm) used to position a post on the timeline.
function hourOfDay(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

function fmtHourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 || hour === 24 ? "AM" : "PM";
  return `${h12} ${ampm}`;
}

function shortDay(d: Date): string {
  try { return d.toLocaleDateString(undefined, { weekday: "short" }); } catch { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]; }
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso?: string | null): string {
  const base = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const d = isNaN(base.getTime()) ? new Date(Date.now() + 60 * 60 * 1000) : base;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isVideoUrl(url: string): boolean {
  const u = url.toLowerCase();
  return /\.(mp4|webm|mov|avi)/.test(u) || u.includes("/video/");
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function statusMeta(status?: string): { Icon: ElementType; tone: string; dot: string; label: string } {
  const st = (status || "").toUpperCase();
  if (st === "PUBLISHED") return { Icon: CheckCircle2, tone: "text-emerald-500", dot: "bg-emerald-500", label: "Published" };
  if (st === "SCHEDULED") return { Icon: CalendarClock, tone: "text-brand-500", dot: "bg-brand-500", label: "Scheduled" };
  return { Icon: FileEdit, tone: "text-muted-foreground", dot: "bg-muted-foreground", label: "Draft" };
}

export function FocusedCalendar({ refreshKey, onAsk, onOpenView, working }: { refreshKey?: number; onAsk?: (prompt: string) => void; onOpenView?: (key: string) => void; working?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  // Agent "working" loader — armed by the empty-state "plan my week", cleared when a post lands.
  const [armed, setArmed] = useState(false);
  const prevCount = useRef(0);
  const [accounts, setAccounts] = useState<PlatformAcc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewMode>("month");
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  // Anchor day for the Week/Day timelines (start-of-day in local time).
  const [dayCursor, setDayCursor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [openId, setOpenId] = useState<string | null>(null);

  // Search + filters (applied client-side over the loaded posts — the list API
  // only filters by status server-side, so caption/platform narrowing happens here).
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");

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

  // Clear the agent loader once the agent's freshly scheduled posts appear.
  useEffect(() => { if (armed && posts.length > prevCount.current) setArmed(false); prevCount.current = posts.length; }, [posts.length, armed]);

  // Connected social targets — used by the post editor's platform picker.
  useEffect(() => {
    let alive = true;
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((j) => { if (alive && j?.success && Array.isArray(j.data?.platforms)) setAccounts(j.data.platforms as PlatformAcc[]); })
      .catch(() => { /* feed is always available */ });
    return () => { alive = false; };
  }, [refreshKey]);

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

  // Every distinct channel across the user's posts — powers the platform filter.
  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) for (const pl of p.platforms ?? []) if (pl) set.add(pl);
    return Array.from(set).sort();
  }, [posts]);

  // Filtered posts (search + status + channel) — drives every calendar view below.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== "ALL" && (p.status || "").toUpperCase() !== statusFilter) return false;
      if (platformFilter !== "ALL" && !(p.platforms ?? []).includes(platformFilter)) return false;
      if (q && !(p.caption || "").toLowerCase().includes(q) && !(p.platforms ?? []).some((pl) => pl.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [posts, query, statusFilter, platformFilter]);

  const filtersActive = query.trim() !== "" || statusFilter !== "ALL" || platformFilter !== "ALL";

  // Posts that can be placed on a calendar (have a date), sorted ascending by date.
  const dated = useMemo(() => {
    return filtered
      .map((p) => ({ p, d: postDate(p) }))
      .filter((x): x is { p: Post; d: Date } => x.d !== null)
      .sort((a, b) => a.d.getTime() - b.d.getTime());
  }, [filtered]);

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

  // Posts placed on a given calendar day, each with its fractional hour-of-day.
  // Anything before DAY_START_HOUR is pinned to the top "earlier" rail so it stays visible.
  const placedByDay = useMemo(() => {
    const map = new Map<string, { post: Post; date: Date; hour: number }[]>();
    for (const { p, d } of dated) {
      const key = dayKey(d);
      const arr = map.get(key);
      const entry = { post: p, date: d, hour: hourOfDay(d) };
      if (arr) arr.push(entry); else map.set(key, [entry]);
    }
    return map;
  }, [dated]);

  // The columns shown in the Week timeline (Sun…Sat of the cursor week).
  const weekColumns = useMemo(() => weekDays(dayCursor), [dayCursor]);

  const openPost = useMemo(() => posts.find((p) => p.id === openId) ?? null, [posts, openId]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your calendar…" /></div>;
  }

  const monthLabel = (() => {
    try { return monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }); } catch { return ""; }
  })();

  const weekLabel = (() => {
    const days = weekColumns;
    const a = days[0], b = days[6];
    try {
      const sameMonth = a.getMonth() === b.getMonth();
      const left = a.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const right = b.toLocaleDateString(undefined, sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
      return `${left} – ${right}`;
    } catch { return ""; }
  })();

  const dayLabel = (() => {
    try { return dayCursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }); } catch { return ""; }
  })();

  // Hours rendered in the week/day timelines: DAY_START_HOUR … 23.
  const timelineHours = Array.from({ length: 24 - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
  const stepDays = (n: number) => setDayCursor((d) => { const next = new Date(d); next.setDate(d.getDate() + n); return next; });
  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setDayCursor(d); };
  // Fire the week-planning agent and arm the in-view loader (shared by both empty-state CTAs).
  const planWeek = () => { setArmed(true); onAsk?.("Plan a week of social posts for me — suggest topics and the best times to publish, then schedule them."); };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
          {/* LEFT: sticky controls — schedule, view menu, counts, filters */}
          <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[264px] lg:shrink-0">
            <button onClick={() => onOpenView?.("compose")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <Sparkles className="h-4 w-4" /> Schedule a post
            </button>

            <nav className="rounded-2xl border border-border bg-card p-1.5">
              {([["list", "Upcoming", List], ["day", "Day", CalendarRange], ["week", "Week", Columns3], ["month", "Month", LayoutGrid]] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", view === id ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  <Icon className="h-4 w-4 shrink-0" /> <span className="flex-1 text-start">{label}</span>
                </button>
              ))}
            </nav>

            <div className="grid grid-cols-3 gap-2">
              <Kpi icon={CalendarClock} label="Scheduled" value={counts.scheduled.toLocaleString()} />
              <Kpi icon={CheckCircle2} label="Published" value={counts.published.toLocaleString()} />
              <Kpi icon={FileEdit} label="Drafts" value={counts.drafts.toLocaleString()} />
            </div>

            {(posts.length > 0 || filtersActive) && (
              <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filter</div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search posts…"
                    className="w-full rounded-[10px] border border-input bg-background py-2 pl-9 pr-3 text-[12.5px] outline-none focus:border-brand-500/60"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full rounded-[10px] border border-input bg-background px-2.5 py-2 text-[12.5px] font-medium outline-none focus:border-brand-500/60"
                  aria-label="Filter by status"
                >
                  <option value="ALL">All statuses</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="DRAFT">Drafts</option>
                </select>
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="w-full rounded-[10px] border border-input bg-background px-2.5 py-2 text-[12.5px] font-medium capitalize outline-none focus:border-brand-500/60"
                  aria-label="Filter by channel"
                >
                  <option value="ALL">All channels</option>
                  {platformOptions.map((p) => (
                    <option key={p} value={p}>{prettyPlatform(p)}</option>
                  ))}
                </select>
                {filtersActive && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] text-muted-foreground">{filtered.length} of {posts.length}</span>
                    <button
                      onClick={() => { setQuery(""); setStatusFilter("ALL"); setPlatformFilter("ALL"); }}
                      className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-brand-500/60 hover:text-foreground"
                    >
                      <X className="h-3 w-3" /> Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* RIGHT: the calendar / list — full width */}
          <div className="min-w-0 flex-1 space-y-4">
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
                <span className="ms-auto hidden text-[11px] text-muted-foreground sm:inline">Click a post to open it, or a day to schedule</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="pb-1 text-center text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{w}</div>
                ))}
                {monthCells.map(({ date, inMonth, items }) => {
                  const isToday = sameDay(date, today);
                  return (
                    <div
                      key={dayKey(date)}
                      className={cn(
                        "group min-h-[92px] rounded-[10px] border p-1.5 text-left align-top transition sm:min-h-[108px]",
                        inMonth ? "border-border bg-muted/20 hover:border-brand-500/50 hover:bg-muted/40" : "border-transparent bg-transparent hover:bg-muted/20",
                        isToday && "border-brand-500/60 bg-brand-500/5",
                      )}
                    >
                      <div className="mb-1 flex items-center">
                        <span className={cn("grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[11.5px] font-semibold", inMonth ? (isToday ? "bg-brand-500 text-white" : "text-foreground") : "text-muted-foreground/40")}>{date.getDate()}</span>
                        <button
                          type="button"
                          onClick={() => onOpenView?.("compose")}
                          title={`Schedule a post for ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                          className="ms-auto grid h-4 w-4 place-items-center rounded text-brand-500 opacity-0 transition hover:bg-brand-500/10 group-hover:opacity-100"
                          aria-label="Schedule a post"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {items.slice(0, 3).map((p) => {
                          const meta = statusMeta(p.status);
                          return (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => setOpenId(p.id)}
                              title={p.caption?.trim() || "Post"}
                              className="flex w-full items-center gap-1 truncate rounded-[6px] bg-card px-1 py-0.5 text-left text-[10px] transition hover:bg-brand-500/10"
                            >
                              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                              <span className="truncate text-muted-foreground">{p.caption?.trim() || "Post"}</span>
                            </button>
                          );
                        })}
                        {items.length > 3 && <div className="px-1 text-[10px] font-medium text-muted-foreground">+{items.length - 3} more</div>}
                      </div>
                    </div>
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
                    {onAsk && <button onClick={planWeek} className="font-semibold text-brand-500 hover:underline">plan my week</button>}
                  </span>
                )}
              </div>
            </section>
          ) : view === "week" ? (
            <WeekTimeline
              columns={weekColumns}
              hours={timelineHours}
              placedByDay={placedByDay}
              today={today}
              label={weekLabel}
              onPrev={() => stepDays(-7)}
              onNext={() => stepDays(7)}
              onToday={goToday}
              onOpen={(id) => setOpenId(id)}
              onSchedule={() => onOpenView?.("compose")}
            />
          ) : view === "day" ? (
            <DayTimeline
              day={dayCursor}
              hours={timelineHours}
              items={placedByDay.get(dayKey(dayCursor)) ?? []}
              isToday={sameDay(dayCursor, today)}
              label={dayLabel}
              onPrev={() => stepDays(-1)}
              onNext={() => stepDays(1)}
              onToday={goToday}
              onOpen={(id) => setOpenId(id)}
              onSchedule={() => onOpenView?.("compose")}
            />
          ) : !posts.length && !error ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-border px-4 py-16 text-center">
              <div className="max-w-md">
                {armed && (
                  <div className="mb-5">
                    <AgentWorkingCard working={working} title="Planning your week" sub={working ? "The agent is planning and scheduling your posts — they'll appear here." : "Answer the agent's questions in the chat and your schedule will land here."} />
                  </div>
                )}
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><CalendarDays className="h-7 w-7" /></span>
                <h2 className="mt-3 text-[16px] font-bold">Your calendar is empty</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Schedule your first post and it shows up here by date — so you always know what is going out when.</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button onClick={() => onOpenView?.("compose")} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                    <Sparkles className="h-4 w-4" /> Schedule a post
                  </button>
                  {onAsk && (
                    <button onClick={planWeek} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60 hover:text-foreground">
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
                          {g.items.map((p) => <PostRow key={p.id} post={p} onOpen={() => setOpenId(p.id)} />)}
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
                    {recent.map((p) => <PostRow key={p.id} post={p} onOpen={() => setOpenId(p.id)} />)}
                  </div>
                </section>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      {openPost && (
        <PostDetail
          post={openPost}
          accounts={accounts}
          onClose={() => setOpenId(null)}
          onSaved={async () => { await load(); }}
          onDeleted={async () => { setOpenId(null); await load(); }}
        />
      )}
    </div>
  );
}

function PostRow({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const d = postDate(post);
  const meta = statusMeta(post.status);
  const media = post.mediaUrls?.[0];
  const platforms = post.platforms ?? [];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-left transition hover:border-brand-500/50 hover:bg-muted/50"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-background">
        {media ? <Image src={media} alt="" width={48} height={48} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px]">{post.caption?.trim() || "Untitled post"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1 font-medium", meta.tone)}>
            <meta.Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
          {d && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtTime(d)}</span>
          )}
          {platforms.length > 0 && <span className="capitalize">{platforms.join(" · ")}</span>}
        </div>
      </div>
    </button>
  );
}

// ── View toggle tab ─────────────────────────────────────────────────────────────


// ── Week / Day hour-by-hour timeline ────────────────────────────────────────────

type Placed = { post: Post; date: Date; hour: number };

// Shared prev / today / next control used by the Week and Day timelines.
function TimelineNav({ label, onPrev, onNext, onToday }: { label: string; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h3 className="text-[14px] font-bold">{label}</h3>
      <div className="inline-flex items-center gap-1">
        <button onClick={onPrev} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
        <button onClick={onToday} className="rounded-[8px] border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground">Today</button>
        <button onClick={onNext} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

// A single post chip placed at its hour on the timeline.
function TimelineEvent({ entry, baseHour, compact, onOpen }: { entry: Placed; baseHour: number; compact?: boolean; onOpen: () => void }) {
  const meta = statusMeta(entry.post.status);
  // Clamp to the rendered window so a 3am post still shows pinned at the top.
  const top = Math.max(0, (entry.hour - baseHour) * HOUR_PX);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${fmtTime(entry.date)} · ${entry.post.caption?.trim() || "Post"}`}
      style={{ top }}
      className={cn(
        "absolute left-1 right-1 z-10 flex items-center gap-1 overflow-hidden rounded-[7px] border border-border bg-card px-1.5 py-1 text-left shadow-sm transition hover:border-brand-500/60 hover:bg-brand-500/10",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">{fmtTime(entry.date)}</span>
      {!compact && <span className="truncate text-[11px]">{entry.post.caption?.trim() || "Post"}</span>}
      {compact && <span className="truncate text-[10px] text-muted-foreground">{entry.post.caption?.trim() || "Post"}</span>}
    </button>
  );
}

function WeekTimeline({
  columns, hours, placedByDay, today, label, onPrev, onNext, onToday, onOpen, onSchedule,
}: {
  columns: Date[];
  hours: number[];
  placedByDay: Map<string, Placed[]>;
  today: Date;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpen: (id: string) => void;
  onSchedule: () => void;
}) {
  const baseHour = hours[0];
  const bodyHeight = hours.length * HOUR_PX;
  const total = columns.reduce((n, c) => n + (placedByDay.get(dayKey(c))?.length ?? 0), 0);
  return (
    <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <TimelineNav label={label} onPrev={onPrev} onNext={onNext} onToday={onToday} />
      {/* day headers */}
      <div className="grid" style={{ gridTemplateColumns: `48px repeat(7, minmax(0, 1fr))` }}>
        <div />
        {columns.map((c) => {
          const isToday = sameDay(c, today);
          return (
            <button
              key={dayKey(c)}
              type="button"
              onClick={onSchedule}
              title={`Schedule a post for ${c.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
              className={cn("mb-1 rounded-[8px] px-1 py-1 text-center transition hover:bg-muted/40", isToday && "bg-brand-500/5")}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{shortDay(c)}</div>
              <div className={cn("mx-auto mt-0.5 grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold", isToday ? "bg-brand-500 text-white" : "text-foreground")}>{c.getDate()}</div>
            </button>
          );
        })}
      </div>
      {/* scrollable timeline body */}
      <div className="max-h-[460px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(7, minmax(0, 1fr))` }}>
          {/* hour labels */}
          <div className="relative" style={{ height: bodyHeight }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute right-1 -translate-y-1/2 text-[9.5px] font-medium text-muted-foreground" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : fmtHourLabel(h)}
              </div>
            ))}
          </div>
          {columns.map((c) => {
            const items = (placedByDay.get(dayKey(c)) ?? []).slice().sort((a, b) => a.hour - b.hour);
            const isToday = sameDay(c, today);
            return (
              <div key={dayKey(c)} className={cn("relative border-l border-border", isToday && "bg-brand-500/5")} style={{ height: bodyHeight }}>
                {hours.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/50" style={{ top: i * HOUR_PX, height: HOUR_PX }} />
                ))}
                {items.map((entry) => (
                  <TimelineEvent key={entry.post.id} entry={entry} baseHour={baseHour} compact onOpen={() => onOpen(entry.post.id)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {total === 0 && (
        <p className="mt-3 text-center text-[12px] text-muted-foreground">Nothing on the calendar this week — pick a day header to schedule a post.</p>
      )}
    </section>
  );
}

function DayTimeline({
  day, hours, items, isToday, label, onPrev, onNext, onToday, onOpen, onSchedule,
}: {
  day: Date;
  hours: number[];
  items: Placed[];
  isToday: boolean;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpen: (id: string) => void;
  onSchedule: () => void;
}) {
  const baseHour = hours[0];
  const bodyHeight = hours.length * HOUR_PX;
  const sorted = items.slice().sort((a, b) => a.hour - b.hour);
  return (
    <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className={cn("text-[14px] font-bold", isToday && "text-brand-500")}>{label}</h3>
        <div className="inline-flex items-center gap-1">
          <button onClick={onPrev} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={onToday} className="rounded-[8px] border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground">Today</button>
          <button onClick={onNext} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <button onClick={onSchedule} className="ms-auto inline-flex items-center gap-1.5 rounded-[8px] border border-border px-2.5 py-1 text-[11.5px] font-semibold text-brand-500 hover:bg-brand-500/10" title={`Schedule a post for ${day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}>
          <Plus className="h-3.5 w-3.5" /> Schedule
        </button>
      </div>
      <div className="max-h-[460px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `56px minmax(0, 1fr)` }}>
          <div className="relative" style={{ height: bodyHeight }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : fmtHourLabel(h)}
              </div>
            ))}
          </div>
          <div className="relative border-l border-border" style={{ height: bodyHeight }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute inset-x-0 border-t border-border/50" style={{ top: i * HOUR_PX, height: HOUR_PX }} />
            ))}
            {sorted.map((entry) => (
              <DayTimelineEvent key={entry.post.id} entry={entry} baseHour={baseHour} onOpen={() => onOpen(entry.post.id)} />
            ))}
          </div>
        </div>
      </div>
      {sorted.length === 0 && (
        <p className="mt-3 text-center text-[12px] text-muted-foreground">Nothing scheduled for this day — use Schedule to add a post.</p>
      )}
    </section>
  );
}

// Roomier event chip for the single-day timeline (shows status + channels).
function DayTimelineEvent({ entry, baseHour, onOpen }: { entry: Placed; baseHour: number; onOpen: () => void }) {
  const meta = statusMeta(entry.post.status);
  const top = Math.max(0, (entry.hour - baseHour) * HOUR_PX);
  const media = entry.post.mediaUrls?.[0];
  const platforms = entry.post.platforms ?? [];
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ top }}
      className="absolute left-2 right-2 z-10 flex items-center gap-2 overflow-hidden rounded-[9px] border border-border bg-muted/40 px-2 py-1.5 text-left shadow-sm transition hover:border-brand-500/60 hover:bg-brand-500/10"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-background">
        {media ? <Image src={media} alt="" width={36} height={36} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px]">{entry.post.caption?.trim() || "Untitled post"}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1 font-medium", meta.tone)}><meta.Icon className="h-3 w-3" /> {meta.label}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtTime(entry.date)}</span>
          {platforms.length > 0 && <span className="capitalize">{platforms.join(" · ")}</span>}
        </div>
      </div>
    </button>
  );
}

// ── Post detail / edit / reschedule / delete panel ──────────────────────────────

type DetailMode = "view" | "edit";

function PostDetail({
  post,
  accounts,
  onClose,
  onSaved,
  onDeleted,
}: {
  post: Post;
  accounts: PlatformAcc[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const st = (post.status || "").toUpperCase();
  const meta = statusMeta(post.status);
  const isPublished = st === "PUBLISHED";
  const when = post.scheduledAt || post.publishedAt;

  const [mode, setMode] = useState<DetailMode>("view");
  const [caption, setCaption] = useState(post.caption ?? "");
  const [media, setMedia] = useState<string[]>(post.mediaUrls ?? []);
  const [platforms, setPlatforms] = useState<string[]>(post.platforms?.length ? post.platforms : ["feed"]);
  const [scheduleAt, setScheduleAt] = useState(() => toLocalInput(post.scheduledAt));

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Cross-post (retry) state — the per-platform results returned by the retry endpoint,
  // plus the set of external platforms the user picked to re-publish.
  const [retryResults, setRetryResults] = useState<Record<string, PublishResult> | null>(null);
  const [retryTargets, setRetryTargets] = useState<string[]>([]);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryNotice, setRetryNotice] = useState("");

  // External (non-feed) channels this post targets — the only ones a retry can re-publish to.
  const externalChannels = useMemo(
    () => Array.from(new Set((post.platforms ?? []).filter(isExternalPlatform))),
    [post.platforms],
  );

  // Reset local state whenever the underlying post changes (re-fetch after a save).
  useEffect(() => {
    setCaption(post.caption ?? "");
    setMedia(post.mediaUrls ?? []);
    setPlatforms(post.platforms?.length ? post.platforms : ["feed"]);
    setScheduleAt(toLocalInput(post.scheduledAt));
    setRetryResults(null);
    setRetryTargets([]);
    setRetryNotice("");
  }, [post.id, post.caption, post.mediaUrls, post.platforms, post.scheduledAt]);

  const targets = useMemo(() => {
    const connected = accounts.filter((a) => a.connected || (a.connectedCount ?? 0) > 0);
    return [
      { id: "feed", label: "In-app feed", feed: true as const, username: null as string | null, avatarUrl: null as string | null },
      ...connected.map((a) => ({ id: a.platform, label: a.name || a.platform, feed: false as const, username: a.username ?? null, avatarUrl: a.avatarUrl ?? null })),
    ];
  }, [accounts]);

  const chars = caption.length;
  const over = chars > CAPTION_MAX;
  const mediaGallery = post.mediaUrls ?? [];

  const patch = useCallback(async (body: Record<string, unknown>, fail: string): Promise<boolean> => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/content/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        await onSaved();
        return true;
      }
      setErr(j?.error?.message || fail);
      return false;
    } catch {
      setErr(fail);
      return false;
    } finally {
      setBusy(false);
    }
  }, [post.id, onSaved]);

  const saveEdits = async () => {
    const text = caption.trim();
    if (!text) { setErr("Write a caption first."); return; }
    if (over) { setErr("That caption is too long."); return; }
    if (!platforms.length) { setErr("Pick at least one place to post — the in-app feed is always available."); return; }
    const body: Record<string, unknown> = { caption: text, platforms };
    body.mediaUrls = media;
    if (media.length) body.mediaType = isVideoUrl(media[0]) ? "video" : "image";
    const ok = await patch(body, "Couldn't save your changes. Try again.");
    if (ok) setMode("view");
  };

  const reschedule = async () => {
    if (!scheduleAt) { setErr("Pick a date and time to schedule for."); return; }
    const d = new Date(scheduleAt);
    if (isNaN(d.getTime())) { setErr("That schedule time isn't valid."); return; }
    if (d.getTime() <= Date.now()) { setErr("Pick a time in the future."); return; }
    await patch({ scheduledAt: d.toISOString(), status: "SCHEDULED" }, "Couldn't reschedule that post. Try again.");
  };

  const toggleRetryTarget = (id: string) => {
    setRetryNotice("");
    setRetryTargets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // POST /api/content/posts/[id]/retry — re-publish to the chosen external platforms.
  // The endpoint returns fresh per-platform results, which we render below.
  const runRetry = async () => {
    if (retryTargets.length === 0) { setErr("Pick at least one channel to re-publish to."); return; }
    setRetryBusy(true); setErr(""); setRetryNotice("");
    try {
      const r = await fetch(`/api/content/posts/${post.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: retryTargets }),
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        const results = (j.data?.publishResults ?? {}) as Record<string, PublishResult>;
        setRetryResults(results);
        const ok = Object.values(results).filter((res) => res?.success).length;
        const total = Object.keys(results).length;
        setRetryNotice(total ? `Re-published to ${total} channel${total === 1 ? "" : "s"} — ${ok} succeeded.` : "Retry complete.");
        await onSaved();
      } else {
        setErr(j?.error?.message || "Couldn't re-publish that post. Try again.");
      }
    } catch {
      setErr("Couldn't re-publish that post. Try again.");
    } finally {
      setRetryBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/content/posts/${post.id}`, { method: "DELETE" });
      const j = await r.json();
      if (r.ok && j?.success) {
        await onDeleted();
        return;
      }
      setErr(j?.error?.message || "Couldn't delete that post. Try again.");
      setConfirmDelete(false);
    } catch {
      setErr("Couldn't delete that post. Try again.");
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  const togglePlatform = (id: string) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-foreground/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-[11.5px] font-semibold", meta.tone)}>
            <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
          </span>
          <h3 className="truncate text-[13px] font-bold">{mode === "edit" ? "Edit post" : "Post details"}</h3>
          <button onClick={onClose} className="ms-auto grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {mode === "view" ? (
            <>
              {/* media gallery */}
              {mediaGallery.length > 0 && (
                <div className={cn("grid gap-2", mediaGallery.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                  {mediaGallery.map((url, i) => (
                    <div key={`${url}-${i}`} className="relative overflow-hidden rounded-[10px] border border-border bg-background">
                      {isVideoUrl(url) ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={url} controls playsInline preload="metadata" className="aspect-square w-full bg-black object-contain" />
                      ) : (
                        <Image src={url} alt={`Media ${i + 1}`} width={400} height={400} className="aspect-square w-full object-cover" unoptimized />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* caption */}
              <div className="rounded-[10px] border border-border bg-muted/30 px-3.5 py-3">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{post.caption?.trim() || <span className="text-muted-foreground">No caption</span>}</p>
              </div>

              {/* meta rows */}
              <dl className="space-y-2 text-[12.5px]">
                <DetailRow icon={meta.Icon} label="Status" iconTone={meta.tone}>{meta.label}</DetailRow>
                {when && (
                  <DetailRow icon={isPublished ? CheckCircle2 : CalendarClock} label={isPublished ? "Published" : "Scheduled"}>
                    {fmtDateTime(when)}
                  </DetailRow>
                )}
                <DetailRow icon={Plug} label="Channels">
                  <span className="capitalize">{(post.platforms?.length ? post.platforms : ["feed"]).map((p) => (p === "feed" ? "in-app feed" : p)).join(" · ")}</span>
                </DetailRow>
              </dl>

              {/* engagement (published) */}
              {isPublished && (
                <div className="grid grid-cols-4 gap-2">
                  <Stat icon={Eye} label="Views" value={post.viewCount ?? 0} />
                  <Stat icon={Heart} label="Likes" value={post.likeCount ?? 0} />
                  <Stat icon={MessageCircle} label="Comments" value={post.commentCount ?? 0} />
                  <Stat icon={Share2} label="Shares" value={post.shareCount ?? 0} />
                </div>
              )}

              {/* per-platform publish results + retry (published posts with external channels) */}
              {isPublished && externalChannels.length > 0 && (
                <div className="rounded-[10px] border border-border bg-muted/30 p-3.5">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground"><Send className="h-3.5 w-3.5" /> Cross-post results</span>
                  <p className="mb-2.5 text-[11.5px] text-muted-foreground">Pick the channels that failed (or that you want to push again) and re-publish. Results show per channel below.</p>

                  {/* channel chips — selectable retry targets, annotated with the last result */}
                  <div className="flex flex-wrap gap-1.5">
                    {externalChannels.map((p) => {
                      const res = retryResults?.[p];
                      const on = retryTargets.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => toggleRetryTarget(p)}
                          aria-pressed={on}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium capitalize transition",
                            on ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-card text-foreground hover:border-brand-500/40",
                          )}
                        >
                          {res?.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : res ? <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> : null}
                          {prettyPlatform(p)}
                        </button>
                      );
                    })}
                  </div>

                  {/* per-platform results from the last retry */}
                  {retryResults && Object.keys(retryResults).length > 0 && (
                    <div className="mt-2.5 space-y-1.5 rounded-[10px] border border-border bg-card p-2.5">
                      {Object.entries(retryResults).map(([p, res]) => (
                        <div key={p} className="flex items-start gap-2 text-[12px]">
                          {res?.success
                            ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />}
                          <span className="shrink-0 font-medium capitalize">{prettyPlatform(p)}</span>
                          <span className={cn("min-w-0 flex-1", res?.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
                            {res?.success ? "Posted" : (res?.error || "Failed")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {retryNotice && (
                    <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> {retryNotice}</p>
                  )}

                  <button
                    onClick={runRetry}
                    disabled={retryBusy}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60"
                  >
                    {retryBusy ? <FlowLoader size={14} tone="white" /> : retryResults ? <RotateCcw className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {retryResults ? "Retry again" : "Retry publish"}
                  </button>
                </div>
              )}

              {/* reschedule (drafts + scheduled — not for already-published) */}
              {!isPublished && (
                <div className="rounded-[10px] border border-border bg-muted/30 p-3.5">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> Reschedule</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="datetime-local" value={scheduleAt} onChange={(e) => { setScheduleAt(e.target.value); setErr(""); }} className={cn(FIELD, "flex-1 sm:max-w-[240px]")} />
                    <button onClick={reschedule} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                      {busy ? <FlowLoader size={14} tone="white" /> : <CalendarClock className="h-3.5 w-3.5" />} Set time
                    </button>
                  </div>
                </div>
              )}

              {err && <p className="flex items-center gap-1.5 text-[12px] text-rose-500"><AlertTriangle className="h-3.5 w-3.5" /> {err}</p>}
            </>
          ) : (
            /* ── edit form ── */
            <>
              {/* caption */}
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11.5px] font-medium text-muted-foreground">Caption</span>
                  <span className={cn("text-[11px] tabular-nums", over ? "font-semibold text-rose-500" : "text-muted-foreground")}>{chars.toLocaleString()} / {CAPTION_MAX.toLocaleString()}</span>
                </span>
                <textarea
                  rows={5}
                  value={caption}
                  onChange={(e) => { setCaption(e.target.value); setErr(""); }}
                  placeholder="What do you want to say? #hashtags and @mentions are picked up automatically."
                  className={cn(FIELD, "resize-y leading-relaxed")}
                />
              </label>

              {/* platforms */}
              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground"><Plug className="h-3.5 w-3.5" /> Post to</span>
                <div className="flex flex-wrap gap-2">
                  {targets.map((t) => {
                    const on = platforms.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { togglePlatform(t.id); setErr(""); }}
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
                        {on && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* media */}
              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Media <span className="font-normal">(optional)</span></span>
                <MediaUploader
                  value={media}
                  onChange={(urls) => { setMedia(urls); setErr(""); }}
                  multiple
                  maxFiles={4}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime"
                  filterTypes={["image", "video"]}
                  variant="gallery"
                  placeholder="Upload or pick from your library"
                  libraryTitle="Your media library"
                />
              </div>

              {err && <p className="flex items-center gap-1.5 text-[12px] text-rose-500"><AlertTriangle className="h-3.5 w-3.5" /> {err}</p>}
            </>
          )}
        </div>

        {/* footer actions */}
        <div className="border-t border-border px-4 py-3">
          {confirmDelete ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-rose-500/30 bg-rose-500/5 p-3">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-500"><AlertTriangle className="h-4 w-4" /> Delete this post permanently?</p>
              <p className="text-[11.5px] text-muted-foreground">This removes it from your calendar and can&apos;t be undone.</p>
              <div className="flex items-center gap-2">
                <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                  {busy ? <FlowLoader size={14} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                </button>
                <button onClick={() => setConfirmDelete(false)} disabled={busy} className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60">Keep</button>
              </div>
            </div>
          ) : mode === "edit" ? (
            <div className="flex items-center gap-2">
              <button onClick={saveEdits} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60">
                {busy ? <FlowLoader size={15} tone="white" /> : <Save className="h-4 w-4" />} Save changes
              </button>
              <button onClick={() => { setMode("view"); setErr(""); setCaption(post.caption ?? ""); setMedia(post.mediaUrls ?? []); setPlatforms(post.platforms?.length ? post.platforms : ["feed"]); }} disabled={busy} className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => { setMode("edit"); setErr(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button onClick={() => { setConfirmDelete(true); setErr(""); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/40 px-3.5 py-2 text-[12.5px] font-semibold text-rose-500 hover:bg-rose-500/10">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, iconTone, children }: { icon: ElementType; label: string; iconTone?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className={cn("h-4 w-4 shrink-0 text-muted-foreground", iconTone)} />
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">{children}</dd>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: ElementType; label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-border bg-muted/30 p-2.5 text-center">
      <Icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
      <p className="mt-1 text-[15px] font-extrabold leading-none tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
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
