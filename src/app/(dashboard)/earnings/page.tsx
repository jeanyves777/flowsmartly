"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  Building2,
  Info,
  ChevronRight,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type TimeRange = "7d" | "30d" | "90d" | "year";

interface Stats {
  currentBalance: number;
  periodEarnings: number;
  allTimeEarnings: number;
  pendingPayouts: number;
  completedPayouts: number;
  transactionCount: number;
}

interface Earning {
  id: string;
  amount: number;
  source: string;
  sourceId: string | null;
  createdAt: string;
}

interface Payout {
  id: string;
  amount: number;
  method: string;
  status: string;
  requestedAt: string;
  processedAt: string | null;
}

interface SourceBreakdown {
  source: string;
  amount: number;
  count: number;
}

interface ChartData {
  date: string;
  amount: number;
}

export default function EarningsPage() {
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [recentPayouts, setRecentPayouts] = useState<Payout[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<SourceBreakdown[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<"PAYPAL" | "BANK" | "STRIPE">("PAYPAL");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);

  const fetchEarnings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/earnings?range=${timeRange}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch earnings");
      }

      setStats(data.data.stats);
      setEarnings(data.data.earnings || []);
      setRecentPayouts(data.data.recentPayouts || []);
      setSourceBreakdown(data.data.sourceBreakdown || []);
      setChartData(data.data.chartData || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load earnings");
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const handleOpenPayoutModal = () => {
    if (!stats || stats.currentBalance < 10) {
      toast({ title: "Minimum payout amount is $10", variant: "destructive" });
      return;
    }
    setShowPayoutModal(true);
  };

  const handleRequestPayout = async () => {
    if (!stats || stats.currentBalance < 10) {
      toast({ title: "Minimum payout amount is $10", variant: "destructive" });
      return;
    }

    if (payoutMethod === "PAYPAL" && !payoutEmail) {
      toast({ title: "Please enter your PayPal email", variant: "destructive" });
      return;
    }

    setIsRequestingPayout(true);
    try {
      const response = await fetch("/api/earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: stats.currentBalance,
          method: payoutMethod,
          accountInfo: payoutMethod === "PAYPAL" ? { email: payoutEmail } : {},
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to request payout");
      }

      toast({ title: "Payout requested successfully!" });
      setShowPayoutModal(false);
      setPayoutEmail("");
      fetchEarnings();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to request payout",
        variant: "destructive",
      });
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  const getSourceIcon = (source: string) => {
    switch (source.toUpperCase()) {
      case "VIEW":
      case "VIEWS":
        return "👁️";
      case "AD_VIEW":
        return "📺";
      case "AD":
      case "ADS":
        return "🎯";
      case "REFERRAL":
        return "👥";
      case "PLATFORM_FEE":
        return "🏦";
      case "BONUS":
        return "🎁";
      default:
        return "💰";
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source.toUpperCase()) {
      case "VIEW":
      case "VIEWS":
        return "Post Views";
      case "AD_VIEW":
        return "Ad Views";
      case "AD":
      case "ADS":
        return "Ads";
      case "REFERRAL":
        return "Referrals";
      case "PLATFORM_FEE":
        return "Platform Fee";
      case "BONUS":
        return "Bonus";
      default:
        return source;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchEarnings} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            Earnings
          </h1>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border p-1">
            {[
              { id: "7d", label: "7D" },
              { id: "30d", label: "30D" },
              { id: "90d", label: "90D" },
              { id: "year", label: "Year" },
            ].map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id as TimeRange)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  timeRange === range.id
                    ? "bg-brand-500 text-white"
                    : "hover:bg-muted"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-10 w-10 rounded-lg mb-3" />
                <Skeleton className="h-8 w-24 mb-1" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-3xl font-bold">{formatCurrency(stats.currentBalance)}</p>
                <p className="text-sm text-white/80">Available Balance</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-4 w-full"
                onClick={handleOpenPayoutModal}
                disabled={stats.currentBalance < 10}
              >
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Request Payout
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{formatCurrency(stats.periodEarnings)}</p>
                <p className="text-sm text-muted-foreground">This Period</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-500" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{formatCurrency(stats.allTimeEarnings)}</p>
                <p className="text-sm text-muted-foreground">All Time</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{formatCurrency(stats.pendingPayouts)}</p>
                <p className="text-sm text-muted-foreground">Pending Payouts</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart & Breakdown */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-500" />
              Earnings Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No earnings data for this period</p>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-end justify-around gap-2">
                {chartData.map((data, index) => {
                  const maxAmount = Math.max(...chartData.map(d => d.amount), 1);
                  const heightPercent = (data.amount / maxAmount) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs text-muted-foreground">${data.amount.toFixed(2)}</span>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPercent}%` }}
                        transition={{ delay: index * 0.05 }}
                        className="w-full bg-green-500/80 rounded-t-md min-h-[4px]"
                      />
                      <span className="text-xs text-muted-foreground">{data.date}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-brand-500" />
              Earnings Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : sourceBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No earnings yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sourceBreakdown.map((source, index) => {
                  const total = sourceBreakdown.reduce((sum, s) => sum + s.amount, 0);
                  const percentage = total > 0 ? (source.amount / total) * 100 : 0;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{getSourceIcon(source.source)}</span>
                          <span className="font-medium">{getSourceLabel(source.source)}</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(source.amount)}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions & Payouts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Earnings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-brand-500" />
              Recent Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : earnings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No earnings yet</p>
                <p className="text-sm mt-1">Start creating content to earn!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {earnings.slice(0, 5).map((earning) => (
                  <div
                    key={earning.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getSourceIcon(earning.source)}</span>
                      <div>
                        <p className="font-medium">{getSourceLabel(earning.source)}</p>
                        <p className="text-sm text-muted-foreground">{formatTimeAgo(earning.createdAt)}</p>
                      </div>
                    </div>
                    <span className="font-semibold text-green-500">+{formatCurrency(earning.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payouts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-500" />
              Recent Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentPayouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No payouts yet</p>
                <p className="text-sm mt-1">Request a payout when you reach $10</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentPayouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-brand-500" />
                      </div>
                      <div>
                        <p className="font-medium">{payout.method}</p>
                        <p className="text-sm text-muted-foreground">{formatTimeAgo(payout.requestedAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{formatCurrency(payout.amount)}</span>
                      <div className="mt-1">{getStatusBadge(payout.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payout Request Modal */}
      <Dialog open={showPayoutModal} onOpenChange={setShowPayoutModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Choose your payout method and confirm the withdrawal amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Amount Display */}
            <div className="text-center p-4 rounded-lg bg-green-500/10">
              <p className="text-sm text-muted-foreground mb-1">Payout Amount</p>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(stats?.currentBalance || 0)}
              </p>
            </div>

            {/* Payout Method Selection */}
            <div className="space-y-2">
              <Label>Payout Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "PAYPAL", label: "PayPal", icon: "💳" },
                  { id: "BANK", label: "Bank", icon: "🏦" },
                  { id: "STRIPE", label: "Stripe", icon: "💵" },
                ].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPayoutMethod(method.id as typeof payoutMethod)}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      payoutMethod === method.id
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                  >
                    <span className="text-2xl block mb-1">{method.icon}</span>
                    <span className="text-sm font-medium">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* PayPal Email (only for PayPal) */}
            {payoutMethod === "PAYPAL" && (
              <div className="space-y-2">
                <Label htmlFor="paypal-email">PayPal Email</Label>
                <Input
                  id="paypal-email"
                  type="email"
                  placeholder="your@email.com"
                  value={payoutEmail}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                />
              </div>
            )}

            {/* Bank notice */}
            {payoutMethod === "BANK" && (
              <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-sm">
                <p>Bank transfers require account verification. We will contact you via email to verify your bank details.</p>
              </div>
            )}

            {/* Stripe notice */}
            {payoutMethod === "STRIPE" && (
              <div className="p-3 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm">
                <p>Stripe payouts will be sent to your connected Stripe account. Make sure you have set up Stripe Connect in settings.</p>
              </div>
            )}

            {/* Processing time */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Processing time: 1-3 business days</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayoutModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestPayout}
              disabled={isRequestingPayout || (payoutMethod === "PAYPAL" && !payoutEmail)}
              className="bg-green-600 hover:bg-green-700"
            >
              {isRequestingPayout ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Request Payout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
