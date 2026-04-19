"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Package, ShoppingCart, DollarSign, Clock, Plus, ExternalLink, Settings, AlertCircle, TrendingUp, Rocket, ArrowRight, Palette, Flag, Check, AlertTriangle, Star, RotateCcw, ShieldAlert } from "lucide-react";
import { ORDER_STATUSES } from "@/lib/constants/ecommerce";
import { formatPrice } from "@/lib/store/currency";
import { StoreUpgradeBanner } from "@/components/ecommerce/store-upgrade-banner";
import { AISpinner } from "@/components/shared/ai-generation-loader";

interface Store {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  setupComplete: boolean;
  productCount: number;
  orderCount: number;
  totalRevenueCents: number;
  currency: string;
  region: string | null;
  generatorVersion: string;
  buildStatus: string;
  lastBuildError: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  currency: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

interface StoreAlerts {
  lowStock: { count: number; outOfStock: number; products: { name: string; quantity: number }[] };
  newOrders: number;
  unfulfilled: number;
  returnRequests: number;
  compliance: { status: string; warningCount: number; lastReason: string | null; suspendedReason: string | null };
  feedback: { averageRating: number | null; totalReviews: number };
}

export default function EcommerceDashboardPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [alerts, setAlerts] = useState<StoreAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [storeRes, ordersRes, alertsRes] = await Promise.all([
          fetch("/api/ecommerce/store"),
          fetch("/api/ecommerce/orders?limit=10"),
          fetch("/api/ecommerce/store-alerts"),
        ]);

        const storeData = await storeRes.json();
        const ordersData = await ordersRes.json();
        const alertsData = await alertsRes.json();

        if (storeData.success && storeData.data?.store) {
          setStore(storeData.data.store);
        } else {
          setError("No store found. Please set up your store first.");
        }

        if (ordersData.success && ordersData.data) {
          setOrders(ordersData.data.orders || []);
          setPendingCount(ordersData.data.stats?.pendingCount || 0);
        }

        if (alertsData.success && alertsData.data) {
          setAlerts(alertsData.data);
        }
      } catch {
        setError("Failed to load store data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading store dashboard...</div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error || "Store not found."}</p>
        <Link
          href="/ecommerce/settings"
          className="text-brand-500 hover:underline text-sm font-medium"
        >
          Go to Store Settings
        </Link>
      </div>
    );
  }

  const stats = [
    {
      label: "Products",
      value: store.productCount.toString(),
      icon: Package,
      color: "text-blue-600 bg-blue-100",
    },
    {
      label: "Orders",
      value: store.orderCount.toString(),
      icon: ShoppingCart,
      color: "text-indigo-600 bg-indigo-100",
    },
    {
      label: "Revenue",
      value: formatPrice(store.totalRevenueCents, store.currency),
      icon: DollarSign,
      color: "text-green-600 bg-green-100",
    },
    {
      label: "Pending Orders",
      value: pendingCount.toString(),
      icon: Clock,
      color: "text-yellow-600 bg-yellow-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Store Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <div
              className={`h-2.5 w-2.5 rounded-full ${store.isActive ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm text-muted-foreground">
              {store.isActive ? "Active" : "Inactive"} — {store.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/ecommerce/design"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors"
          >
            <Palette className="h-4 w-4" />
            Edit Store
          </Link>
          <Link
            href="/ecommerce/settings"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border hover:bg-accent transition-colors"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      {/* Build Error Banner */}
      {store.buildStatus === "error" && (
        <div className="rounded-xl border-2 border-red-300 dark:border-red-700 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1">Store Build Failed</h3>
              <p className="text-sm text-red-700 dark:text-red-400 mb-1">
                Your store encountered an error during the last build. You can view the error details, try rebuilding, or report the issue to our team.
              </p>
              {store.lastBuildError && (
                <pre className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-lg p-2 overflow-auto max-h-20 mb-3">
                  {store.lastBuildError.substring(0, 200)}{store.lastBuildError.length > 200 ? "..." : ""}
                </pre>
              )}
              <div className="flex items-center gap-2">
                <Link
                  href="/ecommerce/design"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Open Editor
                </Link>
                <BuildErrorReportButton storeId={store.id} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Build In Progress Banner */}
      {store.buildStatus === "building" && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
          <div className="flex items-center gap-3">
            <AISpinner className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-300 text-sm">Your store is being built...</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">This usually takes 30-60 seconds.</p>
            </div>
          </div>
        </div>
      )}

      {/* V2 Upgrade Banner */}
      <StoreUpgradeBanner
        storeId={store.id}
        storeName={store.name}
        generatorVersion={store.generatorVersion}
        buildStatus={store.buildStatus}
      />

      {/* Onboarding Incomplete Banner */}
      {!store.setupComplete && (
        <div className="rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
              <Rocket className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                Complete your store setup
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                Finish setting up your store to start selling — configure your region, payments, brand, and domain.
              </p>
            </div>
            <Link
              href="/ecommerce/onboarding"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors flex-shrink-0"
            >
              Continue Setup
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Store Health Alerts */}
      {alerts && (
        <div className="space-y-3">
          {/* Compliance: Suspended */}
          {alerts.compliance.status === "suspended" && (
            <div className="rounded-xl border-2 border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/30 p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-300">Store Suspended</h3>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    Your store has been suspended: <strong>{alerts.compliance.suspendedReason}</strong>. Please resolve the issue and contact support.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Compliance: Warning */}
          {alerts.compliance.status === "warning" && (
            <div className="rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-orange-800 dark:text-orange-300">
                    Compliance Warning ({alerts.compliance.warningCount}/2)
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                    {alerts.compliance.lastReason}. Please resolve this to avoid suspension.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Low Stock / Out of Stock */}
          {alerts.lowStock.count > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {alerts.lowStock.outOfStock > 0
                      ? `${alerts.lowStock.outOfStock} product${alerts.lowStock.outOfStock > 1 ? "s" : ""} out of stock`
                      : `${alerts.lowStock.count} product${alerts.lowStock.count > 1 ? "s" : ""} low on stock`}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {alerts.lowStock.products.map((p) => `${p.name} (${p.quantity})`).join(", ")}
                  </p>
                </div>
                <Link href="/ecommerce/products" className="text-xs text-amber-700 hover:underline font-medium flex-shrink-0">
                  View
                </Link>
              </div>
            </div>
          )}

          {/* Unfulfilled Orders */}
          {alerts.unfulfilled > 0 && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300 flex-1">
                  {alerts.unfulfilled} unfulfilled order{alerts.unfulfilled > 1 ? "s" : ""} waiting to be processed
                </p>
                <Link href="/ecommerce/orders" className="text-xs text-blue-700 hover:underline font-medium flex-shrink-0">
                  View Orders
                </Link>
              </div>
            </div>
          )}

          {/* Return Requests */}
          {alerts.returnRequests > 0 && (
            <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 p-4">
              <div className="flex items-center gap-3">
                <RotateCcw className="w-5 h-5 text-orange-600 flex-shrink-0" />
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300 flex-1">
                  {alerts.returnRequests} return request{alerts.returnRequests > 1 ? "s" : ""} pending review
                </p>
                <Link href="/ecommerce/orders" className="text-xs text-orange-700 hover:underline font-medium flex-shrink-0">
                  View
                </Link>
              </div>
            </div>
          )}

          {/* New Orders */}
          {alerts.newOrders > 0 && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm font-medium text-green-800 dark:text-green-300 flex-1">
                  {alerts.newOrders} new order{alerts.newOrders > 1 ? "s" : ""} in the last 24 hours
                </p>
                <Link href="/ecommerce/orders" className="text-xs text-green-700 hover:underline font-medium flex-shrink-0">
                  View
                </Link>
              </div>
            </div>
          )}

          {/* Store Rating */}
          {alerts.feedback.totalReviews > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <p className="text-sm text-foreground flex-1">
                  Store Rating: <strong>{alerts.feedback.averageRating}/5</strong>
                  <span className="text-muted-foreground ml-1">({alerts.feedback.totalReviews} review{alerts.feedback.totalReviews > 1 ? "s" : ""})</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/ecommerce/products?action=new"
          className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="p-2 rounded-lg bg-brand-500/10 text-brand-500">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-sm">Add Product</p>
            <p className="text-xs text-muted-foreground">Create a new listing</p>
          </div>
        </Link>
        <a
          href={`/store/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
            <ExternalLink className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-sm">View Store</p>
            <p className="text-xs text-muted-foreground">See your public storefront</p>
          </div>
        </a>
        <Link
          href="/ecommerce/settings"
          className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-sm">Store Settings</p>
            <p className="text-xs text-muted-foreground">Customize your store</p>
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Recent Orders</h2>
          </div>
          <Link
            href="/ecommerce/orders"
            className="text-sm text-brand-500 hover:underline font-medium"
          >
            View all
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No orders yet. Share your store link to start selling!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Order</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const statusConfig = ORDER_STATUSES[order.status] || {
                    label: order.status,
                    color: "bg-gray-100 text-gray-800",
                  };
                  return (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs">{order.orderNumber}</td>
                      <td className="p-3">
                        <p className="font-medium">{order.customerName}</p>
                      </td>
                      <td className="p-3 font-medium">
                        {formatPrice(order.totalCents, order.currency)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BuildErrorReportButton({ storeId }: { storeId: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const report = async () => {
    setSending(true);
    try {
      await fetch(`/api/ecommerce/store/${storeId}/report-error`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setSent(true);
    } catch {}
    setSending(false);
  };

  if (sent) {
    return (
      <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
        <Check className="w-4 h-4" /> Reported
      </span>
    );
  }

  return (
    <button
      onClick={report}
      disabled={sending}
      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
    >
      {sending ? <AISpinner className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
      Report to Admin
    </button>
  );
}
