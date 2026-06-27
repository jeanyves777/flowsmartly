"use client";

import { useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import { Store, Sparkles, ExternalLink, Package, ShoppingBag, Coins, Clock, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Sell — a deep new-design ecommerce surface (the Sell workspace canvas): store
 * overview + KPIs + products + orders. Real data (GET /api/ecommerce/store,
 * /products, /orders); store creation + product adds drive the agent (build_store).
 * No legacy links. [[new-design-no-legacy]]
 */

interface StoreData {
  id: string;
  name: string;
  slug: string;
  currency?: string;
  region?: string;
  isActive?: boolean;
  productCount?: number;
  orderCount?: number;
  totalRevenueCents?: number;
}
interface Product { id: string; name: string; priceCents?: number; currency?: string; status?: string; quantity?: number; images?: { url: string }[]; }
interface Order { id: string; orderNumber?: string; customerName?: string; totalCents?: number; currency?: string; status?: string; createdAt?: string; }
interface OrderStats { totalOrders?: number; totalRevenueCents?: number; pendingCount?: number; deliveredCount?: number; }

function money(cents?: number, currency = "USD"): string {
  try { return ((cents ?? 0) / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 }); } catch { return `${((cents ?? 0) / 100).toFixed(0)}`; }
}

export function FocusedSell({ onAsk, refreshKey }: { onAsk: (prompt: string) => void; refreshKey?: number }) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/ecommerce/store")
      .then((r) => r.json())
      .then(async (j) => {
        if (!alive) return;
        const has = !!j?.data?.hasStore && !!j?.data?.store;
        setHasStore(has);
        if (has) {
          setStore(j.data.store);
          const [pr, or] = await Promise.all([
            fetch("/api/ecommerce/products?limit=8").then((r) => r.json()).catch(() => null),
            fetch("/api/ecommerce/orders?limit=6").then((r) => r.json()).catch(() => null),
          ]);
          if (!alive) return;
          if (pr?.data?.products) setProducts(pr.data.products);
          if (or?.data?.orders) setOrders(or.data.orders);
          if (or?.data?.stats) setStats(or.data.stats);
        }
      })
      .catch(() => { if (alive) setHasStore(false); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refreshKey]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your store…" /></div>;
  }

  // No store yet → agent-driven create.
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
            <button onClick={() => onAsk("Help me add a new product to my store — ask me the name, price, and a short description, then create it.")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> Add product
            </button>
          </div>
          {products.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-muted/30">
                  <div className="grid aspect-square place-items-center bg-background">
                    {p.images?.[0]?.url ? <Image src={p.images[0].url} alt="" width={160} height={160} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[12.5px] font-medium">{p.name}</p>
                    <p className="mt-0.5 text-[12px] text-brand-500">{money(p.priceCents, p.currency || cur)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No products yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Add your first product and the agent will write the listing and price it.</p>
            </div>
          )}
        </section>

        {/* orders */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">Recent orders</h3>
          {orders.length ? (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                  <span className="text-[12.5px] font-semibold">{o.orderNumber || o.id.slice(0, 8)}</span>
                  <span className="text-[12px] text-muted-foreground">{o.customerName || "Customer"}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", o.status === "DELIVERED" ? "bg-emerald-500/10 text-emerald-500" : "bg-brand-500/10 text-brand-500")}>
                    {o.status === "DELIVERED" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{(o.status || "PENDING").toLowerCase()}
                  </span>
                  <span className="ms-auto text-[13px] font-bold">{money(o.totalCents, o.currency || cur)}</span>
                </div>
              ))}
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
