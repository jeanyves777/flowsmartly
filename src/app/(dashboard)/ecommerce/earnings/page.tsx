"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
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
import { formatPrice } from "@/lib/store/currency";

interface EarningsData {
  store: {
    currency: string;
    platformFeePercent: number;
    stripeConnectAccountId: string | null;
    stripeOnboardingComplete: boolean;
  };
  lifetime: {
    revenueCents: number;
    platformFeesCents: number;
    netCents: number;
    orderCount: number;
  };
  last12Months: {
    revenueCents: number;
    platformFeesCents: number;
    netCents: number;
    orderCount: number;
  };
  monthly: Array<{
    month: string;
    revenue: number;
    orders: number;
    net: number;
    fees: number;
  }>;
  byMethod: Array<{
    method: string;
    revenue: number;
    count: number;
  }>;
}

const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  cod: "Cash on Delivery",
  mobile_money: "Mobile Money",
  bank_transfer: "Bank Transfer",
  unknown: "Unknown",
};

const METHOD_ICONS: Record<string, React.ElementType> = {
  card: CreditCard,
  cod: Banknote,
  mobile_money: Smartphone,
  bank_transfer: Building2,
};

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchEarnings() {
      try {
        const res = await fetch("/api/ecommerce/earnings");
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error?.message || "Failed to load earnings");
        }
      } catch {
        setError("Failed to load earnings");
      } finally {
        setLoading(false);
      }
    }
    fetchEarnings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">{error || "No data available"}</p>
      </div>
    );
  }

  const fmt = (cents: number) => formatPrice(cents, data.store.currency);

  const monthlyChartData = data.monthly.map((m) => ({
    name: new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    revenue: m.revenue / 100,
    net: m.net / 100,
    fees: m.fees / 100,
    orders: m.orders,
  }));

  const pieData = data.byMethod.map((m) => ({
    name: METHOD_LABELS[m.method] || m.method,
    value: m.revenue,
    count: m.count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Store Earnings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revenue breakdown, platform fees, and payout information
        </p>
      </div>

      {/* Stripe Connect Status */}
      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
        {data.store.stripeOnboardingComplete ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Stripe Connect Active</p>
              <p className="text-xs text-muted-foreground">
                Payments are routed to your Stripe account. Platform fee: {data.store.platformFeePercent}%
              </p>
            </div>
          </>
        ) : (
          <>
            <XCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Stripe Connect Not Set Up</p>
              <p className="text-xs text-muted-foreground">
                Complete Stripe onboarding in Store Settings to receive direct payouts.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={fmt(data.lifetime.revenueCents)}
          subtitle={`${data.lifetime.orderCount} orders (lifetime)`}
          icon={DollarSign}
          color="text-green-500"
        />
        <StatCard
          title="Net Earnings"
          value={fmt(data.lifetime.netCents)}
          subtitle="After platform fees"
          icon={TrendingUp}
          color="text-blue-500"
        />
        <StatCard
          title="Last 12 Months Revenue"
          value={fmt(data.last12Months.revenueCents)}
          subtitle={`${data.last12Months.orderCount} orders`}
          icon={DollarSign}
          color="text-indigo-500"
        />
        <StatCard
          title="Platform Fees Paid"
          value={fmt(data.lifetime.platformFeesCents)}
          subtitle={`${data.store.platformFeePercent}% per order`}
          icon={CreditCard}
          color="text-orange-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Monthly Revenue</h2>
          {monthlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value) => `$${Number(value).toFixed(2)}`}
                />
                <Bar dataKey="revenue" fill="#6366f1" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" fill="#22c55e" name="Net Earnings" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fees" fill="#f59e0b" name="Platform Fees" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              No revenue data yet
            </div>
          )}
        </div>

        {/* Payment Methods Pie */}
        <div className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">By Payment Method</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span className="text-xs">{String(value)}</span>}
                />
                <Tooltip
                  formatter={(value) => fmt(Number(value))}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              No orders yet
            </div>
          )}
        </div>
      </div>

      {/* Per-Method Breakdown Table */}
      {data.byMethod.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Payment Method Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Method</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Orders</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Revenue</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Avg. Order</th>
                </tr>
              </thead>
              <tbody>
                {data.byMethod.map((m) => {
                  const Icon = METHOD_ICONS[m.method] || CreditCard;
                  return (
                    <tr key={m.method} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        {METHOD_LABELS[m.method] || m.method}
                      </td>
                      <td className="px-5 py-3 text-right">{m.count}</td>
                      <td className="px-5 py-3 text-right font-medium">{fmt(m.revenue)}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {m.count > 0 ? fmt(Math.round(m.revenue / m.count)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Breakdown Table */}
      {data.monthly.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Monthly Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Month</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Orders</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Revenue</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Fees</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Net</th>
                </tr>
              </thead>
              <tbody>
                {[...data.monthly].reverse().map((m) => (
                  <tr key={m.month} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-medium">
                      {new Date(m.month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3 text-right">{m.orders}</td>
                    <td className="px-5 py-3 text-right">{fmt(m.revenue)}</td>
                    <td className="px-5 py-3 text-right text-orange-500">-{fmt(m.fees)}</td>
                    <td className="px-5 py-3 text-right font-medium text-green-600">{fmt(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
