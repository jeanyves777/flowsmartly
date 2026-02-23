"use client";

import { useState, useEffect, use } from "react";
import {
  Package,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  Phone,
  User,
  RefreshCw,
  AlertCircle,
  Banknote,
} from "lucide-react";

interface DeliveryInfo {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    customerName: string;
    totalCents: number;
    currency: string;
    estimatedDelivery: string | null;
    createdAt: string;
  };
  delivery: {
    id: string;
    status: string;
    driverName: string;
    driverPhone: string;
    currentLatitude: number | null;
    currentLongitude: number | null;
    lastLocationUpdate: string | null;
    estimatedDeliveryTime: string | null;
    codAmountCents: number | null;
    codCollected: boolean;
  } | null;
  statusTimeline: {
    status: string;
    label: string;
    completed: boolean;
    current: boolean;
  }[];
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  PENDING: Clock,
  CONFIRMED: CheckCircle2,
  PROCESSING: Package,
  SHIPPED: Truck,
  DELIVERED: CheckCircle2,
  CANCELLED: AlertCircle,
};

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = use(params);
  const [data, setData] = useState<DeliveryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    try {
      const res = await fetch(`/api/ecommerce/delivery/${orderId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error?.message || "Order not found.");
      }
    } catch {
      setError("Failed to load tracking info.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [orderId]);

  // Auto-refresh location every 10 seconds if delivery is active
  useEffect(() => {
    if (!data?.delivery || ["delivered", "failed"].includes(data.delivery.status)) return;

    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
  }, [data?.delivery?.status, orderId]);

  function formatCurrency(cents: number, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-pulse text-gray-500">Loading tracking information...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <p className="text-gray-500">{error || "Order not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Order Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Track Your Order
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Order {data.order.orderNumber}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Placed {formatDate(data.order.createdAt)}
        </p>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900 mb-8">
        <span className="text-sm text-gray-600 dark:text-gray-400">Order Total</span>
        <span className="text-lg font-bold">
          {formatCurrency(data.order.totalCents, data.order.currency)}
        </span>
      </div>

      {/* Status Timeline */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Order Status
        </h2>
        <div className="space-y-0">
          {data.statusTimeline.map((step, idx) => {
            const Icon = STATUS_ICONS[step.status] || Clock;
            const isLast = idx === data.statusTimeline.length - 1;
            return (
              <div key={step.status} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step.completed
                        ? "bg-green-100 text-green-600"
                        : step.current
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  {!isLast && (
                    <div
                      className={`w-0.5 h-8 ${
                        step.completed ? "bg-green-200" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
                <div className="pt-1">
                  <p
                    className={`text-sm font-medium ${
                      step.completed || step.current
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estimated Delivery */}
      {data.order.estimatedDelivery && (
        <div className="p-4 rounded-lg border mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Estimated Delivery
          </p>
          <p className="text-sm font-medium">
            {new Date(data.order.estimatedDelivery).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      )}

      {/* Delivery Assignment Info */}
      {data.delivery && (
        <div className="rounded-xl border overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Delivery Details
            </h2>
          </div>

          <div className="p-4 space-y-4">
            {/* Driver Info */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{data.delivery.driverName}</p>
                <p className="text-xs text-gray-500">Driver</p>
              </div>
            </div>

            {data.delivery.driverPhone && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-600">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{data.delivery.driverPhone}</p>
                  <p className="text-xs text-gray-500">Phone</p>
                </div>
              </div>
            )}

            {/* Location */}
            {data.delivery.currentLatitude != null && data.delivery.currentLongitude != null && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {data.delivery.currentLatitude.toFixed(4)}, {data.delivery.currentLongitude.toFixed(4)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last updated:{" "}
                    {data.delivery.lastLocationUpdate
                      ? formatDate(data.delivery.lastLocationUpdate)
                      : "N/A"}
                  </p>
                </div>
              </div>
            )}

            {/* COD Info */}
            {data.delivery.codAmountCents != null && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600">
                  <Banknote className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    COD: {formatCurrency(data.delivery.codAmountCents, data.order.currency)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {data.delivery.codCollected ? "Collected" : "Pending collection"}
                  </p>
                </div>
              </div>
            )}

            {/* Estimated Delivery Time */}
            {data.delivery.estimatedDeliveryTime && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {formatDate(data.delivery.estimatedDeliveryTime)}
                  </p>
                  <p className="text-xs text-gray-500">Estimated delivery time</p>
                </div>
              </div>
            )}
          </div>

          {/* Refresh indicator */}
          {!["delivered", "failed"].includes(data.delivery.status) && (
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Auto-refreshing every 10 seconds
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
