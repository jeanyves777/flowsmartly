"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Search,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  Users,
  History,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Stats {
  totalCreditsInSystem: number;
  totalUsersWithCredits: number;
  thisMonth: { netChange: number; transactionCount: number };
  lastMonth: { netChange: number; transactionCount: number };
  topUsers: Array<{ id: string; email: string; name: string; aiCredits: number }>;
}

interface Transaction {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  reason: string | null;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  plan: string;
  aiCredits: number;
  createdAt: string;
  transactionCount: number;
}

const transactionTypeColors: Record<string, string> = {
  PURCHASE: "bg-green-500/20 text-green-400",
  USAGE: "bg-blue-500/20 text-blue-400",
  BONUS: "bg-purple-500/20 text-purple-400",
  REFUND: "bg-orange-500/20 text-orange-400",
  ADMIN_ADJUSTMENT: "bg-yellow-500/20 text-yellow-400",
  SUBSCRIPTION: "bg-cyan-500/20 text-cyan-400",
  REFERRAL: "bg-pink-500/20 text-pink-400",
  WELCOME: "bg-emerald-500/20 text-emerald-400",
};

export default function AdminCreditsPage() {
  // State
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "transactions">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 20;

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Adjustment modal
  const [adjustmentModal, setAdjustmentModal] = useState<{
    open: boolean;
    user: User | null;
    type: "add" | "deduct";
  }>({ open: false, user: null, type: "add" });
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch overview data
  const fetchOverview = async () => {
    try {
      const response = await fetch("/api/admin/credits?view=overview");
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);
      setStats(data.data.stats);
      setRecentTransactions(data.data.recentTransactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        view: "users",
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchQuery,
        sortBy: "credits",
        sortOrder: "desc",
      });
      const response = await fetch(`/api/admin/credits?${params}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);
      setUsers(data.data.users);
      setTotalPages(data.data.pagination.totalPages);
      setTotal(data.data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  };

  // Fetch transactions
  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({
        view: "transactions",
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      });
      const response = await fetch(`/api/admin/credits?${params}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);
      setTransactions(data.data.transactions);
      setTotalPages(data.data.pagination.totalPages);
      setTotal(data.data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    }
  };

  // Initial load and tab changes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      if (activeTab === "overview") {
        await fetchOverview();
      } else if (activeTab === "users") {
        await fetchUsers();
      } else if (activeTab === "transactions") {
        await fetchTransactions();
      }
      setIsLoading(false);
    };
    loadData();
  }, [activeTab]);

  // Page changes
  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "transactions") {
      fetchTransactions();
    }
  }, [currentPage, searchQuery, typeFilter]);

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (activeTab === "overview") {
      await fetchOverview();
    } else if (activeTab === "users") {
      await fetchUsers();
    } else if (activeTab === "transactions") {
      await fetchTransactions();
    }
    setIsRefreshing(false);
  };

  // Submit adjustment
  const handleAdjustment = async () => {
    if (!adjustmentModal.user || !adjustmentAmount || !adjustmentReason) return;

    setIsSubmitting(true);
    try {
      const amount = adjustmentModal.type === "add"
        ? parseInt(adjustmentAmount)
        : -parseInt(adjustmentAmount);

      const response = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust",
          userId: adjustmentModal.user.id,
          amount,
          reason: adjustmentReason,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);

      // Close modal and refresh
      setAdjustmentModal({ open: false, user: null, type: "add" });
      setAdjustmentAmount("");
      setAdjustmentReason("");
      handleRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to adjust credits");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  if (error && !stats && !users.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-foreground mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-foreground">
            <Sparkles className="w-7 h-7 text-violet-500" />
            Credit Management
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage user AI credits and view transaction history
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: "overview", label: "Overview", icon: TrendingUp },
          { id: "users", label: "Users", icon: Users },
          { id: "transactions", label: "Transactions", icon: History },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => {
              setActiveTab(tab.id as typeof activeTab);
              setCurrentPage(1);
            }}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  {isLoading ? (
                    <div className="h-8 w-20 rounded animate-pulse bg-muted" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {formatNumber(stats?.totalCreditsInSystem || 0)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Total Credits in System</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  {isLoading ? (
                    <div className="h-8 w-16 rounded animate-pulse bg-muted" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {formatNumber(stats?.totalUsersWithCredits || 0)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Users with Credits</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(stats?.thisMonth.netChange || 0) >= 0 ? "bg-green-500/20" : "bg-red-500/20"}`}>
                  {(stats?.thisMonth.netChange || 0) >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div>
                  {isLoading ? (
                    <div className="h-8 w-16 rounded animate-pulse bg-muted" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {(stats?.thisMonth.netChange || 0) >= 0 ? "+" : ""}{formatNumber(stats?.thisMonth.netChange || 0)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">This Month</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <History className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  {isLoading ? (
                    <div className="h-8 w-16 rounded animate-pulse bg-muted" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {formatNumber(stats?.thisMonth.transactionCount || 0)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Transactions (Month)</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Users & Recent Transactions */}
          <div className="grid grid-cols-2 gap-6">
            {/* Top Users by Credits */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold mb-4 text-foreground">
                  Top Users by Credits
                </h3>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 rounded animate-pulse bg-muted" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats?.topUsers.map((user, index) => (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium w-5 text-muted-foreground">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-foreground">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-violet-500" />
                          <span className="font-semibold text-foreground">
                            {formatNumber(user.aiCredits)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold mb-4 text-foreground">
                  Recent Transactions
                </h3>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 rounded animate-pulse bg-muted" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentTransactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          {tx.amount >= 0 ? (
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-red-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-foreground">{tx.userName}</p>
                            <p className="text-xs text-muted-foreground">{tx.type}</p>
                          </div>
                        </div>
                        <span className={`font-semibold ${tx.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {tx.amount >= 0 ? "+" : ""}{formatNumber(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-violet-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No users found</p>
                </div>
              ) : (
                <>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">User</th>
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">Plan</th>
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">Credits</th>
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">Transactions</th>
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">Joined</th>
                        <th className="text-right text-xs font-medium p-4 text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border-b last:border-0 border-border hover:bg-muted/50"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9">
                                <AvatarImage src={user.avatarUrl || undefined} />
                                <AvatarFallback className="text-sm bg-muted text-foreground">
                                  {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium text-foreground">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className="bg-gray-500/20 text-gray-400">{user.plan}</Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-violet-500" />
                              <span className="font-semibold text-foreground">
                                {formatNumber(user.aiCredits)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {user.transactionCount}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAdjustmentModal({ open: true, user, type: "add" })}
                                className="h-8"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAdjustmentModal({ open: true, user, type: "deduct" })}
                                className="h-8"
                              >
                                <Minus className="w-3 h-3 mr-1" />
                                Deduct
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between p-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, total)} of {total} users
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div className="space-y-4">
          {/* Filter */}
          <Card>
            <CardContent className="p-4">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-violet-500 bg-muted/50 border-input text-foreground"
              >
                <option value="all">All Types</option>
                <option value="PURCHASE">Purchase</option>
                <option value="USAGE">Usage</option>
                <option value="BONUS">Bonus</option>
                <option value="REFUND">Refund</option>
                <option value="ADMIN_ADJUSTMENT">Admin Adjustment</option>
                <option value="SUBSCRIPTION">Subscription</option>
                <option value="REFERRAL">Referral</option>
              </select>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No transactions found</p>
                </div>
              ) : (
                <>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">User</th>
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">Type</th>
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">Amount</th>
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">Balance After</th>
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">Description</th>
                        <th className="text-left text-xs font-medium p-4 text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <motion.tr
                          key={tx.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border-b last:border-0 border-border hover:bg-muted/50"
                        >
                          <td className="p-4">
                            <div>
                              <p className="text-sm font-medium text-foreground">{tx.userName}</p>
                              <p className="text-xs text-muted-foreground">{tx.userEmail}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={transactionTypeColors[tx.type] || "bg-gray-500/20 text-gray-400"}>
                              {tx.type}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <span className={`font-semibold ${tx.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {tx.amount >= 0 ? "+" : ""}{formatNumber(tx.amount)}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {formatNumber(tx.balanceAfter)}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {tx.reason || tx.description || "-"}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {formatDate(tx.createdAt)}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between p-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, total)} of {total} transactions
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Adjustment Modal */}
      <AnimatePresence>
        {adjustmentModal.open && adjustmentModal.user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setAdjustmentModal({ open: false, user: null, type: "add" })}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-xl bg-card"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">
                  {adjustmentModal.type === "add" ? "Add Credits" : "Deduct Credits"}
                </h3>
                <button
                  onClick={() => setAdjustmentModal({ open: false, user: null, type: "add" })}
                  className="p-1 rounded-lg hover:bg-muted/50"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-4 rounded-lg mb-4 bg-muted/50">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={adjustmentModal.user.avatarUrl || undefined} />
                    <AvatarFallback className="bg-muted text-foreground">
                      {adjustmentModal.user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">
                      {adjustmentModal.user.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Current balance: {formatNumber(adjustmentModal.user.aiCredits)} credits
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-violet-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Reason
                  </label>
                  <textarea
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder="Reason for adjustment..."
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-violet-500 resize-none bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setAdjustmentModal({ open: false, user: null, type: "add" })}
                >
                  Cancel
                </Button>
                <Button
                  className={`flex-1 ${adjustmentModal.type === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                  onClick={handleAdjustment}
                  disabled={!adjustmentAmount || !adjustmentReason || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : adjustmentModal.type === "add" ? (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Credits
                    </>
                  ) : (
                    <>
                      <Minus className="w-4 h-4 mr-2" />
                      Deduct Credits
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
