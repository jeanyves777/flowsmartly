"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Gift,
  Users,
  UserCheck,
  DollarSign,
  Clock,
  Filter,
  Trophy,
  ArrowUpDown,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalPaidCents: number;
  totalPendingCents: number;
  topReferrers: TopReferrer[];
}

interface TopReferrer {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  totalEarnedCents: number;
  referralCount: number;
}

interface Referral {
  id: string;
  referrerName: string;
  referrerEmail: string;
  referredName: string;
  referredEmail: string;
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
  referrerName: string;
  referrerEmail: string;
  referredName: string;
  amountCents: number;
  sourceType: string;
  status: string;
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
// Constants
// ---------------------------------------------------------------------------

type TabKey = "referrals" | "commissions" | "top-referrers";

const TABS: { key: TabKey; label: string }[] = [
  { key: "referrals", label: "Referrals" },
  { key: "commissions", label: "Commissions" },
  { key: "top-referrers", label: "Top Referrers" },
];

const referralStatusColors: Record<string, string> = {
  ACTIVE: "bg-green-500/20 text-green-500 border-green-500/30",
  EXPIRED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  CANCELLED: "bg-red-500/20 text-red-500 border-red-500/30",
};

const referralTypeLabels: Record<string, string> = {
  USER_TO_CLIENT: "User\u2192Client",
  AGENT_TO_CLIENT: "Agent\u2192Client",
  AGENT_TO_AGENT: "Agent\u2192Agent",
};

const referralTypeColors: Record<string, string> = {
  USER_TO_CLIENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  AGENT_TO_CLIENT: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  AGENT_TO_AGENT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const commissionSourceColors: Record<string, string> = {
  SUBSCRIPTION: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CREDIT_PURCHASE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  AGENT_HIRE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const commissionStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  PAID: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminReferralsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("referrals");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    activeReferrals: 0,
    totalPaidCents: 0,
    totalPendingCents: 0,
    topReferrers: [],
  });
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [referralPagination, setReferralPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [commissionPagination, setCommissionPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Pagination state
  const [referralPage, setReferralPage] = useState(1);
  const [commissionPage, setCommissionPage] = useState(1);

  // Sorting
  const [referralSort, setReferralSort] = useState<string>("createdAt");
  const [referralSortDir, setReferralSortDir] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const params = new URLSearchParams();

        if (statusFilter !== "all") params.set("status", statusFilter);
        if (typeFilter !== "all") params.set("type", typeFilter);
        params.set("referralPage", String(referralPage));
        params.set("commissionPage", String(commissionPage));

        const response = await fetch(`/api/admin/referrals?${params}`);
        const json = await response.json();

        if (!json.success) {
          throw new Error(json.error?.message || "Failed to fetch referral data");
        }

        const { data } = json;
        setStats(data.stats);
        setReferrals(data.referrals);
        setCommissions(data.commissions);
        setReferralPagination(data.referralPagination);
        setCommissionPagination(data.commissionPagination);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load referral data");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [statusFilter, typeFilter, referralPage, commissionPage],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset pagination when filters change
  useEffect(() => {
    setReferralPage(1);
  }, [statusFilter, typeFilter]);

  const handleReferralSort = (column: string) => {
    if (referralSort === column) {
      setReferralSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setReferralSort(column);
      setReferralSortDir("desc");
    }
  };

  // Client-side sort for referrals
  const sortedReferrals = [...referrals].sort((a, b) => {
    const dir = referralSortDir === "asc" ? 1 : -1;
    switch (referralSort) {
      case "totalEarnedCents":
        return (a.totalEarnedCents - b.totalEarnedCents) * dir;
      case "commissionRate":
        return (a.commissionRate - b.commissionRate) * dir;
      case "createdAt":
      default:
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    }
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (error && referrals.length === 0 && commissions.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-foreground mb-4">{error}</p>
          <Button onClick={() => fetchData()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-foreground">
            <Gift className="w-7 h-7 text-orange-500" />
            Referral Program
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage and monitor the referral program
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Users}
          iconColor="text-blue-500"
          iconBg="from-blue-500/20 to-indigo-500/20"
          label="Total Referrals"
          value={isLoading ? null : String(stats.totalReferrals)}
        />
        <StatsCard
          icon={UserCheck}
          iconColor="text-green-500"
          iconBg="from-green-500/20 to-emerald-500/20"
          label="Active Referrals"
          value={isLoading ? null : String(stats.activeReferrals)}
        />
        <StatsCard
          icon={DollarSign}
          iconColor="text-orange-500"
          iconBg="from-orange-500/20 to-amber-500/20"
          label="Total Commissions Paid"
          value={isLoading ? null : formatMoney(stats.totalPaidCents)}
        />
        <StatsCard
          icon={Clock}
          iconColor="text-purple-500"
          iconBg="from-purple-500/20 to-pink-500/20"
          label="Pending Commissions"
          value={isLoading ? null : formatMoney(stats.totalPendingCents)}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === tab.key
                ? "text-orange-500"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="referrals-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "referrals" && (
        <ReferralsTab
          referrals={sortedReferrals}
          pagination={referralPagination}
          isLoading={isLoading}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onStatusFilterChange={setStatusFilter}
          onTypeFilterChange={setTypeFilter}
          onPageChange={setReferralPage}
          sortColumn={referralSort}
          sortDir={referralSortDir}
          onSort={handleReferralSort}
        />
      )}

      {activeTab === "commissions" && (
        <CommissionsTab
          commissions={commissions}
          pagination={commissionPagination}
          isLoading={isLoading}
          onPageChange={setCommissionPage}
        />
      )}

      {activeTab === "top-referrers" && (
        <TopReferrersTab
          topReferrers={stats.topReferrers}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats Card
// ---------------------------------------------------------------------------

function StatsCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
}: {
  icon: typeof Users;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string | null;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {value === null ? (
              <Skeleton className="h-9 w-24 mt-1" />
            ) : (
              <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
            )}
          </div>
          <div
            className={cn(
              "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center",
              iconBg,
            )}
          >
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Referrals Tab
// ---------------------------------------------------------------------------

function ReferralsTab({
  referrals,
  pagination,
  isLoading,
  statusFilter,
  typeFilter,
  onStatusFilterChange,
  onTypeFilterChange,
  onPageChange,
  sortColumn,
  sortDir,
  onSort,
}: {
  referrals: Referral[];
  pagination: Pagination;
  isLoading: boolean;
  statusFilter: string;
  typeFilter: string;
  onStatusFilterChange: (v: string) => void;
  onTypeFilterChange: (v: string) => void;
  onPageChange: (p: number) => void;
  sortColumn: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-card text-foreground"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-card text-foreground"
            >
              <option value="all">All Types</option>
              <option value="USER_TO_CLIENT">User &rarr; Client</option>
              <option value="AGENT_TO_CLIENT">Agent &rarr; Client</option>
              <option value="AGENT_TO_AGENT">Agent &rarr; Agent</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSkeleton rows={5} cols={7} />
          ) : referrals.length === 0 ? (
            <EmptyState
              icon={Gift}
              message="No referrals found"
              submessage="Adjust filters or wait for referral activity"
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Referrer
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Referred
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        <SortableHeader
                          label="Rate"
                          column="commissionRate"
                          currentColumn={sortColumn}
                          direction={sortDir}
                          onSort={onSort}
                        />
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        <SortableHeader
                          label="Earned"
                          column="totalEarnedCents"
                          currentColumn={sortColumn}
                          direction={sortDir}
                          onSort={onSort}
                        />
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        <SortableHeader
                          label="Date"
                          column="createdAt"
                          currentColumn={sortColumn}
                          direction={sortDir}
                          onSort={onSort}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((ref) => (
                      <motion.tr
                        key={ref.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {ref.referrerName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ref.referrerEmail}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {ref.referredName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ref.referredEmail}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              referralTypeColors[ref.referralType] ||
                              "bg-gray-500/20 text-gray-400"
                            }
                          >
                            {referralTypeLabels[ref.referralType] || ref.referralType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              referralStatusColors[ref.status] ||
                              "bg-gray-500/20 text-gray-400"
                            }
                          >
                            {ref.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {ref.commissionType === "PERCENTAGE"
                            ? `${ref.commissionRate}%`
                            : formatMoney(ref.commissionRate)}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-foreground">
                          {formatMoney(ref.totalEarnedCents)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatDate(ref.createdAt)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                pagination={pagination}
                onPageChange={onPageChange}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commissions Tab
// ---------------------------------------------------------------------------

function CommissionsTab({
  commissions,
  pagination,
  isLoading,
  onPageChange,
}: {
  commissions: Commission[];
  pagination: Pagination;
  isLoading: boolean;
  onPageChange: (p: number) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingSkeleton rows={5} cols={6} />
        ) : commissions.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            message="No commissions found"
            submessage="Commissions will appear as referrals generate revenue"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Referrer
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Referred
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Source
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((comm) => (
                    <motion.tr
                      key={comm.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {formatDate(comm.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {comm.referrerName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {comm.referrerEmail}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {comm.referredName}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-foreground">
                        {formatMoney(comm.amountCents)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            commissionSourceColors[comm.sourceType] ||
                            "bg-gray-500/20 text-gray-400"
                          }
                        >
                          {comm.sourceType.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            commissionStatusColors[comm.status] ||
                            "bg-gray-500/20 text-gray-400"
                          }
                        >
                          {comm.status}
                        </Badge>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationControls
              pagination={pagination}
              onPageChange={onPageChange}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Top Referrers Tab
// ---------------------------------------------------------------------------

function TopReferrersTab({
  topReferrers,
  isLoading,
}: {
  topReferrers: TopReferrer[];
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Trophy className="w-5 h-5 text-orange-500" />
          Referral Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingSkeleton rows={5} cols={5} />
        ) : topReferrers.length === 0 ? (
          <EmptyState
            icon={Trophy}
            message="No referrers yet"
            submessage="Top referrers will appear here once the program has activity"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-16">
                    Rank
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Referrals
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Total Earned
                  </th>
                </tr>
              </thead>
              <tbody>
                {topReferrers.map((referrer, index) => (
                  <motion.tr
                    key={referrer.userId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <RankBadge rank={index + 1} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-sm font-semibold text-orange-500">
                          {referrer.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {referrer.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {referrer.email}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {referrer.referralCount}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-foreground">
                      {formatMoney(referrer.totalEarnedCents)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-500 text-sm font-bold">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-400/20 text-gray-400 text-sm font-bold">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-600 text-sm font-bold">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 text-sm text-muted-foreground">
      {rank}
    </span>
  );
}

function SortableHeader({
  label,
  column,
  currentColumn,
  direction,
  onSort,
}: {
  label: string;
  column: string;
  currentColumn: string;
  direction: "asc" | "desc";
  onSort: (col: string) => void;
}) {
  const isActive = currentColumn === column;
  return (
    <button
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown
        className={cn(
          "w-3.5 h-3.5",
          isActive ? "text-orange-500" : "text-muted-foreground/50",
        )}
      />
      {isActive && (
        <span className="text-[10px] text-orange-500">
          {direction === "asc" ? "\u2191" : "\u2193"}
        </span>
      )}
    </button>
  );
}

function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination: Pagination;
  onPageChange: (p: number) => void;
}) {
  if (pagination.pages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-sm text-muted-foreground">
        Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
        {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
        {pagination.total} results
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {pagination.page} of {pagination.pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.pages}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function LoadingSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="p-4 space-y-3">
      {/* Header row */}
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex gap-4">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={`cell-${rowIdx}-${colIdx}`} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
  submessage,
}: {
  icon: typeof Gift;
  message: string;
  submessage: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-12 h-12 text-muted-foreground/50 mb-4" />
      <p className="text-foreground font-medium">{message}</p>
      <p className="text-sm text-muted-foreground mt-1">{submessage}</p>
    </div>
  );
}
