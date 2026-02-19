"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Mail,
  MessageSquare,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Send,
  Clock,
  CheckCircle2,
  Edit2,
  Trash2,
  Play,
  Pause,
  BarChart3,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Eye,
  MousePointer,
  XCircle,
  UserMinus,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

type CampaignType = "email" | "sms";
type CampaignStatus = "draft" | "scheduled" | "active" | "sent" | "paused";
type TabType = "all" | "email" | "sms";

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  subject?: string;
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
}

interface CampaignStats {
  total: number;
  active: number;
  sent: number;
  draft: number;
  avgOpenRate: number;
}

const statusConfig: Record<CampaignStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "bg-gray-500/10 text-gray-500", icon: Edit2 },
  scheduled: { label: "Scheduled", color: "bg-blue-500/10 text-blue-500", icon: Clock },
  active: { label: "Active", color: "bg-green-500/10 text-green-500", icon: Play },
  sent: { label: "Sent", color: "bg-purple-500/10 text-purple-500", icon: CheckCircle2 },
  paused: { label: "Paused", color: "bg-yellow-500/10 text-yellow-500", icon: Pause },
};

export default function CampaignsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Get initial tab from URL query parameter
  const getInitialTab = (): TabType => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "email") return "email";
    if (tabParam === "sms") return "sms";
    return "all";
  };

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<CampaignStats>({
    total: 0,
    active: 0,
    sent: 0,
    draft: 0,
    avgOpenRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [statusFilter, setStatusFilter] = useState<"all" | CampaignStatus>("all");

  // Update tab when URL changes
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "email") setActiveTab("email");
    else if (tabParam === "sms") setActiveTab("sms");
    else if (!tabParam) setActiveTab("all");
  }, [searchParams]);

  // Calculate email/SMS specific stats
  const emailCampaigns = campaigns.filter(c => c.type === "email");
  const smsCampaigns = campaigns.filter(c => c.type === "sms");

  const emailStats = {
    total: emailCampaigns.length,
    totalSent: emailCampaigns.reduce((sum, c) => sum + c.sent, 0),
    totalDelivered: emailCampaigns.reduce((sum, c) => sum + (c.delivered || 0), 0),
    totalOpened: emailCampaigns.reduce((sum, c) => sum + c.opened, 0),
    totalClicked: emailCampaigns.reduce((sum, c) => sum + c.clicked, 0),
    totalBounced: emailCampaigns.reduce((sum, c) => sum + (c.bounced || 0), 0),
    avgOpenRate: emailCampaigns.length > 0
      ? emailCampaigns.reduce((sum, c) => sum + c.openRate, 0) / emailCampaigns.length
      : 0,
    avgClickRate: emailCampaigns.length > 0
      ? emailCampaigns.reduce((sum, c) => sum + c.clickRate, 0) / emailCampaigns.length
      : 0,
  };

  const smsStats = {
    total: smsCampaigns.length,
    totalSent: smsCampaigns.reduce((sum, c) => sum + c.sent, 0),
    totalDelivered: smsCampaigns.reduce((sum, c) => sum + (c.delivered || 0), 0),
    totalClicked: smsCampaigns.reduce((sum, c) => sum + c.clicked, 0),
    avgDeliveryRate: smsCampaigns.reduce((sum, c) => sum + c.sent, 0) > 0
      ? (smsCampaigns.reduce((sum, c) => sum + (c.delivered || 0), 0) / smsCampaigns.reduce((sum, c) => sum + c.sent, 0)) * 100
      : 0,
    avgClickRate: smsCampaigns.length > 0
      ? smsCampaigns.reduce((sum, c) => sum + c.clickRate, 0) / smsCampaigns.length
      : 0,
  };

  const fetchCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (activeTab !== "all") params.set("type", activeTab);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/campaigns?${params}`);
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
  }, [searchQuery, activeTab, statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleDelete = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete campaign");
      }

      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      toast({ title: "Campaign deleted successfully" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete campaign",
        variant: "destructive",
      });
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

  const displayedCampaigns = activeTab === "all"
    ? campaigns
    : campaigns.filter(c => c.type === activeTab);

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
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
              <Send className="w-4 h-4 text-white" />
            </div>
            Campaigns
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="lg" variant="outline" asChild>
            <Link href="/email-marketing/create">
              <Mail className="w-4 h-4 mr-2" />
              Email Campaign
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sms-marketing/create">
              <MessageSquare className="w-4 h-4 mr-2" />
              SMS Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: "all" as const, label: "Overview", icon: BarChart3 },
          { id: "email" as const, label: "Email Marketing", icon: Mail },
          { id: "sms" as const, label: "SMS Marketing", icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab-specific Stats */}
      {activeTab === "all" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-brand-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Campaigns</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Play className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Active Now</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.sent}</p>
                  <p className="text-xs text-muted-foreground">Campaigns Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgOpenRate}%</p>
                  <p className="text-xs text-muted-foreground">Avg Open Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "email" && (
        <div className="space-y-4">
          {/* Email Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Emails Sent", value: formatNumber(emailStats.totalSent), icon: Send, color: "blue" },
              { label: "Delivered", value: formatNumber(emailStats.totalDelivered), icon: CheckCircle2, color: "green" },
              { label: "Opened", value: formatNumber(emailStats.totalOpened), icon: Eye, color: "purple" },
              { label: "Clicked", value: formatNumber(emailStats.totalClicked), icon: MousePointer, color: "orange" },
              { label: "Bounced", value: formatNumber(emailStats.totalBounced), icon: XCircle, color: "red" },
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

          {/* Email Rate Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Average Open Rate</span>
                  <span className="text-lg font-bold">{emailStats.avgOpenRate.toFixed(1)}%</span>
                </div>
                <Progress value={emailStats.avgOpenRate} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Average Click Rate</span>
                  <span className="text-lg font-bold">{emailStats.avgClickRate.toFixed(1)}%</span>
                </div>
                <Progress value={emailStats.avgClickRate} className="h-2" />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "sms" && (
        <div className="space-y-4">
          {/* SMS Stats Cards */}
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

          {/* SMS Rate Cards */}
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
        </div>
      )}

      {/* Filters */}
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
      ) : displayedCampaigns.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {activeTab === "email" ? (
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            ) : activeTab === "sms" ? (
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            ) : (
              <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
            )}
            <p className="font-medium">
              {activeTab === "email"
                ? "No email campaigns yet"
                : activeTab === "sms"
                ? "No SMS campaigns yet"
                : "No campaigns yet"}
            </p>
            <p className="text-sm mt-1">
              Create your first {activeTab !== "all" ? activeTab : ""} campaign to get started
            </p>
            <div className="flex items-center gap-2 mt-4">
              {(activeTab === "all" || activeTab === "email") && (
                <Button asChild>
                  <Link href="/email-marketing/create">
                    <Mail className="w-4 h-4 mr-2" />
                    Email Campaign
                  </Link>
                </Button>
              )}
              {(activeTab === "all" || activeTab === "sms") && (
                <Button asChild variant={activeTab === "all" ? "outline" : "default"}>
                  <Link href="/sms-marketing/create">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    SMS Campaign
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayedCampaigns.map((campaign, index) => {
            const StatusIcon = statusConfig[campaign.status]?.icon || Edit2;
            const statusStyle = statusConfig[campaign.status] || statusConfig.draft;
            const deliveryRate = campaign.sent > 0 ? ((campaign.delivered || 0) / campaign.sent) * 100 : 0;

            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Type Icon */}
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          campaign.type === "email"
                            ? "bg-blue-500/10"
                            : "bg-green-500/10"
                        }`}
                      >
                        {campaign.type === "email" ? (
                          <Mail className="w-6 h-6 text-blue-500" />
                        ) : (
                          <MessageSquare className="w-6 h-6 text-green-500" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={campaign.type === "email" ? `/email-marketing/${campaign.id}` : `/sms-marketing/${campaign.id}`}
                            className="font-semibold truncate hover:text-brand-500 transition-colors"
                          >
                            {campaign.name}
                          </Link>
                          <Badge className={statusStyle.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusStyle.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          {campaign.subject && (
                            <span className="truncate max-w-[200px]">{campaign.subject}</span>
                          )}
                          <span>{formatNumber(campaign.audience)} recipients</span>
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
                          {campaign.type === "email" ? (
                            <>
                              <div className="text-center">
                                <p className="font-semibold text-green-600">{campaign.openRate}%</p>
                                <p className="text-xs text-muted-foreground">Opened</p>
                              </div>
                              <div className="text-center">
                                <p className="font-semibold text-blue-600">{campaign.clickRate}%</p>
                                <p className="text-xs text-muted-foreground">Clicked</p>
                              </div>
                              {campaign.bounced > 0 && (
                                <div className="text-center">
                                  <p className="font-semibold text-red-600">{campaign.bounced}</p>
                                  <p className="text-xs text-muted-foreground">Bounced</p>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="text-center">
                                <p className="font-semibold text-green-600">{deliveryRate.toFixed(1)}%</p>
                                <p className="text-xs text-muted-foreground">Delivered</p>
                              </div>
                              <div className="text-center">
                                <p className="font-semibold text-blue-600">{campaign.clickRate}%</p>
                                <p className="text-xs text-muted-foreground">Clicked</p>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {(campaign.status === "active" || campaign.status === "paused") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePauseResume(campaign.id, campaign.status)}
                          >
                            {campaign.status === "paused" ? (
                              <Play className="w-4 h-4" />
                            ) : (
                              <Pause className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        {campaign.status === "draft" && (
                          <Button variant="ghost" size="icon">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        {!["active", "sent"].includes(campaign.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(campaign.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Premium Feature Banner */}
      <Card className="bg-gradient-to-r from-brand-500/10 to-purple-500/10 border-brand-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="font-semibold">Upgrade for Advanced Marketing</h3>
                <p className="text-sm text-muted-foreground">
                  Get A/B testing, advanced analytics, and automation workflows
                </p>
              </div>
            </div>
            <Button variant="outline" className="border-brand-500/30 text-brand-500 hover:bg-brand-500/10">
              Upgrade Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
