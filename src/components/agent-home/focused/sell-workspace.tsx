"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Image from "next/image";
import { Store, ExternalLink, Package, ShoppingBag, Coins, Clock, CheckCircle2, Image as ImageIcon, Plus, X, Check, Pencil, Search, Truck, Ban, RotateCcw, ChevronRight, MapPin, User, CreditCard, AlertTriangle, Users, Palette, LayoutGrid, FolderTree, BarChart3, Settings, Landmark, Ticket, Sparkles, AlertCircle } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { StoreCallToAction, StoreBriefModal } from "./store-cta";
import { StoreStudio } from "./store-studio";
import { ProductEditor } from "./product-editor";
import { StoreOverview } from "./store-overview";
import { StoreCategories } from "./store-categories";
import { StoreShipping } from "./store-shipping";
import { StorePayments } from "./store-payments";
import { StoreAnalytics } from "./store-analytics";
import { StoreSettings } from "./store-settings";
import { StoreDiscounts } from "./store-discounts";
import { cn } from "@/lib/utils/cn";

/**
 * Sell — a deep new-design ecommerce surface (the Sell workspace canvas): store
 * overview + KPIs + products + orders. The data actions are REAL UI — "Add
 * product" opens a form, clicking a product edits it, clicking an order opens a
 * full detail panel where the seller advances status, edits tracking, cancels
 * (with a reason → restores inventory) or refunds (Stripe). Every money /
 * destructive action uses an inline two-step confirm — never window.confirm.
 * (POST/PATCH/DELETE /api/ecommerce/*). A click means do-it-in-the-UI, not a
 * chat prompt. Store creation stays agent-driven (a heavy generative build).
 * No legacy links. [[surface-buttons-are-ui-actions]]
 */

interface StoreData { id: string; name: string; slug: string; currency?: string; region?: string; country?: string; isActive?: boolean; buildStatus?: string; productCount?: number; orderCount?: number; totalRevenueCents?: number; }
interface Product { id: string; name: string; priceCents?: number; comparePriceCents?: number | null; currency?: string; status?: string; quantity?: number; trackInventory?: boolean; lowStockThreshold?: number; labels?: string[]; variantCount?: number; description?: string | null; category?: string | null; categoryName?: string | null; images?: { url: string }[]; }
interface OrderItem { productId?: string; variantId?: string; name?: string; quantity?: number; priceCents?: number; imageUrl?: string; }
interface ShippingAddress { name?: string; line1?: string; line2?: string; city?: string; state?: string; zip?: string; country?: string; phone?: string; }
interface Order {
  id: string; orderNumber?: string; customerName?: string; customerEmail?: string; customerPhone?: string;
  totalCents?: number; subtotalCents?: number; shippingCents?: number; taxCents?: number; currency?: string;
  status?: string; createdAt?: string;
  paymentMethod?: string | null; paymentStatus?: string; paymentId?: string | null; paymentLast4?: string | null; paymentBrand?: string | null;
  shippingMethod?: string | null; trackingNumber?: string | null; estimatedDelivery?: string | null;
  notes?: string | null; cancelReason?: string | null;
  items?: OrderItem[]; shippingAddress?: ShippingAddress;
}
interface OrderStats { totalOrders?: number; totalRevenueCents?: number; pendingCount?: number; deliveredCount?: number; }

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

// Next status the seller can move an order to (mirrors the order state machine).
const NEXT_STATUS: Record<string, { label: string; to: string }> = {
  PENDING: { label: "Confirm", to: "CONFIRMED" },
  CONFIRMED: { label: "Process", to: "PROCESSING" },
  PROCESSING: { label: "Ship", to: "SHIPPED" },
  SHIPPED: { label: "Mark delivered", to: "DELIVERED" },
};
// Statuses a seller can cancel from (matches server-side allowedTransitions → CANCELLED).
const CANCELLABLE = new Set(["PENDING", "CONFIRMED", "PROCESSING"]);

type Section = "overview" | "products" | "orders" | "categories" | "discounts" | "shipping" | "payments" | "analytics" | "settings";

const ORDER_STATUS_FILTERS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const PAYMENT_STATUS_FILTERS = ["pending", "paid", "failed", "refunded"];
// Categories the store can list under (mirrors PRODUCT_CATEGORIES). Kept local so this surface owns its own copy.
const CATEGORY_OPTIONS = ["clothing", "electronics", "food", "health", "home", "jewelry", "sports", "toys", "digital", "services", "art", "books", "automotive", "pets", "other"];

// Badge color per product label (mirrors the API labels enum).
const LABEL_TONE: Record<string, string> = {
  sale: "bg-rose-500", new: "bg-emerald-500", bestseller: "bg-violet-500",
  featured: "bg-amber-500", limited: "bg-teal-500", discount: "bg-brand-500",
};

// Stock pill for a product card — only when inventory is tracked.
function stockPill(p: Product): { text: string; cls: string } | null {
  if (!p.trackInventory || p.quantity == null) return null;
  if (p.quantity <= 0) return { text: "Out", cls: "bg-rose-500 text-white" };
  if (p.quantity <= (p.lowStockThreshold ?? 5)) return { text: `Low · ${p.quantity}`, cls: "bg-amber-500 text-amber-950" };
  return { text: String(p.quantity), cls: "bg-background/80 text-muted-foreground" };
}

function statusTone(status?: string): string {
  const s = (status || "").toUpperCase();
  if (s === "DELIVERED") return "bg-emerald-500/10 text-emerald-500";
  if (s === "CANCELLED") return "bg-rose-500/10 text-rose-500";
  if (s === "REFUNDED") return "bg-muted text-muted-foreground";
  if (s === "SHIPPED") return "bg-violet-500/10 text-violet-500";
  return "bg-brand-500/10 text-brand-500";
}

function money(cents?: number, currency = "USD"): string {
  try { return ((cents ?? 0) / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 }); } catch { return `${((cents ?? 0) / 100).toFixed(2)}`; }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

export function FocusedSell({ refreshKey, onAsk, onOpenView }: { refreshKey?: number; onAsk: (prompt: string) => void; onOpenView: (key: string) => void; working?: boolean }) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  // A store that exists but is still building → show the full-content progress
  // loader instead of the (half-built) store view or the landing CTA.
  const [building, setBuilding] = useState<{ storeId: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({});
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("overview");
  const [studioOpen, setStudioOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false); // store-build brief modal (no-store state)

  // Product editor drawer: "new" (add), a product id (edit), or null (closed).
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [bulkActivating, setBulkActivating] = useState(false);

  // AI product generator (bulk).
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [aiGenBusy, setAiGenBusy] = useState(false);
  const [aiGenDesc, setAiGenDesc] = useState("");
  const [aiGenCount, setAiGenCount] = useState(5);
  const [aiGenError, setAiGenError] = useState("");
  const [aiGenDone, setAiGenDone] = useState("");

  // Product search / filters.
  const [pSearch, setPSearch] = useState("");
  const [pStatus, setPStatus] = useState("");
  const [pCategory, setPCategory] = useState("");

  // Order search / filters.
  const [oSearch, setOSearch] = useState("");
  const [oStatus, setOStatus] = useState("");
  const [oPayment, setOPayment] = useState("");

  // Order detail panel.
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  // Tracking editor (inside detail panel).
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackForm, setTrackForm] = useState<{ trackingNumber: string; shippingMethod: string; estimatedDelivery: string }>({ trackingNumber: "", shippingMethod: "", estimatedDelivery: "" });
  const [savingTrack, setSavingTrack] = useState(false);

  // Two-step money/destructive confirms (inside detail panel).
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [actionErr, setActionErr] = useState("");

  // Build query string for product list from active filters.
  const productQuery = useMemo(() => {
    const q = new URLSearchParams({ limit: "24" });
    if (pStatus) q.set("status", pStatus);
    if (pCategory) q.set("category", pCategory);
    if (pSearch.trim()) q.set("search", pSearch.trim());
    return q.toString();
  }, [pStatus, pCategory, pSearch]);

  const orderQuery = useMemo(() => {
    const q = new URLSearchParams({ limit: "12" });
    if (oStatus) q.set("status", oStatus);
    if (oPayment) q.set("paymentStatus", oPayment);
    if (oSearch.trim()) q.set("search", oSearch.trim());
    return q.toString();
  }, [oStatus, oPayment, oSearch]);

  const loadData = useCallback(async () => {
    const sj = await fetch("/api/ecommerce/store").then((r) => r.json()).catch(() => null);
    const has = !!sj?.data?.hasStore && !!sj?.data?.store;
    setHasStore(has);
    // A store mid-build (or deploying) → drive the progress loader, not the store view.
    const bs = has ? String(sj.data.store.buildStatus || "") : "";
    setBuilding(has && (bs === "building" || bs === "deploying") ? { storeId: sj.data.store.id } : null);
    if (has) {
      setStore(sj.data.store);
      const [pr, or] = await Promise.all([
        fetch(`/api/ecommerce/products?${productQuery}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/ecommerce/orders?${orderQuery}`).then((r) => r.json()).catch(() => null),
      ]);
      setProducts(Array.isArray(pr?.data?.products) ? pr.data.products : []);
      setOrders(Array.isArray(or?.data?.orders) ? or.data.orders : []);
      if (or?.data?.stats) setStats(or.data.stats);
    }
  }, [productQuery, orderQuery]);

  useEffect(() => {
    let alive = true;
    loadData().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadData, refreshKey]);

  // A click opens the rich editor drawer — never a chat prompt.
  const openAdd = () => { setEditing("new"); setSection("products"); };
  const openEdit = (p: Product) => setEditing(p.id);

  // Flip every DRAFT product to ACTIVE in one call.
  const bulkActivate = async () => {
    setBulkActivating(true);
    try {
      const r = await fetch("/api/ecommerce/products/bulk-activate", { method: "POST" });
      if (r.ok) await loadData();
    } finally {
      setBulkActivating(false);
    }
  };

  // Generate a batch of products with AI (drafts) from a short description.
  const runAiGenerate = async () => {
    if (aiGenDesc.trim().length < 10) { setAiGenError("Describe your products in a little more detail (at least 10 characters)."); return; }
    setAiGenBusy(true); setAiGenError(""); setAiGenDone("");
    try {
      const r = await fetch("/api/ecommerce/ai/generate-products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiGenDesc.trim(), count: aiGenCount }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) {
        const made = Array.isArray(j?.data?.products) ? j.data.products.length : aiGenCount;
        await loadData();
        setAiGenDone(`Added ${made} draft product${made === 1 ? "" : "s"} — review and activate them.`);
        setAiGenDesc("");
      } else if (r.status === 402) {
        setAiGenError(j?.error?.message || "You're out of credits for AI product generation.");
      } else {
        setAiGenError(j?.error?.message || "Couldn't generate products — please try again.");
      }
    } catch {
      setAiGenError("Couldn't reach the AI generator — please try again.");
    } finally {
      setAiGenBusy(false);
    }
  };

  // Open the full order detail panel (fetch the single order for line items / address / payment).
  const openOrder = async (o: Order) => {
    setOpenOrderId(o.id); setDetail(null); setDetailErr(""); setDetailLoading(true);
    setTrackOpen(false); setCancelOpen(false); setRefundOpen(false); setCancelReason(""); setActionErr("");
    try {
      const r = await fetch(`/api/ecommerce/orders/${o.id}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.data?.order) setDetail(j.data.order as Order);
      else { setDetail(o); setDetailErr(j?.error?.message || ""); }
    } catch {
      setDetail(o); setDetailErr("Could not load the full order.");
    } finally {
      setDetailLoading(false);
    }
  };
  const closeOrder = () => { setOpenOrderId(null); setDetail(null); setTrackOpen(false); setCancelOpen(false); setRefundOpen(false); };

  // Re-fetch a single order detail after a mutation (keeps the panel fresh) + refresh the list.
  const refreshDetail = async (id: string) => {
    try {
      const r = await fetch(`/api/ecommerce/orders/${id}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.data?.order) setDetail(j.data.order as Order);
    } catch { /* ignore */ }
    await loadData();
  };

  const advanceOrder = async (o: Order) => {
    const next = NEXT_STATUS[(o.status || "PENDING").toUpperCase()];
    if (!next) return;
    setBusyOrder(o.id); setActionErr("");
    try {
      const r = await fetch(`/api/ecommerce/orders/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next.to }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) {
        if (openOrderId === o.id) await refreshDetail(o.id); else await loadData();
      } else if (openOrderId === o.id) {
        setActionErr(j?.error?.message || "Could not update the order.");
      }
    } catch {
      if (openOrderId === o.id) setActionErr("Could not update the order.");
    } finally {
      setBusyOrder(null);
    }
  };

  // Open the tracking editor seeded from the current order.
  const openTrackEditor = () => {
    if (!detail) return;
    setTrackForm({
      trackingNumber: detail.trackingNumber || "",
      shippingMethod: detail.shippingMethod || "",
      estimatedDelivery: detail.estimatedDelivery ? new Date(detail.estimatedDelivery).toISOString().slice(0, 10) : "",
    });
    setActionErr(""); setTrackOpen(true);
  };

  const saveTracking = async () => {
    if (!detail) return;
    setSavingTrack(true); setActionErr("");
    try {
      const body: Record<string, unknown> = {
        trackingNumber: trackForm.trackingNumber.trim(),
        shippingMethod: trackForm.shippingMethod.trim(),
        estimatedDelivery: trackForm.estimatedDelivery ? trackForm.estimatedDelivery : "",
      };
      const r = await fetch(`/api/ecommerce/orders/${detail.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) {
        setTrackOpen(false);
        await refreshDetail(detail.id);
      } else {
        setActionErr(j?.error?.message || "Could not save tracking.");
      }
    } catch {
      setActionErr("Could not save tracking.");
    } finally {
      setSavingTrack(false);
    }
  };

  const confirmCancel = async () => {
    if (!detail) return;
    const reason = cancelReason.trim();
    if (!reason) { setActionErr("A cancellation reason is required."); return; }
    setCancelling(true); setActionErr("");
    try {
      const r = await fetch(`/api/ecommerce/orders/${detail.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED", cancelReason: reason }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) {
        setCancelOpen(false); setCancelReason("");
        await refreshDetail(detail.id);
      } else {
        setActionErr(j?.error?.message || "Could not cancel the order.");
      }
    } catch {
      setActionErr("Could not cancel the order.");
    } finally {
      setCancelling(false);
    }
  };

  const confirmRefund = async () => {
    if (!detail) return;
    setRefunding(true); setActionErr("");
    try {
      const r = await fetch(`/api/ecommerce/orders/${detail.id}/refund`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) {
        setRefundOpen(false);
        await refreshDetail(detail.id);
      } else {
        setActionErr(j?.error?.message || "Refund failed.");
      }
    } catch {
      setActionErr("Refund failed.");
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your store…" /></div>;
  }

  // Store is being built → a full-content-area progress loader (no landing card,
  // no chat round-trip). Polls buildStatus; lands on the store when it's built.
  if (building) {
    return <StoreBuildingLoader storeId={building.storeId} onBuilt={() => { setBuilding(null); loadData(); }} onOpenStore={() => { setBuilding(null); loadData(); }} />;
  }

  // No store yet → benefits + exact charges + "Create my store", which opens the
  // brief and builds the store DIRECTLY from the UI (no agent chat).
  if (!hasStore) {
    // A positioned, non-scrolling content-pane wrapper so the brief modal's
    // `absolute inset-0` fills THIS pane (like the film studio's canvas) — not the
    // whole focused view (which includes the agent chat panel).
    const startBuilding = (storeId: string) => { setBriefOpen(false); setBuilding({ storeId }); };
    return (
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-6 sm:p-8">
          <div className="mx-auto mt-[2vh] max-w-lg space-y-4">
            <StoreCallToAction onBuilding={startBuilding} onTopUp={() => onOpenView("credits")} onStart={() => setBriefOpen(true)} />
          </div>
        </div>
        {briefOpen && (
          <StoreBriefModal
            onTopUp={() => onOpenView("credits")}
            onClose={() => setBriefOpen(false)}
            onBuilding={startBuilding}
          />
        )}
      </div>
    );
  }

  // Studio mode — the full storefront DESIGN editor (Store Info, Hero, Categories,
  // Navigation, FAQ, Pages, AI Redesign, Domains, Status). Renders full-bleed; back
  // returns here and refreshes. Replaces the legacy /ecommerce/design page.
  if (studioOpen && store) {
    return <StoreStudio storeId={store.id} onBack={() => { setStudioOpen(false); loadData(); }} onOpenView={onOpenView} onAsk={onAsk} />;
  }

  const cur = store?.currency || "USD";
  const hasProductFilters = !!(pSearch.trim() || pStatus || pCategory);
  const hasOrderFilters = !!(oSearch.trim() || oStatus || oPayment);

  // The detail order is the source of truth for the open panel's currency.
  const dCur = detail?.currency || cur;
  // Drive the panel's advance action from the loaded order's own status — not the
  // (possibly stale / filtered-out) list row — so the focused panel stays self-consistent.
  const detailNext = detail ? NEXT_STATUS[(detail.status || "PENDING").toUpperCase()] : undefined;
  const canCancelDetail = detail ? CANCELLABLE.has((detail.status || "").toUpperCase()) : false;
  const canRefundDetail = !!detail
    && detail.paymentMethod === "card"
    && detail.paymentStatus === "paid"
    && (detail.status || "").toUpperCase() !== "REFUNDED";

  const productCount = store?.productCount ?? products.length;
  const draftCount = products.filter((p) => (p.status || "").toUpperCase() === "DRAFT").length;
  const orderCount = stats.totalOrders ?? store?.orderCount ?? 0;

  const nav: { id: Section; label: string; icon: ElementType; count?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "products", label: "Products", icon: Package, count: productCount },
    { id: "orders", label: "Orders", icon: ShoppingBag, count: orderCount },
    { id: "categories", label: "Categories", icon: FolderTree },
    { id: "discounts", label: "Discounts", icon: Ticket },
    { id: "shipping", label: "Shipping", icon: Truck },
    { id: "payments", label: "Payments & payouts", icon: Landmark },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky store identity + KPIs + section menu */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Store className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold">{store?.name}</h2>
                <p className="truncate text-[11.5px] text-muted-foreground">{store?.region ? `${store.region} · ` : ""}{cur}</p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", store?.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{store?.isActive ? "Live" : "Draft"}</span>
              {store?.slug && (
                <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                  <ExternalLink className="h-3 w-3" /> Storefront
                </a>
              )}
            </div>
            <button
              onClick={() => setStudioOpen(true)}
              className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand-500/40 bg-brand-500/5 px-3 py-2 text-[12.5px] font-semibold text-brand-500 hover:bg-brand-500/10"
            >
              <Palette className="h-3.5 w-3.5" /> Design studio
            </button>

            <div className="mt-4 space-y-1.5">
              <StatRow icon={Coins} label="Revenue" value={money(stats.totalRevenueCents ?? store?.totalRevenueCents, cur)} />
              <StatRow icon={Package} label="Products" value={String(productCount)} />
              <StatRow icon={ShoppingBag} label="Orders" value={String(orderCount)} />
              <StatRow icon={Clock} label="Pending" value={String(stats.pendingCount ?? 0)} />
            </div>
          </div>

          {/* primary action */}
          <button
            onClick={openAdd}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
          >
            <Plus className="h-4 w-4" /> Add product
          </button>

          {/* section menu */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {nav.map((n) => {
              const active = section === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setSection(n.id)}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-start">{n.label}</span>
                  {(n.count ?? 0) > 0 && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", active ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{n.count}</span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => onOpenView("customers")}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-start">Customers</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </button>
          </nav>
        </aside>

        {/* RIGHT: the selected section, full width */}
        <div className="min-w-0 flex-1 space-y-4">
        {section === "overview" ? (
          <StoreOverview currency={cur} orders={orders} products={products} stats={stats} onSection={(s) => setSection(s as Section)} />
        ) : section === "categories" ? (
          <StoreCategories />
        ) : section === "discounts" ? (
          <StoreDiscounts currency={cur} />
        ) : section === "shipping" ? (
          <StoreShipping currency={cur} />
        ) : section === "payments" ? (
          <StorePayments currency={cur} country={store?.country} />
        ) : section === "analytics" ? (
          <StoreAnalytics currency={cur} />
        ) : section === "settings" ? (
          <StoreSettings />
        ) : section === "products" ? (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Products</h3>
            {productCount > 0 && <span className="text-[11px] text-muted-foreground">{productCount} total</span>}
            <div className="ms-auto flex items-center gap-2">
              {draftCount > 0 && (
                <button onClick={bulkActivate} disabled={bulkActivating} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 disabled:opacity-60">
                  {bulkActivating ? <FlowLoader size={13} /> : <CheckCircle2 className="h-3.5 w-3.5" />} Activate {draftCount} draft{draftCount === 1 ? "" : "s"}
                </button>
              )}
              <button onClick={() => { setAiGenOpen(true); setAiGenError(""); setAiGenDone(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-500/40 bg-brand-500/5 px-3 py-1.5 text-[12px] font-semibold text-brand-500 hover:bg-brand-500/10">
                <Sparkles className="h-3.5 w-3.5" /> Generate with AI
              </button>
              <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
                <Plus className="h-3.5 w-3.5" /> Add product
              </button>
            </div>
          </div>

          {/* search + filters */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={pSearch} onChange={(e) => setPSearch(e.target.value)} placeholder="Search products…" className={cn(FIELD, "pl-8")} />
            </div>
            <select value={pStatus} onChange={(e) => setPStatus(e.target.value)} className={cn(FIELD, "w-auto")}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select value={pCategory} onChange={(e) => setPCategory(e.target.value)} className={cn(FIELD, "w-auto")}>
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            {hasProductFilters && (
              <button onClick={() => { setPSearch(""); setPStatus(""); setPCategory(""); }} className="inline-flex items-center gap-1 rounded-[10px] border border-border px-2.5 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Clear</button>
            )}
          </div>

          {products.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => {
                const stock = stockPill(p);
                return (
                  <button key={p.id} onClick={() => openEdit(p)} className="group overflow-hidden rounded-xl border border-border bg-muted/30 text-left transition hover:border-brand-500/60">
                    <div className="relative grid aspect-square place-items-center bg-background">
                      {p.images?.[0]?.url ? <Image src={p.images[0].url} alt="" width={160} height={160} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                      {(p.labels?.length ?? 0) > 0 && (
                        <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                          {p.labels!.slice(0, 2).map((l) => <span key={l} className={cn("rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-white", LABEL_TONE[l] || "bg-brand-500")}>{l}</span>)}
                        </div>
                      )}
                      {stock && <span className={cn("absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold", stock.cls)}>{stock.text}</span>}
                      <span className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></span>
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-[12.5px] font-medium">{p.name}</p>
                      <p className="mt-0.5 text-[12px]">
                        <span className="font-semibold text-brand-500">{money(p.priceCents, p.currency || cur)}</span>
                        {p.comparePriceCents ? <s className="ms-1.5 text-muted-foreground">{money(p.comparePriceCents, p.currency || cur)}</s> : null}
                        {p.status?.toUpperCase() === "DRAFT" ? <span className="text-muted-foreground"> · draft</span> : null}
                      </p>
                      {(p.variantCount ?? 0) > 0 && <p className="mt-0.5 text-[10.5px] text-muted-foreground">{p.variantCount} variant{p.variantCount === 1 ? "" : "s"}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">{hasProductFilters ? "No products match those filters" : "No products yet"}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{hasProductFilters ? "Try clearing search, status, or category." : "Add your first product — set a name, price, and image."}</p>
              {hasProductFilters ? (
                <button onClick={() => { setPSearch(""); setPStatus(""); setPCategory(""); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60"><X className="h-4 w-4" /> Clear filters</button>
              ) : (
                <button onClick={openAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Plus className="h-4 w-4" /> Add a product</button>
              )}
            </div>
          )}
        </section>
        ) : (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Orders</h3>
            <button onClick={() => onOpenView("customers")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Users className="h-3.5 w-3.5" /> View customers</button>
          </div>

          {/* order search + filters */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={oSearch} onChange={(e) => setOSearch(e.target.value)} placeholder="Order #, name, email…" className={cn(FIELD, "pl-8")} />
            </div>
            <select value={oStatus} onChange={(e) => setOStatus(e.target.value)} className={cn(FIELD, "w-auto")}>
              <option value="">All statuses</option>
              {ORDER_STATUS_FILTERS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
            </select>
            <select value={oPayment} onChange={(e) => setOPayment(e.target.value)} className={cn(FIELD, "w-auto")}>
              <option value="">All payments</option>
              {PAYMENT_STATUS_FILTERS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            {hasOrderFilters && (
              <button onClick={() => { setOSearch(""); setOStatus(""); setOPayment(""); }} className="inline-flex items-center gap-1 rounded-[10px] border border-border px-2.5 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Clear</button>
            )}
          </div>

          {orders.length ? (
            <div className="space-y-2">
              {orders.map((o) => {
                const next = NEXT_STATUS[(o.status || "PENDING").toUpperCase()];
                return (
                  <div key={o.id} className="rounded-xl border border-border bg-muted/30">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                      <button onClick={() => (openOrderId === o.id ? closeOrder() : openOrder(o))} className="inline-flex items-center gap-1.5 text-left">
                        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition", openOrderId === o.id && "rotate-90")} />
                        <span className="text-[12.5px] font-semibold">{o.orderNumber || o.id.slice(0, 8)}</span>
                      </button>
                      <span className="text-[12px] text-muted-foreground">{o.customerName || "Customer"}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", statusTone(o.status))}>
                        {(o.status || "").toUpperCase() === "DELIVERED" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{(o.status || "PENDING").toLowerCase()}
                      </span>
                      <span className="ms-auto text-[13px] font-bold">{money(o.totalCents, o.currency || cur)}</span>
                      {next && (
                        <button onClick={() => advanceOrder(o)} disabled={busyOrder === o.id} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                          {busyOrder === o.id ? <FlowLoader size={13} /> : null} {next.label}
                        </button>
                      )}
                    </div>

                    {/* full order detail panel — opens inline below the row */}
                    {openOrderId === o.id && (
                      <div className="border-t border-border px-3 py-3">
                        {detailLoading ? (
                          <div className="grid place-items-center py-6"><FlowLoader size={22} label="Loading order…" /></div>
                        ) : detail ? (
                          <div className="space-y-3">
                            {detailErr && <p className="text-[12px] text-amber-500">{detailErr}</p>}

                            {/* customer + payment + shipping */}
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="rounded-lg border border-border bg-background p-3">
                                <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground"><User className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold uppercase tracking-wide">Customer</span></div>
                                <p className="text-[12.5px] font-medium">{detail.customerName || "—"}</p>
                                {detail.customerEmail && <p className="truncate text-[12px] text-muted-foreground">{detail.customerEmail}</p>}
                                {detail.customerPhone && <p className="text-[12px] text-muted-foreground">{detail.customerPhone}</p>}
                                <p className="mt-1 text-[11px] text-muted-foreground">Placed {fmtDate(detail.createdAt)}</p>
                              </div>
                              <div className="rounded-lg border border-border bg-background p-3">
                                <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold uppercase tracking-wide">Ship to</span></div>
                                {detail.shippingAddress && (detail.shippingAddress.line1 || detail.shippingAddress.city) ? (
                                  <div className="text-[12px] text-muted-foreground">
                                    {detail.shippingAddress.name && <p className="text-[12.5px] font-medium text-foreground">{detail.shippingAddress.name}</p>}
                                    {detail.shippingAddress.line1 && <p>{detail.shippingAddress.line1}</p>}
                                    {detail.shippingAddress.line2 && <p>{detail.shippingAddress.line2}</p>}
                                    <p>{[detail.shippingAddress.city, detail.shippingAddress.state, detail.shippingAddress.zip].filter(Boolean).join(", ")}</p>
                                    {detail.shippingAddress.country && <p>{detail.shippingAddress.country}</p>}
                                  </div>
                                ) : <p className="text-[12px] text-muted-foreground">No address on file</p>}
                              </div>
                              <div className="rounded-lg border border-border bg-background p-3">
                                <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground"><CreditCard className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold uppercase tracking-wide">Payment</span></div>
                                <p className="text-[12.5px] font-medium capitalize">{(detail.paymentMethod || "—").replace(/_/g, " ")}{detail.paymentBrand ? ` · ${detail.paymentBrand}` : ""}{detail.paymentLast4 ? ` ••${detail.paymentLast4}` : ""}</p>
                                <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold", detail.paymentStatus === "paid" ? "bg-emerald-500/10 text-emerald-500" : detail.paymentStatus === "refunded" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-500")}>{detail.paymentStatus || "pending"}</span>
                              </div>
                            </div>

                            {/* line items */}
                            <div className="rounded-lg border border-border bg-background">
                              <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Items</div>
                              <div className="divide-y divide-border">
                                {(detail.items && detail.items.length ? detail.items : []).map((it, i) => (
                                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                                    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted/30">
                                      {it.imageUrl ? <Image src={it.imageUrl} alt="" width={36} height={36} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[12.5px] font-medium">{it.name || "Item"}</p>
                                      <p className="text-[11.5px] text-muted-foreground">Qty {it.quantity ?? 1} · {money(it.priceCents, dCur)}</p>
                                    </div>
                                    <span className="text-[12.5px] font-semibold">{money((it.priceCents ?? 0) * (it.quantity ?? 1), dCur)}</span>
                                  </div>
                                ))}
                                {(!detail.items || !detail.items.length) && <div className="px-3 py-3 text-[12px] text-muted-foreground">No line items recorded.</div>}
                              </div>
                              {/* totals */}
                              <div className="space-y-1 border-t border-border px-3 py-2.5 text-[12px]">
                                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(detail.subtotalCents, dCur)}</span></div>
                                {!!detail.shippingCents && <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>{money(detail.shippingCents, dCur)}</span></div>}
                                {!!detail.taxCents && <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{money(detail.taxCents, dCur)}</span></div>}
                                <div className="flex justify-between pt-1 text-[13px] font-bold"><span>Total</span><span>{money(detail.totalCents, dCur)}</span></div>
                              </div>
                            </div>

                            {/* tracking / shipping summary */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-background px-3 py-2.5 text-[12px]">
                              <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Truck className="h-3.5 w-3.5" />Tracking</span>
                              <span className="font-medium">{detail.trackingNumber || "—"}</span>
                              {detail.shippingMethod && <span className="text-muted-foreground">{detail.shippingMethod}</span>}
                              {detail.estimatedDelivery && <span className="text-muted-foreground">ETA {fmtDate(detail.estimatedDelivery)}</span>}
                              <button onClick={openTrackEditor} className="ms-auto inline-flex items-center gap-1 rounded-[8px] border border-border px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Pencil className="h-3 w-3" /> Edit tracking</button>
                            </div>

                            {detail.cancelReason && (
                              <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500"><span className="font-semibold">Cancelled:</span> {detail.cancelReason}</p>
                            )}

                            {/* tracking editor */}
                            {trackOpen && (
                              <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
                                <p className="mb-2 text-[12px] font-semibold">Edit tracking &amp; shipping</p>
                                <div className="grid gap-2.5 sm:grid-cols-3">
                                  <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Tracking #</span><input value={trackForm.trackingNumber} onChange={(e) => setTrackForm((f) => ({ ...f, trackingNumber: e.target.value }))} placeholder="1Z…" className={FIELD} /></label>
                                  <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Carrier / method</span><input value={trackForm.shippingMethod} onChange={(e) => setTrackForm((f) => ({ ...f, shippingMethod: e.target.value }))} placeholder="UPS Ground" className={FIELD} /></label>
                                  <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Est. delivery</span><input type="date" value={trackForm.estimatedDelivery} onChange={(e) => setTrackForm((f) => ({ ...f, estimatedDelivery: e.target.value }))} className={FIELD} /></label>
                                </div>
                                <div className="mt-2.5 flex items-center gap-2">
                                  <button onClick={saveTracking} disabled={savingTrack} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">{savingTrack ? <FlowLoader size={13} tone="white" /> : <Check className="h-3.5 w-3.5" />} Save tracking</button>
                                  <button onClick={() => setTrackOpen(false)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
                                </div>
                              </div>
                            )}

                            {actionErr && <p className="text-[12px] text-rose-500">{actionErr}</p>}

                            {/* money / destructive actions — inline two-step confirms */}
                            <div className="flex flex-wrap items-center gap-2">
                              {detailNext && (
                                <button onClick={() => advanceOrder(detail)} disabled={busyOrder === detail.id} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">{busyOrder === detail.id ? <FlowLoader size={13} tone="white" /> : <ChevronRight className="h-3.5 w-3.5" />} {detailNext.label}</button>
                              )}

                              {/* Cancel (restores inventory) — required reason */}
                              {canCancelDetail && !cancelOpen && (
                                <button onClick={() => { setCancelOpen(true); setRefundOpen(false); setActionErr(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/30 px-3 py-2 text-[12px] font-semibold text-rose-500 hover:bg-rose-500/5"><Ban className="h-3.5 w-3.5" /> Cancel order</button>
                              )}

                              {/* Refund (Stripe) — card-paid + paid only */}
                              {canRefundDetail && !refundOpen && (
                                <button onClick={() => { setRefundOpen(true); setCancelOpen(false); setActionErr(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-amber-500/40 px-3 py-2 text-[12px] font-semibold text-amber-600 hover:bg-amber-500/5"><RotateCcw className="h-3.5 w-3.5" /> Refund {money(detail.totalCents, dCur)}</button>
                              )}
                            </div>

                            {/* cancel confirm — step two: shows what will happen + requires reason */}
                            {cancelOpen && (
                              <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3">
                                <div className="mb-1.5 flex items-center gap-1.5 text-rose-500"><AlertTriangle className="h-4 w-4" /><p className="text-[12.5px] font-semibold">Cancel order {detail.orderNumber || detail.id.slice(0, 8)}?</p></div>
                                <p className="mb-2 text-[12px] text-muted-foreground">This marks the order CANCELLED and restores reserved inventory. A reason is required.</p>
                                <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (e.g. customer request, out of stock)" className={cn(FIELD, "mb-2.5")} />
                                <div className="flex items-center gap-2">
                                  <button onClick={confirmCancel} disabled={cancelling || !cancelReason.trim()} className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-50">{cancelling ? <FlowLoader size={13} tone="white" /> : <Ban className="h-3.5 w-3.5" />} Confirm cancel</button>
                                  <button onClick={() => { setCancelOpen(false); setCancelReason(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Keep order</button>
                                </div>
                              </div>
                            )}

                            {/* refund confirm — step two: shows the exact amount + irreversibility */}
                            {refundOpen && (
                              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                                <div className="mb-1.5 flex items-center gap-1.5 text-amber-600"><AlertTriangle className="h-4 w-4" /><p className="text-[12.5px] font-semibold">Refund {money(detail.totalCents, dCur)} to the customer?</p></div>
                                <p className="mb-2.5 text-[12px] text-muted-foreground">This issues a full Stripe refund to the original card{detail.paymentLast4 ? ` ending ••${detail.paymentLast4}` : ""} and marks the order REFUNDED. This cannot be undone.</p>
                                <div className="flex items-center gap-2">
                                  <button onClick={confirmRefund} disabled={refunding} className="inline-flex items-center gap-1.5 rounded-[10px] bg-amber-500 px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-60">{refunding ? <FlowLoader size={13} tone="white" /> : <RotateCcw className="h-3.5 w-3.5" />} Confirm refund</button>
                                  <button onClick={() => setRefundOpen(false)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Don&apos;t refund</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="py-3 text-[12px] text-rose-500">{detailErr || "Could not load this order."}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">{hasOrderFilters ? "No orders match those filters" : "No orders yet"}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{hasOrderFilters ? "Try clearing search, status, or payment." : "Share your storefront and orders will appear here."}</p>
              {hasOrderFilters && (
                <button onClick={() => { setOSearch(""); setOStatus(""); setOPayment(""); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60"><X className="h-4 w-4" /> Clear filters</button>
              )}
            </div>
          )}
        </section>
        )}
        </div>
      </div>

      {/* Rich product editor drawer — opened by a card click or "Add product". */}
      {editing && (
        <ProductEditor
          productId={editing}
          currency={cur}
          categoryOptions={CATEGORY_OPTIONS}
          onClose={() => setEditing(null)}
          onSaved={loadData}
        />
      )}

      {aiGenOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => { if (!aiGenBusy) setAiGenOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500/15 to-violet-500/15"><Sparkles className="h-[18px] w-[18px] text-brand-500" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-bold">Generate products with AI</h3>
                <p className="text-[11.5px] text-muted-foreground">Describe what you sell — we&apos;ll draft products with names, descriptions &amp; prices for you to review.</p>
              </div>
              <button onClick={() => !aiGenBusy && setAiGenOpen(false)} className="grid h-7 w-7 place-items-center rounded-[8px] text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <label className="block"><span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">What are the products?</span>
              <textarea value={aiGenDesc} onChange={(e) => setAiGenDesc(e.target.value)} rows={3} placeholder="e.g. Handmade shea-butter soaps in citrus, lavender and charcoal scents" className={cn(FIELD, "resize-y")} />
            </label>
            <label className="mt-3 block"><span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">How many?</span>
              <select value={aiGenCount} onChange={(e) => setAiGenCount(Number(e.target.value))} className={cn(FIELD, "w-auto")}>
                {[3, 5, 8, 10, 15, 20].map((n) => <option key={n} value={n}>{n} products</option>)}
              </select>
            </label>
            {aiGenError && <p className="mt-3 flex items-center gap-1.5 text-[12px] text-rose-500"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {aiGenError}</p>}
            {aiGenDone && <p className="mt-3 flex items-center gap-1.5 text-[12px] text-emerald-500"><Check className="h-3.5 w-3.5 shrink-0" /> {aiGenDone}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => !aiGenBusy && setAiGenOpen(false)} className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">{aiGenDone ? "Done" : "Cancel"}</button>
              <button onClick={runAiGenerate} disabled={aiGenBusy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{aiGenBusy ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-4 w-4" />} {aiGenBusy ? "Generating…" : "Generate"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Full-content-area progress loader shown while the store builds. Polls the real
// buildStatus; the numbered steps advance on an estimate for a sense of progress.
function StoreBuildingLoader({ storeId, onBuilt, onOpenStore }: { storeId: string; onBuilt: () => void; onOpenStore: () => void }) {
  const STEPS = ["Designing your branded storefront", "Adding your products & pricing", "Setting up secure checkout", "Publishing your store"];
  const [active, setActive] = useState(0);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = setInterval(async () => {
      const st = await fetch(`/api/ecommerce/store/${storeId}/generate`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!alive || !st) return;
      if (st.buildStatus === "built") { clearInterval(poll); onBuilt(); }
      else if (st.buildStatus === "error") { clearInterval(poll); setErrored(true); }
    }, 4000);
    return () => { alive = false; clearInterval(poll); };
  }, [storeId, onBuilt]);

  useEffect(() => {
    if (errored) return;
    const t = setInterval(() => setActive((a) => Math.min(a + 1, STEPS.length - 1)), 22000);
    return () => clearInterval(t);
  }, [errored]); // eslint-disable-line react-hooks/exhaustive-deps

  if (errored) {
    return (
      <div className="grid h-full min-h-0 flex-1 place-items-center p-6">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/10 text-rose-500"><AlertTriangle className="h-7 w-7" /></span>
          <h2 className="mt-4 text-[18px] font-extrabold">Your store build hit a snag</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Something went wrong while building. Open your store to review it and rebuild from the design studio.</p>
          <button onClick={onOpenStore} className="mt-5 inline-flex items-center gap-1.5 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm">Open my store <ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 flex-1 place-items-center p-6">
      <div className="w-full max-w-md text-center">
        <FlowLoader size={42} withMark />
        <h2 className="mt-4 text-[18px] font-extrabold">Building your store…</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">This takes a couple of minutes — hang tight, it lands right here. No need to do anything.</p>
        <div className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
          {STEPS.map((s, i) => {
            const done = i < active, cur = i === active;
            return (
              <div key={s} className={cn("flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors", cur ? "border-brand-500/40 bg-brand-500/5" : done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card")}>
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full", done ? "bg-emerald-500/15 text-emerald-500" : cur ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>
                  {done ? <Check className="h-3.5 w-3.5" /> : cur ? <FlowLoader size={13} /> : <span className="text-[11px] font-bold tabular-nums">{i + 1}</span>}
                </span>
                <span className={cn("text-[13px]", done || cur ? "font-semibold text-foreground" : "text-muted-foreground")}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{value}</span>
    </div>
  );
}
