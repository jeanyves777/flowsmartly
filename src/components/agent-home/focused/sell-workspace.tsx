"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Image from "next/image";
import { Store, ExternalLink, Package, ShoppingBag, Coins, Clock, CheckCircle2, Image as ImageIcon, Plus, X, Check, Pencil, Search, Trash2, Truck, Ban, RotateCcw, ChevronRight, MapPin, User, CreditCard, AlertTriangle, Users } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { StoreCallToAction } from "./store-cta";
import { AgentWorkingCard } from "./agent-working-card";
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

interface StoreData { id: string; name: string; slug: string; currency?: string; region?: string; isActive?: boolean; productCount?: number; orderCount?: number; totalRevenueCents?: number; }
interface Product { id: string; name: string; priceCents?: number; currency?: string; status?: string; quantity?: number; description?: string | null; category?: string | null; categoryName?: string | null; images?: { url: string }[]; }
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
type Form = { name: string; price: string; description: string; category: string; status: "ACTIVE" | "DRAFT" | "ARCHIVED"; quantity: string; image: string };
const EMPTY_FORM: Form = { name: "", price: "", description: "", category: "", status: "ACTIVE", quantity: "", image: "" };

// Next status the seller can move an order to (mirrors the order state machine).
const NEXT_STATUS: Record<string, { label: string; to: string }> = {
  PENDING: { label: "Confirm", to: "CONFIRMED" },
  CONFIRMED: { label: "Process", to: "PROCESSING" },
  PROCESSING: { label: "Ship", to: "SHIPPED" },
  SHIPPED: { label: "Mark delivered", to: "DELIVERED" },
};
// Statuses a seller can cancel from (matches server-side allowedTransitions → CANCELLED).
const CANCELLABLE = new Set(["PENDING", "CONFIRMED", "PROCESSING"]);

type Section = "products" | "orders";

const ORDER_STATUS_FILTERS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const PAYMENT_STATUS_FILTERS = ["pending", "paid", "failed", "refunded"];
// Categories the store can list under (mirrors PRODUCT_CATEGORIES). Kept local so this surface owns its own copy.
const CATEGORY_OPTIONS = ["clothing", "electronics", "food", "health", "home", "jewelry", "sports", "toys", "digital", "services", "art", "books", "automotive", "pets", "other"];

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

export function FocusedSell({ refreshKey, onAsk, onOpenView, working }: { refreshKey?: number; onAsk: (prompt: string) => void; onOpenView: (key: string) => void; working?: boolean }) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [armed, setArmed] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({});
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("products");

  // Product form: "new" (add), a product id (edit), or null (closed).
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyOrder, setBusyOrder] = useState<string | null>(null);

  // Product search / filters.
  const [pSearch, setPSearch] = useState("");
  const [pStatus, setPStatus] = useState("");
  const [pCategory, setPCategory] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // product id pending delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  // Clear the "agent is working" card once the store actually lands (hasStore flips true).
  useEffect(() => { if (armed && hasStore) setArmed(false); }, [hasStore, armed]);

  const openAdd = () => { setForm(EMPTY_FORM); setError(""); setEditing("new"); setSection("products"); };
  const openEdit = (p: Product) => {
    setForm({
      name: p.name ?? "", price: p.priceCents ? String((p.priceCents / 100)) : "", description: p.description ?? "",
      category: p.category ?? "", status: (() => { const s = p.status?.toUpperCase(); return s === "DRAFT" ? "DRAFT" : s === "ARCHIVED" ? "ARCHIVED" : "ACTIVE"; })(), quantity: p.quantity != null ? String(p.quantity) : "",
      image: p.images?.[0]?.url ?? "",
    });
    setError(""); setEditing(p.id); setConfirmDelete(null);
  };
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name) { setError("Give the product a name."); return; }
    if (!Number.isFinite(price) || price <= 0) { setError("Set a price greater than 0."); return; }
    setSaving(true); setError("");
    try {
      const qty = Number(form.quantity);
      const body: Record<string, unknown> = {
        name,
        priceCents: Math.round(price * 100),
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        status: form.status,
        images: form.image ? [{ url: form.image, alt: name, position: 0 }] : undefined,
      };
      if (Number.isFinite(qty) && qty > 0) { body.quantity = Math.floor(qty); body.trackInventory = true; }
      const isEdit = editing && editing !== "new";
      const r = await fetch(isEdit ? `/api/ecommerce/products/${editing}` : "/api/ecommerce/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok && j?.success !== false) {
        setEditing(null); setForm(EMPTY_FORM);
        await loadData();
      } else {
        setError(j?.error?.message || "Could not save the product.");
      }
    } catch {
      setError("Could not save the product.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    setDeletingId(id); setError("");
    try {
      const r = await fetch(`/api/ecommerce/products/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) {
        setConfirmDelete(null);
        if (editing === id) setEditing(null);
        await loadData();
      } else {
        setError(j?.error?.message || "Could not delete the product.");
      }
    } catch {
      setError("Could not delete the product.");
    } finally {
      setDeletingId(null);
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

  // No store yet → show the benefits + exact charges, then have the agent build
  // it (a heavy generative build → agent-driven).
  if (!hasStore) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
        <div className="mx-auto mt-[2vh] max-w-lg space-y-4">
          {armed && (
            <AgentWorkingCard
              working={working}
              title="Setting up your store"
              sub={working ? "The agent is building your branded store — it'll appear here." : "Answer the agent's questions in the chat and your store will land here."}
            />
          )}
          <StoreCallToAction onBuild={(p) => { setArmed(true); onAsk(p); }} onTopUp={() => onOpenView("credits")} />
        </div>
      </div>
    );
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
  const orderCount = stats.totalOrders ?? store?.orderCount ?? 0;

  const nav: { id: Section; label: string; icon: ElementType; count: number }[] = [
    { id: "products", label: "Products", icon: Package, count: productCount },
    { id: "orders", label: "Orders", icon: ShoppingBag, count: orderCount },
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
            <div className="mt-2.5 flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", store?.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{store?.isActive ? "Live" : "Draft"}</span>
              {store?.slug && (
                <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                  <ExternalLink className="h-3 w-3" /> Storefront
                </a>
              )}
            </div>

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
                  {n.count > 0 && (
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
        {section === "products" ? (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Products</h3>
            <button onClick={openAdd} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
              <Plus className="h-3.5 w-3.5" /> Add product
            </button>
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

          {/* inline add/edit form — a click opens this, not a chat prompt */}
          {editing && (
            <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
              <p className="mb-2.5 text-[12.5px] font-semibold">{editing === "new" ? "New product" : "Edit product"}</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Name *</span><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Blue Mug" className={FIELD} /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Price ({cur}) *</span><input value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="20" inputMode="decimal" className={FIELD} /></label>
              </div>
              <label className="mt-2.5 block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Description</span><textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What it is, who it's for." className={cn(FIELD, "resize-none")} /></label>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Category</span>
                  <select value={form.category} onChange={(e) => set("category", e.target.value)} className={FIELD}>
                    <option value="">None</option>
                    {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </label>
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Stock</span><input value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="(optional)" inputMode="numeric" className={FIELD} /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Status</span>
                  <select value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])} className={FIELD}><option value="ACTIVE">Active (listed)</option><option value="DRAFT">Draft</option>{form.status === "ARCHIVED" && <option value="ARCHIVED">Archived</option>}</select>
                </label>
              </div>
              <div className="mt-2.5"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Image</span><MediaUploader value={form.image ? [form.image] : []} onChange={(u) => set("image", u[0] ?? "")} variant="large" placeholder="Product image" showButtons /></div>
              {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                  {saving ? <FlowLoader size={15} tone="white" /> : <Check className="h-3.5 w-3.5" />} {editing === "new" ? "Add product" : "Save changes"}
                </button>
                <button onClick={() => { setEditing(null); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
                {/* Delete — only on edit, with an inline two-step confirm (destructive). */}
                {editing !== "new" && (
                  confirmDelete === editing ? (
                    <div className="ms-auto inline-flex items-center gap-2 rounded-[10px] border border-rose-500/40 bg-rose-500/5 px-2.5 py-1.5">
                      <span className="text-[11.5px] font-semibold text-rose-500">Delete this product?</span>
                      <button onClick={() => deleteProduct(editing)} disabled={deletingId === editing} className="inline-flex items-center gap-1 rounded-[8px] bg-rose-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-60">
                        {deletingId === editing ? <FlowLoader size={12} tone="white" /> : <Trash2 className="h-3 w-3" />} Delete
                      </button>
                      <button onClick={() => setConfirmDelete(null)} className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">Keep</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(editing)} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/30 px-3 py-2 text-[12.5px] font-semibold text-rose-500 hover:bg-rose-500/5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                  )
                )}
              </div>
            </div>
          )}

          {products.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => (
                <button key={p.id} onClick={() => openEdit(p)} className="group overflow-hidden rounded-xl border border-border bg-muted/30 text-left transition hover:border-brand-500/60">
                  <div className="relative grid aspect-square place-items-center bg-background">
                    {p.images?.[0]?.url ? <Image src={p.images[0].url} alt="" width={160} height={160} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></span>
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[12.5px] font-medium">{p.name}</p>
                    <p className="mt-0.5 text-[12px] text-brand-500">{money(p.priceCents, p.currency || cur)}{p.status?.toUpperCase() === "DRAFT" ? " · draft" : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : !editing ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">{hasProductFilters ? "No products match those filters" : "No products yet"}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{hasProductFilters ? "Try clearing search, status, or category." : "Add your first product — set a name, price, and image."}</p>
              {hasProductFilters ? (
                <button onClick={() => { setPSearch(""); setPStatus(""); setPCategory(""); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60"><X className="h-4 w-4" /> Clear filters</button>
              ) : (
                <button onClick={openAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Plus className="h-4 w-4" /> Add a product</button>
              )}
            </div>
          ) : null}
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
