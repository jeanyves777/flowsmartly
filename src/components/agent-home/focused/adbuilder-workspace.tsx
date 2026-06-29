"use client";

import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";
import Image from "next/image";
import { Megaphone, Sparkles, ExternalLink, Coins, Eye, MousePointerClick, TrendingUp, CheckCircle2, Clock, XCircle, Image as ImageIcon, Target, BadgePercent, Plus, Link2, ArrowLeft, Save } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { cn } from "@/lib/utils/cn";

/**
 * Ad builder — a deep new-design advertising surface (the Ad builder workspace
 * canvas): the user's ad campaigns/creatives with status + key metrics (spend,
 * reach/impressions, clicks, ROAS where available). Full-width master/detail —
 * a sticky left card (KPIs + "New campaign") and a right pane that shows the
 * campaign list OR a real in-surface CAMPAIGN BUILDER form that creates & launches
 * the campaign directly (POST /api/ads — promote a link/page, charges credits =
 * budget). NO agent prompt: the agent only helps when the user asks it via the
 * composer. Read view: GET /api/ads + best-effort ROAS from GET /api/ecommerce/ads.
 * [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]] [[full-width-left-menu-layout]]
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

export function FocusedAdBuilder({ refreshKey }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [hasRoas, setHasRoas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [notice, setNotice] = useState("");

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

  const inReview = stats.pending ?? campaigns.filter((c) => (c.approvalStatus || "").toUpperCase() === "PENDING").length;
  const totalSpend = stats.totalSpent ?? campaigns.reduce((s, c) => s + (c.spent ?? 0), 0);
  const totalImpr = stats.totalImpressions ?? campaigns.reduce((s, c) => s + (c.impressions ?? 0), 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky card — new campaign + KPIs */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          <button
            onClick={() => { setBuilding(true); setNotice(""); setExpanded(null); }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
          >
            <Plus className="h-4 w-4" /> New campaign
          </button>

          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 px-1 pb-2"><Megaphone className="h-4 w-4 text-brand-500" /><span className="text-[12.5px] font-bold">Performance</span></div>
            <div className="space-y-1.5">
              <StatRow icon={Megaphone} label="Campaigns" value={num(stats.total ?? campaigns.length)} sub={stats.active ? `${num(stats.active)} active` : undefined} />
              <StatRow icon={Coins} label="Total spend" value={money(totalSpend)} />
              <StatRow icon={Eye} label="Impressions" value={num(totalImpr)} />
              {hasRoas
                ? <StatRow icon={TrendingUp} label="ROAS" value={`${portfolioRoas.toFixed(2)}×`} sub={totalRevenue ? `${money(totalRevenue)} revenue` : undefined} />
                : <StatRow icon={Clock} label="In review" value={num(inReview)} />}
            </div>
          </div>
        </aside>

        {/* RIGHT: builder OR campaign list — full width */}
        <div className="min-w-0 flex-1">
          {building ? (
            <CampaignBuilder
              onCancel={() => setBuilding(false)}
              onCreated={(msg) => { setBuilding(false); setNotice(msg); load(); }}
            />
          ) : (
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-bold">Campaigns &amp; creatives</h3>
                {campaigns.length > 0 && (
                  <button onClick={() => { setBuilding(true); setNotice(""); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" /> New campaign
                  </button>
                )}
              </div>

              {notice && <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-600 dark:text-emerald-400">{notice}</p>}
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
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Megaphone className="h-6 w-6" /></span>
                  <p className="mt-3 text-[13px] font-medium">No ad campaigns yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] text-muted-foreground">Run targeted ads to reach new customers — promote a link or page, set the creative and budget, and launch in a couple of clicks.</p>
                  <button onClick={() => { setBuilding(true); setNotice(""); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                    <Sparkles className="h-4 w-4" /> Build a campaign
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, sub }: { icon: ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        {sub && <p className="truncate text-[10px] text-muted-foreground/80">{sub}</p>}
      </div>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

/* ------------------------------ Campaign builder ----------------------------- */

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
const OBJECTIVES: [string, string][] = [["AWARENESS", "Brand awareness"], ["TRAFFIC", "Traffic / clicks"], ["ENGAGEMENT", "Engagement"], ["CONVERSIONS", "Conversions"], ["LEADS", "Leads"]];
const CTAS = ["Learn More", "Shop Now", "Sign Up", "Book Now", "Get Offer", "Subscribe", "Contact Us", "Download"];
const AD_CATEGORIES = ["Retail & e-commerce", "Professional services", "Software & SaaS", "Education", "Health & wellness", "Food & beverage", "Real estate", "Travel & hospitality", "Finance", "Events", "Nonprofit", "Other"];

function todayStr(): string {
  try { return new Date().toISOString().slice(0, 10); } catch { return ""; }
}

function CampaignBuilder({ onCancel, onCreated }: { onCancel: () => void; onCreated: (msg: string) => void }) {
  const [form, setForm] = useState({
    name: "",
    objective: "AWARENESS",
    destinationUrl: "",
    headline: "",
    description: "",
    ctaText: "Learn More",
    adCategory: AD_CATEGORIES[0],
    budget: "50",
    startDate: todayStr(),
    endDate: "",
  });
  const [media, setMedia] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const budgetNum = Math.max(0, Math.round(Number(form.budget) || 0));

  const launch = async () => {
    if (!form.name.trim()) { setError("Give your campaign a name."); return; }
    if (!/^https?:\/\/.+/i.test(form.destinationUrl.trim())) { setError("Enter a destination URL (starting with http:// or https://)."); return; }
    if (!form.headline.trim()) { setError("Add a headline for your ad."); return; }
    if (budgetNum < 1) { setError("Set a budget of at least 1 credit."); return; }
    setSubmitting(true); setError("");
    try {
      const r = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          objective: form.objective,
          adType: "EXTERNAL_URL",
          destinationUrl: form.destinationUrl.trim(),
          headline: form.headline.trim(),
          description: form.description.trim() || undefined,
          ctaText: form.ctaText,
          adCategory: form.adCategory,
          mediaUrl: media[0] || undefined,
          budget: budgetNum,
          startDate: form.startDate || todayStr(),
          endDate: form.endDate || undefined,
        }),
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        onCreated(`“${form.name.trim()}” submitted — it’s in review and goes live once approved. ${budgetNum} credits reserved.`);
      } else {
        const code = j?.error?.code;
        setError(code === "PLAN_UPGRADE_REQUIRED" ? "Ad campaigns need purchased credits — top up to launch." : (j?.error?.message || "Could not create the campaign. Try again."));
      }
    } catch {
      setError("Could not create the campaign. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h3 className="text-[15px] font-bold">New campaign</h3>
          <p className="text-[11.5px] text-muted-foreground">Promote a link or page — set the creative, budget and schedule, then launch.</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Basics */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Campaign name *" full><input value={form.name} onChange={(e) => set("name", e.target.value)} className={FIELD} placeholder="Summer promo — landing page" /></Field>
          <Field label="Goal"><select value={form.objective} onChange={(e) => set("objective", e.target.value)} className={FIELD}>{OBJECTIVES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Category"><select value={form.adCategory} onChange={(e) => set("adCategory", e.target.value)} className={FIELD}>{AD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        </div>

        {/* What you're promoting */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Link2 className="h-3.5 w-3.5" /> What you&apos;re promoting</p>
          <div className="grid grid-cols-1 gap-3">
            <Field label="Destination URL *"><input value={form.destinationUrl} onChange={(e) => set("destinationUrl", e.target.value)} className={FIELD} placeholder="https://your-site.com/offer" inputMode="url" /></Field>
            <Field label="Headline *"><input value={form.headline} onChange={(e) => set("headline", e.target.value)} className={FIELD} placeholder="Get 20% off your first order" maxLength={120} /></Field>
            <Field label="Description"><textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className={cn(FIELD, "resize-y")} placeholder="A short line about the offer or page…" maxLength={300} /></Field>
            <Field label="Call to action"><select value={form.ctaText} onChange={(e) => set("ctaText", e.target.value)} className={FIELD}>{CTAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          </div>
        </div>

        {/* Creative */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Creative <span className="font-normal normal-case text-muted-foreground/70">(optional image)</span></p>
          <MediaUploader value={media} onChange={setMedia} variant="medium" fit="cover" accept="image/*" label="" description="Upload an image for the ad, or leave blank to use a clean text card." />
        </div>

        {/* Budget & schedule */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Coins className="h-3.5 w-3.5" /> Budget &amp; schedule</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Budget (credits) *"><input value={form.budget} onChange={(e) => set("budget", e.target.value.replace(/[^0-9]/g, ""))} className={FIELD} inputMode="numeric" placeholder="50" /></Field>
            <Field label="Start date"><input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={FIELD} /></Field>
            <Field label="End date (optional)"><input type="date" value={form.endDate} min={form.startDate} onChange={(e) => set("endDate", e.target.value)} className={FIELD} /></Field>
          </div>
        </div>

        {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button onClick={launch} disabled={submitting} className="inline-flex items-center gap-1.5 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60">
            {submitting ? <FlowLoader size={15} tone="white" /> : <Save className="h-4 w-4" />} {submitting ? "Launching…" : `Launch campaign · ${budgetNum} credits`}
          </button>
          <button onClick={onCancel} disabled={submitting} className="inline-flex items-center gap-1.5 rounded-[11px] px-3 py-2.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60">Cancel</button>
          <span className="ms-auto text-[11px] text-muted-foreground">Link ads are reviewed before going live.</span>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
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
