"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Gift,
  Users,
  UserCheck,
  DollarSign,
  Clock,
  Copy,
  Share2,
  Wallet,
  Briefcase,
  Link2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalEarnedCents: number;
  pendingCommissionsCents: number;
}

interface Referral {
  id: string;
  referredName: string;
  referredEmail: string;
  referredAvatar: string | null;
  referralType: string;
  status: string;
  commissionRate: number;
  commissionType: string;
  expiresAt: string | null;
  totalEarnedCents: number;
  createdAt: string;
}

interface Commission {
  id: string;
  amountCents: number;
  sourceType: string;
  status: string;
  referredName: string;
  paidAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getReferralTypeBadge(type: string) {
  switch (type) {
    case "USER_TO_CLIENT":
    case "AGENT_TO_CLIENT":
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          Client
        </Badge>
      );
    case "AGENT_TO_AGENT":
      return (
        <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
          Agent
        </Badge>
      );
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

function getReferralStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          Active
        </Badge>
      );
    case "EXPIRED":
      return (
        <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
          Expired
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getCommissionSourceBadge(source: string) {
  switch (source) {
    case "SUBSCRIPTION":
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          Subscription
        </Badge>
      );
    case "CREDIT_PURCHASE":
      return (
        <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
          Credit Purchase
        </Badge>
      );
    case "AGENT_HIRE":
      return (
        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
          Agent Hire
        </Badge>
      );
    default:
      return <Badge variant="outline">{source}</Badge>;
  }
}

function getCommissionStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case "PAID":
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          <DollarSign className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ReferralsPage() {
  const { toast } = useToast();

  const [code, setCode] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchReferrals = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/referrals?page=${page}&limit=20`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch referral data");
      }

      setCode(data.data.code);
      setLink(data.data.link);
      setStats(data.data.stats);
      setReferrals(data.data.referrals || []);
      setCommissions(data.data.commissions || []);
      setPagination(data.data.pagination || null);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load referral data"
      );
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copied!" });
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(
      "Check out FlowSmartly! Use my referral link to get started:"
    );
    const url = encodeURIComponent(link);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank"
    );
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Check out FlowSmartly! Use my referral link to get started: ${link}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent("Join me on FlowSmartly!");
    const body = encodeURIComponent(
      `Hey!\n\nI've been using FlowSmartly and I think you'd love it. Use my referral link to sign up:\n\n${link}\n\nSee you there!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  // -------------------------------------------------------------------------
  // Error State
  // -------------------------------------------------------------------------

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchReferrals} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
            <Gift className="w-6 h-6 text-white" />
          </div>
          Referrals
        </h1>
        <p className="text-muted-foreground mt-2">
          Share your link, refer friends and agents, and earn commissions on
          their activity.
        </p>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 1. My Referral Link                                               */}
      {/* ----------------------------------------------------------------- */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-64" />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-brand-500/30 bg-gradient-to-br from-brand-500/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-brand-500" />
                <h2 className="text-lg font-semibold">My Referral Link</h2>
                <Badge className="bg-brand-500/10 text-brand-500 border-brand-500/20">
                  {code}
                </Badge>
              </div>
            </div>

            {/* Link display + copy */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 font-mono text-sm truncate">
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{link}</span>
              </div>
              <Button onClick={handleCopyLink} className="flex-shrink-0">
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>

            {/* Share buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-sm text-muted-foreground mr-1">
                <Share2 className="w-4 h-4 inline-block mr-1" />
                Share via:
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShareTwitter}
                className="gap-1.5"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Twitter/X
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShareWhatsApp}
                className="gap-1.5"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShareEmail}
                className="gap-1.5"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                Email
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 2. Stats Cards                                                    */}
      {/* ----------------------------------------------------------------- */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      ) : (
        stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-brand-500" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold">
                    {stats.totalReferrals}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total Referrals
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-green-500" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold">
                    {stats.activeReferrals}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active Referrals
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold">
                    {formatCents(stats.totalEarnedCents)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Earned</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold">
                    {formatCents(stats.pendingCommissionsCents)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pending Commissions
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 3. How It Works                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center mb-3">
              <Gift className="w-5 h-5 text-brand-500" />
            </div>
            <h3 className="font-semibold mb-1">Refer Friends</h3>
            <p className="text-sm text-muted-foreground">
              Share your link, earn 5% of their payments for 3 months.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
              <Briefcase className="w-5 h-5 text-purple-500" />
            </div>
            <h3 className="font-semibold mb-1">Agent Referrals</h3>
            <p className="text-sm text-muted-foreground">
              Refer another agent, earn 50% of their first client&apos;s first
              month.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
              <Wallet className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="font-semibold mb-1">Get Paid</h3>
            <p className="text-sm text-muted-foreground">
              Commissions added to your balance, request payout anytime.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 4. My Referrals                                                   */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-500" />
            My Referrals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No referrals yet.</p>
              <p className="text-sm mt-1">
                Share your link to start earning!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Commission Rate
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Earned
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {referrals.map((ref) => (
                    <tr key={ref.id} className="group">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          {ref.referredAvatar ? (
                            <img
                              src={ref.referredAvatar}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-xs font-semibold text-brand-500">
                              {ref.referredName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{ref.referredName}</p>
                            <p className="text-xs text-muted-foreground">
                              {ref.referredEmail}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        {getReferralTypeBadge(ref.referralType)}
                      </td>
                      <td className="py-3">
                        {getReferralStatusBadge(ref.status)}
                      </td>
                      <td className="py-3 font-medium">
                        {(ref.commissionRate * 100).toFixed(0)}%
                        <span className="text-xs text-muted-foreground ml-1">
                          {ref.commissionType === "RECURRING"
                            ? "(recurring)"
                            : "(one-time)"}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-green-500">
                        {formatCents(ref.totalEarnedCents)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(ref.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages} ({pagination.total}{" "}
                total)
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pagination.pages}
                  onClick={() =>
                    setPage((p) => Math.min(pagination.pages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* 5. Commission History                                             */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-brand-500" />
            Commission History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : commissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No commissions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      From
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Source
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {commissions.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="py-3 font-medium">{c.referredName}</td>
                      <td className="py-3 font-semibold text-green-500">
                        {formatCents(c.amountCents)}
                      </td>
                      <td className="py-3">
                        {getCommissionSourceBadge(c.sourceType)}
                      </td>
                      <td className="py-3">
                        {getCommissionStatusBadge(c.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
