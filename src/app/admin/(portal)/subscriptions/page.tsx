"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  RefreshCw,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Zap,
  Crown,
  Shield,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserSub {
  id: string;
  email: string;
  name: string;
  plan: string;
  aiCredits: number;
  planExpiresAt: string | null;
  stripeCustomerId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface SyncResult {
  total: number;
  synced: number;
  discrepancies: number;
  issues: Array<{
    userId: string;
    email: string;
    issue: string;
    localPlan: string;
    stripePlan: string | null;
    stripeStatus: string | null;
  }>;
  timestamp: string;
}

interface Stats {
  totalUsers: number;
  starterUsers: number;
  paidUsers: number;
  expiringIn7Days: number;
  expiredNotReset: number;
}

const planColors: Record<string, string> = {
  STARTER: "bg-gray-500/20 text-gray-400",
  PRO: "bg-violet-500/20 text-violet-400",
  BUSINESS: "bg-blue-500/20 text-blue-400",
  ENTERPRISE: "bg-amber-500/20 text-amber-400",
  ADMIN: "bg-red-500/20 text-red-400",
};

export default function AdminSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "sync" | "users">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserSub[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(0);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersFilter, setUsersFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [fixingUser, setFixingUser] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/subscriptions?view=stats");
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch { /* silent */ }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view: "users",
        limit: "20",
        offset: String(usersPage * 20),
      });
      if (usersSearch) params.set("search", usersSearch);
      if (usersFilter !== "all") params.set("plan", usersFilter);

      const res = await fetch(`/api/admin/subscriptions?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
        setUsersTotal(data.data.total);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [usersPage, usersSearch, usersFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (activeTab === "users") loadUsers(); }, [activeTab, loadUsers]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/stripe-sync");
      const data = await res.json();
      if (data.success) {
        setSyncResult(data);
      }
    } catch { /* silent */ }
    finally { setSyncing(false); }
  };

  const handleFixUser = async (userId: string, action: "reset_to_starter" | "sync_from_stripe") => {
    setFixingUser(userId);
    try {
      const res = await fetch("/api/admin/stripe-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh sync results
        handleSync();
        loadStats();
      }
    } catch { /* silent */ }
    finally { setFixingUser(null); }
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: TrendingUp },
    { id: "sync" as const, label: "Stripe Sync", icon: RefreshCw },
    { id: "users" as const, label: "Subscribers", icon: Users },
  ];

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function daysUntil(d: string | null) {
    if (!d) return null;
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (86400000));
    return diff;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-orange-500" />
          Subscription Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor subscriptions, sync with Stripe, manage user plans
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground font-medium">Total Users</div>
              <div className="text-2xl font-bold mt-1">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground font-medium">Starter (Free)</div>
              <div className="text-2xl font-bold mt-1 text-gray-400">{stats.starterUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground font-medium">Paid Users</div>
              <div className="text-2xl font-bold mt-1 text-green-500">{stats.paidUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground font-medium">Expiring in 7d</div>
              <div className="text-2xl font-bold mt-1 text-amber-500">{stats.expiringIn7Days}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                Expired Not Reset
              </div>
              <div className="text-2xl font-bold mt-1 text-red-500">{stats.expiredNotReset}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-orange-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && stats && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-3">Subscription Health</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Conversion Rate (Free → Paid)</span>
                  <span className="font-semibold">
                    {stats.totalUsers > 0
                      ? ((stats.paidUsers / stats.totalUsers) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-violet-500 to-blue-500 h-2 rounded-full"
                    style={{ width: `${stats.totalUsers > 0 ? (stats.paidUsers / stats.totalUsers) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {stats.expiredNotReset > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-400">
                      {stats.expiredNotReset} user(s) with expired plans not yet reset to STARTER
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Run the Subscription Manager cron or Stripe Sync to fix this.
                  </p>
                </div>
              )}

              {stats.expiringIn7Days > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-400">
                      {stats.expiringIn7Days} subscription(s) expiring within 7 days
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stripe Sync Tab */}
      {activeTab === "sync" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Compare local subscription data with Stripe to find and fix discrepancies.
            </p>
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Run Stripe Sync
                </>
              )}
            </Button>
          </div>

          {syncResult && (
            <div className="space-y-4">
              {/* Sync Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-xs text-muted-foreground">Synced</div>
                    <div className="text-xl font-bold mt-1 text-green-500">
                      {syncResult.synced}/{syncResult.total}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-xs text-muted-foreground">Discrepancies</div>
                    <div className={`text-xl font-bold mt-1 ${syncResult.discrepancies > 0 ? "text-red-500" : "text-green-500"}`}>
                      {syncResult.discrepancies}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-xs text-muted-foreground">Last Sync</div>
                    <div className="text-sm font-medium mt-1">
                      {new Date(syncResult.timestamp).toLocaleTimeString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Discrepancies List */}
              {syncResult.issues.length > 0 ? (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Discrepancies Found ({syncResult.issues.length})
                    </h3>
                    <div className="space-y-3">
                      {syncResult.issues.map((issue) => (
                        <div
                          key={issue.userId}
                          className="p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{issue.email}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{issue.issue}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <span>
                                  Local: <Badge variant="outline" className="ml-1">{issue.localPlan}</Badge>
                                </span>
                                <span>
                                  Stripe: <Badge variant="outline" className="ml-1">{issue.stripePlan || "none"}</Badge>
                                </span>
                                <span>
                                  Status: <Badge variant="outline" className="ml-1">{issue.stripeStatus || "—"}</Badge>
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleFixUser(issue.userId, "sync_from_stripe")}
                                disabled={fixingUser === issue.userId}
                              >
                                {fixingUser === issue.userId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                )}
                                Sync
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleFixUser(issue.userId, "reset_to_starter")}
                                disabled={fixingUser === issue.userId}
                              >
                                Reset
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p className="font-medium">All subscriptions are in sync!</p>
                    <p className="text-sm text-muted-foreground mt-1">No discrepancies found between local DB and Stripe.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Subscribers Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={usersSearch}
                onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(0); }}
                className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex gap-2">
              {["all", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"].map((plan) => (
                <button
                  key={plan}
                  onClick={() => { setUsersFilter(plan); setUsersPage(0); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    usersFilter === plan
                      ? plan === "all"
                        ? "bg-orange-500/20 text-orange-400"
                        : planColors[plan]
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {plan === "all" ? "All" : plan}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Credits</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Expires</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const days = daysUntil(user.planExpiresAt);
                    const isExpired = days !== null && days < 0;
                    const isExpiring = days !== null && days >= 0 && days <= 7;

                    return (
                      <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-gradient-to-br from-violet-500 to-blue-500 text-white">
                                {user.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{user.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={planColors[user.plan] || "bg-gray-500/20 text-gray-400"}>
                            {user.plan === "STARTER" && <Shield className="h-3 w-3 mr-1" />}
                            {user.plan === "PRO" && <Crown className="h-3 w-3 mr-1" />}
                            {user.plan === "BUSINESS" && <Zap className="h-3 w-3 mr-1" />}
                            {user.plan}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="font-mono">{user.aiCredits.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {user.planExpiresAt ? (
                            <span className={isExpired ? "text-red-400" : isExpiring ? "text-amber-400" : ""}>
                              {formatDate(user.planExpiresAt)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {isExpired ? (
                            <Badge variant="outline" className="text-red-400 border-red-500/30">
                              <XCircle className="h-3 w-3 mr-1" /> Expired
                            </Badge>
                          ) : isExpiring ? (
                            <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                              <Clock className="h-3 w-3 mr-1" /> {days}d left
                            </Badge>
                          ) : user.plan !== "STARTER" ? (
                            <Badge variant="outline" className="text-green-400 border-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Free</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
                          {formatDate(user.lastLoginAt)}
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {usersTotal > 20 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing {usersPage * 20 + 1}–{Math.min((usersPage + 1) * 20, usersTotal)} of {usersTotal}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUsersPage((p) => Math.max(0, p - 1))}
                  disabled={usersPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUsersPage((p) => p + 1)}
                  disabled={(usersPage + 1) * 20 >= usersTotal}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
