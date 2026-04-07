"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Store,
  Package,
  ShoppingCart,
  DollarSign,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface StoreItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  setupComplete: boolean;
  ecomPlan: string;
  ecomSubscriptionStatus: string;
  stripeOnboardingComplete: boolean;
  productCount: number;
  orderCount: number;
  totalRevenueCents: number;
  platformFeesCollectedCents: number;
  customDomain: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface OrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  totalCents: number;
  currency: string;
  itemCount: number;
  store: { id: string; name: string; slug: string };
  createdAt: string;
}

interface Stats {
  totalStores: number;
  activeStores: number;
  totalOrders: number;
  totalRevenueCents: number;
  platformFeesCents: number;
  totalProducts: number;
}

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function AdminEcommercePage() {
  const [tab, setTab] = useState<"stores" | "orders">("stores");
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: currentPage.toString(), limit: "20", tab });
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/admin/ecommerce?${params}`);
      const data = await res.json();
      if (data.success) {
        if (tab === "stores") {
          setStores(data.data.stores);
          setStats(data.data.stats);
        } else {
          setOrders(data.data.orders);
        }
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch ecommerce data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, currentPage, tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getOrderStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500/10 text-yellow-500",
      confirmed: "bg-blue-500/10 text-blue-500",
      shipped: "bg-purple-500/10 text-purple-500",
      delivered: "bg-green-500/10 text-green-500",
      cancelled: "bg-red-500/10 text-red-500",
    };
    return <Badge className={colors[status] || ""}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" />
            E-Commerce Management
          </h1>
          <p className="text-muted-foreground mt-1">Overview of all stores, products, and orders</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}>
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Stores</p><p className="text-2xl font-bold">{stats.totalStores}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-500">{stats.activeStores}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Products</p><p className="text-2xl font-bold text-blue-500">{stats.totalProducts}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Orders</p><p className="text-2xl font-bold text-purple-500">{stats.totalOrders}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Revenue</p><p className="text-2xl font-bold text-green-500">{formatCents(stats.totalRevenueCents)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Platform Fees</p><p className="text-2xl font-bold text-orange-500">{formatCents(stats.platformFeesCents)}</p></CardContent></Card>
        </div>
      )}

      {/* Tab Selector */}
      <div className="flex gap-2">
        <Button variant={tab === "stores" ? "default" : "outline"} size="sm" onClick={() => { setTab("stores"); setCurrentPage(1); }}>
          <Store className="w-4 h-4 mr-2" />Stores
        </Button>
        <Button variant={tab === "orders" ? "default" : "outline"} size="sm" onClick={() => { setTab("orders"); setCurrentPage(1); }}>
          <ShoppingCart className="w-4 h-4 mr-2" />Orders
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={tab === "stores" ? "Search stores..." : "Search orders..."} className="pl-10" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : tab === "stores" ? (
            stores.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground"><Store className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No stores found</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Store</th>
                      <th className="text-left p-3 font-medium">Owner</th>
                      <th className="text-left p-3 font-medium">Plan</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Products</th>
                      <th className="text-left p-3 font-medium">Orders</th>
                      <th className="text-left p-3 font-medium">Revenue</th>
                      <th className="text-left p-3 font-medium">Created</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((store) => (
                      <tr key={store.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <p className="font-medium">{store.name}</p>
                          <p className="text-xs text-muted-foreground">/{store.slug}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-xs font-medium">{store.user.name}</p>
                          <p className="text-xs text-muted-foreground">{store.user.email}</p>
                        </td>
                        <td className="p-3"><Badge variant="outline">{store.ecomPlan}</Badge></td>
                        <td className="p-3">
                          {store.isActive ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
                          ) : (
                            <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>
                          )}
                        </td>
                        <td className="p-3"><span className="flex items-center gap-1"><Package className="w-3 h-3" />{store.productCount}</span></td>
                        <td className="p-3"><span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />{store.orderCount}</span></td>
                        <td className="p-3 font-medium">{formatCents(store.totalRevenueCents)}</td>
                        <td className="p-3 text-xs text-muted-foreground">{new Date(store.createdAt).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`/ecommerce`, "_blank")}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            orders.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground"><ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No orders found</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Order #</th>
                      <th className="text-left p-3 font-medium">Customer</th>
                      <th className="text-left p-3 font-medium">Store</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Items</th>
                      <th className="text-left p-3 font-medium">Total</th>
                      <th className="text-left p-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono font-medium">{order.orderNumber}</td>
                        <td className="p-3">
                          <p className="text-xs font-medium">{order.customerName}</p>
                          <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                        </td>
                        <td className="p-3"><p className="text-xs">{order.store.name}</p></td>
                        <td className="p-3">{getOrderStatusBadge(order.status)}</td>
                        <td className="p-3">{order.itemCount}</td>
                        <td className="p-3 font-medium">{formatCents(order.totalCents, order.currency)}</td>
                        <td className="p-3 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
