"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  MessageSquare,
  Plus,
  Search,
  MoreHorizontal,
  Send,
  AlertTriangle,
  RefreshCw,
  MousePointer,
  CheckCircle2,
  Edit2,
  Trash2,
  Play,
  Pause,
  Clock,
  Settings,
  Eye,
  Zap,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useRouter } from "next/navigation";
import { NumberStatusBanner } from "@/components/sms/number-status-banner";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  audience: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  messageLength?: number;
  segments?: number;
}

type CampaignStatus = "draft" | "scheduled" | "active" | "sent" | "paused" | "failed";

const statusConfig: Record<CampaignStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "bg-gray-500/10 text-gray-500", icon: Edit2 },
  scheduled: { label: "Scheduled", color: "bg-blue-500/10 text-blue-500", icon: Clock },
  active: { label: "Active", color: "bg-green-500/10 text-green-500", icon: Play },
  sent: { label: "Sent", color: "bg-purple-500/10 text-purple-500", icon: CheckCircle2 },
  paused: { label: "Paused", color: "bg-yellow-500/10 text-yellow-500", icon: Pause },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-500", icon: XCircle },
};

export default function SmsMarketingPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CampaignStatus>("all");
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [smsReady, setSmsReady] = useState(false);

  // Calculate stats from campaigns
  const smsStats = {
    total: campaigns.length,
    totalSent: campaigns.reduce((sum, c) => sum + c.sent, 0),
    totalDelivered: campaigns.reduce((sum, c) => sum + (c.delivered || 0), 0),
    totalClicked: campaigns.reduce((sum, c) => sum + c.clicked, 0),
    avgDeliveryRate: campaigns.reduce((sum, c) => sum + c.sent, 0) > 0
      ? (campaigns.reduce((sum, c) => sum + (c.delivered || 0), 0) / campaigns.reduce((sum, c) => sum + c.sent, 0)) * 100
      : 0,
    avgClickRate: campaigns.length > 0
      ? campaigns.reduce((sum, c) => sum + c.clickRate, 0) / campaigns.length
      : 0,
  };

  const fetchCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("type", "sms");
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/campaigns?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch campaigns");
      }

      setCampaigns(data.data.campaigns);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SMS campaigns");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Check if SMS is fully ready (compliance + number + registration approved)
  useEffect(() => {
    (async () => {
      try {
        const [numRes, compRes, a2pRes, tfRes] = await Promise.all([
          fetch("/api/sms/numbers?action=current"),
          fetch("/api/sms/compliance"),
          fetch("/api/sms/numbers/a2p-status"),
          fetch("/api/sms/numbers/verify"),
        ]);
        const numData = await numRes.json();
        const compData = compRes.ok ? await compRes.json() : null;
        const a2pData = a2pRes.ok ? await a2pRes.json() : null;
        const tfData = tfRes.ok ? await tfRes.json() : null;

        const phone = numData.data?.phoneNumber as string | undefined;
        if (!phone) return;

        const complianceOk = compData?.data?.status === "APPROVED";
        const isTollFree = /^\+1(800|833|844|855|866|877|888)/.test(phone);
        const regOk = isTollFree
          ? (tfData?.data?.status === "TWILIO_APPROVED" || tfData?.data?.status === "APPROVED")
          : a2pData?.data?.isApproved === true;

        setSmsReady(complianceOk && regOk);
      } catch {
        // Non-critical — buttons stay disabled by default
      }
    })();
  }, []);

  const handleDelete = async () => {
    if (!deletingCampaignId) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/campaigns/${deletingCampaignId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete campaign");
      }

      setCampaigns(prev => prev.filter(c => c.id !== deletingCampaignId));
      toast({ title: "Campaign deleted successfully" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete campaign",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeletingCampaignId(null);
    }
  };

  const handlePauseResume = async (campaignId: string, currentStatus: CampaignStatus) => {
    const newStatus = currentStatus === "paused" ? "active" : "paused";

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to update campaign");
      }

      setCampaigns(prev =>
        prev.map(c =>
          c.id === campaignId ? { ...c, status: newStatus } : c
        )
      );
      toast({ title: `Campaign ${newStatus === "paused" ? "paused" : "resumed"}` });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to update campaign",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return new Intl.NumberFormat().format(num);
  };

  if (error && campaigns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
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
      className="flex-1 flex flex-col space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            SMS Marketing
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/settings/sms-marketing">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/sms-marketing/automations">
                <Zap className="w-4 h-4 mr-2" />
                Automations
              </Link>
            </Button>
            {smsReady ? (
              <Button size="lg" className="bg-brand-500 hover:bg-brand-600" asChild>
                <Link href="/sms-marketing/create">
                  <Plus className="w-4 h-4 mr-2" />
                  New Campaign
                </Link>
              </Button>
            ) : (
              <Button size="lg" disabled className="opacity-50" title="Complete setup in SMS Settings first">
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Number Registration Status Banner */}
      <NumberStatusBanner />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "SMS Sent", value: formatNumber(smsStats.totalSent), icon: Send, color: "green" },
          { label: "Delivered", value: formatNumber(smsStats.totalDelivered), icon: CheckCircle2, color: "emerald" },
          { label: "Clicked", value: formatNumber(smsStats.totalClicked), icon: MousePointer, color: "blue" },
          { label: "Campaigns", value: smsStats.total, icon: MessageSquare, color: "purple" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-${stat.color}-500/10 flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
                </div>
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Delivery Rate</span>
              <span className="text-lg font-bold">{smsStats.avgDeliveryRate.toFixed(1)}%</span>
            </div>
            <Progress value={smsStats.avgDeliveryRate} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Average Click Rate</span>
              <span className="text-lg font-bold">{smsStats.avgClickRate.toFixed(1)}%</span>
            </div>
            <Progress value={smsStats.avgClickRate} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search SMS campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | CampaignStatus)}
                className="px-3 py-1.5 border rounded-lg text-sm bg-background"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="sent">Sent</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No SMS campaigns yet</p>
            <p className="text-sm mt-1">
              {smsReady ? "Create your first SMS campaign to get started" : "Complete setup in SMS Settings before creating campaigns"}
            </p>
            {smsReady ? (
              <Button className="mt-4 bg-brand-500 hover:bg-brand-600" asChild>
                <Link href="/sms-marketing/create">
                  <Plus className="w-4 h-4 mr-2" />
                  Create SMS Campaign
                </Link>
              </Button>
            ) : (
              <Button className="mt-4" variant="outline" asChild>
                <Link href="/settings/sms-marketing">
                  <Settings className="w-4 h-4 mr-2" />
                  Go to SMS Settings
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign, index) => {
            const StatusIcon = statusConfig[campaign.status as CampaignStatus]?.icon || Edit2;
            const statusStyle = statusConfig[campaign.status as CampaignStatus] || statusConfig.draft;
            const deliveryRate = campaign.sent > 0 ? ((campaign.delivered || 0) / campaign.sent) * 100 : 0;

            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/sms-marketing/${campaign.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Type Icon */}
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-500/10">
                        <MessageSquare className="w-6 h-6 text-green-500" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate hover:text-brand-500 transition-colors">{campaign.name}</span>
                          <Badge className={statusStyle.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusStyle.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{formatNumber(campaign.audience)} recipients</span>
                          {campaign.messageLength && (
                            <span>
                              {campaign.messageLength} chars ({campaign.segments} segment{(campaign.segments || 0) > 1 ? "s" : ""})
                            </span>
                          )}
                          {campaign.scheduledAt && campaign.status === "scheduled" && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(campaign.scheduledAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      {campaign.sent > 0 && (
                        <div className="hidden md:flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="font-semibold">{formatNumber(campaign.sent)}</p>
                            <p className="text-xs text-muted-foreground">Sent</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-green-600">{deliveryRate.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">Delivered</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-blue-600">{campaign.clickRate}%</p>
                            <p className="text-xs text-muted-foreground">Clicked</p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {(campaign.status === "active" || campaign.status === "paused") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePauseResume(campaign.id, campaign.status as CampaignStatus)}
                          >
                            {campaign.status === "paused" ? (
                              <Play className="w-4 h-4" />
                            ) : (
                              <Pause className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        {campaign.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/sms-marketing/create?edit=${campaign.id}`)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/sms-marketing/${campaign.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {campaign.status === "draft" && (
                              <DropdownMenuItem onClick={() => router.push(`/sms-marketing/create?edit=${campaign.id}`)}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Edit & Send
                              </DropdownMenuItem>
                            )}
                            {!["active", "sent"].includes(campaign.status) && (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => setDeletingCampaignId(campaign.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCampaignId} onOpenChange={(open) => { if (!open) setDeletingCampaignId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
