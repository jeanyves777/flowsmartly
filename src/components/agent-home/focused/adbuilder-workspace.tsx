"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Megaphone, Sparkles, ExternalLink, Coins, Eye, MousePointerClick, TrendingUp, CheckCircle2, Clock, XCircle, Image as ImageIcon, Target, Plus, Link2, LayoutGrid, Rocket, Package, PenLine, ArrowRight, ArrowLeft, ArrowLeftRight, Wand2, Trash2, Pause, Play, X, Check, GripVertical } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Ad builder — an AI-driven ad PLAYGROUND laid out as a HORIZONTAL NODE WIZARD:
 * the build steps live inline on a left↔right scrollable dotted canvas as
 * draggable node cards the user can move & rearrange (like the native node
 * playground). Steps: Source → Creative → Goal & placement → Budget → Review &
 * launch. A pinned "Build with AI" skips the steps and hands the whole thing to
 * the agent (onAsk).
 *
 * Source can be a STORE PRODUCT (creative auto-fills from /api/ecommerce/promote
 * defaults; products from /api/ecommerce/products), a product/page LINK, or a
 * DESCRIPTION. The toolbar shows ACTIVE providers (/api/ads/providers, enabled
 * flags). "Build & launch with AI" → agent handoff; "Launch as-is" posts to
 * /api/ecommerce/promote (product) or /api/ads (link). The toolbar Library lists
 * every campaign with status + statistics; a detail drawer offers pause/activate
 * (PATCH) + delete (DELETE). Read: GET /api/ads + ROAS from GET /api/ecommerce/ads.
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
function safeHost(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url.replace(/^https?:\/\//, "").split("/")[0] || "your-store.com"; }
}

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
type StepKey = "source" | "creative" | "placement" | "budget" | "review";
const DEFAULT_ORDER: StepKey[] = ["source", "creative", "placement", "budget", "review"];
const STEP_DEFS: Record<StepKey, { kicker: string; title: string; icon: ElementType }> = {
  source: { kicker: "What you're advertising", title: "Source", icon: Target },
  creative: { kicker: "Ad creative", title: "Creative", icon: ImageIcon },
  placement: { kicker: "Goal & placement", title: "Goal & placement", icon: Rocket },
  budget: { kicker: "Budget & schedule", title: "Budget", icon: Coins },
  review: { kicker: "Review", title: "Review & launch", icon: Rocket },
};

const FIELD = "w-full rounded-[9px] border border-input bg-background px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-500/60";

type CanvasBridge = { getContext: () => string; applyPatch: (patch: Record<string, unknown>) => void };

export function FocusedAdBuilder({ refreshKey, onAsk, agentBusy, canvasRef }: { refreshKey?: number; onAsk?: (prompt: string) => void; agentBusy?: boolean; canvasRef?: { current: CanvasBridge | null } }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  // Portal the header actions into the FocusedView shell header (#fv-header-slot)
  // so there's ONE top bar instead of a second full-width toolbar under it.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);
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

  // Wizard: ordered (pointer-draggable) steps + which is active (frontier).
  const [order, setOrder] = useState<StepKey[]>(DEFAULT_ORDER);
  const [cur, setCur] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ key: StepKey; idx: number; target: number } | null>(null);
  const [drag, setDrag] = useState<{ idx: number; dx: number; target: number } | null>(null);
  // Nodes the agent just filled — briefly ringed so the user SEES it land.
  const [flashKeys, setFlashKeys] = useState<Set<StepKey>>(() => new Set());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
              return { ...c, revenue: typeof m.revenueCents === "number" ? m.revenueCents / 100 : undefined, roas: typeof m.roas === "number" ? m.roas : undefined, orderCount: typeof m.orderCount === "number" ? m.orderCount : undefined };
            });
            setHasRoas(any);
          }
        }
      } catch { /* no store */ }
      setCampaigns(merged);
    } catch { setError("Could not load your campaigns."); }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  useEffect(() => {
    let alive = true;
    fetch("/api/ads/providers").then((r) => r.json()).then((j) => {
      if (!alive || !j?.success || !Array.isArray(j.data?.providers)) return;
      const list = j.data.providers as Provider[];
      setProviders(list);
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

  // Scroll the active node into view as the user advances/edits.
  useEffect(() => {
    const el = trackRef.current?.querySelector(`[data-step-idx="${cur}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [cur, order]);

  const productById = useCallback((id: string) => products.find((p) => p.id === id), [products]);

  const pickProduct = async (id: string) => {
    setProductId(id);
    setPickerOpen(false);
    setMediaUrl(productById(id)?.images?.[0]?.url ?? null);
    try {
      const j = await fetch(`/api/ecommerce/promote?productId=${id}`).then((r) => r.json());
      if (j?.success && j.data) {
        const d = j.data as PromoteDefaults;
        setName((n) => (n === "Untitled ad campaign" && d.name ? d.name : n));
        setHeadline(d.headline || "");
        setDescription(d.description || "");
        setCta(d.ctaText || "Shop Now");
        setDestinationUrl(d.destinationUrl || "");
        if (d.mediaUrl) setMediaUrl(d.mediaUrl);
      }
    } catch { /* keep current */ }
  };

  const selectedPlacementIds = useMemo(() => providers.filter((p) => placements[p.id] && p.enabled).map((p) => p.id), [providers, placements]);
  const budgetNum = Math.max(0, Math.round(Number(budget) || 0));
  const product = productId ? productById(productId) : null;

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
          body: JSON.stringify({ productId, headline: headline.trim(), description: description.trim() || undefined, ctaText: cta, budget: budgetNum, startDate: startDate || todayStr(), endDate: endDate || undefined, targeting: { placementChannels: selectedPlacementIds } }),
        });
      } else if (source === "link") {
        if (!/^https?:\/\/.+/i.test(destinationUrl.trim())) { setLaunchError("Enter a destination URL (http:// or https://)."); setLaunching(false); return; }
        r = await fetch("/api/ads", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() || "Untitled ad campaign", objective: goal, adType: "EXTERNAL_URL", destinationUrl: destinationUrl.trim(), headline: headline.trim(), description: description.trim() || undefined, ctaText: cta, adCategory: category, mediaUrl: mediaUrl || undefined, budget: budgetNum, startDate: startDate || todayStr(), endDate: endDate || undefined }),
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
    } catch { setLaunchError("Could not launch the campaign. Try again."); }
    finally { setLaunching(false); }
  };

  const togglePlacement = (id: string) => setPlacements((p) => ({ ...p, [id]: !p[id] }));

  const newCampaign = () => {
    setName("Untitled ad campaign"); setBrief(""); setSource("product"); setProductId(null);
    setHeadline(""); setDescription(""); setCta("Shop Now"); setDestinationUrl(""); setDescribeText("");
    setMediaUrl(null); setGoal("AWARENESS"); setCategory(AD_CATEGORIES[0]); setBudget("50");
    setStartDate(todayStr()); setEndDate(""); setLaunchError(""); setOrder(DEFAULT_ORDER); setCur(0);
  };

  const toggleStatus = async (c: Campaign) => {
    const curS = (c.status || "").toUpperCase();
    if (curS !== "ACTIVE" && curS !== "PAUSED") return;
    const next = curS === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setBusyId(c.id);
    setCampaigns((list) => list.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    try {
      const r = await fetch(`/api/ads/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!r.ok) setCampaigns((list) => list.map((x) => (x.id === c.id ? { ...x, status: c.status } : x)));
      else await load();
    } catch { setCampaigns((list) => list.map((x) => (x.id === c.id ? { ...x, status: c.status } : x))); }
    finally { setBusyId(null); }
  };

  const deleteCampaign = async (id: string) => {
    setCampaigns((list) => list.filter((c) => c.id !== id));
    try { await fetch(`/api/ads/${id}`, { method: "DELETE" }); } catch { /* ignore */ }
    load();
  };

  // Drag-to-reorder tracked on the WINDOW (not pointer-capture, which is flaky on
  // small handles) — the proven pattern from the design studio. The grabbed node
  // lifts and follows the cursor; it drops into the nearest slot on release.
  const targetIndexAt = (clientX: number, exclude: number): number | null => {
    const cards = trackRef.current?.querySelectorAll<HTMLElement>("[data-step-idx]");
    if (!cards) return null;
    let target: number | null = null;
    cards.forEach((card) => { const idx = Number(card.dataset.stepIdx); if (idx === exclude) return; const r = card.getBoundingClientRect(); if (clientX >= r.left && clientX <= r.right) target = idx; });
    return target;
  };
  const startDrag = (i: number) => (e: RPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button, input, textarea, select, a")) return;
    e.preventDefault();
    const startX = e.clientX;
    dragRef.current = { key: order[i], idx: i, target: i };
    setDrag({ idx: i, dx: 0, target: i });
    const move = (ev: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      const t = targetIndexAt(ev.clientX, d.idx);
      if (t !== null) d.target = t;
      setDrag({ idx: d.idx, dx: ev.clientX - startX, target: d.target });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const d = dragRef.current;
      if (d && d.target !== d.idx) {
        setOrder((prev) => {
          const from = prev.indexOf(d.key);
          if (from === -1 || from === d.target) return prev;
          const n = [...prev]; const [m] = n.splice(from, 1); n.splice(d.target, 0, m); return n;
        });
      }
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ── Live agent-fill bridge ─────────────────────────────────────────────
  // getContext serializes the open canvas (tagged [ADBUILDER]) for the agent;
  // applyPatch lands the agent's update_ad_canvas fields live — revealing &
  // flashing the nodes it touches so the user watches the ad build itself.
  const flash = (keys: StepKey[]) => {
    setFlashKeys(new Set(keys));
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashKeys(new Set()), 1400);
  };
  const buildAdContext = (): string => {
    const enabled = providers.filter((p) => p.enabled).map((p) => `${p.id} (${p.name})`).join(", ") || "feed (FlowSmartly Feed)";
    const prodNames = products.slice(0, 30).map((p) => p.name).join("; ");
    const placed = providers.filter((p) => placements[p.id] && p.enabled).map((p) => p.id);
    const srcDetail = source === "product" ? (product ? ` (product: ${product.name})` : " (no product picked)")
      : source === "link" ? (destinationUrl ? ` (link: ${destinationUrl})` : " (no link yet)")
        : (describeText ? ` (described: ${describeText})` : " (no description yet)");
    return [
      "[ADBUILDER] The Ad builder canvas is OPEN. Build it live with update_ad_canvas — fill the fields and they appear on screen.",
      `Campaign name: ${JSON.stringify(name)}.`,
      `Source mode: ${source}${srcDetail}.`,
      `Creative now — headline: ${JSON.stringify(headline)}; description: ${JSON.stringify(description)}; cta: ${JSON.stringify(cta)}.`,
      `Goal: ${goal}; category: ${JSON.stringify(category)}; budget: ${budgetNum} credits.`,
      `Placements selected: ${placed.join(", ") || "none yet"}.`,
      `ENABLED providers you may set as placements: ${enabled}.`,
      hasStore && products.length ? `Store PRODUCTS the user can advertise (pass productName to pick one): ${prodNames}.` : "No store products available — use a link or a description.",
    ].join("\n");
  };
  const applyAdPatch = (p: Record<string, unknown>) => {
    const touched: StepKey[] = [];
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    if (str(p.name) !== undefined) setName(str(p.name)!);
    if (p.source === "product" || p.source === "link" || p.source === "describe") { setSource(p.source); touched.push("source"); }
    if (str(p.productName)) {
      const q = str(p.productName)!.toLowerCase();
      const match = products.find((pr) => pr.name.toLowerCase() === q) || products.find((pr) => pr.name.toLowerCase().includes(q));
      if (match) { setSource("product"); setProductId(match.id); setMediaUrl(match.images?.[0]?.url ?? null); touched.push("source"); }
    }
    if (str(p.destinationUrl) !== undefined) { setDestinationUrl(str(p.destinationUrl)!); if (source !== "product") touched.push("source"); }
    if (str(p.headline) !== undefined) { setHeadline(str(p.headline)!); touched.push("creative"); }
    if (str(p.description) !== undefined) { setDescription(str(p.description)!); touched.push("creative"); }
    if (str(p.cta) !== undefined) { setCta(str(p.cta)!); touched.push("creative"); }
    if (str(p.goal) !== undefined) { setGoal(str(p.goal)!); touched.push("placement"); }
    if (str(p.category) !== undefined) { setCategory(str(p.category)!); touched.push("placement"); }
    if (typeof p.budget === "number") { setBudget(String(Math.max(1, Math.round(p.budget)))); touched.push("budget"); }
    if (Array.isArray(p.placements)) {
      const ids = (p.placements as unknown[]).filter((x): x is string => typeof x === "string");
      setPlacements((prev) => { const next = { ...prev }; for (const id of ids) next[id] = true; return next; });
      touched.push("placement");
    }
    if (touched.length) {
      const maxIdx = touched.reduce((m, k) => Math.max(m, order.indexOf(k)), cur);
      setCur((n) => Math.max(n, maxIdx));
      flash(Array.from(new Set(touched)));
    }
  };
  useEffect(() => {
    if (!canvasRef) return;
    canvasRef.current = { getContext: buildAdContext, applyPatch: applyAdPatch };
    return () => { if (canvasRef) canvasRef.current = null; };
  });

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your campaigns…" /></div>;
  }

  const total = stats.total ?? campaigns.length;
  const active = stats.active ?? campaigns.filter((c) => (c.status || "").toUpperCase() === "ACTIVE").length;
  const totalSpend = stats.totalSpent ?? campaigns.reduce((s, c) => s + (c.spent ?? 0), 0);
  const totalImpr = stats.totalImpressions ?? campaigns.reduce((s, c) => s + (c.impressions ?? 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + (c.revenue ?? 0), 0);
  const spentForRoas = campaigns.reduce((s, c) => s + (c.revenue != null ? (c.spent ?? 0) : 0), 0);
  const portfolioRoas = spentForRoas > 0 ? totalRevenue / spentForRoas : 0;
  const detailCampaign = campaigns.find((c) => c.id === detailId) || null;

  // A step must be COMPLETE before Continue advances — no skipping past empty
  // steps (or a 'product' source with no store / no product picked).
  const stepValid = (key: StepKey): boolean => {
    switch (key) {
      case "source":
        if (source === "product") return hasStore !== false && !!productId;
        if (source === "link") return /^https?:\/\/.+/i.test(destinationUrl.trim());
        return describeText.trim().length > 2;
      case "creative": return headline.trim().length > 0;
      case "placement": return selectedPlacementIds.length > 0;
      case "budget": return budgetNum >= 1;
      case "review": return true;
    }
  };
  const stepHint = (key: StepKey): string => {
    switch (key) {
      case "source":
        if (source === "product") return hasStore === false ? "Build a store, or switch to a link / description" : "Pick a product to continue";
        if (source === "link") return "Enter a valid link (https://…)";
        return "Describe what to advertise";
      case "creative": return "Add a headline — type one or tap Generate with AI";
      case "placement": return "Pick at least one placement";
      case "budget": return "Set a budget of at least 1 credit";
      case "review": return "";
    }
  };

  const stepBody = (key: StepKey) => {
    switch (key) {
      case "source":
        return (
          <>
            {([["product", "Store product", "Pick & auto-generate", Package], ["link", "Product / link", "Paste a URL", Link2], ["describe", "Describe it", "Free brief", PenLine]] as const).map(([m, t, h, Icon]) => (
              <button key={m} onClick={() => setSource(m)} className={cn("mb-1.5 flex w-full items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left transition", source === m ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-muted text-muted-foreground hover:text-foreground")}>
                <Icon className="h-4 w-4 shrink-0" /><span className="min-w-0"><span className="block text-[12.5px] font-bold leading-tight">{t}</span><span className="block text-[10.5px] text-muted-foreground">{h}</span></span>
              </button>
            ))}
            <div className="mt-1">
              {source === "product" ? (
                hasStore === false ? (
                  <div className="rounded-[11px] border border-dashed border-border bg-muted/40 px-3 py-4 text-center">
                    <p className="text-[12px] font-semibold">No store yet</p>
                    <button onClick={() => onAsk?.("Help me build my online store so I can advertise my products.")} disabled={!onAsk} className="mt-2 inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Build a store</button>
                  </div>
                ) : product ? (
                  <div className="flex items-center gap-2.5 rounded-[11px] border border-border bg-muted px-2.5 py-2.5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-background">{mediaUrl ? <Image src={mediaUrl} alt="" width={48} height={48} className="h-full w-full object-cover" unoptimized /> : <Package className="h-5 w-5 text-muted-foreground" />}</span>
                    <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-bold">{product.name}</div><div className="text-[12.5px] font-extrabold text-emerald-500">{money(product.priceCents / 100)}</div></div>
                    <button onClick={() => setPickerOpen(true)} className="shrink-0 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold hover:border-brand-500/60">Change</button>
                  </div>
                ) : (
                  <button onClick={() => setPickerOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-[11px] border border-dashed border-border bg-muted/40 px-3 py-3 text-[12px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-foreground"><Package className="h-4 w-4" /> Pick a product</button>
                )
              ) : source === "link" ? (
                <>
                  <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">Product / page link</label>
                  <input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} inputMode="url" placeholder="https://your-store.com/..." className={FIELD} />
                  <button onClick={buildWithAI} disabled={!onAsk || !destinationUrl.trim()} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Generate the ad from this link</button>
                  <p className="mt-1.5 text-[10.5px] text-muted-foreground">The agent reads the page, writes the creative &amp; copy, and guides you in the chat.</p>
                </>
              ) : (
                <>
                  <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">Describe what to advertise</label>
                  <textarea value={describeText} onChange={(e) => setDescribeText(e.target.value)} rows={3} className={cn(FIELD, "resize-y leading-relaxed")} placeholder="e.g. cozy autumn home-decor sale, 20% off" />
                  <button onClick={buildWithAI} disabled={!onAsk || !describeText.trim()} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Generate the ad with AI</button>
                  <p className="mt-1.5 text-[10.5px] text-muted-foreground">The agent writes the headline, copy &amp; image from your description and guides you in the chat.</p>
                </>
              )}
            </div>
          </>
        );
      case "creative":
        return (
          <>
            <AdPreview mediaUrl={mediaUrl} host={destinationUrl ? safeHost(destinationUrl) : "your-store.com"} headline={headline} description={description} cta={cta} onAi={buildWithAI} aiDisabled={!onAsk} />
            <label className="mb-1 mt-2.5 block text-[11px] font-semibold text-muted-foreground">Headline</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} placeholder="Get 20% off" className={FIELD} />
            <label className="mb-1 mt-2 block text-[11px] font-semibold text-muted-foreground">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} placeholder="Short line…" className={cn(FIELD, "resize-y")} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">CTA</label><select value={cta} onChange={(e) => setCta(e.target.value)} className={FIELD}>{CTAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="flex items-end"><button onClick={buildWithAI} disabled={!onAsk} className="inline-flex w-full items-center justify-center gap-1 rounded-[9px] border border-border px-2 py-2 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-foreground disabled:opacity-50"><Wand2 className="h-3.5 w-3.5" /> Regenerate</button></div>
            </div>
          </>
        );
      case "placement":
        return (
          <>
            <div className="grid grid-cols-1 gap-2">
              <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Goal</label><select value={goal} onChange={(e) => setGoal(e.target.value)} className={FIELD}>{OBJECTIVES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD}>{AD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <label className="mb-1 mt-2.5 block text-[11px] font-semibold text-muted-foreground">Placements (enabled only)</label>
            {providers.filter((p) => p.id !== "spotlight").map((p) => {
              const v = provVis(p.id);
              const on = !!placements[p.id] && p.enabled;
              return (
                <div key={p.id} className={cn("mt-1.5 flex items-center gap-2 rounded-[10px] border border-border bg-muted px-2.5 py-2", !p.enabled && "opacity-60")}>
                  <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] text-[11px] font-extrabold text-white" style={{ background: v.color }}>{v.mark}</span>
                  <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold">{p.name}</div><div className="text-[10px] text-muted-foreground">{p.enabled ? "Live" : "Not connected"}</div></div>
                  {p.enabled ? (
                    <button onClick={() => togglePlacement(p.id)} className={cn("relative h-[19px] w-[34px] shrink-0 rounded-full border transition", on ? "border-transparent bg-gradient-to-r from-brand-500 to-violet-500" : "border-border bg-muted")}><span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all", on ? "left-[16px]" : "left-0.5")} /></button>
                  ) : <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Off</span>}
                </div>
              );
            })}
          </>
        );
      case "budget":
        return (
          <>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Budget (credits)</label>
            <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={FIELD} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Start</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={FIELD} /></div>
              <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">End</label><input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={FIELD} /></div>
            </div>
            <div className="mt-2.5 rounded-[10px] border border-brand-500/30 bg-brand-500/10 px-2.5 py-2 text-[11.5px]">Est. reach <b>~{(budgetNum * 250).toLocaleString()}–{(budgetNum * 360).toLocaleString()}</b> impressions · reviewed before going live.</div>
          </>
        );
      case "review": {
        const places = selectedPlacementIds.map(provName).join(", ") || "—";
        return (
          <>
            <AdPreview mediaUrl={mediaUrl} host={destinationUrl ? safeHost(destinationUrl) : "your-store.com"} headline={headline} description={description} cta={cta} />
            <div className="mt-2.5">
              <SumRow label="Advertising" value={source === "product" ? (product?.name ?? "Product") : source === "link" ? (destinationUrl || "A link") : "Described"} />
              <SumRow label="Goal" value={OBJECTIVES.find((o) => o[0] === goal)?.[1] ?? goal} />
              <SumRow label="Placements" value={places} />
              <SumRow label="Budget" value={`${budgetNum} credits`} />
            </div>
            {launchError && <p className="mt-2 rounded-[9px] border border-rose-500/30 bg-rose-500/5 px-2.5 py-1.5 text-[11.5px] text-rose-500">{launchError}</p>}
          </>
        );
      }
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header actions live in the shell header (#fv-header-slot) — one top bar. */}
      {(() => {
        const header = (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" className="w-[180px] min-w-0 rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-[13.5px] font-bold outline-none hover:border-border focus:border-brand-500/60 focus:bg-background" />
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-amber-500">Draft</span>
            <button onClick={buildWithAI} disabled={!onAsk} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Build with AI</button>
            <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><LayoutGrid className="h-3.5 w-3.5" /> Library{total > 0 ? ` · ${total}` : ""}</button>
            <button onClick={newCampaign} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Plus className="h-3.5 w-3.5" /> New</button>
          </>
        );
        return headerSlot ? createPortal(header, headerSlot) : (
          <div className="z-10 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-border bg-card/40 px-4 py-2 backdrop-blur">{header}</div>
        );
      })()}
      {notice && <p className="mx-4 mb-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-500">{notice}</p>}

      {/* horizontal node canvas */}
      <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden" style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.18) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        <div ref={trackRef} className="flex h-full min-w-max items-start gap-0 px-5 pb-6 pt-4">
          {order.slice(0, cur + 1).map((key, i) => {
            const d = STEP_DEFS[key];
            const done = i < cur, isActive = i === cur, last = i === order.length - 1;
            return (
              <div key={key} className="flex h-full items-start">
                {i > 0 && <div className="flex h-full items-center px-0.5"><div className={cn("h-0.5 w-6 rounded-full", i < cur ? "bg-emerald-500" : "bg-gradient-to-r from-brand-500/50 to-violet-500/45")} /></div>}
                <div
                  data-step-idx={i}
                  style={drag?.idx === i ? { transform: `translateX(${drag.dx}px)`, zIndex: 50 } : undefined}
                  className={cn(
                    "flex max-h-full w-[360px] shrink-0 flex-col self-start overflow-hidden rounded-2xl border bg-card animate-in fade-in slide-in-from-right-4 duration-300",
                    drag?.idx === i ? "cursor-grabbing scale-[1.03] opacity-95 shadow-2xl ring-2 ring-violet-500/70 transition-none" : "transition",
                    isActive ? "border-brand-500/55 shadow-[0_16px_50px_-26px_rgba(14,165,233,0.5)]" : "border-border",
                    flashKeys.has(key) && "border-brand-500 ring-2 ring-brand-500/70 shadow-[0_0_34px_-6px_rgba(14,165,233,0.6)]",
                    drag && drag.idx !== i && drag.target === i && "ring-2 ring-violet-500/50",
                  )}
                >
                  <div
                    onPointerDown={startDrag(i)}
                    title="Drag to reorder"
                    className="flex touch-none cursor-grab select-none items-center gap-2.5 border-b border-border px-3 py-2.5 active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    <button type="button" onClick={() => setCur(i)} title={done ? "Go back to this step" : "This step"} className={cn("grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2 text-[12px] font-extrabold transition", done ? "border-emerald-500 bg-emerald-500 text-white hover:brightness-110" : "border-transparent bg-gradient-to-r from-brand-500 to-violet-500 text-white")}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</button>
                    <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{d.kicker}</div><div className="truncate text-[13px] font-bold">{d.title}</div></div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-3">{stepBody(key)}</div>
                  {isActive && (
                    <div className="flex items-center gap-2 border-t border-border bg-card/40 px-3 py-2.5">
                      {cur > 0 && <button onClick={() => setCur((n) => Math.max(0, n - 1))} title="Back a step" className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>}
                      <span className={cn("min-w-0 truncate text-[10.5px]", stepValid(key) ? "text-muted-foreground" : "text-amber-500")}>{stepValid(key) ? (last ? "Final step" : `Step ${i + 1} of ${order.length}`) : stepHint(key)}</span>
                      <span className="ms-auto" />
                      {last ? (
                        <>
                          <button onClick={launchAsIs} disabled={launching || source === "describe"} title={source === "describe" ? "Describe-it has no destination — use Build with AI" : ""} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground disabled:opacity-50">{launching ? <FlowLoader size={12} /> : <Rocket className="h-3.5 w-3.5" />} Launch · {budgetNum}cr</button>
                          <button onClick={buildWithAI} disabled={!onAsk} className="inline-flex items-center gap-1 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Build &amp; launch</button>
                        </>
                      ) : (
                        <button onClick={() => stepValid(key) && setCur((n) => Math.min(order.length - 1, n + 1))} disabled={!stepValid(key)} title={stepValid(key) ? "" : stepHint(key)} className={cn("inline-flex items-center gap-1 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1 text-[11px] font-semibold text-white", !stepValid(key) && "cursor-not-allowed opacity-50")}>Continue <ArrowRight className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <span className="pointer-events-none absolute bottom-3 right-3.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[10.5px] text-muted-foreground"><ArrowLeftRight className="h-3 w-3" /> drag a node&apos;s header to reorder · scroll sideways</span>
      </div>

      {pickerOpen && <ProductPicker products={products} selected={productId} onPick={pickProduct} onClose={() => setPickerOpen(false)} />}

      {libOpen && (
        <CampaignLibrary campaigns={campaigns} filter={libFilter} busyId={busyId} hasRoas={hasRoas} totals={{ total, active, totalSpend, totalImpr, portfolioRoas }} onFilter={setLibFilter} onToggle={toggleStatus} onOpen={(id) => { setLibOpen(false); setDetailId(id); }} onNew={() => { setLibOpen(false); newCampaign(); }} onClose={() => setLibOpen(false)} />
      )}

      {detailCampaign && <CampaignDetailDrawer campaign={detailCampaign} busy={busyId === detailCampaign.id} onToggle={() => toggleStatus(detailCampaign)} onDelete={() => { setDetailId(null); deleteCampaign(detailCampaign.id); }} onClose={() => setDetailId(null)} />}

      {(working || agentBusy) && <div className="absolute bottom-4 left-1/2 z-[55] flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-brand-500/40 bg-card px-4 py-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2"><FlowLoader size={15} /><span className="text-[12px]">The agent is working on your campaign — it’ll appear here. Reply in the chat to keep going.</span></div>}
    </div>
  );
}

function AdPreview({ mediaUrl, host, headline, description, cta, onAi, aiDisabled }: { mediaUrl: string | null; host: string; headline: string; description: string; cta: string; onAi?: () => void; aiDisabled?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-background">
      <div className="relative grid aspect-[1.91] w-full place-items-center bg-gradient-to-br from-brand-500/15 to-violet-500/15 text-muted-foreground">
        {mediaUrl ? <Image src={mediaUrl} alt="" fill sizes="340px" className="object-cover" unoptimized /> : <ImageIcon className="h-8 w-8" />}
        {onAi && <button onClick={onAi} disabled={aiDisabled} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-2 py-1 text-[10px] font-semibold text-white shadow disabled:opacity-50"><Sparkles className="h-3 w-3" /> AI image</button>}
      </div>
      <div className="p-2.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{host}</div>
        <div className={cn("mt-0.5 text-[13.5px] leading-snug", headline ? "font-bold" : "font-medium italic text-muted-foreground/50")}>{headline || "Headline — generate with AI"}</div>
        <div className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{description || <span className="italic text-muted-foreground/50">Description — the AI writes this from your source</span>}</div>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-muted px-3 py-1.5 text-[11.5px] font-bold">{cta} <ArrowRight className="h-3 w-3" /></span>
      </div>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 border-b border-border py-1.5 last:border-b-0">
      <span className="w-[78px] shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{value}</span>
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
// Campaign library.
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
  const counts = { all: campaigns.length, active: campaigns.filter((c) => isStatus(c, "active")).length, review: campaigns.filter((c) => isStatus(c, "review")).length, paused: campaigns.filter((c) => isStatus(c, "paused")).length };
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
// Detail drawer.
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
          <div className="overflow-hidden rounded-[14px] border border-border bg-background">
            <div className="relative grid aspect-[1.91] w-full place-items-center bg-gradient-to-br from-brand-500/15 to-violet-500/15 text-muted-foreground">{media ? <Image src={media} alt="" fill sizes="420px" className="object-cover" unoptimized /> : <ImageIcon className="h-9 w-9" />}</div>
            <div className="p-3">
              {c.destinationUrl && <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{safeHost(c.destinationUrl)}</div>}
              <div className="mt-0.5 text-[14px] font-bold leading-snug">{c.headline || "—"}</div>
              {c.description && <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{c.description}</div>}
              {c.ctaText && <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-muted px-3 py-1.5 text-[12px] font-bold">{c.ctaText} <ArrowRight className="h-3 w-3" /></span>}
            </div>
          </div>
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
