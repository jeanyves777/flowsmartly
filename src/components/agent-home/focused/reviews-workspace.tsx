"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import { Star, MessageSquare, Reply, Gauge, MapPin, ExternalLink, Sparkles, ListChecks, ShieldCheck, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Reviews & local SEO — a deep new-design ListSmartly surface (the Reviews
 * workspace canvas): business-listing presence, rating & review KPIs, the local
 * SEO health scores, and the most recent reviews. Read-heavy: the data lives
 * behind directory scans, so the generative actions (ask for more reviews, fix a
 * listing) drive the agent via `onAsk`. No legacy links — external "view
 * directory" links to the live listing are fine. [[new-design-no-legacy]]
 */

interface Analytics {
  scores?: {
    citationScore?: number;
    coverageScore?: number;
    consistencyScore?: number;
    reviewScore?: number;
  };
  listings?: { total?: number; statusCounts?: Record<string, number> };
  reviews?: {
    total?: number;
    averageRating?: number;
    responseRate?: number;
    sentimentCounts?: Record<string, number>;
    byPlatform?: Record<string, number>;
  };
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
  createdAt: string;
}
interface Profile {
  businessName?: string | null;
  city?: string | null;
  state?: string | null;
  setupComplete?: boolean;
}

// "live"-ish listing statuses that count as a real presence on a directory.
const LIVE_STATUSES = ["live", "submitted", "claimed", "verified"];

function whenLabel(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

function platformLabel(p: string): string {
  return p ? p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ") : "Review";
}

const SENTIMENT_META: Record<string, { icon: ElementType; tone: string }> = {
  positive: { icon: ThumbsUp, tone: "text-emerald-500" },
  negative: { icon: ThumbsDown, tone: "text-rose-500" },
  neutral: { icon: Minus, tone: "text-muted-foreground" },
};

export function FocusedReviews({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const pj = await fetch("/api/listsmartly/profile").then((r) => r.json()).catch(() => null);
    const prof = pj?.success ? pj?.data?.profile : null;
    const has = !!prof;
    setHasProfile(has);
    setProfile(prof);
    if (has) {
      const [aj, rj] = await Promise.all([
        fetch("/api/listsmartly/analytics").then((r) => r.json()).catch(() => null),
        fetch("/api/listsmartly/reviews?limit=8").then((r) => r.json()).catch(() => null),
      ]);
      if (aj?.success && aj.data) setAnalytics(aj.data as Analytics);
      if (rj?.success && Array.isArray(rj.data?.reviews)) setReviews(rj.data.reviews as Review[]);
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

  // No ListSmartly profile yet → setting up the business presence is a heavy
  // generative build, so the agent runs it.
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
  const totalReviews = a?.reviews?.total ?? reviews.length;
  const responseRate = a?.reviews?.responseRate ?? 0;
  const statusCounts = a?.listings?.statusCounts ?? {};
  const totalListings = a?.listings?.total ?? 0;
  const liveListings = Object.entries(statusCounts).reduce((sum, [s, n]) => sum + (LIVE_STATUSES.includes(s) ? n : 0), 0);
  const citation = a?.scores?.citationScore ?? 0;
  const sentiments = a?.reviews?.sentimentCounts ?? {};
  const location = [profile?.city, profile?.state].filter(Boolean).join(", ");

  const seoBars: { label: string; value: number }[] = [
    { label: "Coverage", value: a?.scores?.coverageScore ?? 0 },
    { label: "Consistency", value: a?.scores?.consistencyScore ?? 0 },
    { label: "Reviews", value: a?.scores?.reviewScore ?? 0 },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* business / presence header */}
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
            {onAsk && (
              <button onClick={() => onAsk("Fix and complete my business listings — claim the unverified ones and resolve any NAP inconsistencies across directories.")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Fix listings
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={Star} label="Avg rating" value={rating ? rating.toFixed(1) : "—"} />
            <Kpi icon={MessageSquare} label="Reviews" value={totalReviews.toLocaleString()} />
            <Kpi icon={Reply} label="Response rate" value={`${responseRate}%`} />
            <Kpi icon={Gauge} label="SEO score" value={citation ? `${citation}` : "—"} />
          </div>
        </section>

        {/* local SEO health */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-brand-500" />
            <h3 className="text-[13px] font-bold">Local SEO health</h3>
            {onAsk && (
              <button onClick={() => onAsk("Audit my local SEO and tell me the top 3 things to improve my citation score and search visibility.")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Improve score
              </button>
            )}
          </div>
          <div className="space-y-2.5">
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

        {/* recent reviews */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Recent reviews</h3>
            {(sentiments.positive || sentiments.negative) ? (
              <span className="inline-flex items-center gap-2 text-[11.5px] text-muted-foreground">
                {sentiments.positive ? <span className="inline-flex items-center gap-1 text-emerald-500"><ThumbsUp className="h-3 w-3" /> {sentiments.positive}</span> : null}
                {sentiments.negative ? <span className="inline-flex items-center gap-1 text-rose-500"><ThumbsDown className="h-3 w-3" /> {sentiments.negative}</span> : null}
              </span>
            ) : null}
            {onAsk && (
              <button onClick={() => onAsk("Run a campaign to request more reviews from my happy customers across email and SMS.")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
                <Star className="h-3.5 w-3.5" /> Request reviews
              </button>
            )}
          </div>

          {reviews.length ? (
            <div className="space-y-2">
              {reviews.map((rv) => {
                const sm = SENTIMENT_META[(rv.sentiment || "").toLowerCase()];
                return (
                  <div key={rv.id} className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="text-[12.5px] font-semibold">{rv.authorName || "Anonymous"}</span>
                      <Stars rating={rv.rating} />
                      <span className="text-[11px] text-muted-foreground">{platformLabel(rv.platform)}{rv.createdAt ? ` · ${whenLabel(rv.createdAt)}` : ""}</span>
                      {sm ? <span className={cn("inline-flex items-center", sm.tone)}><sm.icon className="h-3 w-3" /></span> : null}
                      {rv.hasResponse && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500"><Reply className="h-3 w-3" /> replied</span>}
                      {rv.reviewUrl && (
                        <a href={rv.reviewUrl} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-3 w-3" /> View
                        </a>
                      )}
                    </div>
                    {rv.text && <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground">{rv.text}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No reviews yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Once reviews come in they show up here — ask the agent to run a review-request campaign to get the first ones.</p>
              {onAsk && (
                <button onClick={() => onAsk("Run a campaign to request reviews from my recent customers.")} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Star className="h-4 w-4" /> Request reviews</button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

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
