"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import {
  Star, MessageSquare, Reply, Gauge, MapPin, ExternalLink, Sparkles, ListChecks,
  ShieldCheck, ThumbsUp, ThumbsDown, Minus, Search, ChevronLeft, ChevronRight,
  CheckCircle2, AlertTriangle, Clock, HelpCircle, Send, X, Flag, Archive, Wand2,
  Filter, BadgeCheck, ListTree,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Reviews & local SEO — the deep new-design ListSmartly surface (the Reviews
 * workspace canvas). When the user has NO presence yet, it shows the generative
 * "Set up my presence" CTA (heavy build → the agent runs it via onAsk). Once set
 * up it becomes a full workspace, all real in-surface UI (no legacy links):
 *   • Local-SEO health score + KPI summary (/analytics).
 *   • A browsable directory LISTINGS list — per-directory status badge grouped by
 *     workflow state + tier, NAP correctness, with search + status + tier filters
 *     and pagination (/listings).
 *   • A REVIEWS list with platform / sentiment / responded filters and an
 *     in-surface Reply action (AI-draft → edit → post), plus flag / archive
 *     (/reviews + /reviews/[id]/reply + PUT /reviews/[id]).
 * Generative setup + "request reviews" drive the agent via onAsk; everything
 * else is direct UI. [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]]
 */

interface Analytics {
  scores?: { citationScore?: number; coverageScore?: number; consistencyScore?: number; reviewScore?: number };
  listings?: { total?: number; statusCounts?: Record<string, number> };
  reviews?: {
    total?: number; averageRating?: number; responseRate?: number;
    sentimentCounts?: Record<string, number>; byPlatform?: Record<string, number>;
  };
}
interface Listing {
  id: string;
  status: string;
  directoryName: string;
  directoryUrl?: string | null;
  listingUrl?: string | null;
  submitUrl?: string | null;
  claimUrl?: string | null;
  tier: number;
  isConsistent?: boolean;
  inconsistencies?: string[];
  lastChecked?: string | null;
}
interface Review {
  id: string;
  platform: string;
  authorName?: string;
  rating: number;
  text?: string | null;
  sentiment?: string | null;
  reviewUrl?: string | null;
  hasResponse?: boolean;
  responseText?: string | null;
  responseStatus?: string | null;
  isFlagged?: boolean;
  createdAt: string;
}
interface Profile { businessName?: string | null; city?: string | null; state?: string | null; setupComplete?: boolean }
interface Pagination { page: number; limit: number; total: number; totalPages: number }

// "live"-ish listing statuses that count as a real presence on a directory.
const LIVE_STATUSES = ["live", "submitted", "claimed", "verified"];
const LISTINGS_PER_PAGE = 30;

const TIER_NAMES: Record<number, string> = {
  1: "Critical", 2: "Major", 3: "Industry", 4: "Reviews", 5: "Maps", 6: "Social", 7: "Local",
};

// Workflow buckets the listing rows group into (order = display order).
const WORKFLOW_GROUPS: { key: string; label: string; statuses: string[]; tone: string }[] = [
  { key: "live", label: "Live & submitted", statuses: ["live", "submitted", "claimed", "verified"], tone: "text-emerald-500" },
  { key: "action", label: "Needs action", statuses: ["missing", "needs_update"], tone: "text-amber-500" },
  { key: "unscanned", label: "Not scanned yet", statuses: ["unverified"], tone: "text-muted-foreground" },
  { key: "error", label: "Errors", statuses: ["error"], tone: "text-rose-500" },
];

const STATUS_META: Record<string, { label: string; tone: string; icon: ElementType }> = {
  live: { label: "Live", tone: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  claimed: { label: "Claimed", tone: "bg-emerald-500/10 text-emerald-500", icon: BadgeCheck },
  verified: { label: "Verified", tone: "bg-emerald-500/10 text-emerald-500", icon: ShieldCheck },
  submitted: { label: "Submitted", tone: "bg-sky-500/10 text-sky-500", icon: Send },
  needs_update: { label: "Needs update", tone: "bg-amber-500/10 text-amber-500", icon: AlertTriangle },
  missing: { label: "Missing", tone: "bg-amber-500/10 text-amber-500", icon: AlertTriangle },
  unverified: { label: "Not scanned", tone: "bg-muted text-muted-foreground", icon: HelpCircle },
  error: { label: "Error", tone: "bg-rose-500/10 text-rose-500", icon: AlertTriangle },
};

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "live", label: "Live" },
  { value: "submitted", label: "Submitted" },
  { value: "missing", label: "Missing" },
  { value: "needs_update", label: "Needs update" },
  { value: "unverified", label: "Not scanned" },
  { value: "error", label: "Errors" },
];

const SENTIMENT_META: Record<string, { icon: ElementType; tone: string }> = {
  positive: { icon: ThumbsUp, tone: "text-emerald-500" },
  negative: { icon: ThumbsDown, tone: "text-rose-500" },
  neutral: { icon: Minus, tone: "text-muted-foreground" },
};

function whenLabel(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}
function platformLabel(p: string): string {
  return p ? p.charAt(0).toUpperCase() + p.slice(1).replace(/[_-]/g, " ") : "Review";
}
function statusGroupKey(status: string): string {
  return WORKFLOW_GROUPS.find((g) => g.statuses.includes(status))?.key ?? "unscanned";
}

const SELECT = "rounded-[9px] border border-input bg-background px-2.5 py-1.5 text-[12px] font-medium outline-none focus:border-brand-500/60";

type Tab = "listings" | "reviews";

export function FocusedReviews({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("listings");

  const load = useCallback(async () => {
    const pj = await fetch("/api/listsmartly/profile").then((r) => r.json()).catch(() => null);
    const prof = pj?.success ? pj?.data?.profile : null;
    setHasProfile(!!prof);
    setProfile(prof);
    if (prof) {
      const aj = await fetch("/api/listsmartly/analytics").then((r) => r.json()).catch(() => null);
      if (aj?.success && aj.data) setAnalytics(aj.data as Analytics);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your reviews…" /></div>;
  }

  // No ListSmartly profile yet → setting up the presence is a heavy generative
  // build, so the agent runs it (gated empty state).
  if (!hasProfile) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Star className="h-8 w-8" /></span>
          <h2 className="mt-4 text-[20px] font-extrabold">Get found everywhere</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">Tell the agent about your business and it builds your local presence — listings across the top directories, review tracking, and a local-SEO health score.</p>
          {onAsk && (
            <button onClick={() => onAsk("Set up my business listings and local SEO presence — get me listed on the top directories and start tracking my reviews.")} className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <Sparkles className="h-4 w-4" /> Set up my presence
            </button>
          )}
        </div>
      </div>
    );
  }

  const a = analytics;
  const rating = a?.reviews?.averageRating ?? 0;
  const totalReviews = a?.reviews?.total ?? 0;
  const responseRate = a?.reviews?.responseRate ?? 0;
  const statusCounts = a?.listings?.statusCounts ?? {};
  const totalListings = a?.listings?.total ?? 0;
  const liveListings = Object.entries(statusCounts).reduce((sum, [s, n]) => sum + (LIVE_STATUSES.includes(s) ? n : 0), 0);
  const citation = a?.scores?.citationScore ?? 0;
  const location = [profile?.city, profile?.state].filter(Boolean).join(", ");

  const seoBars: { label: string; value: number }[] = [
    { label: "Coverage", value: a?.scores?.coverageScore ?? 0 },
    { label: "Consistency", value: a?.scores?.consistencyScore ?? 0 },
    { label: "Reviews", value: a?.scores?.reviewScore ?? 0 },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* business / presence header + KPIs */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><MapPin className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[16px] font-bold">{profile?.businessName || "Your business"}</h2>
                <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", liveListings > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{liveListings > 0 ? `${liveListings} live` : "Setting up"}</span>
              </div>
              <p className="truncate text-[12px] text-muted-foreground">{location ? `${location} · ` : ""}{totalListings} {totalListings === 1 ? "directory" : "directories"}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={Gauge} label="SEO score" value={citation ? `${citation}` : "—"} />
            <Kpi icon={Star} label="Avg rating" value={rating ? rating.toFixed(1) : "—"} />
            <Kpi icon={MessageSquare} label="Reviews" value={totalReviews.toLocaleString()} />
            <Kpi icon={Reply} label="Response rate" value={`${responseRate}%`} />
          </div>
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center gap-2"><ListChecks className="h-3.5 w-3.5 text-brand-500" /><span className="text-[12px] font-semibold">Local SEO health</span></div>
            {seoBars.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[12px] font-medium text-muted-foreground">{b.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${Math.max(2, Math.min(100, b.value))}%` }} />
                </div>
                <span className="w-10 shrink-0 text-end text-[12px] font-semibold tabular-nums">{Math.round(b.value)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* tabs */}
        <div className="flex gap-1.5">
          {([["listings", "Listings", ListTree], ["reviews", "Reviews", MessageSquare]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                tab === id ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === "listings" ? (
          <ListingsPanel onAsk={onAsk} refreshKey={refreshKey} />
        ) : (
          <ReviewsPanel onAsk={onAsk} refreshKey={refreshKey} onChanged={load} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Listings panel ------------------------------ */

function ListingsPanel({ onAsk, refreshKey }: { onAsk?: (p: string) => void; refreshKey?: number }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the search box.
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, status, tier]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LISTINGS_PER_PAGE) });
    if (status) params.set("status", status);
    if (tier) params.set("tier", tier);
    if (debounced) params.set("search", debounced);
    const j = await fetch(`/api/listsmartly/listings?${params}`).then((r) => r.json()).catch(() => null);
    if (j?.success && j.data) {
      setListings(Array.isArray(j.data.listings) ? (j.data.listings as Listing[]) : []);
      setPagination(j.data.pagination ?? null);
    } else {
      setListings([]); setPagination(null);
    }
    setLoading(false);
  }, [page, status, tier, debounced]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Group the current page by workflow state, then by tier within each group.
  const grouped = useMemo(() => {
    const out: Record<string, Record<number, Listing[]>> = {};
    for (const l of listings) {
      const gk = statusGroupKey(l.status);
      (out[gk] ??= {});
      (out[gk][l.tier] ??= []).push(l);
    }
    return out;
  }, [listings]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-bold">Directory listings</h3>
        {onAsk && (
          <button onClick={() => onAsk("Scan my business across the directories and fix any missing or inconsistent listings.")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
            <Wand2 className="h-3.5 w-3.5" /> Scan &amp; fix
          </button>
        )}
      </div>

      {/* filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search directories…"
            className="w-full rounded-[9px] border border-input bg-background py-1.5 pl-8 pr-3 text-[12.5px] outline-none focus:border-brand-500/60"
          />
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Filter className="h-3 w-3" /></span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT} aria-label="Filter by status">
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value)} className={SELECT} aria-label="Filter by tier">
          <option value="">All tiers</option>
          {[1, 2, 3, 4, 5, 6, 7].map((t) => <option key={t} value={t}>Tier {t} · {TIER_NAMES[t]}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid place-items-center py-10"><FlowLoader size={24} label="Loading listings…" /></div>
      ) : listings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-[13px] font-medium">No directories match</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {WORKFLOW_GROUPS.filter((g) => grouped[g.key]).map((g) => {
            const byTier = grouped[g.key];
            const count = Object.values(byTier).reduce((n, arr) => n + arr.length, 0);
            return (
              <div key={g.key}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={cn("text-[11.5px] font-bold uppercase tracking-wide", g.tone)}>{g.label}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{count}</span>
                </div>
                {Object.keys(byTier).map(Number).sort((x, y) => x - y).map((t) => (
                  <div key={t} className="mb-2 last:mb-0">
                    <p className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground/70">Tier {t} · {TIER_NAMES[t] ?? "Other"}</p>
                    <div className="space-y-1.5">
                      {byTier[t].map((l) => <ListingRow key={l.id} listing={l} />)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11.5px] text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} directories
          </span>
          <div className="flex gap-1.5">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-40 hover:border-brand-500/60">
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-40 hover:border-brand-500/60">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

    </section>
  );
}

function ListingRow({ listing }: { listing: Listing }) {
  const meta = STATUS_META[listing.status] ?? STATUS_META.unverified;
  const StatusIcon = meta.icon;
  const isLive = LIVE_STATUSES.includes(listing.status);
  const napIssues = listing.inconsistencies?.length ?? 0;
  const href = listing.listingUrl || listing.directoryUrl || listing.submitUrl || listing.claimUrl || null;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <span className="truncate text-[12.5px] font-semibold">{listing.directoryName}</span>
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.tone)}>
        <StatusIcon className="h-3 w-3" /> {meta.label}
      </span>
      {isLive && (napIssues > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500" title={listing.inconsistencies?.join(", ")}>
          <AlertTriangle className="h-3 w-3" /> NAP: {napIssues} {napIssues === 1 ? "issue" : "issues"}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
          <CheckCircle2 className="h-3 w-3" /> NAP OK
        </span>
      ))}
      {listing.lastChecked && (
        <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground"><Clock className="h-3 w-3" /> {whenLabel(listing.lastChecked)}</span>
      )}
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          <ExternalLink className="h-3 w-3" /> {isLive ? "View" : "Open"}
        </a>
      )}
    </div>
  );
}

/* ------------------------------- Reviews panel ------------------------------- */

function ReviewsPanel({ onAsk, refreshKey, onChanged }: { onAsk?: (p: string) => void; refreshKey?: number; onChanged: () => void }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [responded, setResponded] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");

  useEffect(() => { setPage(1); }, [platform, sentiment, responded]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (platform !== "all") params.set("platform", platform);
    if (sentiment !== "all") params.set("sentiment", sentiment);
    if (responded) params.set("responded", responded);
    const j = await fetch(`/api/listsmartly/reviews?${params}`).then((r) => r.json()).catch(() => null);
    if (j?.success && j.data) {
      setReviews(Array.isArray(j.data.reviews) ? (j.data.reviews as Review[]) : []);
      setPagination(j.data.pagination ?? null);
    } else {
      setReviews([]); setPagination(null);
    }
    setLoading(false);
  }, [page, platform, sentiment, responded]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Build platform filter options from the data we have (plus common ones).
  const platforms = useMemo(() => {
    const set = new Set<string>(["google", "yelp", "facebook"]);
    reviews.forEach((r) => r.platform && set.add(r.platform));
    return Array.from(set);
  }, [reviews]);

  // Patch one review in place after a reply/flag/archive without a full reload.
  const patchReview = useCallback((id: string, patch: Partial<Review>) => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const afterChange = useCallback((msg: string) => { setNotice(msg); onChanged(); }, [onChanged]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-bold">Reviews</h3>
        {onAsk && (
          <button onClick={() => onAsk("Run a campaign to request more reviews from my happy customers across email and SMS.")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
            <Star className="h-3.5 w-3.5" /> Request reviews
          </button>
        )}
      </div>

      {/* filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={SELECT} aria-label="Filter by platform">
          <option value="all">All platforms</option>
          {platforms.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
        </select>
        <select value={sentiment} onChange={(e) => setSentiment(e.target.value)} className={SELECT} aria-label="Filter by sentiment">
          <option value="all">All sentiment</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
        <select value={responded} onChange={(e) => setResponded(e.target.value)} className={SELECT} aria-label="Filter by response">
          <option value="">All</option>
          <option value="false">Unreplied</option>
          <option value="true">Replied</option>
        </select>
      </div>

      {notice && (
        <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2 text-[12px] text-emerald-600 dark:text-emerald-400">{notice}</p>
      )}

      {loading ? (
        <div className="grid place-items-center py-10"><FlowLoader size={24} label="Loading reviews…" /></div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-[13px] font-medium">No reviews here</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Adjust the filters, or ask the agent to run a review-request campaign to get the first ones.</p>
          {onAsk && (
            <button onClick={() => onAsk("Run a campaign to request reviews from my recent customers.")} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Star className="h-4 w-4" /> Request reviews</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((rv) => <ReviewCard key={rv.id} review={rv} onPatch={patchReview} onChanged={afterChange} />)}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11.5px] text-muted-foreground">Page {pagination.page} of {pagination.totalPages} · {pagination.total} reviews</span>
          <div className="flex gap-1.5">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-40 hover:border-brand-500/60">
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-40 hover:border-brand-500/60">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewCard({ review, onPatch, onChanged }: { review: Review; onPatch: (id: string, p: Partial<Review>) => void; onChanged: (msg: string) => void }) {
  const sm = SENTIMENT_META[(review.sentiment || "").toLowerCase()];
  const replied = review.hasResponse || review.responseStatus === "posted";
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState<"flag" | "archive" | null>(null);
  const [error, setError] = useState("");

  const openReply = () => { setDraft(review.responseText || ""); setError(""); setReplying(true); };

  const aiDraft = async () => {
    setDrafting(true); setError("");
    try {
      const r = await fetch(`/api/listsmartly/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "draft" }),
      });
      const j = await r.json();
      if (r.ok && j?.success && j.data?.response) setDraft(j.data.response);
      else setError(j?.error?.message || (r.status === 402 ? "Not enough credits to draft a reply." : "Could not draft a reply."));
    } catch {
      setError("Could not draft a reply.");
    } finally {
      setDrafting(false);
    }
  };

  const post = async () => {
    const text = draft.trim();
    if (!text) { setError("Write a reply first, or draft one with AI."); return; }
    setPosting(true); setError("");
    try {
      const r = await fetch(`/api/listsmartly/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "post", text }),
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        onPatch(review.id, { hasResponse: true, responseStatus: "posted", responseText: text });
        setReplying(false);
        onChanged(`Reply posted to ${review.authorName || "the reviewer"}.`);
      } else {
        setError(j?.error?.message || "Could not post the reply.");
      }
    } catch {
      setError("Could not post the reply.");
    } finally {
      setPosting(false);
    }
  };

  const moderate = async (which: "flag" | "archive") => {
    setBusy(which); setError("");
    try {
      const r = await fetch(`/api/listsmartly/reviews/${review.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(which === "flag" ? { isFlagged: !review.isFlagged } : { isArchived: true }),
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        if (which === "flag") {
          onPatch(review.id, { isFlagged: !review.isFlagged });
          onChanged(!review.isFlagged ? "Review flagged." : "Flag removed.");
        } else {
          onChanged("Review archived.");
        }
      } else {
        setError(j?.error?.message || "Could not update the review.");
      }
    } catch {
      setError("Could not update the review.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-[12.5px] font-semibold">{review.authorName || "Anonymous"}</span>
        <Stars rating={review.rating} />
        <span className="text-[11px] text-muted-foreground">{platformLabel(review.platform)}{review.createdAt ? ` · ${whenLabel(review.createdAt)}` : ""}</span>
        {sm ? <span className={cn("inline-flex items-center", sm.tone)}><sm.icon className="h-3 w-3" /></span> : null}
        {review.isFlagged && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500"><Flag className="h-3 w-3" /> flagged</span>}
        {replied && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500"><Reply className="h-3 w-3" /> replied</span>}
        {review.reviewUrl && (
          <a href={review.reviewUrl} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3 w-3" /> View
          </a>
        )}
      </div>
      {review.text && <p className="mt-1.5 line-clamp-4 text-[12.5px] leading-snug text-muted-foreground">{review.text}</p>}

      {/* posted reply preview */}
      {replied && review.responseText && !replying && (
        <div className="mt-2 rounded-lg border border-border bg-background px-3 py-2">
          <p className="mb-0.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-500"><Reply className="h-3 w-3" /> Your reply</p>
          <p className="text-[12px] leading-snug text-muted-foreground">{review.responseText}</p>
        </div>
      )}

      {/* action row */}
      {!replying ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button onClick={openReply} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
            <Reply className="h-3.5 w-3.5" /> {replied ? "Edit reply" : "Reply"}
          </button>
          <button onClick={() => moderate("flag")} disabled={busy === "flag"} className={cn("inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11.5px] font-semibold disabled:opacity-60", review.isFlagged ? "border-amber-500/50 text-amber-500" : "border-border hover:border-amber-500/60 hover:text-amber-500")}>
            {busy === "flag" ? <FlowLoader size={13} /> : <Flag className="h-3.5 w-3.5" />} {review.isFlagged ? "Unflag" : "Flag"}
          </button>
          <button onClick={() => moderate("archive")} disabled={busy === "archive"} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:border-rose-500/60 hover:text-rose-500 disabled:opacity-60">
            {busy === "archive" ? <FlowLoader size={13} /> : <Archive className="h-3.5 w-3.5" />} Archive
          </button>
          {error && <span className="text-[11.5px] text-rose-500">{error}</span>}
        </div>
      ) : (
        <div className="mt-2 rounded-lg border border-brand-500/30 bg-brand-500/5 p-2.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Write a reply, or let AI draft one…"
            className="w-full resize-y rounded-[9px] border border-input bg-background px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-500/60"
          />
          {error && <p className="mt-1.5 text-[11.5px] text-rose-500">{error}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button onClick={aiDraft} disabled={drafting} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
              {drafting ? <FlowLoader size={13} /> : <Sparkles className="h-3.5 w-3.5" />} AI draft
            </button>
            <button onClick={post} disabled={posting} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm disabled:opacity-60">
              {posting ? <FlowLoader size={13} tone="white" /> : <Send className="h-3.5 w-3.5" />} Post reply
            </button>
            <button onClick={() => { setReplying(false); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- shared ----------------------------------- */

function Stars({ rating }: { rating: number }) {
  const r = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-3 w-3", i <= r ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[11px] font-medium">{label}</span></div>
      <p className="mt-1 text-[18px] font-extrabold leading-none">{value}</p>
    </div>
  );
}
