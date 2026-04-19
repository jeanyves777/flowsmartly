"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, Mail, Ban, Eye, UserCheck, UserX, Download, ChevronLeft, ChevronRight, Crown, RefreshCw, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AISpinner } from "@/components/shared/ai-generation-loader";

interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  plan: string;
  planExpiresAt: string | null;
  aiCredits: number;
  balanceCents: number;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  isDeleted: boolean;
  postsCount: number;
  campaignsCount: number;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  paidUsers: number;
  newThisMonth: number;
}

const planColors: Record<string, string> = {
  STARTER: "bg-gray-500/20 text-gray-400",
  BASIC: "bg-blue-500/20 text-blue-400",
  PRO: "bg-purple-500/20 text-purple-400",
  BUSINESS: "bg-orange-500/20 text-orange-400",
  ENTERPRISE: "bg-red-500/20 text-red-400",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [confirmBan, setConfirmBan] = useState<string | null>(null);
  const itemsPerPage = 20;

  const fetchUsers = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        status: statusFilter,
        plan: planFilter,
        search: searchQuery,
      });

      const response = await fetch(`/api/admin/users?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch users");
      }

      setUsers(data.data.users);
      setStats(data.data.stats);
      setTotalPages(data.data.pagination.totalPages);
      setTotal(data.data.pagination.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, statusFilter, planFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleUserAction = async (userId: string, action: string) => {
    setActionLoading(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Action failed");
      }

      fetchUsers();
      setConfirmBan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = () => {
    const headers = ["Name", "Email", "Plan", "Credits", "Status", "Last Login", "Created"];
    const rows = users.map((u) => [
      u.name,
      u.email,
      u.plan,
      u.aiCredits.toString(),
      u.isDeleted ? "Deleted" : "Active",
      u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : "Never",
      new Date(u.createdAt).toISOString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (error && !users.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4">{error}</p>
          <Button onClick={() => fetchUsers()} variant="outline">
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
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-7 h-7 text-orange-500" />
            User Management
          </h1>
          <p className="mt-1 text-muted-foreground">
            View and manage all registered users
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => fetchUsers(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={users.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
              )}
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats?.activeUsers || 0}</p>
              )}
              <p className="text-xs text-muted-foreground">Active (7d)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats?.paidUsers || 0}</p>
              )}
              <p className="text-xs text-muted-foreground">Paid Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <UserX className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-16 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats?.newThisMonth || 0}</p>
              )}
              <p className="text-xs text-muted-foreground">New (30d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-muted/50 border-input text-foreground"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="deleted">Deleted</option>
            </select>
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-muted/50 border-input text-foreground"
            >
              <option value="all">All Plans</option>
              <option value="STARTER">Starter</option>
              <option value="BASIC">Basic</option>
              <option value="PRO">Pro</option>
              <option value="BUSINESS">Business</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {error && users.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <AISpinner className="w-8 h-8 animate-spin text-muted-foreground" />
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
                    <th className="text-left text-xs font-medium p-4 text-muted-foreground">Status</th>
                    <th className="text-left text-xs font-medium p-4 text-muted-foreground">Posts</th>
                    <th className="text-left text-xs font-medium p-4 text-muted-foreground">AI Credits</th>
                    <th className="text-left text-xs font-medium p-4 text-muted-foreground">Last Login</th>
                    <th className="text-right text-xs font-medium p-4 text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b last:border-0 border-border/50 hover:bg-muted/50"
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
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={planColors[user.plan] || planColors.STARTER}>
                          {user.plan}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge
                          className={
                            user.isDeleted
                              ? "bg-red-500/20 text-red-400"
                              : "bg-green-500/20 text-green-400"
                          }
                        >
                          {user.isDeleted ? "Deleted" : "Active"}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{user.postsCount}</td>
                      <td className="p-4 text-sm text-muted-foreground">{user.aiCredits}</td>
                      <td className="p-4 text-sm text-muted-foreground">{formatDate(user.lastLoginAt)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="View User"
                            onClick={() => setViewingUser(user)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Email User"
                            onClick={() => { window.location.href = `mailto:${user.email}`; }}
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                          {user.isDeleted ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-green-400"
                              title="Unban User"
                              onClick={() => handleUserAction(user.id, "unban")}
                              disabled={actionLoading === user.id}
                            >
                              {actionLoading === user.id ? (
                                <AISpinner className="w-4 h-4 animate-spin" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </Button>
                          ) : confirmBan === user.id ? (
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-red-400 whitespace-nowrap">Ban?</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                onClick={() => handleUserAction(user.id, "ban")}
                                disabled={actionLoading === user.id}
                              >
                                {actionLoading === user.id ? (
                                  <AISpinner className="w-3 h-3 animate-spin" />
                                ) : (
                                  <UserCheck className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                onClick={() => setConfirmBan(null)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-400"
                              title="Ban User"
                              onClick={() => setConfirmBan(user.id)}
                              disabled={actionLoading === user.id}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
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
      {/* User Detail Modal */}
      <AnimatePresence>
        {viewingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setViewingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">User Details</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingUser(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={viewingUser.avatarUrl || undefined} />
                  <AvatarFallback className="text-lg bg-muted text-foreground">
                    {viewingUser.name?.charAt(0) || viewingUser.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-medium">{viewingUser.name}</p>
                  <p className="text-sm text-muted-foreground">{viewingUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Plan</p>
                  <Badge className={`mt-1 ${planColors[viewingUser.plan] || planColors.STARTER}`}>
                    {viewingUser.plan}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={`mt-1 ${viewingUser.isDeleted ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                    {viewingUser.isDeleted ? "Deleted" : "Active"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">AI Credits</p>
                  <p className="font-medium mt-1">{viewingUser.aiCredits}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance</p>
                  <p className="font-medium mt-1">${(viewingUser.balanceCents / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Posts</p>
                  <p className="font-medium mt-1">{viewingUser.postsCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Campaigns</p>
                  <p className="font-medium mt-1">{viewingUser.campaignsCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium mt-1">{formatDate(viewingUser.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Login</p>
                  <p className="font-medium mt-1">{formatDate(viewingUser.lastLoginAt)}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
