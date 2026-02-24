"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  DollarSign,
  Clock,
  CheckCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { ORDER_STATUSES } from "@/lib/constants/ecommerce";
import { PageLoader } from "@/components/shared/page-loader";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ name: string; quantity: number; priceCents: number }>;
  totalCents: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paymentStatus: string;
  createdAt: string;
  deliveryAssignment: {
    driver: { id: string; name: string } | null;
    status: string;
  } | null;
}

interface Stats {
  totalOrders: number;
  totalRevenueCents: number;
  pendingCount: number;
  deliveredCount: number;
}

const PAYMENT_STATUS_OPTIONS = ["pending", "paid", "failed", "refunded"];
const PAYMENT_METHOD_OPTIONS = ["card", "mobile_money", "cod", "bank_transfer"];

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function StatusBadge({ status, type = "order" }: { status: string; type?: "order" | "payment" }) {
  if (type === "order") {
    const config = ORDER_STATUSES[status];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.color || "bg-gray-100 text-gray-800"}`}>
        {config?.label || status}
      </span>
    );
  }

  // Payment status
  const paymentColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    refunded: "bg-gray-100 text-gray-800",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentColors[status] || "bg-gray-100 text-gray-800"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    totalRevenueCents: 0,
    pendingCount: 0,
    deliveredCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (statusFilter) params.set("status", statusFilter);
      if (paymentStatusFilter) params.set("paymentStatus", paymentStatusFilter);
      if (paymentMethodFilter) params.set("paymentMethod", paymentMethodFilter);
      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/ecommerce/orders?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setOrders(json.data.orders);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
        setStats(json.data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, paymentStatusFilter, paymentMethodFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, paymentStatusFilter, paymentMethodFilter, search, dateFrom, dateTo]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="mt-1 text-sm text-gray-500">Manage and track your store orders</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCents(stats.totalRevenueCents)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Delivered</p>
              <p className="text-2xl font-bold text-gray-900">{stats.deliveredCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search order #, customer name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {Object.entries(ORDER_STATUSES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Payment</option>
            {PAYMENT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Methods</option>
            {PAYMENT_METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>{m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="To"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <PageLoader tips={["Loading orders..."]} />
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No orders found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {search || statusFilter || paymentStatusFilter || paymentMethodFilter || dateFrom || dateTo
                ? "Try adjusting your filters"
                : "Orders will appear here when customers make purchases"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/ecommerce/orders/${order.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.customerName}</div>
                        <div className="text-xs text-gray-500">{order.customerEmail}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {order.items.length} {order.items.length === 1 ? "item" : "items"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCents(order.totalCents, order.currency)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={order.status} type="order" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={order.paymentStatus} type="payment" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/ecommerce/orders/${order.id}`}
                          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
