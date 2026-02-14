"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Send,
  Loader2,
  AlertTriangle,
  MousePointer,
  Eye,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Campaign {
  id: string;
  name: string;
  status: string;
  subject?: string;
  sentCount: number;
  deliveredCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  unsubCount: number;
  openRate: number;
  clickRate: number;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; username: string };
  contactList?: { id: string; name: string; totalCount: number } | null;
  recipientCount: number;
}

interface EmailStats {
  total: number;
  sent: number;
  totalEmailsSent: number;
  totalOpened: number;
  totalClicked: number;
  avgOpenRate: number;
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

export default function EmailMarketingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmailCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);

      const response = await fetch(`/api/admin/marketing/email?${params}`);
      const data = await response.json();

      if (data.success) {
        setCampaigns(data.data.campaigns);
        setStats(data.data.stats);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email campaigns");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus]);

  useEffect(() => {
    fetchEmailCampaigns();
  }, [fetchEmailCampaigns]);

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
          <Button onClick={fetchEmailCampaigns} variant="outline">
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
            Email Marketing
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage and track your email marketing campaigns
          </p>
        </div>
        <Button className="bg-brand-500 hover:bg-brand-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Create Email Campaign
        </Button>
      </div>

      {/* Email Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Campaigns", value: formatNumber(stats?.total), icon: Mail, color: "blue" },
          { label: "Total Sent", value: formatNumber(stats?.totalEmailsSent), icon: Send, color: "green" },
          { label: "Opened", value: formatNumber(stats?.totalOpened), icon: Eye, color: "purple" },
          { label: "Clicked", value: formatNumber(stats?.totalClicked), icon: MousePointer, color: "orange" },
          { label: "Sent Campaigns", value: formatNumber(stats?.sent), icon: CheckCircle2, color: "red" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  stat.color === "blue" ? "bg-blue-500/20" :
                  stat.color === "green" ? "bg-green-500/20" :
                  stat.color === "purple" ? "bg-purple-500/20" :
                  stat.color === "orange" ? "bg-orange-500/20" :
                  "bg-red-500/20"
                }`}>
                  <stat.icon className={`w-5 h-5 ${
                    stat.color === "blue" ? "text-blue-500" :
                    stat.color === "green" ? "text-green-500" :
                    stat.color === "purple" ? "text-purple-500" :
                    stat.color === "orange" ? "text-orange-500" :
                    "text-red-500"
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
              <span className="text-sm text-muted-foreground">Avg Open Rate</span>
              <span className="text-lg font-bold">
                {(stats?.avgOpenRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <Progress value={stats?.avgOpenRate || 0} className="h-2 bg-muted" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Avg Click Rate</span>
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
                placeholder="Search email campaigns..."
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

      {/* Email Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No email campaigns found</p>
            <Button className="mt-4 bg-brand-500 hover:bg-brand-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Email Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <EmailCampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmailCampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-500/20">
              <Mail className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">
                  {campaign.name}
                </h3>
                <Badge className={statusColors[campaign.status] || statusColors.draft}>{campaign.status}</Badge>
              </div>
              {campaign.subject && (
                <p className="text-sm mt-1 text-muted-foreground">
                  Subject: {campaign.subject}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-muted-foreground">
                  Owner: {campaign.user?.name || campaign.user?.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {campaign.sentAt
                    ? new Date(campaign.sentAt).toLocaleDateString()
                    : new Date(campaign.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {(campaign.sentCount || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-green-500">
                  {(campaign.openRate ?? 0).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Opened</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-blue-500">
                  {(campaign.clickRate ?? 0).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Clicked</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-red-500">
                  {campaign.bounceCount || 0}
                </p>
                <p className="text-xs text-muted-foreground">Bounced</p>
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
