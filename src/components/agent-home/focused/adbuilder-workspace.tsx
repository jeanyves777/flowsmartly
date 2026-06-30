"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Image from "next/image";
import { Megaphone, Sparkles, ExternalLink, Coins, Eye, MousePointerClick, TrendingUp, CheckCircle2, Clock, XCircle, Image as ImageIcon, Target, Plus, Link2, LayoutGrid, Rocket, Package, PenLine, ArrowRight, Wand2, Trash2, Pause, Play, X } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Ad builder — an AI-DRIVEN ad PLAYGROUND (the Video/Follow-ups canvas language).
 * The toolbar shows the ACTIVE ad providers (enabled vs. not connected, from
 * /api/ads/providers). The canvas builds a campaign: name it, choose a SOURCE —
 * a store product (the ad auto-generates from it via /api/ecommerce/promote
 * defaults), a product/page LINK, or a free DESCRIPTION — tune the AI ad-preview
 * creative, pick placements (only enabled providers), set budget/schedule, then
 * "Build & launch with AI" hands a structured brief to the agent (onAsk) which
 * generates the creative/targeting and launches; "Launch as-is" posts directly
 * (/api/ecommerce/promote for products, /api/ads for links).
 *
 * The right rail shows live campaigns; the toolbar "Library" opens every
 * campaign with status + statistics (spend, impressions, clicks, ROAS). Clicking
 * a campaign opens an in-surface detail drawer with the creative, full metrics,
 * providers, ad-page link, and pause/activate (PATCH) / delete (DELETE). Read:
 * GET /api/ads + best-effort ROAS from GET /api/ecommerce/ads.
 * [[new-design-no-legacy]] [[agent-operates-account-full-crud]]
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
  ctaText?: string | null;
  rejectionReason?: string | null;
  providers?: string[];
  startDate?: string;
  endDate?: string | null;
  createdAt?: string;
  post?: { id: string; caption?: string | null; mediaUrl?: string | null; mediaType?: string | null } | null;
  adPage?: { id: string; slug: string; views?: number; clicks?: number } | null;
  revenue?: number;
  roas?: number;
  orderCount?: number;
}
interface Stats { total?: number; active?: number; pending?: number; totalSpent?: number; totalImpressions?: number; }
interface EcomAd { id: string; spentCents?: number; revenueCents?: number; roas?: number; orderCount?: number; }
interface Provider { id: string; name: string; enabled: boolean; description?: string; feeCredits?: number; }
interface ProductOption { id: string; name: string; priceCents: number; images?: { url: string }[]; status?: string; }
interface PromoteDefaults { name: string; headline: string; description: string; destinationUrl: string; mediaUrl: string | null; ctaText: string; sourceProductId: string; }

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
function todayStr(): string { try { return new Date().toISOString().slice(0, 10); } catch { return ""; } }

function statusMeta(status?: string | null, approval?: string | null): { label: string; tone: string; icon: ElementType } {
  const s = (status || "").toUpperCase();
  const a = (approval || "").toUpperCase();
  if (a === "REJECTED" || s === "REJECTED") return { label: "Rejected", tone: "bg-rose-500/10 text-rose-500", icon: XCircle };
  if (s === "ACTIVE") return { label: "Active", tone: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 };
  if (s === "COMPLETED") return { label: "Completed", tone: "bg-muted text-muted-foreground", icon: CheckCircle2 };
  if (s === "PAUSED") return { label: "Paused", tone: "bg-amber-500/10 text-amber-500", icon: Pause };
  if (a === "PENDING" || s === "PENDING_REVIEW" || s === "PENDING") return { label: "In review", tone: "bg-brand-500/10 text-brand-500", icon: Clock };
  return { label: status ? status.replace(/_/g, " ").toLowerCase() : "Draft", tone: "bg-muted text-muted-foreground", icon: Clock };
}

// Provider id → a compact brand mark + color for the chips/marks.
const PROVIDER_VIS: Record<string, { mark: string; color: string }> = {
  feed: { mark: "F", color: "#0ea5e9" },
  meta_ads: { mark: "M", color: "#0866ff" },
  google_ads: { mark: "G", color: "#ea4335" },
  tiktok_ads: { mark: "T", color: "#111827" },
  spotlight: { mark: "★", color: "#8b5cf6" },
};
const provVis = (id: string) => PROVIDER_VIS[id] ?? { mark: (id[0] || "?").toUpperCase(), color: "#0ea5e9" };
const provName = (id: string) => id.replace(/_ads$/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const OBJECTIVES: [string, string][] = [["AWARENESS", "Brand awareness"], ["TRAFFIC", "Traffic / clicks"], ["ENGAGEMENT", "Engagement"], ["CONVERSIONS", "Conversions"], ["LEADS", "Leads"]];
const CTAS = ["Shop Now", "Learn More", "Get Offer", "Sign Up", "Book Now", "Subscribe", "Contact Us", "Download"];
const AD_CATEGORIES = ["Retail & e-commerce", "Professional services", "Software & SaaS", "Education", "Health & wellness", "Food & beverage", "Real estate", "Travel & hospitality", "Finance", "Events", "Nonprofit", "Other"];

type SourceMode = "product" | "link" | "describe";
type LibFilter = "all" | "active" | "review" | "paused";

export function FocusedAdBuilder({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [hasRoas, setHasRoas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  const [libFilter, setLibFilter] = useState<LibFilter>("all");
  const [working, setWorking] = useState(false);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Builder state.
  const [name, setName] = useState("Untitled ad campaign");
  const [brief, setBrief] = useState("");
  const [source, setSource] = useState<SourceMode>("product");
  const [productId, setProductId] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [cta, setCta] = useState("Shop Now");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [describeText, setDescribeText] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [goal, setGoal] = useState("AWARENESS");
  const [category, setCategory] = useState(AD_CATEGORIES[0]);
  const [budget, setBudget] = useState("50");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState("");
  const [placements, setPlacements] = useState<Record<string, boolean>>({});
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const j = await fetch("/api/ads?limit=30").then((r) => r.json());
      if (!j?.success || !j.data) { setError("Could not load your campaigns."); return; }
      const base: Campaign[] = Array.isArray(j.data.campaigns) ? j.data.campaigns : [];
      setStats(j.data.stats && typeof j.data.stats === "object" ? j.data.stats : {});
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
      } catch { /* no store / not available */ }
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

  // Providers (enabled flags) + store/products for the source picker.
  useEffect(() => {
    let alive = true;
    fetch("/api/ads/providers").then((r) => r.json()).then((j) => {
      if (!alive || !j?.success || !Array.isArray(j.data?.providers)) return;
      const list = j.data.providers as Provider[];
      setProviders(list);
      // Default: select all enabled non-spotlight placements.
      setPlacements(Object.fromEntries(list.filter((p) => p.enabled && p.id !== "spotlight").map((p) => [p.id, true])));
    }).catch(() => {});
    fetch("/api/ecommerce/products?limit=50").then(async (r) => {
      if (!alive) return;
      if (r.ok) {
        const j = await r.json();
        if (j?.success && Array.isArray(j.data?.products)) { setProducts(j.data.products as ProductOption[]); setHasStore(true); return; }
      }
      setHasStore(false);
    }).catch(() => { if (alive) setHasStore(false); });
    return () => { alive = false; };
  }, []);

  const productById = useCallback((id: string) => products.find((p) => p.id === id), [products]);

  // Pick a product → pull its promote defaults to prefill the creative.
  const pickProduct = async (id: string) => {
    setProductId(id);
    setPickerOpen(false);
    setMediaUrl(productById(id)?.images?.[0]?.url ?? null);
    try {
      const j = await fetch(`/api/ecommerce/promote?productId=${id}`).then((r) => r.json());
      if (j?.success && j.data) {
        const d = j.data as PromoteDefaults;
        setName(d.name || name);
        setHeadline(d.headline || "");
        setDescription(d.description || "");
        setCta(d.ctaText || "Shop Now");
        setDestinationUrl(d.destinationUrl || "");
        if (d.mediaUrl) setMediaUrl(d.mediaUrl);
      }
    } catch { /* keep current creative */ }
  };

  const selectedPlacementIds = useMemo(() => providers.filter((p) => placements[p.id] && p.enabled).map((p) => p.id), [providers, placements]);
  const budgetNum = Math.max(0, Math.round(Number(budget) || 0));
  const product = productId ? productById(productId) : null;

  // Hand a structured brief to the agent and let it generate + launch.
  const buildWithAI = () => {
    if (!onAsk) return;
    let sourceLine = "";
    if (source === "product") sourceLine = product ? `my store product "${product.name}" (${money(product.priceCents / 100)})` : "one of my store products (I'll pick)";
    else if (source === "link") sourceLine = destinationUrl.trim() ? `this link: ${destinationUrl.trim()}` : "a product/page link I'll provide";
    else sourceLine = describeText.trim() ? `this idea: ${describeText.trim()}` : "an idea I'll describe";
    const places = selectedPlacementIds.length ? selectedPlacementIds.map(provName).join(", ") : "my enabled providers";
    const prompt = [
      `Create and launch an ad campaign called "${name.trim() || "Untitled ad campaign"}".`,
      brief.trim() ? `What I want: ${brief.trim()}` : "",
      `Advertise ${sourceLine}.`,
      `Generate the ad creative (a scroll-stopping image + punchy headline & description${headline.trim() ? ` — refine my draft headline "${headline.trim()}"` : ""}) and a strong call-to-action.`,
      `Goal: ${OBJECTIVES.find((o) => o[0] === goal)?.[1] ?? goal}. Category: ${category}. Placements: ${places}.`,
      `Budget: ${budgetNum} credits${startDate ? `, starting ${startDate}` : ""}${endDate ? ` until ${endDate}` : ""}.`,
      `Set sensible targeting, propose the plan + exact credit cost first, and on my confirm launch it. Tell me when it's live or in review.`,
    ].filter(Boolean).join("\n");
    onAsk(prompt);
    setWorking(true);
    setTimeout(() => setWorking(false), 6000);
  };

  // Direct launch (no agent): product → /api/ecommerce/promote, link → /api/ads.
  const launchAsIs = async () => {
    setLaunchError("");
    if (budgetNum < 1) { setLaunchError("Set a budget of at least 1 credit."); return; }
    if (!headline.trim()) { setLaunchError("Add a headline for your ad."); return; }
    setLaunching(true);
    try {
      let r: Response;
      if (source === "product") {
        if (!productId) { setLaunchError("Pick a product to advertise."); setLaunching(false); return; }
        r = await fetch("/api/ecommerce/promote", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId, headline: headline.trim(), description: description.trim() || undefined, ctaText: cta,
            budget: budgetNum, startDate: startDate || todayStr(), endDate: endDate || undefined,
            targeting: { placementChannels: selectedPlacementIds },
          }),
        });
      } else if (source === "link") {
        if (!/^https?:\/\/.+/i.test(destinationUrl.trim())) { setLaunchError("Enter a destination URL (http:// or https://)."); setLaunching(false); return; }
        r = await fetch("/api/ads", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || "Untitled ad campaign", objective: goal, adType: "EXTERNAL_URL",
            destinationUrl: destinationUrl.trim(), headline: headline.trim(), description: description.trim() || undefined,
            ctaText: cta, adCategory: category, mediaUrl: mediaUrl || undefined,
            budget: budgetNum, startDate: startDate || todayStr(), endDate: endDate || undefined,
          }),
        });
      } else {
        setLaunchError("“Describe it” has no link to send traffic to — use Build with AI, or switch to a product/link.");
        setLaunching(false);
        return;
      }
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        setNotice(`“${name.trim() || "Campaign"}” submitted — it's in review and goes live once approved. ${budgetNum} credits reserved.`);
        newCampaign();
        await load();
      } else {
        const code = j?.error?.code;
        setLaunchError(code === "PLAN_UPGRADE_REQUIRED" ? "Ad campaigns need purchased credits — top up to launch." : (j?.error?.message || "Could not launch the campaign. Try again."));
      }
    } catch {
      setLaunchError("Could not launch the campaign. Try again.");
    } finally {
      setLaunching(false);
    }
  };

  const togglePlacement = (id: string) => setPlacements((p) => ({ ...p, [id]: !p[id] }));

  const newCampaign = () => {
    setName("Untitled ad campaign"); setBrief(""); setSource("product"); setProductId(null);
    setHeadline(""); setDescription(""); setCta("Shop Now"); setDestinationUrl(""); setDescribeText("");
    setMediaUrl(null); setGoal("AWARENESS"); setCategory(AD_CATEGORIES[0]); setBudget("50");
    setStartDate(todayStr()); setEndDate(""); setLaunchError("");
  };

  // Pause/activate (PATCH status) — optimistic.
  const toggleStatus = async (c: Campaign) => {
    const cur = (c.status || "").toUpperCase();
    if (cur !== "ACTIVE" && cur !== "PAUSED") return;
    const next = cur === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setBusyId(c.id);
    setCampaigns((list) => list.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    try {
      const r = await fetch(`/api/ads/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!r.ok) setCampaigns((list) => list.map((x) => (x.id === c.id ? { ...x, status: c.status } : x)));
      else await load();
    } catch {
      setCampaigns((list) => list.map((x) => (x.id === c.id ? { ...x, status: c.status } : x)));
    } finally {
      setBusyId(null);
    }
  };

  const deleteCampaign = async (id: string) => {
    setCampaigns((list) => list.filter((c) => c.id !== id));
    try { await fetch(`/api/ads/${id}`, { method: "DELETE" }); } catch { /* ignore */ }
    load();
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your campaigns…" /></div>;
  }

  const totalRevenue = campaigns.reduce((s, c) => s + (c.revenue ?? 0), 0);
  const spentForRoas = campaigns.reduce((s, c) => s + (c.revenue != null ? (c.spent ?? 0) : 0), 0);
  const portfolioRoas = spentForRoas > 0 ? totalRevenue / spentForRoas : 0;
  const total = stats.total ?? campaigns.length;
  const active = stats.active ?? campaigns.filter((c) => (c.status || "").toUpperCase() === "ACTIVE").length;
  const totalSpend = stats.totalSpent ?? campaigns.reduce((s, c) => s + (c.spent ?? 0), 0);
  const totalImpr = stats.totalImpressions ?? campaigns.reduce((s, c) => s + (c.impressions ?? 0), 0);
  const enabledProviders = providers.filter((p) => p.enabled);
  const detailCampaign = campaigns.find((c) => c.id === detailId) || null;
  const canDirect = source !== "describe";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* toolbar */}
      <div className="z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card/40 px-4 py-2.5 backdrop-blur">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"><Megaphone className="h-4 w-4 text-brand-500" /> Ad builder playground</span>
        {providers.length > 0 && (
          <span className="hidden flex-wrap items-center gap-1.5 md:inline-flex">
            <span className="text-[11px] text-muted-foreground">Providers:</span>
            {providers.map((p) => {
              const v = provVis(p.id);
              return (
                <span key={p.id} title={p.enabled ? "Live" : "Not connected"} className={cn("inline-flex items-center gap-1.5 rounded-full border bg-muted py-0.5 pe-2.5 ps-1.5 text-[11px] font-semibold", p.enabled ? "border-emerald-500/35 text-foreground" : "border-border text-muted-foreground")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", p.enabled ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" : "bg-muted-foreground")} />
                  <span className="grid h-4 w-4 place-items-center rounded text-[8px] font-extrabold text-white" style={{ background: v.color }}>{v.mark}</span>
                  {p.name.replace(/ Ads$/, "")}
                </span>
              );
            })}
          </span>
        )}
        <div className="ms-auto flex items-center gap-2">
          <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground"><LayoutGrid className="h-3.5 w-3.5" /> Library{total > 0 ? ` · ${total}` : ""}</button>
          <button onClick={newCampaign} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" /> New campaign</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* canvas */}
        <div className="relative min-h-0 flex-1 overflow-auto" style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.18) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
          <div className="flex min-h-full flex-col items-center px-6 py-6">
            <div className="w-full max-w-[560px]">
              {/* name */}
              <div className="mb-3.5 flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-brand-500/10 text-brand-500"><Megaphone className="h-4 w-4" /></span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" className="min-w-0 flex-1 rounded-[9px] border border-transparent bg-transparent px-2 py-1.5 text-[16px] font-bold outline-none hover:border-border focus:border-brand-500/60 focus:bg-background" />
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-amber-500">Draft</span>
              </div>

              {notice && <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-500">{notice}</p>}

              {/* AI hero */}
              <div className="mb-4 rounded-2xl border border-brand-500/35 bg-gradient-to-r from-brand-500/10 to-violet-500/10 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[10.5px] font-bold text-white"><Sparkles className="h-3 w-3" /> Build with AI</span>
                  <h3 className="text-[13px] font-bold">Describe it or pick a product — the agent builds the whole ad</h3>
                </div>
                <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2}
                  placeholder="e.g. Promote my Aurora Lamp to cozy-home-decor lovers — punchy creative, $50 budget, run on Feed + Meta."
                  className="mt-2.5 w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60" />
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">Generates the creative + copy + targeting · suggests budget · launches on your enabled providers · you confirm cost first.</span>
                  <button onClick={buildWithAI} disabled={!onAsk} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Build the ad</button>
                </div>
              </div>

              {/* SOURCE node */}
              <div className="rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2.5 px-3.5 py-3">
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-brand-500/10 text-brand-500"><Target className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What you&apos;re advertising</div><div className="text-[13px] font-bold">Pick the source — the ad generates from it</div></div>
                  <span className="shrink-0 rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-500">source</span>
                </div>
                <div className="flex gap-1.5 px-3.5 pb-2.5">
                  {([["product", "Store product", Package], ["link", "Product / link", Link2], ["describe", "Describe it", PenLine]] as const).map(([m, label, Icon]) => (
                    <button key={m} onClick={() => setSource(m)} className={cn("inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11.5px] font-semibold transition", source === m ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-muted text-muted-foreground hover:text-foreground")}>
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
                <div className="px-3.5 pb-3.5">
                  {source === "product" ? (
                    hasStore === false ? (
                      <div className="rounded-[11px] border border-dashed border-border bg-muted/40 px-4 py-5 text-center">
                        <p className="text-[12.5px] font-semibold">No store yet</p>
                        <p className="mt-1 text-[11.5px] text-muted-foreground">Build a store to advertise your products directly.</p>
                        <button onClick={() => onAsk?.("Help me build my online store so I can advertise my products.")} disabled={!onAsk} className="mt-2.5 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Build a store</button>
                      </div>
                    ) : product ? (
                      <div className="flex items-center gap-3 rounded-[11px] border border-border bg-muted px-3 py-2.5">
                        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-background">
                          {mediaUrl ? <Image src={mediaUrl} alt="" width={56} height={56} className="h-full w-full object-cover" unoptimized /> : <Package className="h-5 w-5 text-muted-foreground" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-bold">{product.name}</div>
                          <div className="text-[12.5px] font-extrabold text-emerald-500">{money(product.priceCents / 100)}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">The ad generates its creative &amp; copy from this product.</div>
                        </div>
                        <button onClick={() => setPickerOpen(true)} className="shrink-0 rounded-[8px] border border-border px-2.5 py-1 text-[11px] font-semibold hover:border-brand-500/60 hover:text-foreground">Change</button>
                      </div>
                    ) : (
                      <button onClick={() => setPickerOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-[11px] border border-dashed border-border bg-muted/40 px-4 py-4 text-[12.5px] font-semibold text-muted-foreground transition hover:border-brand-500/50 hover:text-foreground"><Package className="h-4 w-4" /> Pick a product to advertise</button>
                    )
                  ) : source === "link" ? (
                    <>
                      <label className="mb-1.5 block text-[11.5px] font-semibold text-muted-foreground">Product or page link</label>
                      <input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} inputMode="url" placeholder="https://your-store.com/product/aurora-lamp" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
                      <p className="mt-2 text-[11px] text-muted-foreground">Paste any product or landing-page URL — “Build with AI” reads it and writes the ad creative &amp; copy from it.</p>
                    </>
                  ) : (
                    <>
                      <label className="mb-1.5 block text-[11.5px] font-semibold text-muted-foreground">Describe what to advertise</label>
                      <textarea value={describeText} onChange={(e) => setDescribeText(e.target.value)} rows={3} className="w-full resize-y rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-brand-500/60" placeholder="e.g. A cozy autumn sale on home decor — warm, inviting, 20% off everything." />
                    </>
                  )}
                </div>
              </div>

              <Connector />

              {/* CREATIVE node — ad preview */}
              <div className="rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2.5 px-3.5 py-3">
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-violet-500/10 text-violet-400"><ImageIcon className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ad creative</div><div className="text-[13px] font-bold">Headline, copy &amp; image — AI-generated, editable</div></div>
                  <button onClick={buildWithAI} disabled={!onAsk} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-foreground disabled:opacity-50"><Wand2 className="h-3 w-3" /> Regenerate</button>
                </div>
                <div className="px-3.5 pb-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {/* preview */}
                    <div className="min-w-0 flex-1 overflow-hidden rounded-[14px] border border-border bg-background">
                      <div className="relative grid aspect-[1.91] w-full place-items-center bg-gradient-to-br from-brand-500/15 to-violet-500/15 text-muted-foreground">
                        {mediaUrl ? <Image src={mediaUrl} alt="" fill sizes="360px" className="object-cover" unoptimized /> : <ImageIcon className="h-9 w-9" />}
                        <button onClick={buildWithAI} disabled={!onAsk} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-2 py-1 text-[10.5px] font-semibold text-white shadow disabled:opacity-50"><Sparkles className="h-3 w-3" /> AI image</button>
                      </div>
                      <div className="p-3">
                        <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{(destinationUrl || product?.name) ? (destinationUrl ? safeHost(destinationUrl) : "your store") : "your-store.com"}</div>
                        <div className="mt-0.5 text-[14px] font-bold leading-snug">{headline || "Your headline appears here"}</div>
                        <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{description || "A short, punchy description of the offer or product."}</div>
                        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-muted px-3 py-1.5 text-[12px] font-bold">{cta} <ArrowRight className="h-3 w-3" /></span>
                      </div>
                    </div>
                    {/* inputs */}
                    <div className="w-full shrink-0 sm:w-[170px]">
                      <label className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Headline</label>
                      <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} placeholder="Get 20% off" className="w-full rounded-[9px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
                      <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold text-muted-foreground">Description</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={300} placeholder="Short line…" className="w-full resize-y rounded-[9px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
                      <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold text-muted-foreground">Call to action</label>
                      <select value={cta} onChange={(e) => setCta(e.target.value)} className="w-full rounded-[9px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60">{CTAS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                    </div>
                  </div>
                </div>
              </div>

              <Connector />

              {/* GOAL + PLACEMENT node */}
              <div className="rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2.5 px-3.5 py-3">
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-brand-500/10 text-brand-500"><Rocket className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Goal &amp; placement</div><div className="text-[13px] font-bold">Where it runs &amp; what it optimizes for</div></div>
                </div>
                <div className="px-3.5 pb-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div><label className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Goal</label><select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60">{OBJECTIVES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                    <div><label className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60">{AD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                  </div>
                  <label className="mb-1.5 mt-3 block text-[11.5px] font-semibold text-muted-foreground">Placements — only your enabled providers can run</label>
                  {providers.filter((p) => p.id !== "spotlight").map((p) => {
                    const v = provVis(p.id);
                    const on = !!placements[p.id] && p.enabled;
                    return (
                      <div key={p.id} className={cn("mt-2 flex items-center gap-2.5 rounded-[11px] border border-border bg-muted px-3 py-2.5", !p.enabled && "opacity-60")}>
                        <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] text-[11px] font-extrabold text-white" style={{ background: v.color }}>{v.mark}</span>
                        <div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold">{p.name}</div><div className="text-[10.5px] text-muted-foreground">{p.enabled ? "Live — your approved ads run here" : "Not connected — an admin can enable it"}</div></div>
                        {p.enabled ? (
                          <button onClick={() => togglePlacement(p.id)} className={cn("relative h-5 w-9 shrink-0 rounded-full border transition", on ? "border-transparent bg-gradient-to-r from-brand-500 to-violet-500" : "border-border bg-muted")}><span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all", on ? "left-[18px]" : "left-0.5")} /></button>
                        ) : (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Off</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Connector />

              {/* BUDGET node */}
              <div className="rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2.5 px-3.5 py-3">
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-brand-500/10 text-brand-500"><Coins className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Budget &amp; schedule</div><div className="text-[13px] font-bold">What you spend &amp; when it runs</div></div>
                </div>
                <div className="px-3.5 pb-3.5">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div><label className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Budget (credits)</label><input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" /></div>
                    <div><label className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Start date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" /></div>
                    <div><label className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">End date</label><input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" /></div>
                  </div>
                  <p className="mt-2.5 text-[11px] text-muted-foreground">Est. reach <b className="text-foreground">~{(budgetNum * 250).toLocaleString()}–{(budgetNum * 360).toLocaleString()}</b> impressions · link &amp; product ads are reviewed before going live.</p>
                </div>
              </div>

              {launchError && <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{launchError}</p>}

              {/* LAUNCH node */}
              <div className="mt-4 rounded-2xl border border-brand-500/40 bg-gradient-to-r from-brand-500/10 to-violet-500/10 p-3.5 text-center">
                <div className="mb-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-bold"><Rocket className="h-4 w-4 text-brand-500" /> Launch campaign</div>
                <p className="mb-2.5 text-[12px] text-muted-foreground">The agent finalizes the creative &amp; copy, sets targeting, and launches across your enabled providers. You confirm the budget &amp; cost first.</p>
                <button onClick={buildWithAI} disabled={!onAsk} className="mx-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50"><Sparkles className="h-4 w-4" /> Build &amp; launch with AI</button>
                <div className="mt-2">
                  <button onClick={launchAsIs} disabled={launching || !canDirect} title={canDirect ? "" : "“Describe it” has no destination — use Build with AI"} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground disabled:opacity-50">
                    {launching ? <FlowLoader size={13} /> : <Rocket className="h-3.5 w-3.5" />} Launch as-is · {budgetNum} cr
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* rail */}
        <aside className="hidden w-[268px] shrink-0 flex-col border-l border-border bg-card/40 lg:flex">
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-3 text-[12px] font-bold"><Megaphone className="h-4 w-4 text-brand-500" /> Campaigns <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-[10.5px] tabular-nums text-muted-foreground">{total}</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {error && <p className="mb-2 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11.5px] text-rose-500">{error}</p>}
            {campaigns.length ? campaigns.map((c) => {
              const meta = statusMeta(c.status, c.approvalStatus);
              const media = c.mediaUrl || c.post?.mediaUrl || null;
              return (
                <button key={c.id} onClick={() => setDetailId(c.id)} className="mb-2 block w-full overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-brand-500/50">
                  <div className="flex gap-2.5 p-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-background">{media ? <Image src={media} alt="" width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5"><b className="min-w-0 flex-1 truncate text-[12.5px]">{c.name || c.headline || "Untitled"}</b><span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold", meta.tone)}><meta.icon className="h-2.5 w-2.5" /> {meta.label}</span></div>
                      <div className="mt-1.5 flex gap-1">{(c.providers ?? []).slice(0, 4).map((pid) => { const v = provVis(pid); return <span key={pid} className="grid h-4 w-4 place-items-center rounded text-[8px] font-extrabold text-white" style={{ background: v.color }}>{v.mark}</span>; })}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 border-t border-border">
                    <RailStat value={money(c.spent)} label="Spend" tone="emerald" />
                    <RailStat value={num(c.impressions)} label="Impr." border />
                    <RailStat value={c.roas != null && c.roas > 0 ? `${c.roas.toFixed(1)}×` : "—"} label="ROAS" />
                  </div>
                </button>
              );
            }) : <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center"><p className="text-[12px] font-medium">No campaigns yet</p><p className="mt-1 text-[11px] text-muted-foreground">Build an ad on the canvas and launch it.</p></div>}
          </div>
        </aside>
      </div>

      {/* product picker */}
      {pickerOpen && (
        <ProductPicker products={products} selected={productId} onPick={pickProduct} onClose={() => setPickerOpen(false)} />
      )}

      {/* library */}
      {libOpen && (
        <CampaignLibrary
          campaigns={campaigns} filter={libFilter} busyId={busyId} hasRoas={hasRoas}
          totals={{ total, active, totalSpend, totalImpr, portfolioRoas }}
          onFilter={setLibFilter} onToggle={toggleStatus} onOpen={(id) => { setLibOpen(false); setDetailId(id); }}
          onNew={() => { setLibOpen(false); newCampaign(); }} onClose={() => setLibOpen(false)}
        />
      )}

      {/* detail drawer */}
      {detailCampaign && (
        <CampaignDetailDrawer campaign={detailCampaign} busy={busyId === detailCampaign.id} onToggle={() => toggleStatus(detailCampaign)} onDelete={() => { setDetailId(null); deleteCampaign(detailCampaign.id); }} onClose={() => setDetailId(null)} />
      )}

      {/* agent working banner */}
      {working && (
        <div className="absolute bottom-4 left-1/2 z-[55] flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-brand-500/40 bg-card px-4 py-2.5 shadow-2xl"><FlowLoader size={15} /><span className="text-[12px]">The agent is generating your ad creative &amp; targeting — confirm the budget in the chat on the left.</span></div>
      )}
    </div>
  );
}

function safeHost(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url.replace(/^https?:\/\//, "").split("/")[0] || "your-store.com"; }
}

function Connector() {
  return <div className="flex flex-col items-center"><div className="h-4 w-0.5 bg-gradient-to-b from-brand-500/50 to-violet-500/40" /><div className="h-4 w-0.5 bg-gradient-to-b from-violet-500/40 to-brand-500/50" /></div>;
}

function RailStat({ value, label, tone, border }: { value: string; label: string; tone?: "emerald"; border?: boolean }) {
  return (
    <div className={cn("px-2 py-1.5 text-center", border && "border-x border-border")}>
      <div className={cn("text-[13px] font-extrabold tabular-nums", tone === "emerald" && "text-emerald-500")}>{value}</div>
      <div className="text-[9.5px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product picker — a bottom sheet grid of store products.
// ---------------------------------------------------------------------------

function ProductPicker({ products, selected, onPick, onClose }: { products: ProductOption[]; selected: string | null; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute bottom-0 flex max-h-[80%] w-full max-w-[760px] flex-col rounded-t-[18px] border border-b-0 border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex items-center gap-2 px-4 pb-2 pt-4">
          <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold"><Package className="h-4 w-4 text-brand-500" /> Pick a product to advertise</span>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-4">
          {products.length ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => {
                const img = p.images?.[0]?.url || null;
                return (
                  <button key={p.id} onClick={() => onPick(p.id)} className={cn("overflow-hidden rounded-[12px] border bg-muted text-left transition hover:border-brand-500/60", selected === p.id ? "border-brand-500/60" : "border-border")}>
                    <div className="grid aspect-[1.3] w-full place-items-center overflow-hidden bg-background">{img ? <Image src={img} alt="" width={160} height={123} className="h-full w-full object-cover" unoptimized /> : <Package className="h-6 w-6 text-muted-foreground" />}</div>
                    <div className="p-2"><div className="truncate text-[12px] font-semibold">{p.name}</div><div className="text-[12px] font-extrabold text-emerald-500">{money(p.priceCents / 100)}</div></div>
                  </button>
                );
              })}
            </div>
          ) : <p className="py-10 text-center text-[12.5px] text-muted-foreground">No products yet. Add products to your store first.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign library — every campaign with KPIs, status filter, and per-campaign
// status + statistics (spend / impressions / clicks / ROAS).
// ---------------------------------------------------------------------------

function CampaignLibrary({ campaigns, filter, busyId, hasRoas, totals, onFilter, onToggle, onOpen, onNew, onClose }: {
  campaigns: Campaign[];
  filter: LibFilter;
  busyId: string | null;
  hasRoas: boolean;
  totals: { total: number; active: number; totalSpend: number; totalImpr: number; portfolioRoas: number };
  onFilter: (f: LibFilter) => void;
  onToggle: (c: Campaign) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const isStatus = (c: Campaign, f: Exclude<LibFilter, "all">) => {
    const s = (c.status || "").toUpperCase();
    const a = (c.approvalStatus || "").toUpperCase();
    if (f === "active") return s === "ACTIVE";
    if (f === "paused") return s === "PAUSED";
    return a === "PENDING" || s === "PENDING_REVIEW" || s === "PENDING";
  };
  const counts = {
    all: campaigns.length,
    active: campaigns.filter((c) => isStatus(c, "active")).length,
    review: campaigns.filter((c) => isStatus(c, "review")).length,
    paused: campaigns.filter((c) => isStatus(c, "paused")).length,
  };
  const list = campaigns.filter((c) => filter === "all" ? true : isStatus(c, filter));
  const kpis = [
    { n: totals.total.toLocaleString(), l: "Campaigns" },
    { n: money(totals.totalSpend), l: "Total spend" },
    { n: totals.totalImpr.toLocaleString(), l: "Impressions" },
    { n: hasRoas ? `${totals.portfolioRoas.toFixed(2)}×` : `${totals.active}`, l: hasRoas ? "Portfolio ROAS" : "Active" },
  ];
  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-background/97 backdrop-blur">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold"><LayoutGrid className="h-4 w-4 text-brand-500" /> Ad campaign library</span>
        <span className="hidden text-[11.5px] text-muted-foreground sm:inline">every campaign — status &amp; statistics</span>
        <div className="ms-auto flex items-center gap-2">
          <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" /> New campaign</button>
          <button onClick={onClose} aria-label="Close library" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {kpis.map((k) => <div key={k.l} className="rounded-[13px] border border-border bg-card px-3.5 py-3"><div className="text-[22px] font-extrabold leading-none tabular-nums">{k.n}</div><div className="mt-1.5 text-[11px] text-muted-foreground">{k.l}</div></div>)}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {([["all", "All"], ["active", "Active"], ["review", "In review"], ["paused", "Paused"]] as const).map(([f, label]) => (
            <button key={f} onClick={() => onFilter(f)} className={cn("inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11.5px] font-semibold transition", filter === f ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-muted text-muted-foreground hover:text-foreground")}>{label} · {counts[f]}</button>
          ))}
        </div>
        {list.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => {
              const meta = statusMeta(c.status, c.approvalStatus);
              const media = c.mediaUrl || c.post?.mediaUrl || null;
              const canToggle = ["ACTIVE", "PAUSED"].includes((c.status || "").toUpperCase());
              return (
                <div key={c.id} className="overflow-hidden rounded-[14px] border border-border bg-card transition hover:border-brand-500/50">
                  <div className="flex gap-2.5 px-3.5 py-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-background">{media ? <Image src={media} alt="" width={48} height={48} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold">{c.name || c.headline || "Untitled"}</div>
                      <div className="mt-1 flex gap-1">{(c.providers ?? []).slice(0, 5).map((pid) => { const v = provVis(pid); return <span key={pid} title={provName(pid)} className="grid h-[18px] w-[18px] place-items-center rounded text-[9px] font-extrabold text-white" style={{ background: v.color }}>{v.mark}</span>; })}</div>
                    </div>
                    <span className={cn("inline-flex h-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", meta.tone)}><meta.icon className="h-3 w-3" /> {meta.label}</span>
                  </div>
                  <div className="grid grid-cols-4 border-t border-border">
                    <LibStat value={money(c.spent)} label="Spend" tone="emerald" />
                    <LibStat value={num(c.impressions)} label="Impr." border />
                    <LibStat value={num(c.clicks)} label="Clicks" border />
                    <LibStat value={c.roas != null && c.roas > 0 ? `${c.roas.toFixed(2)}×` : "—"} label="ROAS" />
                  </div>
                  <div className="flex items-center gap-2 border-t border-border bg-card/40 px-3.5 py-2.5">
                    {canToggle && (
                      <button onClick={() => onToggle(c)} disabled={busyId === c.id} className={cn("inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1 text-[11.5px] font-semibold transition disabled:opacity-60", (c.status || "").toUpperCase() === "ACTIVE" ? "border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" : "border-brand-500/40 bg-brand-500/5 text-brand-500 hover:bg-brand-500/10")}>
                        {busyId === c.id ? <FlowLoader size={13} /> : (c.status || "").toUpperCase() === "ACTIVE" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {(c.status || "").toUpperCase() === "ACTIVE" ? "Pause" : "Activate"}
                      </button>
                    )}
                    <button onClick={() => onOpen(c.id)} className="ms-auto inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-brand-500">Open <ArrowRight className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid place-items-center py-20 text-center"><div className="max-w-xs"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Megaphone className="h-6 w-6" /></span><p className="mt-3 text-[13px] font-semibold">No {filter === "all" ? "" : filter} campaigns</p><p className="mt-1 text-[12px] text-muted-foreground">Build an ad on the canvas and launch it.</p></div></div>
        )}
      </div>
    </div>
  );
}

function LibStat({ value, label, tone, border }: { value: string; label: string; tone?: "emerald"; border?: boolean }) {
  return (
    <div className={cn("px-2 py-2.5 text-center", border && "border-x border-border")}>
      <div className={cn("text-[15px] font-extrabold tabular-nums", tone === "emerald" && "text-emerald-500")}>{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer — the ad creative, full metrics, providers, ad-page link, and
// pause/activate + delete (two-step). Renders from the campaign object.
// ---------------------------------------------------------------------------

function CampaignDetailDrawer({ campaign: c, busy, onToggle, onDelete, onClose }: { campaign: Campaign; busy: boolean; onToggle: () => void; onDelete: () => void; onClose: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = statusMeta(c.status, c.approvalStatus);
  const media = c.mediaUrl || c.post?.mediaUrl || null;
  const live = c.adPage?.slug ? `/ad/${c.adPage.slug}` : null;
  const canToggle = ["ACTIVE", "PAUSED"].includes((c.status || "").toUpperCase());
  return (
    <div className="absolute inset-0 z-[70] flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-background">{media ? <Image src={media} alt="" width={36} height={36} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><p className="truncate text-[14px] font-bold">{c.name || c.headline || "Campaign"}</p><span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", meta.tone)}><meta.icon className="h-3 w-3" /> {meta.label}</span></div>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{c.objective ? c.objective.toLowerCase() : "campaign"}{c.startDate ? ` · started ${fmt(c.startDate)}` : ""}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {c.rejectionReason && <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-2.5 py-1.5 text-[11.5px] text-rose-500"><span className="font-semibold">Rejected:</span> {c.rejectionReason}</p>}

          {/* ad preview */}
          <div className="overflow-hidden rounded-[14px] border border-border bg-background">
            <div className="relative grid aspect-[1.91] w-full place-items-center bg-gradient-to-br from-brand-500/15 to-violet-500/15 text-muted-foreground">{media ? <Image src={media} alt="" fill sizes="420px" className="object-cover" unoptimized /> : <ImageIcon className="h-9 w-9" />}</div>
            <div className="p-3">
              {c.destinationUrl && <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{safeHost(c.destinationUrl)}</div>}
              <div className="mt-0.5 text-[14px] font-bold leading-snug">{c.headline || "—"}</div>
              {c.description && <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{c.description}</div>}
              {c.ctaText && <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-muted px-3 py-1.5 text-[12px] font-bold">{c.ctaText} <ArrowRight className="h-3 w-3" /></span>}
            </div>
          </div>

          {/* metrics */}
          <h4 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Performance</h4>
          <div className="grid grid-cols-3 gap-2">
            <Metric icon={Coins} label="Spend" value={`${money(c.spent)}${c.budget ? ` / ${money(c.budget)}` : ""}`} />
            <Metric icon={Eye} label="Impressions" value={num(c.impressions)} />
            <Metric icon={MousePointerClick} label="Clicks" value={num(c.clicks)} />
            <Metric icon={MousePointerClick} label="CTR" value={c.ctr != null ? `${c.ctr}%` : "—"} />
            <Metric icon={Target} label="Conversions" value={num(c.conversions)} />
            {c.roas != null ? <Metric icon={TrendingUp} label="ROAS" value={`${c.roas.toFixed(2)}×`} /> : <Metric icon={Coins} label="Daily" value={c.dailyBudget ? money(c.dailyBudget) : "—"} />}
          </div>
          {c.revenue != null && <div className="mt-2"><Metric icon={Coins} label="Revenue" value={money(c.revenue)} /></div>}

          {/* providers */}
          {(c.providers?.length || c.objective) && (
            <>
              <h4 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Placements</h4>
              <div className="flex flex-wrap gap-1.5">
                {(c.providers ?? []).map((pid) => { const v = provVis(pid); return <span key={pid} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-1 text-[11px] font-semibold"><span className="grid h-4 w-4 place-items-center rounded text-[8px] font-extrabold text-white" style={{ background: v.color }}>{v.mark}</span>{provName(pid)}</span>; })}
              </div>
            </>
          )}

          {live && <a href={live} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> View ad page</a>}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          {confirmDelete ? (
            <>
              <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3 py-2 text-[12px] font-semibold text-white hover:bg-rose-600"><Trash2 className="h-3.5 w-3.5" /> Confirm delete</button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
            </>
          ) : (
            <>
              {canToggle && (
                <button onClick={onToggle} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">
                  {busy ? <FlowLoader size={14} tone="white" /> : (c.status || "").toUpperCase() === "ACTIVE" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {(c.status || "").toUpperCase() === "ACTIVE" ? "Pause campaign" : "Activate campaign"}
                </button>
              )}
              <button onClick={() => setConfirmDelete(true)} className={cn("inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/30 px-3 py-2 text-[12px] font-semibold text-rose-500 hover:bg-rose-500/5", !canToggle && "flex-1 justify-center")}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="flex items-center gap-1 text-muted-foreground"><Icon className="h-3 w-3" /><span className="text-[10.5px] font-medium">{label}</span></div>
      <p className="mt-0.5 text-[13px] font-bold leading-none">{value}</p>
    </div>
  );
}
