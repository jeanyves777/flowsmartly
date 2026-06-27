"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import { Store, Sparkles, ExternalLink, Package, ShoppingBag, Coins, Clock, CheckCircle2, Image as ImageIcon, Plus, X, Check, Pencil } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { cn } from "@/lib/utils/cn";

/**
 * Sell — a deep new-design ecommerce surface (the Sell workspace canvas): store
 * overview + KPIs + products + orders. The data actions are REAL UI — "Add
 * product" opens a form, clicking a product edits it, orders advance via inline
 * controls (POST/PATCH /api/ecommerce/*). A click means do-it-in-the-UI, not a
 * chat prompt. Store creation stays agent-driven (a heavy generative build).
 * No legacy links. [[surface-buttons-are-ui-actions]]
 */

interface StoreData { id: string; name: string; slug: string; currency?: string; region?: string; isActive?: boolean; productCount?: number; orderCount?: number; totalRevenueCents?: number; }
interface Product { id: string; name: string; priceCents?: number; currency?: string; status?: string; quantity?: number; description?: string | null; category?: string | null; images?: { url: string }[]; }
interface Order { id: string; orderNumber?: string; customerName?: string; totalCents?: number; currency?: string; status?: string; createdAt?: string; }
interface OrderStats { totalOrders?: number; totalRevenueCents?: number; pendingCount?: number; deliveredCount?: number; }

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
type Form = { name: string; price: string; description: string; category: string; status: "ACTIVE" | "DRAFT"; quantity: string; image: string };
const EMPTY_FORM: Form = { name: "", price: "", description: "", category: "", status: "ACTIVE", quantity: "", image: "" };

// Next status the seller can move an order to (mirrors the order state machine).
const NEXT_STATUS: Record<string, { label: string; to: string }> = {
  PENDING: { label: "Confirm", to: "CONFIRMED" },
  CONFIRMED: { label: "Process", to: "PROCESSING" },
  PROCESSING: { label: "Ship", to: "SHIPPED" },
  SHIPPED: { label: "Mark delivered", to: "DELIVERED" },
};

function money(cents?: number, currency = "USD"): string {
  try { return ((cents ?? 0) / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 }); } catch { return `${((cents ?? 0) / 100).toFixed(0)}`; }
}

export function FocusedSell({ refreshKey, onAsk, onOpenView }: { refreshKey?: number; onAsk: (prompt: string) => void; onOpenView: (key: string) => void }) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({});
  const [loading, setLoading] = useState(true);

  // Product form: "new" (add), a product id (edit), or null (closed).
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyOrder, setBusyOrder] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const sj = await fetch("/api/ecommerce/store").then((r) => r.json()).catch(() => null);
    const has = !!sj?.data?.hasStore && !!sj?.data?.store;
    setHasStore(has);
    if (has) {
      setStore(sj.data.store);
      const [pr, or] = await Promise.all([
        fetch("/api/ecommerce/products?limit=12").then((r) => r.json()).catch(() => null),
        fetch("/api/ecommerce/orders?limit=6").then((r) => r.json()).catch(() => null),
      ]);
      if (pr?.data?.products) setProducts(pr.data.products);
      if (or?.data?.orders) setOrders(or.data.orders);
      if (or?.data?.stats) setStats(or.data.stats);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadData().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadData, refreshKey]);

  const openAdd = () => { setForm(EMPTY_FORM); setError(""); setEditing("new"); };
  const openEdit = (p: Product) => {
    setForm({
      name: p.name ?? "", price: p.priceCents ? String((p.priceCents / 100)) : "", description: p.description ?? "",
      category: p.category ?? "", status: (p.status?.toUpperCase() === "DRAFT" ? "DRAFT" : "ACTIVE"), quantity: p.quantity != null ? String(p.quantity) : "",
      image: p.images?.[0]?.url ?? "",
    });
    setError(""); setEditing(p.id);
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

  const advanceOrder = async (o: Order) => {
    const next = NEXT_STATUS[(o.status || "PENDING").toUpperCase()];
    if (!next) return;
    setBusyOrder(o.id);
    try {
      await fetch(`/api/ecommerce/orders/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next.to }) });
      await loadData();
    } catch { /* ignore */ } finally {
      setBusyOrder(null);
    }
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your store…" /></div>;
  }

  // No store yet → store creation is a heavy generative build, so the agent runs it.
  if (!hasStore) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Store className="h-8 w-8" /></span>
          <h2 className="mt-4 text-[20px] font-extrabold">Launch your online store</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">Tell the agent what you sell and it builds the whole store — branded storefront, products, and checkout — in minutes.</p>
          <button onClick={() => onAsk("Help me build my online store — ask me what I sell, my products and prices, then create the store.")} className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30">
            <Sparkles className="h-4 w-4" /> Create my store
          </button>
        </div>
      </div>
    );
  }

  const cur = store?.currency || "USD";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* store header */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Store className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[16px] font-bold">{store?.name}</h2>
                <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", store?.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{store?.isActive ? "Live" : "Draft"}</span>
              </div>
              <p className="truncate text-[12px] text-muted-foreground">{store?.region ? `${store.region} · ` : ""}{cur}</p>
            </div>
            {store?.slug && (
              <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" /> View storefront
              </a>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={Package} label="Products" value={String(store?.productCount ?? products.length)} />
            <Kpi icon={ShoppingBag} label="Orders" value={String(stats.totalOrders ?? store?.orderCount ?? 0)} />
            <Kpi icon={Coins} label="Revenue" value={money(stats.totalRevenueCents ?? store?.totalRevenueCents, cur)} />
            <Kpi icon={Clock} label="Pending" value={String(stats.pendingCount ?? 0)} />
          </div>
        </section>

        {/* products */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">Products</h3>
            <button onClick={openAdd} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
              <Plus className="h-3.5 w-3.5" /> Add product
            </button>
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
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Category</span><input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Drinkware" className={FIELD} /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Stock</span><input value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="(optional)" inputMode="numeric" className={FIELD} /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Status</span>
                  <select value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])} className={FIELD}><option value="ACTIVE">Active (listed)</option><option value="DRAFT">Draft</option></select>
                </label>
              </div>
              <div className="mt-2.5"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Image</span><MediaUploader value={form.image ? [form.image] : []} onChange={(u) => set("image", u[0] ?? "")} variant="large" placeholder="Product image" showButtons /></div>
              {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                  {saving ? <FlowLoader size={15} tone="white" /> : <Check className="h-3.5 w-3.5" />} {editing === "new" ? "Add product" : "Save changes"}
                </button>
                <button onClick={() => { setEditing(null); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
              </div>
            </div>
          )}

          {products.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
              <p className="text-[13px] font-medium">No products yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Add your first product — set a name, price, and image.</p>
              <button onClick={openAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Plus className="h-4 w-4" /> Add a product</button>
            </div>
          ) : null}
        </section>

        {/* orders */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">Recent orders</h3>
            <button onClick={() => onOpenView("customers")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">View customers</button>
          </div>
          {orders.length ? (
            <div className="space-y-2">
              {orders.map((o) => {
                const next = NEXT_STATUS[(o.status || "PENDING").toUpperCase()];
                return (
                  <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <span className="text-[12.5px] font-semibold">{o.orderNumber || o.id.slice(0, 8)}</span>
                    <span className="text-[12px] text-muted-foreground">{o.customerName || "Customer"}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", o.status === "DELIVERED" ? "bg-emerald-500/10 text-emerald-500" : "bg-brand-500/10 text-brand-500")}>
                      {o.status === "DELIVERED" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{(o.status || "PENDING").toLowerCase()}
                    </span>
                    <span className="ms-auto text-[13px] font-bold">{money(o.totalCents, o.currency || cur)}</span>
                    {next && (
                      <button onClick={() => advanceOrder(o)} disabled={busyOrder === o.id} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                        {busyOrder === o.id ? <FlowLoader size={13} /> : null} {next.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No orders yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Share your storefront and orders will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </div>
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
