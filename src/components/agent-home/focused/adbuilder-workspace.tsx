"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import { Megaphone, Sparkles, ExternalLink, Coins, Eye, MousePointerClick, TrendingUp, CheckCircle2, Clock, XCircle, Image as ImageIcon, Target, BadgePercent } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Ad builder — a deep new-design advertising surface (the Ad builder workspace
 * canvas): the user's ad campaigns/creatives with status + key metrics (spend,
 * reach/impressions, clicks, ROAS where available). Read view (GET /api/ads,
 * with best-effort ROAS from GET /api/ecommerce/ads) + KPIs + a campaign list
 * you can expand inline. Building a NEW campaign is a heavy generative build, so
 * that one action drives the agent (onAsk). No legacy links. [[new-design-no-legacy]]
 */

interface Campaign {
  id: string;
  name: string;
  objective?: string | null;
  status?: string | null;
  adType?: string | null;
  approvalStatus?: string | null;
  budget?: number;
  spent?: number;
  dailyBudget?: number | null;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  ctr?: number;
  headline?: string | null;
  description?: string | null;
  destinationUrl?: string | null;
  mediaUrl?: string | null;
  videoUrl?: string | null;
  rejectionReason?: string | null;
  providers?: string[];
  startDate?: string;
  endDate?: string | null;
  createdAt?: string;
  post?: { id: string; caption?: string | null; mediaUrl?: string | null; mediaType?: string | null } | null;
  adPage?: { id: string; slug: string; views?: number; clicks?: number } | null;
  // merged from ecommerce roas (best-effort)
  revenue?: number;
  roas?: number;
  orderCount?: number;
}
interface Stats { total?: number; active?: number; pending?: number; totalSpent?: number; totalImpressions?: number; }

// Best-effort ROAS row from /api/ecommerce/ads (store-scoped; cents-based).
interface EcomAd { id: string; spentCents?: number; revenueCents?: number; roas?: number; orderCount?: number; }

const CREATE_PROMPT =
  "Help me build a new ad campaign. Ask me what I'm promoting (a post, product, or link), my goal, audience, and budget, then create and launch the campaign for me.";

function num(n?: number): string { return (n ?? 0).toLocaleString(); }
function money(n?: number): string {
  const v = n ?? 0;
  try { return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: v < 100 ? 2 : 0 }); }
  catch { return `$${v.toFixed(2)}`; }
}
function fmt(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

// Map a campaign status → a badge tone + icon. Falls back to approval state.
function statusMeta(status?: string | null, approval?: string | null): { label: string; tone: string; icon: ElementType } {
  const s = (status || "").toUpperCase();
  const a = (approval || "").toUpperCase();
  if (a === "REJECTED" || s === "REJECTED") return { label: "Rejected", tone: "bg-rose-500/10 text-rose-500", icon: XCircle };
  if (s === "ACTIVE") return { label: "Active", tone: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 };
  if (s === "COMPLETED") return { label: "Completed", tone: "bg-muted text-muted-foreground", icon: CheckCircle2 };
  if (s === "PAUSED") return { label: "Paused", tone: "bg-amber-500/10 text-amber-500", icon: Clock };
  if (a === "PENDING" || s === "PENDING_REVIEW" || s === "PENDING") return { label: "In review", tone: "bg-brand-500/10 text-brand-500", icon: Clock };
  return { label: status ? status.replace(/_/g, " ").toLowerCase() : "Draft", tone: "bg-muted text-muted-foreground", icon: Clock };
}

export function FocusedAdBuilder({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [hasRoas, setHasRoas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const j = await fetch("/api/ads?limit=30").then((r) => r.json());
      if (!j?.success || !j.data) { setError("Could not load your campaigns."); return; }
      const base: Campaign[] = Array.isArray(j.data.campaigns) ? j.data.campaigns : [];
      setStats(j.data.stats && typeof j.data.stats === "object" ? j.data.stats : {});

      // Best-effort: merge ROAS/revenue from the store-scoped ecommerce ads route.
      // It 404s when the user has no store — that's fine, we just skip ROAS then.
      let merged = base;
      try {
        const er = await fetch("/api/ecommerce/ads");
        if (er.ok) {
          const ej = await er.json();
          const rows: EcomAd[] = Array.isArray(ej?.campaigns) ? ej.campaigns : [];
          if (rows.length) {
            const byId = new Map(rows.map((r) => [r.id, r]));
            let any = false;
            merged = base.map((c) => {
              const m = byId.get(c.id);
              if (!m) return c;
              any = true;
              return {
                ...c,
                revenue: typeof m.revenueCents === "number" ? m.revenueCents / 100 : undefined,
                roas: typeof m.roas === "number" ? m.roas : undefined,
                orderCount: typeof m.orderCount === "number" ? m.orderCount : undefined,
              };
            });
            setHasRoas(any);
          }
        }
      } catch { /* no store / not available — ROAS stays hidden */ }

      setCampaigns(merged);
    } catch {
      setError("Could not load your campaigns.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your campaigns…" /></div>;
  }

  // Roll up a portfolio ROAS when at least one campaign reported revenue.
  const totalRevenue = campaigns.reduce((s, c) => s + (c.revenue ?? 0), 0);
  const spentForRoas = campaigns.reduce((s, c) => s + (c.revenue != null ? (c.spent ?? 0) : 0), 0);
  const portfolioRoas = spentForRoas > 0 ? totalRevenue / spentForRoas : 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Megaphone} label="Campaigns" value={num(stats.total ?? campaigns.length)} sub={stats.active ? `${num(stats.active)} active` : undefined} />
          <Kpi icon={Coins} label="Total spend" value={money(stats.totalSpent ?? campaigns.reduce((s, c) => s + (c.spent ?? 0), 0))} />
          <Kpi icon={Eye} label="Impressions" value={num(stats.totalImpressions ?? campaigns.reduce((s, c) => s + (c.impressions ?? 0), 0))} />
          {hasRoas
            ? <Kpi icon={TrendingUp} label="ROAS" value={`${portfolioRoas.toFixed(2)}×`} sub={totalRevenue ? `${money(totalRevenue)} revenue` : undefined} />
            : <Kpi icon={Clock} label="In review" value={num(stats.pending ?? 0)} />}
        </div>

        {/* Campaigns */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Campaigns &amp; creatives</h3>
            {onAsk && (
              <button onClick={() => onAsk(CREATE_PROMPT)} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> New campaign
              </button>
            )}
          </div>

          {error && <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{error}</p>}

          {campaigns.length ? (
            <div className="space-y-2.5">
              {campaigns.map((c) => {
                const meta = statusMeta(c.status, c.approvalStatus);
                const media = c.mediaUrl || c.post?.mediaUrl || null;
                const isOpen = expanded === c.id;
                const live = c.adPage?.slug ? `/ad/${c.adPage.slug}` : null;
                return (
                  <div key={c.id} className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    <button onClick={() => setExpanded(isOpen ? null : c.id)} className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-muted/50">
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-background">
                        {media ? <Image src={media} alt="" width={48} height={48} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-semibold">{c.name || c.headline || "Untitled campaign"}</p>
                          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize", meta.tone)}>
                            <meta.icon className="h-3 w-3" /> {meta.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
                          {c.adType && <span className="capitalize">{c.adType.replace(/_/g, " ").toLowerCase()}</span>}
                          <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" /> {money(c.spent)}{c.budget ? ` / ${money(c.budget)}` : ""}</span>
                          <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {num(c.impressions)}</span>
                          <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {num(c.clicks)}</span>
                          {c.roas != null && c.roas > 0 && <span className="inline-flex items-center gap-1 font-medium text-emerald-500"><TrendingUp className="h-3 w-3" /> {c.roas.toFixed(2)}×</span>}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border/70 px-3 pb-3 pt-3">
                        {c.rejectionReason && (
                          <p className="mb-2.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-2.5 py-1.5 text-[11.5px] text-rose-500"><span className="font-semibold">Rejected:</span> {c.rejectionReason}</p>
                        )}
                        {(c.headline || c.description) && (
                          <div className="mb-2.5">
                            {c.headline && <p className="text-[12.5px] font-semibold">{c.headline}</p>}
                            {c.description && <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{c.description}</p>}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Metric icon={MousePointerClick} label="CTR" value={c.ctr != null ? `${c.ctr}%` : "—"} />
                          <Metric icon={Target} label="Conversions" value={num(c.conversions)} />
                          {c.roas != null
                            ? <Metric icon={TrendingUp} label="ROAS" value={`${c.roas.toFixed(2)}×`} />
                            : <Metric icon={BadgePercent} label="Daily budget" value={c.dailyBudget ? money(c.dailyBudget) : "—"} />}
                          {c.revenue != null
                            ? <Metric icon={Coins} label="Revenue" value={money(c.revenue)} />
                            : <Metric icon={Clock} label="Started" value={fmt(c.startDate) || "—"} />}
                        </div>
                        {(c.providers?.length || c.objective) && (
                          <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            {c.objective && <span className="rounded-full bg-muted px-2 py-0.5 capitalize">{c.objective.toLowerCase()}</span>}
                            {(c.providers ?? []).map((p) => <span key={p} className="rounded-full bg-muted px-2 py-0.5 capitalize">{p.replace(/_/g, " ").toLowerCase()}</span>)}
                          </p>
                        )}
                        {live && (
                          <a href={live} target="_blank" rel="noreferrer" className="mt-2.5 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                            <ExternalLink className="h-3.5 w-3.5" /> View ad page
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Megaphone className="h-6 w-6" /></span>
              <p className="mt-3 text-[13px] font-medium">No ad campaigns yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[12px] text-muted-foreground">Run targeted ads to reach new customers — promote a post, product, or link. The agent designs the creative, sets the audience, and launches it for you.</p>
              {onAsk && (
                <button onClick={() => onAsk(CREATE_PROMPT)} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                  <Sparkles className="h-4 w-4" /> Build a campaign
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-[11.5px] font-medium">{label}</span></div>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none">{value}</p>
      {sub && <p className="mt-1 truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-2.5">
      <div className="flex items-center gap-1 text-muted-foreground"><Icon className="h-3 w-3" /><span className="text-[10.5px] font-medium">{label}</span></div>
      <p className="mt-0.5 text-[13px] font-bold leading-none">{value}</p>
    </div>
  );
}
