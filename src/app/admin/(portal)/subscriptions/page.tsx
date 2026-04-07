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
  ChevronLeft,
  ChevronRight,
  Zap,
  Crown,
  Shield,
  Clock,
  TrendingUp,
  ShoppingBag,
  MapPin,
  Globe,
  Gift,
  DollarSign,
  ArrowLeft,
  Ban,
  RotateCcw,
  CalendarPlus,
  ArrowUpDown,
  Receipt,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Non-subscriber roles
const FREE_ROLES = ["STARTER", "ADMIN", "SUPER_ADMIN", "AGENT"];

type TabId = "overview" | "plans" | "flowshop" | "listsmartly" | "domains" | "referrals";

interface Stats {
  totalUsers: number;
  freeUsers: number;
  paidPlanUsers: number;
  expiringIn7Days: number;
  expiredNotReset: number;
  flowshop: { active: number; trialing: number; pastDue: number };
  listsmartly: { active: number; trialing: number };
  domains: { active: number };
  referrals: { active: number; pendingCommissions: number };
}

interface UserDetail {
  user: {
    id: string; email: string; name: string; plan: string; aiCredits: number;
    freeCredits: number; balanceCents: number; planExpiresAt: string | null;
    stripeCustomerId: string | null; lastLoginAt: string | null; createdAt: string;
    referralCode: string | null;
  };
  store: {
    id: string; name: string; ecomPlan: string; ecomSubscriptionId: string | null;
    ecomSubscriptionStatus: string; freeTrialEndsAt: string | null; freeDomainClaimed: boolean;
    isActive: boolean; productCount: number; orderCount: number; totalRevenueCents: number;
  } | null;
  listsmartly: {
    id: string; businessName: string; lsPlan: string; lsSubscriptionId: string | null;
    lsSubscriptionStatus: string; freeTrialEndsAt: string | null; totalListings: number;
    liveListings: number; citationScore: number;
  } | null;
  domains: Array<{
    id: string; domainName: string; tld: string; registrarStatus: string;
    isFree: boolean; purchasePriceCents: number; autoRenew: boolean; expiresAt: string | null;
  }>;
  referralsMade: Array<{ id: string; referralCode: string; status: string; commissionRate: number; referred: { email: string; name: string }; createdAt: string }>;
  referredBy: { referralCode: string; referrer: { email: string; name: string } } | null;
  commissions: Array<{ id: string; amountCents: number; sourceType: string; status: string; createdAt: string }>;
  recentTransactions: Array<{ id: string; type: string; amount: number; balanceAfter: number; description: string | null; createdAt: string }>;
}

const planColors: Record<string, string> = {
  STARTER: "bg-gray-500/20 text-gray-400",
  PRO: "bg-violet-500/20 text-violet-400",
  BUSINESS: "bg-blue-500/20 text-blue-400",
  ENTERPRISE: "bg-amber-500/20 text-amber-400",
  NON_PROFIT: "bg-emerald-500/20 text-emerald-400",
  ADMIN: "bg-red-500/20 text-red-400",
  SUPER_ADMIN: "bg-red-500/20 text-red-400",
  AGENT: "bg-pink-500/20 text-pink-400",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  trialing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  inactive: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  past_due: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export default function AdminSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // List state
  const [items, setItems] = useState<unknown[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // User detail
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Actions
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modals
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [newPlan, setNewPlan] = useState("");
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/subscriptions?view=stats");
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const viewMap: Record<TabId, string> = {
      overview: "", plans: "users", flowshop: "flowshop",
      listsmartly: "listsmartly", domains: "domains", referrals: "referrals",
    };
    const view = viewMap[activeTab];
    if (!view) { setLoading(false); return; }

    const params = new URLSearchParams({ view, limit: "20", offset: String(page * 20) });
    if (search) params.set("search", search);
    if (filter !== "all") params.set(activeTab === "plans" ? "plan" : "status", filter);

    try {
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        setItems(d.users || d.stores || d.profiles || d.domains || d.referrals || []);
        setItemsTotal(d.total || d.totalReferrals || 0);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [activeTab, page, search, filter]);

  const loadUserDetail = async (userId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions?view=user-detail&userId=${userId}`);
      const data = await res.json();
      if (data.success) setSelectedUser(data.data);
    } catch { /* silent */ }
    finally { setDetailLoading(false); }
  };

  const runAction = async (action: string, userId: string, extra: Record<string, unknown> = {}) => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, ...extra }),
      });
      const data = await res.json();
      setActionMessage(data.success ? data.message : `Error: ${data.error}`);
      if (data.success) {
        loadStats();
        if (selectedUser) loadUserDetail(userId);
      }
    } catch { setActionMessage("Action failed"); }
    finally { setActionLoading(false); }
  };

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    if (activeTab !== "overview" && !selectedUser) loadItems();
  }, [activeTab, loadItems, selectedUser]);

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "plans", label: "Platform Plans", icon: CreditCard, count: stats?.paidPlanUsers },
    { id: "flowshop", label: "FlowShop", icon: ShoppingBag, count: stats ? stats.flowshop.active + stats.flowshop.trialing : undefined },
    { id: "listsmartly", label: "ListSmartly", icon: MapPin, count: stats ? stats.listsmartly.active + stats.listsmartly.trialing : undefined },
    { id: "domains", label: "Domains", icon: Globe, count: stats?.domains.active },
    { id: "referrals", label: "Referrals", icon: Gift, count: stats?.referrals.active },
  ];

  // ── User Detail View ──
  if (selectedUser) {
    const u = selectedUser.user;
    const isPaid = !FREE_ROLES.includes(u.plan);

    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to list
        </button>

        {/* Action message */}
        {actionMessage && (
          <div className={`p-3 rounded-lg text-sm ${actionMessage.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
            {actionMessage}
            <button onClick={() => setActionMessage(null)} className="float-right"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* User Header */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="text-lg bg-gradient-to-br from-violet-500 to-blue-500 text-white">{u.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold">{u.name}</h2>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={planColors[u.plan] || "bg-gray-500/20"}>{u.plan}</Badge>
                    {u.stripeCustomerId && <Badge variant="outline" className="text-[10px]">Stripe Connected</Badge>}
                    {u.referralCode && <Badge variant="outline" className="text-[10px]">Ref: {u.referralCode}</Badge>}
                  </div>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Credits: <span className="font-semibold text-foreground">{u.aiCredits.toLocaleString()}</span></p>
                <p>Balance: <span className="font-semibold text-foreground">${(u.balanceCents / 100).toFixed(2)}</span></p>
                <p>Joined: {formatDate(u.createdAt)}</p>
                <p>Last login: {formatDate(u.lastLoginAt)}</p>
              </div>
            </div>

            {/* Admin Actions */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
              <Button size="sm" variant="outline" onClick={() => { setNewPlan(u.plan); setShowPlanModal(true); }} disabled={actionLoading}>
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Change Plan
              </Button>
              {isPaid && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setShowExtendModal(true)} disabled={actionLoading}>
                    <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Extend
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-400 hover:text-red-300" onClick={() => runAction("cancel_subscription", u.id, { product: "platform" })} disabled={actionLoading}>
                    <Ban className="h-3.5 w-3.5 mr-1" /> Cancel Sub
                  </Button>
                </>
              )}
              {u.stripeCustomerId && (
                <Button size="sm" variant="outline" onClick={() => setShowRefundModal(true)} disabled={actionLoading}>
                  <Receipt className="h-3.5 w-3.5 mr-1" /> Refund
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan Change Modal */}
        {showPlanModal && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3">Change Platform Plan</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {["STARTER", "NON_PROFIT", "PRO", "BUSINESS", "ENTERPRISE"].map((p) => (
                  <button key={p} onClick={() => setNewPlan(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${newPlan === p ? planColors[p] || "bg-orange-500/20 text-orange-400" : "bg-muted text-muted-foreground"}`}
                  >{p}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { runAction("change_plan", u.id, { plan: newPlan }); setShowPlanModal(false); }} disabled={actionLoading}>Apply</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowPlanModal(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extend Modal */}
        {showExtendModal && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3">Extend Plan Duration</h3>
              <div className="flex items-center gap-3 mb-3">
                <input type="number" value={extendDays} onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                  className="w-24 px-3 py-1.5 rounded-lg border bg-background text-sm" min={1} />
                <span className="text-sm text-muted-foreground">days</span>
                <div className="flex gap-1">
                  {[7, 14, 30, 90].map((d) => (
                    <button key={d} onClick={() => setExtendDays(d)} className="px-2 py-1 rounded text-xs bg-muted hover:bg-accent">{d}d</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { runAction("extend_plan", u.id, { days: extendDays }); setShowExtendModal(false); }}>Extend</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowExtendModal(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Refund Modal */}
        {showRefundModal && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3">Issue Stripe Refund</h3>
              <p className="text-xs text-muted-foreground mb-3">Leave amount empty for full refund of last charge.</p>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm">$</span>
                <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="Full refund" className="w-32 px-3 py-1.5 rounded-lg border bg-background text-sm" min={0} step={0.01} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => {
                  const cents = refundAmount ? Math.round(parseFloat(refundAmount) * 100) : undefined;
                  runAction("refund", u.id, { amountCents: cents });
                  setShowRefundModal(false); setRefundAmount("");
                }}>Issue Refund</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowRefundModal(false); setRefundAmount(""); }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscriptions Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* FlowShop */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-pink-400" /> FlowShop</h3>
                {selectedUser.store ? (
                  <Badge variant="outline" className={statusColors[selectedUser.store.ecomSubscriptionStatus] || ""}>{selectedUser.store.ecomSubscriptionStatus}</Badge>
                ) : <Badge variant="outline" className="text-gray-400">None</Badge>}
              </div>
              {selectedUser.store ? (
                <>
                  <div className="space-y-1.5 text-sm">
                    <p>Store: <span className="font-medium">{selectedUser.store.name}</span></p>
                    <p>Plan: <Badge className={selectedUser.store.ecomPlan === "pro" ? "bg-violet-500/20 text-violet-400" : "bg-gray-500/20 text-gray-400"}>{selectedUser.store.ecomPlan}</Badge></p>
                    <p>Products: {selectedUser.store.productCount} | Orders: {selectedUser.store.orderCount}</p>
                    <p>Revenue: <span className="font-semibold text-green-400">${(selectedUser.store.totalRevenueCents / 100).toFixed(2)}</span></p>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    {selectedUser.store.ecomSubscriptionStatus === "active" && (
                      <Button size="sm" variant="outline" className="text-red-400 text-xs" onClick={() => runAction("cancel_subscription", u.id, { product: "flowshop" })} disabled={actionLoading}>Cancel</Button>
                    )}
                    {(selectedUser.store.ecomSubscriptionStatus === "cancelled" || selectedUser.store.ecomSubscriptionStatus === "inactive") && (
                      <Button size="sm" variant="outline" className="text-green-400 text-xs" onClick={() => runAction("reactivate", u.id, { product: "flowshop" })} disabled={actionLoading}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Reactivate
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => runAction("change_flowshop_plan", u.id, { plan: selectedUser.store!.ecomPlan === "pro" ? "basic" : "pro" })} disabled={actionLoading}>
                      Switch to {selectedUser.store.ecomPlan === "pro" ? "Basic" : "Pro"}
                    </Button>
                  </div>
                </>
              ) : <p className="text-xs text-muted-foreground">No FlowShop store</p>}
            </CardContent>
          </Card>

          {/* ListSmartly */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-400" /> ListSmartly</h3>
                {selectedUser.listsmartly ? (
                  <Badge variant="outline" className={statusColors[selectedUser.listsmartly.lsSubscriptionStatus] || ""}>{selectedUser.listsmartly.lsSubscriptionStatus}</Badge>
                ) : <Badge variant="outline" className="text-gray-400">None</Badge>}
              </div>
              {selectedUser.listsmartly ? (
                <>
                  <div className="space-y-1.5 text-sm">
                    <p>Business: <span className="font-medium">{selectedUser.listsmartly.businessName}</span></p>
                    <p>Plan: <Badge className={selectedUser.listsmartly.lsPlan === "pro" ? "bg-violet-500/20 text-violet-400" : "bg-gray-500/20 text-gray-400"}>{selectedUser.listsmartly.lsPlan}</Badge></p>
                    <p>Listings: {selectedUser.listsmartly.liveListings}/{selectedUser.listsmartly.totalListings}</p>
                    <p>Citation Score: <span className="font-semibold">{selectedUser.listsmartly.citationScore}%</span></p>
                    {selectedUser.listsmartly.freeTrialEndsAt && (
                      <p>Trial ends: {formatDate(selectedUser.listsmartly.freeTrialEndsAt)}</p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    {selectedUser.listsmartly.lsSubscriptionStatus === "active" && (
                      <Button size="sm" variant="outline" className="text-red-400 text-xs" onClick={() => runAction("cancel_subscription", u.id, { product: "listsmartly" })} disabled={actionLoading}>Cancel</Button>
                    )}
                    {(selectedUser.listsmartly.lsSubscriptionStatus === "cancelled" || selectedUser.listsmartly.lsSubscriptionStatus === "inactive") && (
                      <Button size="sm" variant="outline" className="text-green-400 text-xs" onClick={() => runAction("reactivate", u.id, { product: "listsmartly" })} disabled={actionLoading}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Reactivate
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => runAction("change_listsmartly_plan", u.id, { plan: selectedUser.listsmartly!.lsPlan === "pro" ? "basic" : "pro" })} disabled={actionLoading}>
                      Switch to {selectedUser.listsmartly.lsPlan === "pro" ? "Basic" : "Pro"}
                    </Button>
                  </div>
                </>
              ) : <p className="text-xs text-muted-foreground">No ListSmartly profile</p>}
            </CardContent>
          </Card>
        </div>

        {/* Domains */}
        {selectedUser.domains.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><Globe className="h-4 w-4 text-cyan-400" /> Domains ({selectedUser.domains.length})</h3>
              <div className="space-y-2">
                {selectedUser.domains.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">{d.domainName}</span>
                      <Badge variant="outline" className={statusColors[d.registrarStatus] || ""}>{d.registrarStatus}</Badge>
                      {d.isFree && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">FREE</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.autoRenew ? "Auto-renew" : "Manual"} • Expires {formatDate(d.expiresAt)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Referrals */}
        {(selectedUser.referralsMade.length > 0 || selectedUser.referredBy) && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><Gift className="h-4 w-4 text-pink-400" /> Referrals</h3>
              {selectedUser.referredBy && (
                <p className="text-sm mb-3">Referred by: <span className="font-medium">{selectedUser.referredBy.referrer.name}</span> ({selectedUser.referredBy.referrer.email})</p>
              )}
              {selectedUser.referralsMade.length > 0 && (
                <div className="space-y-1.5">
                  {selectedUser.referralsMade.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                      <span>{r.referred.name} ({r.referred.email})</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{(r.commissionRate * 100)}%</span>
                        <Badge variant="outline" className={r.status === "ACTIVE" ? "text-green-400" : "text-gray-400"}>{r.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedUser.commissions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Commissions</h4>
                  {selectedUser.commissions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm py-1">
                      <span>${(c.amountCents / 100).toFixed(2)} ({c.sourceType})</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={c.status === "PAID" ? "text-green-400" : "text-amber-400"}>{c.status}</Badge>
                        {c.status === "PENDING" && (
                          <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => runAction("approve_commission", u.id, { commissionId: c.id })} disabled={actionLoading}>
                            Pay
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Transactions */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><DollarSign className="h-4 w-4 text-green-400" /> Recent Credit Transactions</h3>
            <div className="space-y-1">
              {selectedUser.recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                    <span className="text-muted-foreground truncate max-w-[200px]">{t.description || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono ${t.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                      {t.amount > 0 ? "+" : ""}{t.amount}
                    </span>
                    <span className="text-muted-foreground w-16 text-right">{formatDate(t.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main List View ──
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-orange-500" />
          Subscription Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">All subscriptions across platform plans, FlowShop, ListSmartly, domains, and referrals</p>
      </div>

      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card><CardContent className="pt-3 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Paid Plans</div>
            <div className="text-xl font-bold text-violet-400">{stats.paidPlanUsers}</div>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">FlowShop</div>
            <div className="text-xl font-bold text-pink-400">{stats.flowshop.active}<span className="text-xs text-muted-foreground ml-1">+{stats.flowshop.trialing} trial</span></div>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">ListSmartly</div>
            <div className="text-xl font-bold text-blue-400">{stats.listsmartly.active}<span className="text-xs text-muted-foreground ml-1">+{stats.listsmartly.trialing} trial</span></div>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Domains</div>
            <div className="text-xl font-bold text-cyan-400">{stats.domains.active}</div>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Expiring 7d</div>
            <div className="text-xl font-bold text-amber-400">{stats.expiringIn7Days}</div>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-400" />Past Due</div>
            <div className="text-xl font-bold text-red-400">{stats.flowshop.pastDue + stats.expiredNotReset}</div>
          </CardContent></Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(0); setFilter("all"); setSearch(""); }}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id ? "border-orange-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count !== undefined && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-muted text-[10px]">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && stats && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card><CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Platform Conversion</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Users</span><span className="font-semibold">{stats.totalUsers}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Free (Starter/Admin/Agent)</span><span>{stats.freeUsers}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid Subscribers</span><span className="text-green-400 font-semibold">{stats.paidPlanUsers}</span></div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div className="bg-gradient-to-r from-violet-500 to-blue-500 h-2 rounded-full" style={{ width: `${stats.totalUsers > 0 ? (stats.paidPlanUsers / stats.totalUsers) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-right">{stats.totalUsers > 0 ? ((stats.paidPlanUsers / stats.totalUsers) * 100).toFixed(1) : 0}% conversion</p>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Referral Program</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Active Referrals</span><span className="font-semibold">{stats.referrals.active}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pending Commissions</span><span className="text-amber-400 font-semibold">{stats.referrals.pendingCommissions}</span></div>
            </div>
          </CardContent></Card>

          {stats.expiredNotReset > 0 && (
            <Card className="md:col-span-2"><CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-semibold">{stats.expiredNotReset} expired subscription(s) not reset to STARTER</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Go to Platform Plans tab to find and fix these users, or run the Subscription cron job.</p>
            </CardContent></Card>
          )}
        </div>
      )}

      {/* List Tabs */}
      {activeTab !== "overview" && (
        <>
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {(activeTab === "plans" || activeTab === "referrals") && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search by name or email..." value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            )}
            <div className="flex gap-1 flex-wrap">
              {activeTab === "plans" && ["all", "paid", "STARTER", "PRO", "BUSINESS", "ENTERPRISE", "NON_PROFIT"].map((p) => (
                <button key={p} onClick={() => { setFilter(p); setPage(0); }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === p ? (planColors[p] || "bg-orange-500/20 text-orange-400") : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                  {p === "paid" ? "Paid Only" : p === "all" ? "All" : p}
                </button>
              ))}
              {(activeTab === "flowshop" || activeTab === "listsmartly") && ["all", "active", "trialing", "cancelled", "inactive", "past_due"].map((s) => (
                <button key={s} onClick={() => { setFilter(s); setPage(0); }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? (statusColors[s] || "bg-orange-500/20 text-orange-400") : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Plans Tab */}
              {activeTab === "plans" && (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Credits</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Expires</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr></thead>
                    <tbody>
                      {(items as UserDetail["user"][]).map((u: any) => {
                        const days = daysUntil(u.planExpiresAt);
                        const isExpired = days !== null && days < 0;
                        return (
                          <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-gradient-to-br from-violet-500 to-blue-500 text-white">{u.name?.charAt(0)}</AvatarFallback></Avatar>
                                <div><p className="font-medium truncate max-w-[180px]">{u.name}</p><p className="text-xs text-muted-foreground truncate max-w-[180px]">{u.email}</p></div>
                              </div>
                            </td>
                            <td className="px-4 py-3"><Badge className={planColors[u.plan] || "bg-gray-500/20"}>{u.plan}</Badge></td>
                            <td className="px-4 py-3 hidden md:table-cell font-mono">{u.aiCredits?.toLocaleString()}</td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {u.planExpiresAt ? (
                                <span className={isExpired ? "text-red-400" : days !== null && days <= 7 ? "text-amber-400" : ""}>
                                  {formatDate(u.planExpiresAt)}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Button size="sm" variant="ghost" onClick={() => loadUserDetail(u.id)}>
                                <Eye className="h-3.5 w-3.5 mr-1" /> Details
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* FlowShop Tab */}
              {activeTab === "flowshop" && (
                <div className="space-y-2">
                  {(items as any[]).map((s: any) => (
                    <Card key={s.id}><CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-pink-500/20"><ShoppingBag className="h-5 w-5 text-pink-400" /></div>
                        <div>
                          <p className="font-medium text-sm">{s.name} <Badge className={s.ecomPlan === "pro" ? "bg-violet-500/20 text-violet-400" : "bg-gray-500/20 text-gray-400"} >{s.ecomPlan}</Badge></p>
                          <p className="text-xs text-muted-foreground">{s.user?.email} • {s.productCount} products • ${(s.totalRevenueCents / 100).toFixed(2)} revenue</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusColors[s.ecomSubscriptionStatus] || ""}>{s.ecomSubscriptionStatus}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => loadUserDetail(s.user?.id)}><Eye className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent></Card>
                  ))}
                </div>
              )}

              {/* ListSmartly Tab */}
              {activeTab === "listsmartly" && (
                <div className="space-y-2">
                  {(items as any[]).map((p: any) => (
                    <Card key={p.id}><CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-blue-500/20"><MapPin className="h-5 w-5 text-blue-400" /></div>
                        <div>
                          <p className="font-medium text-sm">{p.businessName} <Badge className={p.lsPlan === "pro" ? "bg-violet-500/20 text-violet-400" : "bg-gray-500/20 text-gray-400"}>{p.lsPlan}</Badge></p>
                          <p className="text-xs text-muted-foreground">{p.user?.email} • {p.liveListings}/{p.totalListings} listings • Score: {p.citationScore}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusColors[p.lsSubscriptionStatus] || ""}>{p.lsSubscriptionStatus}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => loadUserDetail(p.user?.id)}><Eye className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent></Card>
                  ))}
                </div>
              )}

              {/* Domains Tab */}
              {activeTab === "domains" && (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Domain</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Owner</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Price</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Expires</th>
                    </tr></thead>
                    <tbody>
                      {(items as any[]).map((d: any) => (
                        <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono">{d.domainName} {d.isFree && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] ml-1">FREE</Badge>}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{d.user?.email}</td>
                          <td className="px-4 py-3 hidden md:table-cell"><Badge variant="outline" className={statusColors[d.registrarStatus] || ""}>{d.registrarStatus}</Badge></td>
                          <td className="px-4 py-3 hidden md:table-cell">${((d.purchasePriceCents || 0) / 100).toFixed(2)}/yr</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs">{formatDate(d.expiresAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Referrals Tab */}
              {activeTab === "referrals" && (
                <div className="space-y-2">
                  {(items as any[]).map((r: any) => (
                    <Card key={r.id}><CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-pink-500/20"><Gift className="h-5 w-5 text-pink-400" /></div>
                        <div>
                          <p className="text-sm"><span className="font-medium">{r.referrer?.name}</span> → <span className="font-medium">{r.referred?.name}</span></p>
                          <p className="text-xs text-muted-foreground">{r.referralType} • {(r.commissionRate * 100)}% {r.commissionType?.toLowerCase()} • Code: {r.referralCode}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={r.status === "ACTIVE" ? "text-green-400 border-green-500/30" : "text-gray-400"}>{r.status}</Badge>
                    </CardContent></Card>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {itemsTotal > 20 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {page * 20 + 1}–{Math.min((page + 1) * 20, itemsTotal)} of {itemsTotal}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * 20 >= itemsTotal}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}

              {items.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No items found</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {detailLoading && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}
    </div>
  );
}
