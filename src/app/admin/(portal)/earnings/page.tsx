"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  ShoppingCart,
  Wallet,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Transaction {
  id: string;
  type: string;
  user: string;
  email: string;
  amount: number;
  status: string;
  date: string;
  plan: string;
}

interface EarningsStats {
  totalRevenue: number;
  revenueGrowth: number;
  mrr: number;
  activeSubscriptions: number;
  refunds: number;
  refundChange: number;
  refundCount: number;
}

interface RevenueSource {
  source: string;
  revenue: number;
  percentage: number;
}

const statusColors: Record<string, string> = {
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  refunded: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const typeColors: Record<string, string> = {
  subscription: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "one-time": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  refund: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function EarningsPage() {
  const [dateRange, setDateRange] = useState("30d");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<EarningsStats>({
    totalRevenue: 0,
    revenueGrowth: 0,
    mrr: 0,
    activeSubscriptions: 0,
    refunds: 0,
    refundChange: 0,
    refundCount: 0,
  });
  const [revenueBySource, setRevenueBySource] = useState<RevenueSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEarnings = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("range", dateRange);

      const response = await fetch(`/api/admin/earnings?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch earnings");
      }

      setTransactions(data.data.transactions);
      setStats(data.data.stats);
      setRevenueBySource(data.data.revenueBySource);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load earnings");
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (error && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-foreground mb-4">{error}</p>
          <Button onClick={fetchEarnings} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Earnings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Track revenue, subscriptions, and transactions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-card text-foreground"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Revenue Stats */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Revenue
                    </p>
                    <p className="text-3xl font-bold mt-1 text-foreground">
                      {formatCurrency(stats.totalRevenue)}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {stats.revenueGrowth >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm ${stats.revenueGrowth >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {stats.revenueGrowth >= 0 ? "+" : ""}{stats.revenueGrowth}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        vs last period
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      MRR
                    </p>
                    <p className="text-3xl font-bold mt-1 text-foreground">
                      {formatCurrency(stats.mrr)}
                    </p>
                    <p className="text-xs mt-2 text-muted-foreground">
                      Monthly Recurring Revenue
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Active Subscriptions
                    </p>
                    <p className="text-3xl font-bold mt-1 text-foreground">
                      {stats.activeSubscriptions}
                    </p>
                    <p className="text-xs mt-2 text-muted-foreground">
                      Paying customers
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Refunds
                    </p>
                    <p className="text-3xl font-bold mt-1 text-foreground">
                      {formatCurrency(stats.refunds)}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {stats.refundChange <= 0 ? (
                        <ArrowDownRight className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm ${stats.refundChange <= 0 ? "text-green-500" : "text-red-500"}`}>
                        {stats.refundChange}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({stats.refundCount} refunds)
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Breakdown */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-orange-500" />
                  Recent Transactions
                </CardTitle>
                <CardDescription>
                  Latest payments and subscriptions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No transactions found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Transaction
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Type
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Amount
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((txn) => (
                          <tr
                            key={txn.id}
                            className="border-b border-border hover:bg-muted/50"
                          >
                            <td className="py-3 px-4">
                              <div>
                                <p className="font-medium text-foreground">
                                  {txn.user}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {txn.plan}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={typeColors[txn.type] || typeColors.subscription}>
                                {txn.type}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`font-semibold ${txn.amount < 0 ? "text-red-400" : "text-foreground"}`}>
                                {txn.amount < 0 ? "-" : ""}${Math.abs(txn.amount).toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={statusColors[txn.status] || statusColors.completed}>
                                {txn.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {txn.date}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-orange-500" />
                  Revenue by Source
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {revenueBySource.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No revenue data</p>
                  </div>
                ) : (
                  revenueBySource.map((item) => (
                    <div key={item.source} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {item.source}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrency(item.revenue)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-orange-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-500" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Avg. Order Value", value: stats.totalRevenue > 0 && transactions.length > 0 ? formatCurrency(stats.totalRevenue / transactions.length) : "$0" },
                  { label: "Conversion Rate", value: "N/A" },
                  { label: "Churn Rate", value: "N/A" },
                  { label: "LTV", value: "N/A" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-4 rounded-lg text-center bg-muted"
                  >
                    <p className="text-2xl font-bold text-foreground">
                      {item.value}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
