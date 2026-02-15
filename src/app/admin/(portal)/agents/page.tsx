"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ShieldOff,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Users,
  DollarSign,
  Star,
  ChevronDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AgentProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  specialties: string;
  industries: string;
  portfolioUrls: string;
  minPricePerMonth: number;
  status: string;
  approvedAt: string | null;
  rejectedReason: string | null;
  performanceScore: number;
  totalEarningsCents: number;
  clientCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    plan: string;
  };
  _count: {
    clients: number;
    warnings: number;
  };
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-500",
  APPROVED: "bg-green-500/20 text-green-500",
  REJECTED: "bg-red-500/20 text-red-500",
  SUSPENDED: "bg-gray-500/20 text-gray-400",
};

const statusIcons: Record<string, typeof Clock> = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
  SUSPENDED: ShieldOff,
};

export default function AdminAgentsPage() {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState<{ profileId: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Detail expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchProfiles = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/admin/agents?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch agents");
      }

      setProfiles(data.data.profiles);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [statusFilter]);

  const handleAction = async (profileId: string, action: "approve" | "reject" | "suspend", reason?: string) => {
    setActionLoading(profileId);
    try {
      const response = await fetch("/api/admin/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, action, reason }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Action failed");
      }

      setRejectModal(null);
      setRejectReason("");
      fetchProfiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  const parseJson = (json: string): string[] => {
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  // Filter by search
  const filteredProfiles = profiles.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      p.user.name.toLowerCase().includes(q) ||
      p.user.email.toLowerCase().includes(q)
    );
  });

  // Stats
  const stats = {
    total: profiles.length,
    pending: profiles.filter((p) => p.status === "PENDING").length,
    approved: profiles.filter((p) => p.status === "APPROVED").length,
    suspended: profiles.filter((p) => p.status === "SUSPENDED").length,
  };

  if (error && !profiles.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4">{error}</p>
          <Button onClick={() => fetchProfiles()} variant="outline">
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
            <Briefcase className="w-7 h-7 text-violet-500" />
            Agent Management
          </h1>
          <p className="mt-1 text-muted-foreground">
            Review and manage marketplace agent applications
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchProfiles(true)}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-12 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats.total}</p>
              )}
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-12 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats.pending}</p>
              )}
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-12 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats.approved}</p>
              )}
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
              <ShieldOff className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              {isLoading ? (
                <div className="h-8 w-12 rounded animate-pulse bg-muted" />
              ) : (
                <p className="text-2xl font-bold">{stats.suspended}</p>
              )}
              <p className="text-xs text-muted-foreground">Suspended</p>
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
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-violet-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-violet-500 bg-muted/50 border-input text-foreground"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Agents List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No agent applications found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredProfiles.map((profile) => {
                const StatusIcon = statusIcons[profile.status] || Clock;
                const specialties = parseJson(profile.specialties);
                const industries = parseJson(profile.industries);
                const isExpanded = expandedId === profile.id;

                return (
                  <motion.div
                    key={profile.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Main row */}
                    <div className="p-4 flex items-center gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={profile.user.avatarUrl || undefined} />
                        <AvatarFallback className="text-sm bg-violet-500/20 text-violet-500">
                          {profile.displayName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{profile.displayName}</p>
                          <Badge className={statusColors[profile.status]}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {profile.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {profile.user.name} &bull; {profile.user.email}
                        </p>
                      </div>

                      <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1" title="Min. Price/Month">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>{formatPrice(profile.minPricePerMonth)}/mo</span>
                        </div>
                        <div className="flex items-center gap-1" title="Clients">
                          <Users className="w-3.5 h-3.5" />
                          <span>{profile._count.clients}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Performance">
                          <Star className="w-3.5 h-3.5" />
                          <span>{profile.performanceScore}%</span>
                        </div>
                        <span className="text-xs">{formatDate(profile.createdAt)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {profile.status === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleAction(profile.id, "approve")}
                              disabled={actionLoading === profile.id}
                            >
                              {actionLoading === profile.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRejectModal({ profileId: profile.id, name: profile.displayName })}
                              disabled={actionLoading === profile.id}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {profile.status === "APPROVED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => handleAction(profile.id, "suspend")}
                            disabled={actionLoading === profile.id}
                          >
                            {actionLoading === profile.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <ShieldOff className="w-3.5 h-3.5 mr-1" />
                                Suspend
                              </>
                            )}
                          </Button>
                        )}
                        {profile.status === "SUSPENDED" && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleAction(profile.id, "approve")}
                            disabled={actionLoading === profile.id}
                          >
                            {actionLoading === profile.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                Reinstate
                              </>
                            )}
                          </Button>
                        )}
                        {profile.status === "REJECTED" && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleAction(profile.id, "approve")}
                            disabled={actionLoading === profile.id}
                          >
                            {actionLoading === profile.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(isExpanded ? null : profile.id)}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 pb-4 border-t border-border/50 bg-muted/20"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                          {/* Bio */}
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Bio</h4>
                            <p className="text-sm">{profile.bio || "No bio provided"}</p>
                          </div>

                          {/* Specialties & Industries */}
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Specialties</h4>
                              <div className="flex flex-wrap gap-1">
                                {specialties.length > 0 ? specialties.map((s) => (
                                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                                )) : (
                                  <span className="text-xs text-muted-foreground">None listed</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Industries</h4>
                              <div className="flex flex-wrap gap-1">
                                {industries.length > 0 ? industries.map((i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{i}</Badge>
                                )) : (
                                  <span className="text-xs text-muted-foreground">None listed</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Stats & Info */}
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Min. Price</span>
                              <span className="font-medium">{formatPrice(profile.minPricePerMonth)}/month</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Clients</span>
                              <span className="font-medium">{profile._count.clients}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Warnings</span>
                              <span className={`font-medium ${profile._count.warnings > 0 ? "text-red-500" : ""}`}>
                                {profile._count.warnings}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Earnings</span>
                              <span className="font-medium">{formatPrice(profile.totalEarningsCents)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Performance</span>
                              <span className="font-medium">{profile.performanceScore}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Applied</span>
                              <span className="font-medium">{formatDate(profile.createdAt)}</span>
                            </div>
                            {profile.approvedAt && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Approved</span>
                                <span className="font-medium">{formatDate(profile.approvedAt)}</span>
                              </div>
                            )}
                            {profile.rejectedReason && (
                              <div className="mt-2 p-2 rounded bg-red-500/10 text-red-500 text-xs">
                                <strong>Rejection reason:</strong> {profile.rejectedReason}
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">User Plan</span>
                              <span className="font-medium">{profile.user.plan}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Reject Application</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Rejecting <strong>{rejectModal.name}</strong>&apos;s agent application. Please provide a reason.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="w-full p-3 border border-input rounded-lg text-sm bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleAction(rejectModal.profileId, "reject", rejectReason)}
                disabled={!rejectReason.trim() || actionLoading === rejectModal.profileId}
              >
                {actionLoading === rejectModal.profileId ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Reject Application
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
