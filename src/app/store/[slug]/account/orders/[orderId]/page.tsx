"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

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

interface OrderDetail {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paymentStatus: string;
  shippingAddress: ShippingAddress;
  shippingMethod: string | null;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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

const STATUS_TIMELINE = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export default function StoreOrderDetailPage() {
  const router = useRouter();
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/store/${slug}/account/orders/${orderId}`);
        if (res.status === 401) {
          router.push(`/store/${slug}/account/login`);
          return;
        }
        if (res.status === 404) {
          setError("Order not found.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setOrder(data);
      } catch {
        setError("Failed to load order.");
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [slug, orderId, router]);

  function formatMoney(cents: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: order?.currency || "USD",
    }).format(cents / 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 px-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: "var(--store-primary)" }}
        />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-lg font-medium opacity-60">{error || "Order not found"}</p>
          <Link
            href={`/store/${slug}/account/orders`}
            className="inline-block mt-3 text-sm font-medium hover:underline"
            style={{ color: "var(--store-primary)" }}
          >
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const currentStatusIndex = STATUS_TIMELINE.indexOf(order.status);
  const isCancelled = order.status === "CANCELLED" || order.status === "REFUNDED";

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/store/${slug}/account/orders`}
          className="opacity-50 hover:opacity-80 transition-opacity"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
          >
            {order.orderNumber}
          </h1>
          <p className="text-sm opacity-50">
            Placed on{" "}
            {new Date(order.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="hidden sm:flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)" }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          Print Invoice
        </button>
      </div>

      {/* Status + Timeline */}
      <div
        className="rounded-lg border p-5 mb-6"
        style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium opacity-60">Status:</span>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-800"}`}>
            {order.status}
          </span>
        </div>

        {!isCancelled && (
          <div className="flex items-center gap-1">
            {STATUS_TIMELINE.map((step, i) => {
              const isActive = i <= currentStatusIndex;
              const isCurrent = i === currentStatusIndex;
              return (
                <div key={step} className="flex-1 flex items-center gap-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`h-2.5 w-full rounded-full transition-colors ${
                        isActive ? "" : "opacity-20"
                      }`}
                      style={{
                        backgroundColor: isActive ? "var(--store-primary)" : "currentColor",
                      }}
                    />
                    <span className={`text-[10px] mt-1.5 ${isCurrent ? "font-semibold" : "opacity-40"}`}>
                      {step.charAt(0) + step.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {order.trackingNumber && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid color-mix(in srgb, var(--store-text) 8%, transparent)" }}>
            <p className="text-sm">
              <span className="opacity-60">Tracking: </span>
              <span className="font-medium">{order.trackingNumber}</span>
            </p>
            {order.estimatedDelivery && (
              <p className="text-sm mt-1">
                <span className="opacity-60">Estimated delivery: </span>
                <span className="font-medium">
                  {new Date(order.estimatedDelivery).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2">
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
          >
            <div className="px-5 py-3" style={{ backgroundColor: "color-mix(in srgb, var(--store-text) 4%, transparent)" }}>
              <h2 className="text-sm font-semibold">Items ({order.items.length})</h2>
            </div>
            <div className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--store-text) 8%, transparent)" }}>
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  {item.imageUrl ? (
                    <div className="h-16 w-16 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-lg shrink-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <svg className="h-6 w-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25c0 .828.672 1.5 1.5 1.5z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs opacity-50 mt-0.5">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-medium text-sm shrink-0">
                    {formatMoney(item.priceCents * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div
              className="px-5 py-4 space-y-2"
              style={{ borderTop: "1px solid color-mix(in srgb, var(--store-text) 10%, transparent)" }}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-60">Subtotal</span>
                <span>{formatMoney(order.subtotalCents)}</span>
              </div>
              {order.shippingCents > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-60">Shipping</span>
                  <span>{formatMoney(order.shippingCents)}</span>
                </div>
              )}
              {order.taxCents > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-60">Tax</span>
                  <span>{formatMoney(order.taxCents)}</span>
                </div>
              )}
              <div
                className="flex items-center justify-between text-sm font-bold pt-2"
                style={{ borderTop: "1px solid color-mix(in srgb, var(--store-text) 8%, transparent)" }}
              >
                <span>Total</span>
                <span>{formatMoney(order.totalCents)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Shipping + Payment */}
        <div className="space-y-4">
          {/* Shipping Address */}
          <div
            className="rounded-lg border p-5"
            style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
          >
            <h3 className="text-sm font-semibold mb-3">Shipping Address</h3>
            {order.shippingAddress?.line1 ? (
              <div className="text-sm opacity-70 space-y-0.5">
                {order.shippingAddress.name && <p className="font-medium opacity-100">{order.shippingAddress.name}</p>}
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.zip]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {order.shippingAddress.country && <p>{order.shippingAddress.country}</p>}
              </div>
            ) : (
              <p className="text-sm opacity-40">No shipping address</p>
            )}
          </div>

          {/* Payment Info */}
          <div
            className="rounded-lg border p-5"
            style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
          >
            <h3 className="text-sm font-semibold mb-3">Payment</h3>
            <div className="text-sm opacity-70 space-y-1">
              {order.paymentMethod && (
                <p>
                  <span className="opacity-70">Method: </span>
                  <span className="capitalize">{order.paymentMethod.replace(/_/g, " ")}</span>
                </p>
              )}
              <p>
                <span className="opacity-70">Status: </span>
                <span className="capitalize">{order.paymentStatus}</span>
              </p>
            </div>
          </div>

          {/* Print button (mobile) */}
          <button
            onClick={() => window.print()}
            className="sm:hidden w-full flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)" }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
