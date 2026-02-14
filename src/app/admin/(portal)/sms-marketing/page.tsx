"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Send,
  Loader2,
  AlertTriangle,
  MousePointer,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  audience: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  startDate: string;
  endDate: string | null;
  owner: string;
  ownerId: string;
  messageLength?: number;
  segments?: number;
  deliveryRate?: number;
  clickRate?: number;
}

interface SmsStats {
  totalCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  totalClicked: number;
  avgDeliveryRate: number;
  avgClickRate: number;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  PAUSED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  sent: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  DRAFT: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  scheduled: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  SCHEDULED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  COMPLETED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function SmsMarketingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<SmsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSmsCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);

      const response = await fetch(`/api/admin/marketing/sms?${params}`);
      const data = await response.json();

      if (data.success) {
        setCampaigns(data.data.campaigns);
        setStats(data.data.stats);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SMS campaigns");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus]);

  useEffect(() => {
    fetchSmsCampaigns();
  }, [fetchSmsCampaigns]);

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (error && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4">{error}</p>
          <Button onClick={fetchSmsCampaigns} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            SMS Marketing
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage and track your SMS marketing campaigns
          </p>
        </div>
        <Button className="bg-brand-500 hover:bg-brand-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Create SMS Campaign
        </Button>
      </div>

      {/* SMS Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sent", value: formatNumber(stats?.totalSent), icon: Send, color: "green" },
          { label: "Delivered", value: formatNumber(stats?.totalDelivered), icon: CheckCircle2, color: "emerald" },
          { label: "Clicked", value: formatNumber(stats?.totalClicked), icon: MousePointer, color: "blue" },
          { label: "Campaigns", value: stats?.totalCampaigns || 0, icon: MessageSquare, color: "purple" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  stat.color === "green" ? "bg-green-500/20" :
                  stat.color === "emerald" ? "bg-emerald-500/20" :
                  stat.color === "blue" ? "bg-blue-500/20" :
                  "bg-purple-500/20"
                }`}>
                  <stat.icon className={`w-5 h-5 ${
                    stat.color === "green" ? "text-green-500" :
                    stat.color === "emerald" ? "text-emerald-500" :
                    stat.color === "blue" ? "text-blue-500" :
                    "text-purple-500"
                  }`} />
                </div>
                <div>
                  <p className="text-xl font-bold">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stat.label}
                  </p>
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
              <span className="text-lg font-bold">
                {(stats?.avgDeliveryRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <Progress value={stats?.avgDeliveryRate || 0} className="h-2 bg-muted" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Click Rate</span>
              <span className="text-lg font-bold">
                {(stats?.avgClickRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <Progress value={stats?.avgClickRate || 0} className="h-2 bg-muted" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search SMS campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-muted placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm bg-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="SENT">Sent</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMS Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No SMS campaigns found</p>
            <Button className="mt-4 bg-brand-500 hover:bg-brand-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create SMS Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <SmsCampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}

function SmsCampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-500/20">
              <MessageSquare className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">
                  {campaign.name}
                </h3>
                <Badge className={statusColors[campaign.status] || statusColors.draft}>{campaign.status}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-muted-foreground">
                  Owner: {campaign.owner}
                </span>
                {campaign.messageLength && (
                  <span className="text-xs text-muted-foreground">
                    {campaign.messageLength} chars ({campaign.segments} segment{(campaign.segments || 0) > 1 ? "s" : ""})
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {campaign.startDate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {campaign.sent.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-green-500">
                  {campaign.deliveryRate?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-blue-500">
                  {campaign.clickRate?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-muted-foreground">Clicked</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="hover:bg-muted/50"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
