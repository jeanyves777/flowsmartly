"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Package, Truck, CheckCircle, Clock, XCircle,
  MapPin, CreditCard, Loader2, AlertTriangle, Printer,
} from "lucide-react";
import { formatPrice } from "@/lib/data";

interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  priceCents: number;
  imageUrl?: string;
}

interface ShippingAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentId?: string;
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  shippingAddress: ShippingAddress;
  trackingNumber?: string;
  estimatedDelivery?: string;
  returnRequested: boolean;
  returnReason?: string;
  createdAt: string;
}

const STATUS_STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];
const STATUS_ICONS: Record<string, typeof Clock> = {
  PENDING: Clock, CONFIRMED: CheckCircle, PROCESSING: Package,
  SHIPPED: Truck, DELIVERED: CheckCircle, CANCELLED: XCircle,
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
  CONFIRMED: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  PROCESSING: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400",
  SHIPPED: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
  DELIVERED: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400",
  CANCELLED: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  REFUNDED: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};
const PAYMENT_LABELS: Record<string, string> = {
  card: "Card", cod: "Cash on Delivery",
  bank_transfer: "Bank Transfer", mobile_money: "Mobile Money",
};
const PRE_FULFILLMENT = ["PENDING", "CONFIRMED", "PROCESSING"];

function getBasePath() {
  return window.location.pathname.match(/^(\/stores\/[^/]+)/)?.[1] || "";
}

export default function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const { orderId } = params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Cancel
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Address change
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState({ name: "", line1: "", line2: "", city: "", state: "", zip: "", country: "" });
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrError, setAddrError] = useState("");
  const [addrSuccess, setAddrSuccess] = useState(false);

  // Return
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [returnSuccess, setReturnSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/account/orders/${orderId}`, { credentials: "include" })
      .then(async res => {
        if (res.status === 401) { window.location.href = `${getBasePath()}/account/login`; return; }
        if (!res.ok) { setErr("Order not found."); return; }
        setOrder(await res.json());
      })
      .catch(() => setErr("Failed to load order."))
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleCancel() {
    setCancelling(true); setCancelError("");
    try {
      const res = await fetch(`/api/account/orders/${orderId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) { setCancelError(data.error || "Failed to cancel order."); return; }
      setOrder(prev => prev ? { ...prev, status: "CANCELLED", paymentStatus: data.paymentStatus } : prev);
      setCancelConfirm(false);
    } catch { setCancelError("Something went wrong."); }
    finally { setCancelling(false); }
  }

  async function handleAddressChange(e: React.FormEvent) {
    e.preventDefault(); setSavingAddr(true); setAddrError("");
    try {
      const res = await fetch(`/api/account/orders/${orderId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_address", address: addrForm }),
      });
      const data = await res.json();
      if (!res.ok) { setAddrError(data.error || "Failed to update address."); return; }
      setOrder(prev => prev ? { ...prev, shippingAddress: data.shippingAddress } : prev);
      setShowAddrForm(false); setAddrSuccess(true);
    } catch { setAddrError("Something went wrong."); }
    finally { setSavingAddr(false); }
  }

  async function handleReturn(e: React.FormEvent) {
    e.preventDefault(); setSubmittingReturn(true); setReturnError("");
    try {
      const res = await fetch(`/api/account/orders/${orderId}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: returnReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setReturnError(data.error || "Failed to submit."); return; }
      setOrder(prev => prev ? { ...prev, returnRequested: true, returnReason: returnReason.trim() } : prev);
      setReturnSuccess(true); setShowReturnForm(false);
    } catch { setReturnError("Something went wrong."); }
    finally { setSubmittingReturn(false); }
  }

  if (loading) return (
    <div className="flex justify-center py-24"><Loader2 size={32} className="animate-spin text-primary" /></div>
  );
  if (err || !order) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
      <Package size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-4" />
      <p className="text-lg font-medium text-gray-500">{err || "Order not found"}</p>
      <Link href="/account/orders" className="inline-block mt-4 text-sm font-medium text-primary hover:underline">
        Back to orders
      </Link>
    </div>
  );

  const stepIndex = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === "CANCELLED" || order.status === "REFUNDED";
  const canCancel = PRE_FULFILLMENT.includes(order.status);
  const canChangeAddr = PRE_FULFILLMENT.includes(order.status);
  const canReturn = order.status === "DELIVERED" && !order.returnRequested;

  return (
    <div className="min-h-screen py-20 sm:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 mb-8">
          <div>
            <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-3 font-medium">
              <ArrowLeft size={15} /> Back to Orders
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{order.orderNumber}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Placed {new Date(order.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Printer size={15} /> Print
          </button>
        </motion.div>

        {/* Status badge + timeline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[order.status] || STATUS_COLORS.PENDING}`}>
              {(() => { const Icon = STATUS_ICONS[order.status] || Clock; return <Icon size={11} />; })()}
              {order.status}
            </span>
          </div>

          {!isCancelled && (
            <div className="flex items-center gap-1">
              {STATUS_STEPS.map((step, i) => (
                <div key={step} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className={`h-2 w-full rounded-full transition-colors ${i <= stepIndex ? "bg-primary" : "bg-gray-100 dark:bg-gray-800"}`} />
                  <span className={`text-[10px] ${i === stepIndex ? "font-semibold text-primary" : "text-gray-400"}`}>
                    {step.charAt(0) + step.slice(1).toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {order.trackingNumber && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">Tracking: </span>
              <span className="font-mono">{order.trackingNumber}</span>
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Items + actions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Items */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Items ({order.items.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-lg object-cover border border-gray-100 dark:border-gray-800 flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <Package size={20} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex-shrink-0">
                      {formatPrice(item.priceCents * item.quantity, order.currency)}
                    </p>
                  </div>
                ))}
              </div>
              {/* Totals */}
              <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>Subtotal</span><span>{formatPrice(order.subtotalCents, order.currency)}</span>
                </div>
                {order.shippingCents > 0 && (
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>Shipping</span><span>{formatPrice(order.shippingCents, order.currency)}</span>
                  </div>
                )}
                {order.taxCents > 0 && (
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>Tax</span><span>{formatPrice(order.taxCents, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span>Total</span><span>{formatPrice(order.totalCents, order.currency)}</span>
                </div>
              </div>
            </motion.div>

            {/* Banners */}
            {returnSuccess && (
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-400 font-medium">
                Return request submitted! The store will contact you soon.
              </div>
            )}
            {addrSuccess && (
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-400 font-medium">
                Shipping address updated successfully.
              </div>
            )}
            {order.returnRequested && (
              <div className="rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4">
                <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Return Request Submitted</p>
                <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">{order.returnReason}</p>
              </div>
            )}

            {/* Cancel */}
            {canCancel && !isCancelled && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5"
              >
                {!cancelConfirm ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Need to cancel?</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {order.paymentMethod === "card" && order.paymentStatus === "paid"
                          ? "A full refund will be issued automatically."
                          : "This order has not been charged yet."}
                      </p>
                    </div>
                    <button
                      onClick={() => setCancelConfirm(true)}
                      className="flex-shrink-0 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                    >
                      Cancel Order
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400">
                      <AlertTriangle size={16} />
                      <p className="text-sm font-semibold">Confirm cancellation?</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {order.paymentMethod === "card" && order.paymentStatus === "paid"
                        ? "Your card will be refunded in 5–10 business days. This cannot be undone."
                        : "This action cannot be undone."}
                    </p>
                    {cancelError && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{cancelError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
                      >
                        {cancelling ? <Loader2 size={14} className="animate-spin" /> : "Yes, Cancel"}
                      </button>
                      <button
                        onClick={() => { setCancelConfirm(false); setCancelError(""); }}
                        disabled={cancelling}
                        className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      >
                        Keep Order
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Return */}
            {canReturn && !showReturnForm && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Not satisfied?</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Your order has been delivered. Request a return or refund.</p>
                <button
                  onClick={() => setShowReturnForm(true)}
                  className="px-4 py-2 rounded-lg border border-primary text-sm font-medium text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  Request Return / Refund
                </button>
              </motion.div>
            )}

            {showReturnForm && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Return / Refund Request</h3>
                {returnError && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{returnError}</p>}
                <form onSubmit={handleReturn} className="space-y-3">
                  <textarea
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    placeholder="Describe the reason for your return..."
                    rows={3}
                    required
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submittingReturn || !returnReason.trim()}
                      className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
                    >
                      {submittingReturn ? <Loader2 size={14} className="animate-spin" /> : "Submit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowReturnForm(false); setReturnReason(""); setReturnError(""); }}
                      className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right: Shipping + Payment */}
          <div className="space-y-4">
            {/* Shipping Address */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Shipping Address</h3>
              </div>
              {order.shippingAddress?.line1 ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
                  {order.shippingAddress.name && <p className="font-medium text-gray-900 dark:text-white">{order.shippingAddress.name}</p>}
                  <p>{order.shippingAddress.line1}</p>
                  {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                  <p>{[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.zip].filter(Boolean).join(", ")}</p>
                  {order.shippingAddress.country && <p>{order.shippingAddress.country}</p>}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No address on file</p>
              )}

              {canChangeAddr && !showAddrForm && (
                <button
                  onClick={() => {
                    setAddrForm({
                      name: order.shippingAddress?.name || "",
                      line1: order.shippingAddress?.line1 || "",
                      line2: order.shippingAddress?.line2 || "",
                      city: order.shippingAddress?.city || "",
                      state: order.shippingAddress?.state || "",
                      zip: order.shippingAddress?.zip || "",
                      country: order.shippingAddress?.country || "",
                    });
                    setShowAddrForm(true);
                    setAddrSuccess(false);
                  }}
                  className="mt-3 text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  Change address
                </button>
              )}

              {!canChangeAddr && !["CANCELLED","REFUNDED"].includes(order.status) && (
                <p className="mt-3 text-xs text-gray-400 italic">Address cannot be changed after shipment.</p>
              )}

              {canChangeAddr && showAddrForm && (
                <form onSubmit={handleAddressChange} className="mt-4 space-y-2">
                  {addrError && <p className="text-xs text-red-600 dark:text-red-400">{addrError}</p>}
                  {(["name","line1","line2","city","state","zip","country"] as const).map(field => (
                    <input
                      key={field}
                      type="text"
                      placeholder={
                        field === "line1" ? "Address line 1 *" :
                        field === "line2" ? "Apt, suite, etc." :
                        field === "zip" ? "Postal code" :
                        field.charAt(0).toUpperCase() + field.slice(1) + (["city","country"].includes(field) ? " *" : "")
                      }
                      value={addrForm[field]}
                      onChange={e => setAddrForm(prev => ({ ...prev, [field]: e.target.value }))}
                      required={["line1","city","country"].includes(field)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={savingAddr}
                      className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {savingAddr ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddrForm(false); setAddrError(""); }}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </motion.div>

            {/* Payment */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Payment</h3>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {order.paymentMethod && (
                  <p>{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</p>
                )}
                <p className="capitalize">{order.paymentStatus}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
