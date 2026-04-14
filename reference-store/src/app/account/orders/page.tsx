"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, ArrowRight, AlertCircle, CreditCard,
  Package, Truck, CheckCircle, XCircle, Clock, Loader2, ChevronLeft, ChevronRight
} from "lucide-react";
import { formatPrice } from "@/lib/data";

interface OrderItem {
  name: string;
  quantity: number;
  priceCents: number;
  imageUrl?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentId?: string;
  totalCents: number;
  currency: string;
  items: OrderItem[];
  createdAt: string;
  trackingNumber?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ size: number }> }> = {
  PENDING:   { label: "Pending",    color: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400", icon: Clock },
  CONFIRMED: { label: "Confirmed",  color: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",         icon: CheckCircle },
  SHIPPED:   { label: "Shipped",    color: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400", icon: Truck },
  DELIVERED: { label: "Delivered",  color: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400",     icon: CheckCircle },
  CANCELLED: { label: "Cancelled",  color: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",             icon: XCircle },
};

const PAYMENT_LABELS: Record<string, string> = {
  card: "Card", cod: "Cash on Delivery",
  bank_transfer: "Bank Transfer", mobile_money: "Mobile Money",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => { fetchOrders(page); }, [page]);

  // Extract basePath from current URL so navigations stay within the store
  function getBasePath() {
    return window.location.pathname.match(/^(\/stores\/[^/]+)/)?.[1] || "";
  }

  async function fetchOrders(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/account/orders?page=${p}`, { credentials: "include" });
      if (res.status === 401) {
        const base = getBasePath();
        window.location.href = `${base}/account/login?return=${base}/account/orders`;
        return;
      }
      const data = await res.json();
      setOrders(data.orders || []);
      setPendingPayments(data.pendingPayments || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      // Network error — stay on page
    } finally {
      setLoading(false);
    }
  }

  async function handleCompletePayment(order: Order) {
    setResumingId(order.id);
    setResumeError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/resume-payment`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { setResumeError(data.error || "Unable to resume payment"); return; }
      const { clientSecret, amount, orderId } = data.data;
      const base = getBasePath();
      window.location.href = `${base}/checkout/confirm?secret=${encodeURIComponent(clientSecret)}&order=${orderId}&amount=${amount}`;
    } catch {
      setResumeError("Network error — please try again");
    } finally {
      setResumingId(null);
    }
  }

  async function handleCancelOrder(order: Order) {
    if (!confirm("Cancel this order? This action cannot be undone.")) return;
    setCancellingId(order.id);
    try {
      const res = await fetch(`/api/account/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders(page);
      } else {
        alert(data.error || "Unable to cancel order.");
      }
    } catch {
      alert("Network error — please try again");
    } finally {
      setCancellingId(null);
    }
  }

  const fmt = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="min-h-screen py-20 sm:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <ShoppingBag size={32} className="text-primary" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Order History</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">View and track all your orders</p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 size={36} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ── Payment Required Section ─────────────────────────────── */}
            <AnimatePresence>
              {pendingPayments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-8 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <h2 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                      {pendingPayments.length === 1 ? "Payment Required" : `${pendingPayments.length} Payments Required`}
                    </h2>
                  </div>

                  {resumeError && (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">{resumeError}</p>
                  )}

                  <div className="space-y-3">
                    {pendingPayments.map(order => (
                      <div
                        key={order.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 rounded-xl p-4 border border-amber-100 dark:border-amber-800"
                      >
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            Order #{order.orderNumber}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {fmt(order.createdAt)} · {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
                            <span className="font-medium">{formatPrice(order.totalCents, order.currency)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCompletePayment(order)}
                          disabled={resumingId === order.id || cancellingId === order.id}
                          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer flex-shrink-0"
                        >
                          {resumingId === order.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <CreditCard size={15} />
                          )}
                          Complete Payment
                        </button>
                        <button
                          onClick={() => handleCancelOrder(order)}
                          disabled={cancellingId === order.id || resumingId === order.id}
                          className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors cursor-pointer flex-shrink-0"
                        >
                          {cancellingId === order.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <XCircle size={15} />
                          )}
                          Cancel
                        </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Order List ───────────────────────────────────────────── */}
            {orders.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
                <ShoppingBag size={64} className="mx-auto text-gray-300 dark:text-gray-700 mb-6" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No orders yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-8">Start shopping to place your first order</p>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary/90 text-white font-semibold rounded-full transition-colors"
                >
                  Shop Now <ArrowRight size={18} />
                </Link>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {orders.map((order, idx) => {
                  const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                  const StatusIcon = s.icon;
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      className="block p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-primary hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                              #{order.orderNumber}
                            </h3>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${s.color}`}>
                              <StatusIcon size={11} />
                              {s.label}
                            </span>
                            {order.paymentMethod && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
                                {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {fmt(order.createdAt)} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                          </p>
                          {order.trackingNumber && (
                            <p className="text-xs text-primary mt-1 font-medium">
                              Tracking: {order.trackingNumber}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {formatPrice(order.totalCents, order.currency)}
                          </p>
                          {order.items[0]?.imageUrl ? (
                            <img
                              src={order.items[0].imageUrl}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover ml-auto mt-2 border border-gray-100 dark:border-gray-800"
                            />
                          ) : (
                            <Package size={16} className="ml-auto mt-2 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ── Pagination ───────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:border-primary transition-colors cursor-pointer"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:border-primary transition-colors cursor-pointer"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
