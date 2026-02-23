"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  ShoppingCart,
  DollarSign,
  Clock,
  Plus,
  ExternalLink,
  Settings,
  AlertCircle,
  TrendingUp,
  Rocket,
  ArrowRight,
} from "lucide-react";
import { ORDER_STATUSES } from "@/lib/constants/ecommerce";

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

export default function EcommerceDashboardPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [storeRes, ordersRes] = await Promise.all([
          fetch("/api/ecommerce/store"),
          fetch("/api/ecommerce/orders?limit=10"),
        ]);

        const storeData = await storeRes.json();
        const ordersData = await ordersRes.json();

        if (storeData.success && storeData.data?.store) {
          setStore(storeData.data.store);
        } else {
          setError("No store found. Please set up your store first.");
        }

        if (ordersData.success && ordersData.data) {
          setOrders(ordersData.data.orders || []);
          setPendingCount(ordersData.data.stats?.pendingCount || 0);
        }
      } catch {
        setError("Failed to load store data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function formatCurrency(cents: number, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  }

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
      value: formatCurrency(store.totalRevenueCents, store.currency),
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
            href="/ecommerce/settings"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border hover:bg-accent transition-colors"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

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
                        {formatCurrency(order.totalCents, order.currency)}
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
