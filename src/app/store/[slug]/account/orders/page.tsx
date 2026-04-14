"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";


interface OrderSummary {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  status: string;
  paymentMethod: string;
  paymentId: string | null;
  createdAt: string;
  items: Array<{ name: string; quantity: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  PROCESSING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  SHIPPED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  REFUNDED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function StoreOrdersPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [pendingPayments, setPendingPayments] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/store/${slug}/account/orders?page=${p}&limit=10`);
      if (res.status === 401) { router.push(`/store/${slug}/account/login`); return; }
      const data = await res.json();
      setOrders(data.orders || []);
      setPendingPayments(data.pendingPayments || []);
      setTotalPages(data.totalPages || 1);
    } catch { /* network error */ } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => { fetchOrders(page); }, [page, fetchOrders]);

  async function resumePayment(order: OrderSummary) {
    setResumingId(order.id);
    try {
      const res = await fetch(`/api/store/${slug}/orders/${order.id}/resume-payment`);
      const data = await res.json();
      if (data.success) {
        // checkout/confirm lives in the store app at /stores/[slug]/, NOT the main app /store/[slug]/
        window.location.href = `/stores/${slug}/checkout/confirm?secret=${data.data.clientSecret}&order=${data.data.orderId}&amount=${data.data.amount}`;
      } else {
        alert(data.error || "Unable to resume payment. Please place a new order.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setResumingId(null);
    }
  }

  async function cancelOrder(order: OrderSummary) {
    if (!confirm("Cancel this order? This action cannot be undone.")) return;
    setCancellingId(order.id);
    try {
      const res = await fetch(`/api/store/${slug}/account/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders(page);
      } else {
        alert(data.error || "Unable to cancel order.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setCancellingId(null);
    }
  }

  function formatMoney(cents: number, currency: string) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(cents / 100);
  }

  const storeBase = `/store/${slug}`;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`${storeBase}/account`} className="opacity-50 hover:opacity-80 transition-opacity">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--store-font-heading), sans-serif" }}>
          My Orders
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "var(--store-primary)" }} />
        </div>
      ) : (
        <>
          {/* Payment Required Reminders */}
          {pendingPayments.length > 0 && (
            <div className="mb-6 space-y-3">
              <h2 className="text-sm font-semibold opacity-50 uppercase tracking-wider">Payment Required</h2>
              {pendingPayments.map((order) => {
                const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) || 0;
                const itemSummary = order.items?.map(i => i.name).slice(0, 2).join(", ") || "";
                return (
                  <div
                    key={order.id}
                    className="rounded-lg border-2 p-4"
                    style={{ borderColor: "var(--store-primary)", background: "color-mix(in srgb, var(--store-primary) 5%, transparent)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-sm">{order.orderNumber}</span>
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Payment Required
                          </span>
                        </div>
                        <p className="text-xs opacity-50 mt-1">
                          {new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                        {itemSummary && (
                          <p className="text-xs opacity-40 mt-1 truncate">
                            {itemCount} item{itemCount !== 1 ? "s" : ""} — {itemSummary}{(order.items?.length || 0) > 2 ? "..." : ""}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <p className="font-semibold text-sm">{formatMoney(order.totalCents, order.currency)}</p>
                        <button
                          onClick={() => resumePayment(order)}
                          disabled={resumingId === order.id || cancellingId === order.id}
                          className="px-4 py-1.5 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{ background: "var(--store-primary)" }}
                        >
                          {resumingId === order.id ? "Loading..." : "Complete Payment"}
                        </button>
                        <button
                          onClick={() => cancelOrder(order)}
                          disabled={cancellingId === order.id || resumingId === order.id}
                          className="px-4 py-1.5 rounded-full text-xs font-semibold border transition-opacity hover:opacity-70 disabled:opacity-50"
                          style={{ borderColor: "color-mix(in srgb, var(--store-text) 20%, transparent)" }}
                        >
                          {cancellingId === order.id ? "Cancelling..." : "Cancel Order"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed Orders */}
          {orders.length === 0 && pendingPayments.length === 0 ? (
            <div className="rounded-lg border p-12 text-center" style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}>
              <svg className="h-12 w-12 mx-auto opacity-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-lg font-medium opacity-60">No orders yet</p>
              <Link href={`${storeBase}/products`} className="inline-block mt-4 text-sm font-medium hover:underline" style={{ color: "var(--store-primary)" }}>
                Start shopping
              </Link>
            </div>
          ) : orders.length > 0 ? (
            <>
              <div className="space-y-3">
                {orders.map((order) => {
                  const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) || 0;
                  const itemSummary = order.items?.map(i => i.name).slice(0, 2).join(", ") || "";
                  return (
                    <Link
                      key={order.id}
                      href={`${storeBase}/account/orders/${order.id}`}
                      className="block rounded-lg border p-4 transition-shadow hover:shadow-md"
                      style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-semibold text-sm">{order.orderNumber}</span>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-800"}`}>
                              {order.status}
                            </span>
                          </div>
                          <p className="text-xs opacity-50 mt-1">
                            {new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                          </p>
                          {itemSummary && (
                            <p className="text-xs opacity-40 mt-1 truncate">
                              {itemCount} item{itemCount !== 1 ? "s" : ""} — {itemSummary}{(order.items?.length || 0) > 2 ? "..." : ""}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm">{formatMoney(order.totalCents, order.currency)}</p>
                          <svg className="h-4 w-4 opacity-30 mt-1 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-30"
                    style={{ borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)" }}>
                    Previous
                  </button>
                  <span className="text-sm opacity-50">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-30"
                    style={{ borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)" }}>
                    Next
                  </button>
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
