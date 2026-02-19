"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  Search,
  MoreHorizontal,
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
  Calendar,
  TrendingUp,
  Play,
  Pause,
  Edit2,
  BarChart3,
  Users,
  Zap,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type AdStatus = "active" | "paused" | "draft" | "completed" | "scheduled";

interface AdCampaign {
  id: string;
  name: string;
  status: AdStatus;
  objective: string;
  budget: number;
  spent: number;
  dailyBudget: number | null;
  costPerView: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  startDate: string;
  endDate: string | null;
  post: {
    id: string;
    caption: string;
    mediaUrl: string | null;
  } | null;
  createdAt: string;
}

interface AdStats {
  total: number;
  active: number;
  totalSpent: number;
  totalImpressions: number;
}

const statusConfig: Record<AdStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-500/10 text-green-500" },
  paused: { label: "Paused", color: "bg-yellow-500/10 text-yellow-500" },
  draft: { label: "Draft", color: "bg-gray-500/10 text-gray-500" },
  completed: { label: "Completed", color: "bg-blue-500/10 text-blue-500" },
  scheduled: { label: "Scheduled", color: "bg-purple-500/10 text-purple-500" },
};

export default function AdsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [stats, setStats] = useState<AdStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdCampaign | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/ads?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch campaigns");
      }

      setCampaigns(data.data.campaigns);
      setStats(data.data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/ads/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to update campaign");
      }

      // Refresh campaigns
      fetchCampaigns();
      toast({ title: `Campaign ${newStatus.toLowerCase()}` });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update campaign",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const campaignId = deleteTarget.id;
    setDeleteTarget(null);
    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/ads/${campaignId}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to delete campaign");
      fetchCampaigns();
      toast({ title: "Campaign deleted" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete campaign",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (campaign: AdCampaign) => {
    setActionLoading(campaign.id);
    try {
      const response = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${campaign.name} (Copy)`,
          objective: campaign.objective,
          budget: campaign.budget * 100 / 5, // Convert dollars back to credits
          costPerView: campaign.costPerView,
          startDate: new Date().toISOString().split("T")[0],
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to duplicate campaign");
      fetchCampaigns();
      toast({ title: "Campaign duplicated" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to duplicate campaign",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBudget = campaigns.reduce((acc, c) => acc + c.budget, 0);
  const totalSpent = stats?.totalSpent || 0;
  const totalImpressions = stats?.totalImpressions || 0;
  const totalConversions = campaigns.reduce((acc, c) => acc + c.conversions, 0);
  const avgCtr = campaigns.length > 0
    ? campaigns.reduce((acc, c) => acc + c.ctr, 0) / campaigns.length
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (error && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchCampaigns} variant="outline">
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
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-white" />
            </div>
            Ads Manager
          </h1>
        </div>
        <Button size="lg" asChild>
          <Link href="/ads/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Link>
        </Button>
      </div>

      {/* Stats Overview */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
                  <p className="text-xs text-muted-foreground">
                    of {formatCurrency(totalBudget)} budget
                  </p>
                </div>
              </div>
              {totalBudget > 0 && (
                <Progress
                  value={(totalSpent / totalBudget) * 100}
                  className="h-1.5 mt-3"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(totalImpressions)}</p>
                  <p className="text-xs text-muted-foreground">Total Impressions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <MousePointerClick className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgCtr.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Avg. CTR</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(totalConversions)}</p>
                  <p className="text-xs text-muted-foreground">Conversions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-brand-500/10 to-purple-500/5 border-brand-500/20 cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-brand-500" />
            </div>
            <div>
              <h3 className="font-semibold">Quick Boost</h3>
              <p className="text-sm text-muted-foreground">Promote your best post</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20 cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold">Audience Builder</h3>
              <p className="text-sm text-muted-foreground">Create target audiences</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20 cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold">Ad Insights</h3>
              <p className="text-sm text-muted-foreground">View detailed analytics</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-md border bg-background text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
              </select>
              <Button variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                Date Range
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign List */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            {filteredCampaigns.map((campaign, index) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="flex flex-col lg:flex-row">
                      {/* Campaign Info */}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">{campaign.name}</h3>
                              <Badge className={statusConfig[campaign.status]?.color || statusConfig.draft.color}>
                                {statusConfig[campaign.status]?.label || campaign.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Target className="w-3.5 h-3.5" />
                                {campaign.objective}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(campaign.startDate).toLocaleDateString()}
                                {campaign.endDate && ` - ${new Date(campaign.endDate).toLocaleDateString()}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {campaign.status === "active" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(campaign.id, "PAUSED")}
                                disabled={actionLoading === campaign.id}
                              >
                                {actionLoading === campaign.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Pause className="w-3.5 h-3.5 mr-1.5" />
                                    Pause
                                  </>
                                )}
                              </Button>
                            )}
                            {(campaign.status === "paused" || campaign.status === "draft") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(campaign.id, "ACTIVE")}
                                disabled={actionLoading === campaign.id}
                              >
                                {actionLoading === campaign.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5 mr-1.5" />
                                    {campaign.status === "draft" ? "Launch" : "Resume"}
                                  </>
                                )}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/ads/create?campaignId=${campaign.id}`}>
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Edit Campaign
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(campaign)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                {campaign.status === "active" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(campaign.id, "PAUSED")}>
                                    <Pause className="w-4 h-4 mr-2" />
                                    Pause Campaign
                                  </DropdownMenuItem>
                                )}
                                {(campaign.status === "paused" || campaign.status === "draft") && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(campaign.id, "ACTIVE")}>
                                    <Play className="w-4 h-4 mr-2" />
                                    {campaign.status === "draft" ? "Launch Campaign" : "Resume Campaign"}
                                  </DropdownMenuItem>
                                )}
                                {(campaign.status === "draft" || campaign.status === "scheduled") && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600"
                                      onClick={() => setDeleteTarget(campaign)}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete Campaign
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Budget Progress */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="text-muted-foreground">Budget Spent</span>
                            <span className="font-medium">
                              {formatCurrency(campaign.spent)} / {formatCurrency(campaign.budget)}
                            </span>
                          </div>
                          <Progress
                            value={campaign.budget > 0 ? (campaign.spent / campaign.budget) * 100 : 0}
                            className="h-2"
                          />
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-lg font-bold">{formatNumber(campaign.impressions)}</p>
                            <p className="text-xs text-muted-foreground">Impressions</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-lg font-bold">{formatNumber(campaign.clicks)}</p>
                            <p className="text-xs text-muted-foreground">Clicks</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-lg font-bold">{campaign.ctr}%</p>
                            <p className="text-xs text-muted-foreground">CTR</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-lg font-bold">{campaign.conversions}</p>
                            <p className="text-xs text-muted-foreground">Conversions</p>
                          </div>
                        </div>
                      </div>

                      {/* Performance Indicator */}
                      <div className="lg:w-32 p-4 bg-muted/30 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l">
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 ${
                            campaign.ctr >= 3
                              ? "bg-green-500/20 text-green-500"
                              : campaign.ctr >= 2
                              ? "bg-yellow-500/20 text-yellow-500"
                              : "bg-gray-500/20 text-gray-500"
                          }`}
                        >
                          <TrendingUp className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          {campaign.ctr >= 3
                            ? "Excellent"
                            : campaign.ctr >= 2
                            ? "Good"
                            : campaign.ctr > 0
                            ? "Average"
                            : "No data"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {filteredCampaigns.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Megaphone className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No campaigns found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {searchQuery
                      ? "Try adjusting your search"
                      : "Get started by creating your first ad campaign"}
                  </p>
                  <Button asChild>
                    <Link href="/ads/create">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Campaign
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">&ldquo;{deleteTarget?.name}&rdquo;</span>? This action cannot be undone and the campaign will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </motion.div>
  );
}
