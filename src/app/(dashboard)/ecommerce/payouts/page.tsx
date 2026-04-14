"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DollarSign,
  Banknote,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  AlertCircle,
  Loader2,
  Wallet,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { formatPrice } from "@/lib/store/currency";

interface PayoutData {
  id: string;
  stripePayoutId: string;
  amountCents: number;
  netCents: number;
  currency: string;
  status: string;
  failureMessage: string | null;
  method: string | null;
  arrivalDate: string | null;
  description: string | null;
  createdAt: string;
}

interface PayoutsResponse {
  payouts: PayoutData[];
  balance: { available: number; pending: number };
  onboardingComplete: boolean;
  currency: string;
  platformFeePercent: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  paid: {
    label: "Paid",
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-100 dark:bg-green-900/30",
  },
  in_transit: {
    label: "In Transit",
    icon: ArrowUpRight,
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-yellow-600",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-100 dark:bg-red-900/30",
  },
  canceled: {
    label: "Canceled",
    icon: XCircle,
    color: "text-gray-600",
    bg: "bg-gray-100 dark:bg-gray-900/30",
  },
};

export default function PayoutsPage() {
  const [data, setData] = useState<PayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPayouts = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/ecommerce/payouts");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Failed to load payouts");
      }
    } catch {
      setError("Failed to load payouts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
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

  if (!data.onboardingComplete) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payouts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your payouts and account balance
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Banknote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Bank Account Not Set Up
          </h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Add your bank account to start receiving automatic payouts from
            customer purchases.
          </p>
          <Link
            href="/ecommerce/settings?tab=payments"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
          >
            Set Up Payouts
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const fmt = (cents: number) => formatPrice(cents, data.currency);
  const totalPaid = data.payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.netCents, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payouts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your payouts and account balance
          </p>
        </div>
        <button
          onClick={() => fetchPayouts(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Available Balance
            </p>
            <Wallet className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {fmt(data.balance.available)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ready for next payout
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pending Balance
            </p>
            <Clock className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {fmt(data.balance.pending)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Processing from recent sales
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Paid Out
            </p>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {fmt(totalPaid)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Lifetime payouts received
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Payouts Active
          </p>
          <p className="text-xs text-muted-foreground">
            Payouts are automatically sent to your bank account. Platform fee:{" "}
            {data.platformFeePercent}%
          </p>
        </div>
        <Link
          href="/ecommerce/earnings"
          className="text-sm font-medium text-brand-500 hover:text-brand-600 flex-shrink-0"
        >
          View Earnings
        </Link>
      </div>

      {/* Payout History */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Payout History
          </h2>
        </div>
        {data.payouts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    Method
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    Arrival
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((payout) => {
                  const config = STATUS_CONFIG[payout.status] || STATUS_CONFIG.pending;
                  const StatusIcon = config.icon;
                  return (
                    <tr
                      key={payout.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-5 py-3 font-medium text-foreground">
                        {new Date(payout.createdAt).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                        {payout.failureMessage && (
                          <p className="text-xs text-red-500 mt-0.5">
                            {payout.failureMessage}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-foreground">
                        {fmt(payout.netCents)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground capitalize">
                        {payout.method || "Standard"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {payout.arrivalDate
                          ? new Date(payout.arrivalDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                        {payout.description || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No payouts yet. Payouts will appear here once customers make
              purchases.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
