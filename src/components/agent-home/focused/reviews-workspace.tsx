"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import {
  Star, MessageSquare, Reply, Gauge, MapPin, ExternalLink, Sparkles, ListChecks,
  ShieldCheck, ThumbsUp, ThumbsDown, Minus, Search, ChevronLeft, ChevronRight,
  CheckCircle2, AlertTriangle, Clock, HelpCircle, Send, X, Flag, Archive, Wand2,
  Filter, BadgeCheck, ListTree, RefreshCw, Pencil, Building2, Save, Layers,
  TrendingUp, Lightbulb, Zap, Globe, Inbox, ArrowRight, Coins, BarChart3,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Reviews & local SEO — the deep new-design ListSmartly surface (the Reviews
 * workspace canvas). When the user has NO presence yet, it shows a real in-surface
 * SETUP FORM (business profile + transparent charges → activates directly via
 * POST /activate + PUT /profile — it does NOT fire a chat prompt at the agent).
 * Once set up it's a full workspace, all real in-surface UI (no legacy links):
 *   • A circular local-SEO health gauge + KPI summary + per-tier coverage, with a
 *     priority-actions banner when directories need work (/analytics).
 *   • A browsable directory LISTINGS list — per-directory status badge grouped by
 *     workflow state + tier, NAP correctness, search + status + tier filters,
 *     pagination, an in-surface directory SCAN and a direct AI AUTO-FIX (/listings).
 *   • A REVIEWS list with platform / sentiment / responded filters and an
 *     in-surface Reply action (AI-draft → edit → post), plus flag / archive
 *     (/reviews + /reviews/[id]/reply + PUT /reviews/[id]).
 *   • An INSIGHTS tab — sentiment + platform breakdown, monthly trend, and a
 *     direct one-click AI presence report with recommendations (/ai/presence-report).
 * Every button is a direct UI action; only the genuinely-generative "Request
 * reviews" campaign drives the agent (the user explicitly asks for it).
 * [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]]
 */

interface TierCoverage { tier: number; live: number; total: number; percentage: number }
interface Analytics {
  scores?: { citationScore?: number; coverageScore?: number; consistencyScore?: number; reviewScore?: number };
  listings?: { total?: number; statusCounts?: Record<string, number> };
  listingsByTier?: TierCoverage[];
  reviews?: {
    total?: number; averageRating?: number; responseRate?: number;
    sentimentCounts?: Record<string, number>; byPlatform?: Record<string, number>;
    monthlyTrend?: Record<string, number>;
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
interface ProfileHours { monFri?: string; sat?: string; sun?: string }
interface ProfileSocial { facebook?: string; instagram?: string; twitter?: string; linkedin?: string }
interface Profile {
  businessName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  industry?: string | null;
  description?: string | null;
  hours?: ProfileHours | null;
  socialLinks?: ProfileSocial | null;
  setupComplete?: boolean;
}
interface Pagination { page: number; limit: number; total: number; totalPages: number }

// "live"-ish listing statuses that count as a real presence on a directory.
const LIVE_STATUSES = ["live", "submitted", "claimed", "verified"];
const LISTINGS_PER_PAGE = 30;
// Transparent charges shown on the setup CTA (mirrors LISTSMARTLY_UNLOCK_CREDIT_COST
// + AI_PRESENCE_REPORT in lib/constants/listsmartly + lib/credits/costs).
const UNLOCK_COST = 500;
const PRESENCE_REPORT_COST = 15;

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

type Tab = "listings" | "reviews" | "insights";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
// The profile endpoint returns hours/socialLinks already JSON-parsed, but guard
// against unexpected shapes from older records.
function parseProfile(raw: unknown): Profile {
  const p = asObject(raw);
  const hours = asObject(p.hours);
  const social = asObject(p.socialLinks);
  return {
    businessName: str(p.businessName) || null,
    phone: str(p.phone) || null,
    email: str(p.email) || null,
    website: str(p.website) || null,
    address: str(p.address) || null,
    city: str(p.city) || null,
    state: str(p.state) || null,
    zip: str(p.zip) || null,
    country: str(p.country) || null,
    industry: str(p.industry) || null,
    description: str(p.description) || null,
    hours: { monFri: str(hours.monFri), sat: str(hours.sat), sun: str(hours.sun) },
    socialLinks: {
      facebook: str(social.facebook), instagram: str(social.instagram),
      twitter: str(social.twitter), linkedin: str(social.linkedin),
    },
    setupComplete: p.setupComplete === true,
  };
}

export function FocusedReviews({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("listings");
  const [editing, setEditing] = useState(false);
  // Priority-actions banner jumps to the Listings tab pre-filtered to a status.
  const [jump, setJump] = useState<{ status: string; nonce: number }>({ status: "", nonce: 0 });
  const focusListings = useCallback((status: string) => {
    setJump((j) => ({ status, nonce: j.nonce + 1 }));
    setTab("listings");
  }, []);

  const load = useCallback(async () => {
    const pj = await fetch("/api/listsmartly/profile").then((r) => r.json()).catch(() => null);
    const rawProfile = pj?.success ? pj?.data?.profile : null;
    setHasProfile(!!rawProfile);
    setProfile(rawProfile ? parseProfile(rawProfile) : null);
    if (rawProfile) {
      const aj = await fetch("/api/listsmartly/analytics").then((r) => r.json()).catch(() => null);
      if (aj?.success && aj.data) setAnalytics(aj.data as Analytics);
    }
  }, []);

  // Refresh just the analytics (used after a scan re-computes scores/stats).
  const refreshAnalytics = useCallback(async () => {
    const aj = await fetch("/api/listsmartly/analytics").then((r) => r.json()).catch(() => null);
    if (aj?.success && aj.data) setAnalytics(aj.data as Analytics);
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your reviews…" /></div>;
  }

  // No ListSmartly profile yet → a REAL in-surface setup form (no agent prompt):
  // the user fills their business profile, sees the exact charges, and activates
  // directly. [[surface-buttons-are-ui-actions]] [[unprovisioned-feature-shows-cta]]
  if (!hasProfile) {
    return (
      <PresenceSetup
        onActivated={(p) => { setProfile(p); setHasProfile(true); setLoading(true); load().finally(() => setLoading(false)); }}
      />
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

  const tierCoverage = (a?.listingsByTier ?? []).filter((t) => t.total > 0);

  // Priority actions: directories that need work + reviews waiting on a reply.
  const missingCount = (statusCounts.missing ?? 0) + (statusCounts.needs_update ?? 0);
  const unscannedCount = statusCounts.unverified ?? 0;
  const unrepliedCount = Math.max(0, totalReviews - Math.round((responseRate / 100) * totalReviews));

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
            <button
              onClick={() => setEditing((v) => !v)}
              className={cn(
                "ms-auto inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                editing ? "border-brand-500/60 text-brand-500" : "border-border hover:border-brand-500/60 hover:text-foreground"
              )}
            >
              <Pencil className="h-3.5 w-3.5" /> {editing ? "Close" : "Edit profile"}
            </button>
          </div>

          {editing && profile && (
            <ProfileEditor
              profile={profile}
              onSaved={(p) => { setProfile(p); setEditing(false); }}
              onCancel={() => setEditing(false)}
            />
          )}

          {/* Local-SEO health: a circular score gauge beside the component bars. */}
          <div className="mt-4 flex flex-col items-stretch gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-col items-center gap-1 sm:w-32">
              <ScoreGauge score={citation} />
              <span className="text-[11px] font-medium text-muted-foreground">Local-SEO score</span>
            </div>
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex items-center gap-2"><ListChecks className="h-3.5 w-3.5 text-brand-500" /><span className="text-[12px] font-semibold">What makes up your score</span></div>
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
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Kpi icon={Star} label="Avg rating" value={rating ? rating.toFixed(1) : "—"} />
            <Kpi icon={MessageSquare} label="Reviews" value={totalReviews.toLocaleString()} />
            <Kpi icon={Reply} label="Response rate" value={`${responseRate}%`} />
          </div>

          {/* Priority actions: only when there is something worth doing. */}
          {(missingCount > 0 || unscannedCount > 0 || unrepliedCount > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5">
              <Zap className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">Next best actions</span>
              <div className="ms-auto flex flex-wrap items-center gap-1.5">
                {missingCount > 0 && (
                  <button onClick={() => focusListings("missing")} className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-600 hover:bg-amber-500/25 dark:text-amber-300">
                    {missingCount} need {missingCount === 1 ? "setup" : "setup"} <ArrowRight className="h-3 w-3" />
                  </button>
                )}
                {unscannedCount > 0 && (
                  <button onClick={() => focusListings("unverified")} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/70">
                    {unscannedCount} to scan <ArrowRight className="h-3 w-3" />
                  </button>
                )}
                {unrepliedCount > 0 && (
                  <button onClick={() => setTab("reviews")} className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-500 hover:bg-brand-500/20">
                    {unrepliedCount} {unrepliedCount === 1 ? "reply" : "replies"} waiting <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* per-tier coverage: live vs total on each directory tier */}
          {tierCoverage.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-2.5 flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-brand-500" /><span className="text-[12px] font-semibold">Coverage by tier</span></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {tierCoverage.map((t) => (
                  <div key={t.tier} className="rounded-xl border border-border bg-muted/30 p-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] font-semibold">Tier {t.tier}</span>
                      <span className="shrink-0 text-[10.5px] font-semibold tabular-nums text-muted-foreground">{t.live}/{t.total}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{TIER_NAMES[t.tier] ?? "Other"}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", t.percentage >= 60 ? "bg-emerald-500" : t.percentage > 0 ? "bg-amber-500" : "bg-muted-foreground/30")} style={{ width: `${Math.max(3, Math.min(100, t.percentage))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* tabs */}
        <div className="flex gap-1.5">
          {([["listings", "Listings", ListTree], ["reviews", "Reviews", MessageSquare], ["insights", "Insights", BarChart3]] as const).map(([id, label, Icon]) => (
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
          <ListingsPanel refreshKey={refreshKey} onScanned={refreshAnalytics} focusStatus={jump.status} focusNonce={jump.nonce} />
        ) : tab === "reviews" ? (
          <ReviewsPanel onAsk={onAsk} refreshKey={refreshKey} onChanged={load} />
        ) : (
          <InsightsPanel analytics={a} refreshKey={refreshKey} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Listings panel ------------------------------ */

interface ScanSummary { total: number; live: number; missing: number; unverified: number; inconsistent: number; errors: number; searched: number }

function ListingsPanel({ refreshKey, onScanned, focusStatus, focusNonce }: { refreshKey?: number; onScanned: () => void; focusStatus?: string; focusNonce?: number }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);

  // Directory/review scan: a heavy action that re-checks every directory and
  // re-computes scores, so it uses an inline two-step confirm (not window.confirm).
  const [confirmScan, setConfirmScan] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanSummary | null>(null);
  const [scanError, setScanError] = useState("");

  // AI auto-fix: corrects NAP inconsistencies on live listings to match the
  // master profile — a direct API action (no agent prompt).
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{ fixed: number; totalChecked: number } | null>(null);

  // Jump from the priority-actions banner pre-filters this list to a status.
  useEffect(() => {
    if (focusNonce) { setStatus(focusStatus ?? ""); setSearch(""); setTier(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

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

  const runScan = useCallback(async () => {
    setScanning(true); setConfirmScan(false); setScanError(""); setScanResult(null);
    try {
      const r = await fetch("/api/listsmartly/listings/scan", { method: "POST" });
      const j = await r.json();
      if (r.ok && j?.success && j.data?.summary) {
        setScanResult(j.data.summary as ScanSummary);
        await load();        // refreshed listing rows / statuses
        onScanned();         // refreshed header scores + tier coverage
      } else {
        setScanError(j?.error?.message || "Could not run the scan. Try again.");
      }
    } catch {
      setScanError("Could not run the scan. Try again.");
    } finally {
      setScanning(false);
    }
  }, [load, onScanned]);

  const autoFix = useCallback(async () => {
    setFixing(true); setScanError(""); setFixResult(null);
    try {
      const r = await fetch("/api/listsmartly/ai/auto-fix", { method: "POST" });
      const j = await r.json();
      if (r.ok && j?.success && j.data) {
        setFixResult({ fixed: j.data.fixed ?? 0, totalChecked: j.data.totalChecked ?? 0 });
        await load();
        onScanned();
      } else {
        setScanError(j?.error?.message || (r.status === 402 ? "Not enough credits to auto-fix." : "Could not auto-fix listings."));
      }
    } catch {
      setScanError("Could not auto-fix listings.");
    } finally {
      setFixing(false);
    }
  }, [load, onScanned]);

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
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          {/* Real in-surface scan: re-checks every directory + refreshes status. */}
          {confirmScan ? (
            <span className="inline-flex items-center gap-1.5">
              <button onClick={runScan} disabled={scanning} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">
                <RefreshCw className="h-3.5 w-3.5" /> Run scan
              </button>
              <button onClick={() => setConfirmScan(false)} disabled={scanning} className="inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60">
                Cancel
              </button>
            </span>
          ) : (
            <button onClick={() => { setConfirmScan(true); setScanError(""); }} disabled={scanning} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
              {scanning ? <FlowLoader size={13} /> : <RefreshCw className="h-3.5 w-3.5" />} {scanning ? "Scanning…" : "Scan directories"}
            </button>
          )}
          {/* Direct AI auto-fix: corrects NAP mismatches on live listings. */}
          <button onClick={autoFix} disabled={fixing || scanning} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60" title="Correct any NAP mismatches on your live listings (uses credits per fix)">
            {fixing ? <FlowLoader size={13} /> : <Wand2 className="h-3.5 w-3.5" />} {fixing ? "Fixing…" : "Auto-fix"}
          </button>
        </div>
      </div>

      {confirmScan && !scanning && (
        <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2 text-[12px] text-amber-600 dark:text-amber-400">
          A full scan re-checks every directory and recomputes your scores — it can take a minute and may use credits. Confirm to run it.
        </p>
      )}
      {scanResult && (
        <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2 text-[12px] text-emerald-600 dark:text-emerald-400">
          Scan complete — {scanResult.total} directories checked: {scanResult.live} live, {scanResult.missing} missing, {scanResult.inconsistent} inconsistent{scanResult.errors ? `, ${scanResult.errors} errors` : ""}.
        </p>
      )}
      {fixResult && (
        <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2 text-[12px] text-emerald-600 dark:text-emerald-400">
          {fixResult.fixed > 0
            ? `Auto-fix corrected ${fixResult.fixed} ${fixResult.fixed === 1 ? "listing" : "listings"} to match your profile.`
            : `Checked ${fixResult.totalChecked} live ${fixResult.totalChecked === 1 ? "listing" : "listings"} — everything's already consistent.`}
        </p>
      )}
      {scanError && (
        <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3.5 py-2 text-[12px] text-rose-500">{scanError}</p>
      )}

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

  // Patch one review in place after a reply/flag without a full reload.
  const patchReview = useCallback((id: string, patch: Partial<Review>) => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  // Drop a review from the list (archive) — the route filters isArchived out, so
  // it would vanish on reload anyway; remove it now to avoid a stale row.
  const removeReview = useCallback((id: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
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
          {reviews.map((rv) => <ReviewCard key={rv.id} review={rv} onPatch={patchReview} onRemove={removeReview} onChanged={afterChange} />)}
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

function ReviewCard({ review, onPatch, onRemove, onChanged }: { review: Review; onPatch: (id: string, p: Partial<Review>) => void; onRemove: (id: string) => void; onChanged: (msg: string) => void }) {
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
          onRemove(review.id);
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

/* ------------------------------ Profile editor ------------------------------ */

const FIELD = "w-full rounded-[9px] border border-input bg-background px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-500/60";

function ProfileEditor({ profile, onSaved, onCancel }: { profile: Profile; onSaved: (p: Profile) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    businessName: profile.businessName || "",
    phone: profile.phone || "",
    email: profile.email || "",
    website: profile.website || "",
    address: profile.address || "",
    city: profile.city || "",
    state: profile.state || "",
    zip: profile.zip || "",
    country: profile.country || "US",
    industry: profile.industry || "",
    description: profile.description || "",
    hoursMonFri: profile.hours?.monFri || "",
    hoursSat: profile.hours?.sat || "",
    hoursSun: profile.hours?.sun || "",
    facebook: profile.socialLinks?.facebook || "",
    instagram: profile.socialLinks?.instagram || "",
    twitter: profile.socialLinks?.twitter || "",
    linkedin: profile.socialLinks?.linkedin || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.businessName.trim()) { setError("Business name is required."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/listsmartly/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          website: form.website.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zip: form.zip.trim(),
          country: form.country.trim(),
          industry: form.industry.trim(),
          description: form.description.trim(),
          hours: { monFri: form.hoursMonFri.trim(), sat: form.hoursSat.trim(), sun: form.hoursSun.trim() },
          socialLinks: {
            facebook: form.facebook.trim(), instagram: form.instagram.trim(),
            twitter: form.twitter.trim(), linkedin: form.linkedin.trim(),
          },
        }),
      });
      const j = await r.json();
      if (r.ok && j?.success && j.data?.profile) {
        onSaved(parseProfile(j.data.profile));
      } else {
        setError(j?.error?.message || "Could not save your profile. Try again.");
      }
    } catch {
      setError("Could not save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5 sm:p-4">
      <div className="mb-3 flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-brand-500" /><span className="text-[12.5px] font-bold">Business profile</span><span className="text-[11px] text-muted-foreground">Keep this accurate — it powers every listing.</span></div>

      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Name, address &amp; phone</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Business name"><input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} className={FIELD} placeholder="Acme Plumbing" /></Field>
        <Field label="Industry"><input value={form.industry} onChange={(e) => set("industry", e.target.value)} className={FIELD} placeholder="Plumbing" /></Field>
        <Field label="Phone"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={FIELD} placeholder="(555) 123-4567" inputMode="tel" /></Field>
        <Field label="Email"><input value={form.email} onChange={(e) => set("email", e.target.value)} className={FIELD} placeholder="hello@acme.com" inputMode="email" /></Field>
        <Field label="Website"><input value={form.website} onChange={(e) => set("website", e.target.value)} className={FIELD} placeholder="https://acme.com" inputMode="url" /></Field>
        <Field label="Street address"><input value={form.address} onChange={(e) => set("address", e.target.value)} className={FIELD} placeholder="123 Main St" /></Field>
        <Field label="City"><input value={form.city} onChange={(e) => set("city", e.target.value)} className={FIELD} placeholder="Austin" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="State"><input value={form.state} onChange={(e) => set("state", e.target.value)} className={FIELD} placeholder="TX" /></Field>
          <Field label="ZIP"><input value={form.zip} onChange={(e) => set("zip", e.target.value)} className={FIELD} placeholder="78701" inputMode="numeric" /></Field>
        </div>
      </div>

      <p className="mb-1.5 mt-3 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
      <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className={cn(FIELD, "resize-y")} placeholder="A short description of what your business offers…" />

      <p className="mb-1.5 mt-3 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Hours</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Mon–Fri"><input value={form.hoursMonFri} onChange={(e) => set("hoursMonFri", e.target.value)} className={FIELD} placeholder="9am – 5pm" /></Field>
        <Field label="Saturday"><input value={form.hoursSat} onChange={(e) => set("hoursSat", e.target.value)} className={FIELD} placeholder="10am – 2pm" /></Field>
        <Field label="Sunday"><input value={form.hoursSun} onChange={(e) => set("hoursSun", e.target.value)} className={FIELD} placeholder="Closed" /></Field>
      </div>

      <p className="mb-1.5 mt-3 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Social links</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Facebook"><input value={form.facebook} onChange={(e) => set("facebook", e.target.value)} className={FIELD} placeholder="https://facebook.com/…" inputMode="url" /></Field>
        <Field label="Instagram"><input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} className={FIELD} placeholder="https://instagram.com/…" inputMode="url" /></Field>
        <Field label="X / Twitter"><input value={form.twitter} onChange={(e) => set("twitter", e.target.value)} className={FIELD} placeholder="https://x.com/…" inputMode="url" /></Field>
        <Field label="LinkedIn"><input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} className={FIELD} placeholder="https://linkedin.com/…" inputMode="url" /></Field>
      </div>

      {error && <p className="mt-2.5 text-[11.5px] text-rose-500">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
          {saving ? <FlowLoader size={14} tone="white" /> : <Save className="h-3.5 w-3.5" />} Save profile
        </button>
        <button onClick={onCancel} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60">
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* ------------------------------ Presence setup ------------------------------ */

const SETUP_BENEFITS: { icon: ElementType; title: string; desc: string }[] = [
  { icon: Globe, title: "Listed across 150+ directories", desc: "Google, Apple Maps, Bing, Yelp, Facebook and the long tail — organized into 7 tiers of impact." },
  { icon: ShieldCheck, title: "NAP consistency tracking", desc: "Catch a wrong phone or address anywhere it's published and correct it from one place." },
  { icon: Gauge, title: "A local-SEO health score", desc: "One number built from coverage, consistency and reviews — with the full breakdown." },
  { icon: Inbox, title: "All your reviews in one inbox", desc: "Google, Yelp and more with sentiment — reply with an on-brand AI draft in a click." },
  { icon: Lightbulb, title: "AI presence insights", desc: "A one-click report on what to fix next and where you're already winning." },
  { icon: Zap, title: "One-click auto-fix", desc: "Push your correct details to every live listing automatically." },
];

function PresenceSetup({ onActivated }: { onActivated: (p: Profile) => void }) {
  const [form, setForm] = useState({
    businessName: "", industry: "", phone: "", email: "", website: "",
    address: "", city: "", state: "", zip: "", country: "US", description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Prefill from the Brand Kit (best-effort) so the user rarely types from scratch.
  useEffect(() => {
    let alive = true;
    fetch("/api/brand").then((r) => r.json()).then((j) => {
      if (!alive || !j?.success) return;
      const bk = j.data?.brandKit;
      if (!bk) return;
      setForm((f) => ({
        ...f,
        businessName: f.businessName || str(bk.name),
        industry: f.industry || str(bk.industry),
        phone: f.phone || str(bk.phone),
        email: f.email || str(bk.email),
        website: f.website || str(bk.website),
        address: f.address || str(bk.address),
        city: f.city || str(bk.city),
        state: f.state || str(bk.state),
        zip: f.zip || str(bk.zip),
        country: f.country || str(bk.country) || "US",
        description: f.description || str(bk.description),
      }));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const activate = async () => {
    if (!form.businessName.trim()) { setError("Add your business name to continue."); return; }
    setSubmitting(true); setError("");
    try {
      const r = await fetch("/api/listsmartly/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: form.businessName.trim(), industry: form.industry.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        const code = j?.error?.code;
        setError(
          code === "INSUFFICIENT_CREDITS" ? `You need ${UNLOCK_COST} credits to activate your presence.`
          : code === "PAYMENT_METHOD_REQUIRED" ? "Add a payment method to your account before activating."
          : (j?.error?.message || "Could not activate. Please try again.")
        );
        setSubmitting(false);
        return;
      }
      // Save the full NAP onto the freshly-created profile (best-effort).
      let saved = j.data?.profile;
      try {
        const pr = await fetch("/api/listsmartly/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessName: form.businessName.trim(), industry: form.industry.trim(),
            phone: form.phone.trim(), email: form.email.trim(), website: form.website.trim(),
            address: form.address.trim(), city: form.city.trim(), state: form.state.trim(),
            zip: form.zip.trim(), country: form.country.trim(), description: form.description.trim(),
            setupComplete: true,
          }),
        });
        const pj = await pr.json();
        if (pr.ok && pj?.success && pj.data?.profile) saved = pj.data.profile;
      } catch { /* keep the activate profile */ }
      onActivated(parseProfile(saved));
    } catch {
      setError("Could not activate. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* hero */}
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><MapPin className="h-7 w-7" /></span>
          <h2 className="mt-3 text-[22px] font-extrabold">Get found everywhere</h2>
          <p className="mx-auto mt-1.5 max-w-lg text-[13.5px] leading-relaxed text-muted-foreground">
            Build your local presence — listed across the top directories, every review in one inbox, and a live local-SEO health score. Fill in your business once and activate.
          </p>
        </div>

        {/* benefits */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SETUP_BENEFITS.map((b) => (
            <div key={b.title} className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><b.icon className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold">{b.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* transparent charges */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-brand-500/30 bg-brand-500/5 px-3.5 py-2.5">
          <Coins className="h-4 w-4 shrink-0 text-brand-500" />
          <span className="text-[12px] font-semibold">{UNLOCK_COST} credits</span>
          <span className="text-[12px] text-muted-foreground">one-time to unlock & map your presence.</span>
          <span className="text-[11.5px] text-muted-foreground">AI replies, descriptions & insights use a few credits each as you go; ~250 credits/mo keeps monitoring active.</span>
        </div>

        {/* business profile form */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2"><Building2 className="h-4 w-4 text-brand-500" /><span className="text-[13px] font-bold">Your business</span><span className="text-[11px] text-muted-foreground">Prefilled from your Brand Kit — edit anything.</span></div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Business name *"><input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} className={FIELD} placeholder="Acme Plumbing" /></Field>
            <Field label="Industry"><input value={form.industry} onChange={(e) => set("industry", e.target.value)} className={FIELD} placeholder="Plumbing" /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={FIELD} placeholder="(555) 123-4567" inputMode="tel" /></Field>
            <Field label="Email"><input value={form.email} onChange={(e) => set("email", e.target.value)} className={FIELD} placeholder="hello@acme.com" inputMode="email" /></Field>
            <Field label="Website"><input value={form.website} onChange={(e) => set("website", e.target.value)} className={FIELD} placeholder="https://acme.com" inputMode="url" /></Field>
            <Field label="Street address"><input value={form.address} onChange={(e) => set("address", e.target.value)} className={FIELD} placeholder="123 Main St" /></Field>
            <Field label="City"><input value={form.city} onChange={(e) => set("city", e.target.value)} className={FIELD} placeholder="Austin" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="State"><input value={form.state} onChange={(e) => set("state", e.target.value)} className={FIELD} placeholder="TX" /></Field>
              <Field label="ZIP"><input value={form.zip} onChange={(e) => set("zip", e.target.value)} className={FIELD} placeholder="78701" inputMode="numeric" /></Field>
            </div>
          </div>
          <p className="mb-1.5 mt-3 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">What you do</p>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className={cn(FIELD, "resize-y")} placeholder="A short description of what your business offers…" />

          {error && <p className="mt-2.5 text-[12px] text-rose-500">{error}</p>}
          <button onClick={activate} disabled={submitting} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60 sm:w-auto">
            {submitting ? <FlowLoader size={15} tone="white" /> : <Sparkles className="h-4 w-4" />} {submitting ? "Activating…" : `Activate my presence · ${UNLOCK_COST} credits`}
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">After activating, run a directory scan to detect where you&apos;re already listed.</p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Score gauge ------------------------------- */

function ScoreGauge({ score, size = 96 }: { score: number; size?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - v / 100);
  const tone = v >= 70 ? "#10b981" : v >= 40 ? "#f59e0b" : "#f43f5e";
  const label = v >= 70 ? "Strong" : v >= 40 ? "Building" : v > 0 ? "Needs work" : "Not scored";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="rgba(125,125,135,0.18)" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={tone} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[24px] font-extrabold leading-none tabular-nums">{v || "—"}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: tone }}>{label}</span>
      </div>
    </div>
  );
}

/* ------------------------------- Insights tab ------------------------------- */

const SENTIMENT_BAR: Record<string, { label: string; color: string }> = {
  positive: { label: "Positive", color: "bg-emerald-500" },
  neutral: { label: "Neutral", color: "bg-muted-foreground/40" },
  negative: { label: "Negative", color: "bg-rose-500" },
};

function recText(rec: unknown): string {
  if (typeof rec === "string") return rec;
  const o = asObject(rec);
  return str(o.title) || str(o.text) || str(o.recommendation) || str(o.description) || str(o.action) || "";
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const idx = Number(m) - 1;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[idx] ? `${names[idx]} ${String(y).slice(2)}` : key;
}

function InsightsPanel({ analytics }: { analytics?: Analytics | null; refreshKey?: number }) {
  const [report, setReport] = useState<{ overallScore: number; summary: string; recommendations: unknown[]; creditsUsed?: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setGenerating(true); setError("");
    try {
      const r = await fetch("/api/listsmartly/ai/presence-report", { method: "POST" });
      const j = await r.json();
      if (r.ok && j?.success && j.data) {
        setReport({
          overallScore: Math.round(j.data.overallScore ?? j.data.citationScore ?? 0),
          summary: str(j.data.summary),
          recommendations: Array.isArray(j.data.recommendations) ? j.data.recommendations : [],
          creditsUsed: typeof j.data.creditsUsed === "number" ? j.data.creditsUsed : undefined,
        });
      } else {
        setError(j?.error?.message || (r.status === 402 ? `Not enough credits — an AI report uses ${PRESENCE_REPORT_COST}.` : "Could not generate the report."));
      }
    } catch {
      setError("Could not generate the report.");
    } finally {
      setGenerating(false);
    }
  };

  const rv = analytics?.reviews;
  const sentiment = rv?.sentimentCounts ?? {};
  const sentTotal = (["positive", "neutral", "negative"] as const).reduce((s, k) => s + (sentiment[k] ?? 0), 0);
  const byPlatform = Object.entries(rv?.byPlatform ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const platformMax = Math.max(1, ...byPlatform.map(([, n]) => n));
  const trend = Object.entries(rv?.monthlyTrend ?? {}).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const trendMax = Math.max(1, ...trend.map(([, n]) => n));
  const hasReviewData = sentTotal > 0 || byPlatform.length > 0 || trend.length > 0;

  return (
    <section className="space-y-4">
      {/* AI presence report — a direct one-click insight (no agent prompt) */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Lightbulb className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold">AI presence report</h3>
            <p className="text-[11.5px] text-muted-foreground">An expert read on your local presence with the top moves to make next.</p>
          </div>
          <button onClick={generate} disabled={generating} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
            {generating ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} {generating ? "Analyzing…" : report ? "Regenerate" : `Generate · ${PRESENCE_REPORT_COST} credits`}
          </button>
        </div>

        {error && <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3.5 py-2 text-[12px] text-rose-500">{error}</p>}

        {report && (
          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
              <ScoreGauge score={report.overallScore} size={76} />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-foreground/90">{report.summary || "No summary available."}</p>
              </div>
            </div>
            {report.recommendations.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold"><ListChecks className="h-3.5 w-3.5 text-brand-500" /> Recommended next steps</p>
                <ul className="space-y-1.5">
                  {report.recommendations.map((rec, i) => {
                    const t = recText(rec);
                    if (!t) return null;
                    return (
                      <li key={i} className="flex items-start gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-[12.5px] leading-snug">
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> <span>{t}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {report.creditsUsed ? <p className="text-[11px] text-muted-foreground">Used {report.creditsUsed} credits.</p> : null}
          </div>
        )}
      </div>

      {/* Review analytics */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-bold"><BarChart3 className="h-4 w-4 text-brand-500" /> Review analytics</h3>
        {!hasReviewData ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            No review data yet. Run a directory scan to pull in existing reviews, or ask the agent to request reviews from recent customers.
          </p>
        ) : (
          <div className="space-y-5">
            {/* sentiment breakdown */}
            {sentTotal > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sentiment</p>
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {(["positive", "neutral", "negative"] as const).map((k) => {
                    const pct = ((sentiment[k] ?? 0) / sentTotal) * 100;
                    return pct > 0 ? <div key={k} className={SENTIMENT_BAR[k].color} style={{ width: `${pct}%` }} title={`${SENTIMENT_BAR[k].label}: ${sentiment[k]}`} /> : null;
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {(["positive", "neutral", "negative"] as const).map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                      <span className={cn("h-2 w-2 rounded-full", SENTIMENT_BAR[k].color)} /> {SENTIMENT_BAR[k].label} <span className="font-semibold tabular-nums text-foreground">{sentiment[k] ?? 0}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* by platform */}
            {byPlatform.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">By platform</p>
                <div className="space-y-1.5">
                  {byPlatform.map(([p, n]) => (
                    <div key={p} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate text-[12px] font-medium">{platformLabel(p)}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${Math.max(4, (n / platformMax) * 100)}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-end text-[12px] font-semibold tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* monthly trend */}
            {trend.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> New reviews / month</p>
                <div className="flex items-end gap-2" style={{ height: 88 }}>
                  {trend.map(([m, n]) => (
                    <div key={m} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{n}</span>
                      <div className="flex w-full items-end justify-center" style={{ height: 56 }}>
                        <div className="w-full max-w-[26px] rounded-t-md bg-gradient-to-t from-brand-500/60 to-violet-500" style={{ height: `${Math.max(6, (n / trendMax) * 100)}%` }} />
                      </div>
                      <span className="truncate text-[9.5px] text-muted-foreground">{monthLabel(m)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
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
