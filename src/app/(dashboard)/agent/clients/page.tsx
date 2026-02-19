"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Briefcase,
  Users,
  AlertTriangle,
  DollarSign,
  Search,
  LogIn,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  TrendingUp,
  Bell,
  Shield,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ClientUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  plan: string;
  createdAt: string;
}

interface ClientStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  performanceScore: number;
  activityStatus: "on_time" | "late" | "needs_attention";
  lastActivity: string;
}

interface AgentClient {
  id: string;
  status: string;
  monthlyPriceCents: number;
  startDate: string;
  clientUser: ClientUser;
  stats: ClientStats;
}

interface PendingRequest {
  id: string;
  clientUser: ClientUser;
  monthlyPriceCents: number;
  message: string | null;
  createdAt: string;
}

interface Summary {
  totalClients: number;
  activeClients: number;
  pendingCount: number;
  needsAttention: number;
  monthlyRevenue: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function getStatusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    case "PENDING":
      return "bg-amber-500/10 text-amber-600 border-amber-200";
    case "PAUSED":
      return "bg-orange-500/10 text-orange-600 border-orange-200";
    case "TERMINATED":
      return "bg-red-500/10 text-red-600 border-red-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getActivityIcon(status: "on_time" | "late" | "needs_attention") {
  switch (status) {
    case "on_time":
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case "late":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "needs_attention":
      return <Clock className="h-4 w-4 text-amber-500" />;
  }
}

function getActivityLabel(status: "on_time" | "late" | "needs_attention") {
  switch (status) {
    case "on_time":
      return "On Track";
    case "late":
      return "Late";
    case "needs_attention":
      return "Needs Attention";
  }
}

export default function AgentClientsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<AgentClient[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("startDate");
  const [search, setSearch] = useState("");
  const [impersonateDialog, setImpersonateDialog] = useState<AgentClient | null>(null);
  const [impersonateReason, setImpersonateReason] = useState("");
  const [isImpersonating, setIsImpersonating] = useState(false);

  // Accept/Reject dialog
  const [respondDialog, setRespondDialog] = useState<{ request: PendingRequest; action: "accept" | "reject" } | null>(null);
  const [respondAgreed, setRespondAgreed] = useState(false);
  const [isResponding, setIsResponding] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (sortBy) params.set("sort", sortBy);

      const res = await fetch(`/api/agent/clients?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setClients(data.data.clients);
        setPendingRequests(data.data.pendingRequests || []);
        setSummary(data.data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search, sortBy]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleImpersonate = async () => {
    if (!impersonateDialog) return;
    setIsImpersonating(true);
    try {
      const res = await fetch("/api/agent/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: impersonateDialog.id,
          reason: impersonateReason || "Managing client account",
        }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.data.redirectUrl || "/dashboard";
      }
    } catch (error) {
      console.error("Failed to start impersonation:", error);
    } finally {
      setIsImpersonating(false);
      setImpersonateDialog(null);
      setImpersonateReason("");
    }
  };

  const handleRespondToRequest = async () => {
    if (!respondDialog) return;
    if (respondDialog.action === "accept" && !respondAgreed) return;
    setIsResponding(true);
    try {
      const res = await fetch("/api/marketplace/hire/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: respondDialog.request.id,
          action: respondDialog.action,
          agreedToTerms: respondDialog.action === "accept" ? true : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: respondDialog.action === "accept" ? "Client Accepted" : "Request Declined",
          description: data.data.message,
        });
        setRespondDialog(null);
        setRespondAgreed(false);
        fetchClients();
      } else {
        toast({ title: "Error", description: data.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    }
    setIsResponding(false);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Clients</h1>
              <p className="text-sm text-muted-foreground">
                {summary?.totalClients || 0} total clients
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      {summary && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-brand-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalClients}</p>
                  <p className="text-xs text-muted-foreground">Total Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.activeClients}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.needsAttention}</p>
                  <p className="text-xs text-muted-foreground">Needs Attention</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary.monthlyRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">Monthly Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="TERMINATED">Terminated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="startDate">Start Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="price">Price</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-sm">
              Pending Hire Requests ({pendingRequests.length})
            </h2>
          </div>
          {pendingRequests.map((req, index) => (
            <motion.div
              key={req.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: index * 0.05 }}
            >
              <Card className="border-amber-200/50 bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="shrink-0">
                      {req.clientUser.avatarUrl ? (
                        <img src={req.clientUser.avatarUrl} alt={req.clientUser.name} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <span className="text-lg font-semibold text-amber-600">
                            {req.clientUser.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold truncate">{req.clientUser.name}</span>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                          PENDING
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{req.clientUser.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatCurrency(req.monthlyPriceCents)}/mo</span>
                        <span className="capitalize">{req.clientUser.plan} plan</span>
                        <span>Requested {formatDate(req.createdAt)}</span>
                      </div>
                      {req.message && (
                        <div className="mt-2 p-2 rounded bg-white/50 dark:bg-white/5 border text-sm">
                          <div className="flex items-start gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{req.message}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => setRespondDialog({ request: req, action: "reject" })}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setRespondDialog({ request: req, action: "accept" })}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Client List */}
      <div className="space-y-3">
        {clients.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No clients yet</h3>
              <p className="text-sm text-muted-foreground">
                Your client list will appear here once clients subscribe to your services.
              </p>
            </CardContent>
          </Card>
        ) : (
          clients.map((client, index) => (
            <motion.div
              key={client.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="shrink-0">
                      {client.clientUser.avatarUrl ? (
                        <img
                          src={client.clientUser.avatarUrl}
                          alt={client.clientUser.name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-brand-500/10 flex items-center justify-center">
                          <span className="text-lg font-semibold text-brand-500">
                            {client.clientUser.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link
                          href={`/agent/clients/${client.id}`}
                          className="font-semibold text-foreground hover:text-brand-500 transition-colors truncate"
                        >
                          {client.clientUser.name}
                        </Link>
                        <Badge
                          variant="outline"
                          className={getStatusColor(client.status)}
                        >
                          {client.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {client.clientUser.email}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Since {formatDate(client.startDate)}</span>
                        <span>{formatCurrency(client.monthlyPriceCents)}/mo</span>
                        <span className="capitalize">{client.clientUser.plan} plan</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden lg:flex items-center gap-6">
                      {/* Performance Score */}
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            {client.stats.performanceScore}%
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Performance</p>
                      </div>

                      {/* Tasks */}
                      <div className="text-center">
                        <p className="text-sm font-semibold">
                          {client.stats.completedTasks}/{client.stats.totalTasks}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Tasks Done</p>
                      </div>

                      {/* Activity Status */}
                      <div className="flex items-center gap-1.5">
                        {getActivityIcon(client.stats.activityStatus)}
                        <div>
                          <p className="text-xs font-medium">
                            {getActivityLabel(client.stats.activityStatus)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {timeAgo(client.stats.lastActivity)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/agent/clients/${client.id}`}>
                          View Details
                        </Link>
                      </Button>
                      {client.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-700"
                          onClick={() => setImpersonateDialog(client)}
                        >
                          <LogIn className="h-4 w-4 mr-1" />
                          Login as Client
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Impersonation Confirmation Dialog */}
      <Dialog
        open={!!impersonateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setImpersonateDialog(null);
            setImpersonateReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login as Client</DialogTitle>
            <DialogDescription>
              You are about to start managing{" "}
              <strong>{impersonateDialog?.clientUser.name}</strong>&apos;s account.
              A banner will be displayed showing you are in Agent Mode.
              Financial actions (purchases, withdrawals) will be restricted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <label className="text-sm font-medium">
                Reason for login (optional)
              </label>
              <Input
                value={impersonateReason}
                onChange={(e) => setImpersonateReason(e.target.value)}
                placeholder="e.g., Creating weekly content posts"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImpersonateDialog(null);
                setImpersonateReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={handleImpersonate}
              disabled={isImpersonating}
            >
              {isImpersonating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting Session...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Start Agent Session
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept/Reject Request Dialog */}
      <Dialog
        open={!!respondDialog}
        onOpenChange={(open) => {
          if (!open) {
            setRespondDialog(null);
            setRespondAgreed(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {respondDialog?.action === "accept" ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  Accept Client
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Decline Request
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {respondDialog && (
            <div className="space-y-4">
              {/* Client info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {respondDialog.request.clientUser.avatarUrl ? (
                  <img src={respondDialog.request.clientUser.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-brand-500/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-brand-500">
                      {respondDialog.request.clientUser.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium">{respondDialog.request.clientUser.name}</p>
                  <p className="text-xs text-muted-foreground">{respondDialog.request.clientUser.email} &middot; {respondDialog.request.clientUser.plan} plan</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="font-semibold">{formatCurrency(respondDialog.request.monthlyPriceCents)}/mo</p>
                </div>
              </div>

              {respondDialog.request.message && (
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Client&apos;s Message:</p>
                  <p className="text-sm">{respondDialog.request.message}</p>
                </div>
              )}

              {respondDialog.action === "accept" ? (
                <>
                  {/* Service Agreement for agent */}
                  <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-500" />
                      Agent Service Agreement
                    </h4>
                    <div className="text-xs text-muted-foreground space-y-2 max-h-40 overflow-y-auto pr-2">
                      <p><strong>1. Account Access & Responsibilities</strong><br />
                      By accepting this client, you agree to manage their FlowSmartly account professionally and in accordance with their marketing goals. You may create, edit, and schedule content, manage campaigns, and perform marketing tasks on their behalf.</p>
                      <p><strong>2. Financial Restrictions</strong><br />
                      You are prohibited from making purchases, changing billing, or accessing the client&apos;s financial settings. All financial actions are restricted to the account owner.</p>
                      <p><strong>3. Content Ownership</strong><br />
                      All content created for the client belongs to the client. You retain no rights to their account data, content, or intellectual property.</p>
                      <p><strong>4. Performance Standards</strong><br />
                      FlowSmartly monitors agent performance. Repeated poor performance, inactivity, or violations may result in warnings, suspension, or removal from the marketplace.</p>
                      <p><strong>5. Payment</strong><br />
                      You will receive the agreed monthly rate ({formatCurrency(respondDialog.request.monthlyPriceCents)}/mo) for managing this client&apos;s account. FlowSmartly does not charge a platform fee on agent earnings.</p>
                      <p><strong>6. Termination</strong><br />
                      Either party may end the relationship at any time. Upon termination, all access to the client&apos;s account is immediately revoked.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="accept-agree"
                      checked={respondAgreed}
                      onCheckedChange={(checked) => setRespondAgreed(checked === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="accept-agree" className="text-sm leading-relaxed cursor-pointer">
                      I have read and agree to the Agent Service Agreement. I commit to managing this client&apos;s account professionally and adhering to all platform guidelines.
                    </Label>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to decline this hire request from <strong>{respondDialog.request.clientUser.name}</strong>? They will be notified that their request was declined.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setRespondDialog(null); setRespondAgreed(false); }}>
              Cancel
            </Button>
            {respondDialog?.action === "accept" ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleRespondToRequest}
                disabled={!respondAgreed || isResponding}
              >
                {isResponding ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Accepting...</>
                ) : (
                  <><CheckCircle className="h-4 w-4 mr-2" />Accept & Sign Agreement</>
                )}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleRespondToRequest}
                disabled={isResponding}
              >
                {isResponding ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Declining...</>
                ) : (
                  <><XCircle className="h-4 w-4 mr-2" />Decline Request</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
