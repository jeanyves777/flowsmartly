"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface RevenuePoint {
  date: string;
  revenueCents: number;
  orderCount: number;
}

interface TopProduct {
  id: string;
  name: string;
  orderCount: number;
  revenueCents: number;
  viewCount: number;
}

interface Summary {
  totalRevenueCents: number;
  totalOrders: number;
  averageOrderValueCents: number;
  conversionRate: number;
  repeatCustomerPercent: number;
  revenueChange: number;
  orderChange: number;
}

interface StatusGroup {
  status: string;
  _count: { id: number };
}

interface PaymentGroup {
  paymentMethod: string;
  _count: { id: number };
}

interface AnalyticsData {
  revenueTimeline: RevenuePoint[];
  topProducts: TopProduct[];
  summary: Summary;
  ordersByStatus: StatusGroup[];
  ordersByPayment: PaymentGroup[];
  currency: string;
}

const RANGES = ["7d", "30d", "90d", "1y"] as const;
type Range = (typeof RANGES)[number];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#eab308",
  CONFIRMED: "#3b82f6",
  PROCESSING: "#6366f1",
  SHIPPED: "#a855f7",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
  REFUNDED: "#6b7280",
};

function formatCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChangeBadge({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
        <ArrowUpRight className="h-3 w-3" />
        {value.toFixed(1)}%
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
        <ArrowDownRight className="h-3 w-3" />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
      0%
    </span>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-md text-sm">
      <p className="font-medium mb-1">{formatDateLabel(label)}</p>
      <p className="text-blue-600">
        Revenue: {formatCurrency(payload[0]?.value * 100 || 0)}
      </p>
      <p className="text-purple-600">
        Orders: {payload[1]?.value ?? 0}
      </p>
    </div>
  );
}

export default function EcommerceAnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (r: Range) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ecommerce/analytics?range=${r}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error || "Failed to load analytics.");
      }
    } catch {
      setError("Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data || (data.summary.totalOrders === 0 && data.revenueTimeline.length === 0)) {
    return (
      <div className="space-y-6">
        <Header range={range} onRangeChange={setRange} />
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 rounded-xl border bg-card p-8">
          <BarChart3 className="h-12 w-12 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">
            No orders yet. Analytics will appear once you start receiving orders.
          </p>
        </div>
      </div>
    );
  }

  const { summary, revenueTimeline, topProducts, ordersByStatus, ordersByPayment, currency } = data;

  const chartData = revenueTimeline.map((pt) => ({
    date: pt.date,
    revenue: pt.revenueCents / 100,
    orders: pt.orderCount,
  }));

  const pieData = ordersByStatus.map((s) => ({
    name: s.status,
    value: s._count.id,
  }));

  const totalPaymentOrders = ordersByPayment.reduce((sum, p) => sum + p._count.id, 0);

  const stats = [
    {
      label: "Total Revenue",
      value: formatCurrency(summary.totalRevenueCents, currency),
      icon: DollarSign,
      color: "text-green-600 bg-green-100",
      change: summary.revenueChange,
    },
    {
      label: "Orders",
      value: summary.totalOrders.toString(),
      icon: ShoppingCart,
      color: "text-indigo-600 bg-indigo-100",
      change: summary.orderChange,
    },
    {
      label: "Avg Order Value",
      value: formatCurrency(summary.averageOrderValueCents, currency),
      icon: TrendingUp,
      color: "text-blue-600 bg-blue-100",
      change: null,
    },
    {
      label: "Conversion Rate",
      value: `${summary.conversionRate.toFixed(1)}%`,
      icon: Target,
      color: "text-purple-600 bg-purple-100",
      change: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header range={range} onRangeChange={setRange} />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-2xl font-bold">{stat.value}</p>
              {stat.change !== null && <ChangeBadge value={stat.change} />}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Revenue Over Time</h2>
        </div>
        <div className="h-[300px] sm:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="revenue"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name="Revenue"
              />
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 4 }}
                name="Orders"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 bg-blue-500 rounded" />
            Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 bg-purple-500 rounded border-dashed" style={{ borderTop: "2px dashed #8b5cf6", height: 0 }} />
            Orders
          </span>
        </div>
      </div>

      {/* Two-column: Top Products + Order Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 p-5 border-b">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Top Products</h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No product data available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Orders</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Revenue</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.slice(0, 10).map((product) => (
                    <tr key={product.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-medium max-w-[200px] truncate">
                        {product.name}
                      </td>
                      <td className="p-3 text-right tabular-nums">{product.orderCount}</td>
                      <td className="p-3 text-right tabular-nums">
                        {formatCurrency(product.revenueCents, currency)}
                      </td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">
                        {product.viewCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Order Status Pie Chart */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Orders by Status</h2>
          </div>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
              No order data available.
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_COLORS[entry.name] || "#9ca3af"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [String(value), ""]}
                    contentStyle={{
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs capitalize">{value.toLowerCase()}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Payment Methods Distribution */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Payment Methods</h2>
        </div>
        {ordersByPayment.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-6">
            No payment data available.
          </div>
        ) : (
          <div className="space-y-3">
            {ordersByPayment.map((pm) => {
              const count = pm._count.id;
              const pct = totalPaymentOrders > 0 ? (count / totalPaymentOrders) * 100 : 0;
              return (
                <div key={pm.paymentMethod}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium capitalize">
                      {pm.paymentMethod.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {count} order{count !== 1 ? "s" : ""} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({
  range,
  onRangeChange,
}: {
  range: Range;
  onRangeChange: (r: Range) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="flex items-center gap-1 rounded-lg border p-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              range === r
                ? "bg-blue-600 text-white"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
