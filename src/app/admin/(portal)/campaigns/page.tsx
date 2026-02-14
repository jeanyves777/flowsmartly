"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Megaphone,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Play,
  Pause,
  Calendar,
  Users,
  TrendingUp,
  Mail,
  Target,
  Loader2,
  AlertTriangle,
  MessageSquare,
  Send,
  MousePointer,
  Eye,
  XCircle,
  UserMinus,
  CheckCircle2,
  Phone,
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
  subject?: string;
  deliveredCount?: number;
  unsubscribedCount?: number;
  openRate?: number;
  clickRate?: number;
  messageLength?: number;
  segments?: number;
  deliveryRate?: number;
}

interface CampaignStats {
  total: number;
  active: number;
  completed: number;
  thisMonth: number;
  totalReach: number;
  avgOpenRate: number;
}

interface MarketingStats {
  email: {
    totalCampaigns: number;
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalUnsubscribed: number;
    avgOpenRate: number;
    avgClickRate: number;
    avgBounceRate: number;
  };
  sms: {
    totalCampaigns: number;
    totalSent: number;
    totalDelivered: number;
    totalClicked: number;
    avgDeliveryRate: number;
    avgClickRate: number;
  };
  contacts: {
    total: number;
    active: number;
    emailOptedIn: number;
    smsOptedIn: number;
  };
  topEmailCampaigns: Campaign[];
  topSmsCampaigns: Campaign[];
}

type TabType = "overview" | "email" | "sms";

const typeColors: Record<string, string> = {
  email: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  EMAIL: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sms: "bg-green-500/20 text-green-400 border-green-500/30",
  SMS: "bg-green-500/20 text-green-400 border-green-500/30",
  push: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

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

export default function CampaignsPage() {
  const searchParams = useSearchParams();

  // Get initial tab from URL query parameter
  const getInitialTab = (): TabType => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "email") return "email";
    if (tabParam === "sms") return "sms";
    return "overview";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);

  // Update tab when URL changes
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "email") setActiveTab("email");
    else if (tabParam === "sms") setActiveTab("sms");
    else if (!tabParam) setActiveTab("overview");
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<Campaign[]>([]);
  const [smsCampaigns, setSmsCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<CampaignStats>({
    total: 0,
    active: 0,
    completed: 0,
    thisMonth: 0,
    totalReach: 0,
    avgOpenRate: 0,
  });
  const [marketingStats, setMarketingStats] = useState<MarketingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch overview campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);

      const response = await fetch(`/api/admin/campaigns?${params}`);
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
  }, [searchQuery, filterStatus]);

  // Fetch marketing stats for overview
  const fetchMarketingStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/marketing/stats");
      const data = await response.json();
      if (data.success) {
        setMarketingStats(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch marketing stats:", err);
    }
  }, []);

  // Fetch email campaigns
  const fetchEmailCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);

      const response = await fetch(`/api/admin/marketing/email?${params}`);
      const data = await response.json();

      if (data.success) {
        setEmailCampaigns(data.data.campaigns);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email campaigns");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus]);

  // Fetch SMS campaigns
  const fetchSmsCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);

      const response = await fetch(`/api/admin/marketing/sms?${params}`);
      const data = await response.json();

      if (data.success) {
        setSmsCampaigns(data.data.campaigns);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SMS campaigns");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus]);

  useEffect(() => {
    if (activeTab === "overview") {
      fetchCampaigns();
      fetchMarketingStats();
    } else if (activeTab === "email") {
      fetchEmailCampaigns();
    } else if (activeTab === "sms") {
      fetchSmsCampaigns();
    }
  }, [activeTab, fetchCampaigns, fetchMarketingStats, fetchEmailCampaigns, fetchSmsCampaigns]);

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Megaphone },
    { id: "email" as const, label: "Email Marketing", icon: Mail },
    { id: "sms" as const, label: "SMS Marketing", icon: MessageSquare },
  ];

  if (error && campaigns.length === 0 && !marketingStats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-foreground mb-4">{error}</p>
          <Button onClick={fetchCampaigns} variant="outline">
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
          <h1 className="text-2xl font-bold text-foreground">
            Marketing Campaigns
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage email and SMS marketing campaigns
          </p>
        </div>
        <Button className="bg-brand-500 hover:bg-brand-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map((tab) => (
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

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab
          stats={stats}
          marketingStats={marketingStats}
          campaigns={campaigns}
          isLoading={isLoading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          formatNumber={formatNumber}
        />
      )}

      {activeTab === "email" && (
        <EmailTab
          campaigns={emailCampaigns}
          marketingStats={marketingStats}
          isLoading={isLoading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          formatNumber={formatNumber}
        />
      )}

      {activeTab === "sms" && (
        <SmsTab
          campaigns={smsCampaigns}
          marketingStats={marketingStats}
          isLoading={isLoading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          formatNumber={formatNumber}
        />
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  stats,
  marketingStats,
  campaigns,
  isLoading,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  formatNumber,
}: {
  stats: CampaignStats;
  marketingStats: MarketingStats | null;
  campaigns: Campaign[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  formatNumber: (n: number) => string;
}) {
  return (
    <div className="space-y-6">
      {/* Marketing Overview Stats */}
      {marketingStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Email Stats Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Email Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatNumber(marketingStats.email?.totalSent)}
                  </p>
                  <p className="text-xs text-muted-foreground">Emails Sent</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {(marketingStats.email?.avgOpenRate ?? 0).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Open Rate</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                <div className="text-center">
                  <p className="text-sm font-medium text-green-500">
                    {formatNumber(marketingStats.email?.totalDelivered)}
                  </p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-blue-500">
                    {formatNumber(marketingStats.email?.totalClicked)}
                  </p>
                  <p className="text-xs text-muted-foreground">Clicked</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-red-500">
                    {formatNumber(marketingStats.email?.totalBounced)}
                  </p>
                  <p className="text-xs text-muted-foreground">Bounced</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SMS Stats Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-500" />
                SMS Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatNumber(marketingStats.sms?.totalSent)}
                  </p>
                  <p className="text-xs text-muted-foreground">SMS Sent</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {(marketingStats.sms?.avgDeliveryRate ?? 0).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Delivery Rate</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <div className="text-center">
                  <p className="text-sm font-medium text-green-500">
                    {formatNumber(marketingStats.sms?.totalDelivered)}
                  </p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-blue-500">
                    {formatNumber(marketingStats.sms?.totalClicked)}
                  </p>
                  <p className="text-xs text-muted-foreground">Clicked</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Database Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                Contact Database
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatNumber(marketingStats.contacts?.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Contacts</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatNumber(marketingStats.contacts?.active)}
                  </p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <div className="text-center">
                  <p className="text-sm font-medium text-blue-500">
                    {formatNumber(marketingStats.contacts?.emailOptedIn)}
                  </p>
                  <p className="text-xs text-muted-foreground">Email Opt-in</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-green-500">
                    {formatNumber(marketingStats.contacts?.smsOptedIn)}
                  </p>
                  <p className="text-xs text-muted-foreground">SMS Opt-in</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Campaign Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Campaigns", value: stats.total, icon: Megaphone, sub: `+${stats.thisMonth} this month` },
          { label: "Active", value: stats.active, icon: Play, sub: "Running now" },
          { label: "Total Reach", value: formatNumber(stats.totalReach), icon: Users, sub: "Contacts reached" },
          { label: "Avg. Open Rate", value: `${stats.avgOpenRate}%`, icon: TrendingUp, sub: "Across all campaigns" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    {stat.sub}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-brand-500/20">
                  <stat.icon className="w-5 h-5 text-brand-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-muted/50 border-input text-foreground"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="sent">Sent</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No campaigns found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}

// Email Tab Component
function EmailTab({
  campaigns,
  marketingStats,
  isLoading,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  formatNumber,
}: {
  campaigns: Campaign[];
  marketingStats: MarketingStats | null;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  formatNumber: (n: number) => string;
}) {
  return (
    <div className="space-y-6">
      {/* Email Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Sent", value: formatNumber(marketingStats?.email?.totalSent || 0), icon: Send, color: "blue" },
          { label: "Delivered", value: formatNumber(marketingStats?.email?.totalDelivered || 0), icon: CheckCircle2, color: "green" },
          { label: "Opened", value: formatNumber(marketingStats?.email?.totalOpened || 0), icon: Eye, color: "purple" },
          { label: "Clicked", value: formatNumber(marketingStats?.email?.totalClicked || 0), icon: MousePointer, color: "orange" },
          { label: "Bounced", value: formatNumber(marketingStats?.email?.totalBounced || 0), icon: XCircle, color: "red" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${stat.color}-500/20`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Open Rate</span>
              <span className="text-lg font-bold text-foreground">
                {(marketingStats?.email?.avgOpenRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <Progress value={marketingStats?.email?.avgOpenRate || 0} className="h-2 bg-muted" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Click Rate</span>
              <span className="text-lg font-bold text-foreground">
                {(marketingStats?.email?.avgClickRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <Progress value={marketingStats?.email?.avgClickRate || 0} className="h-2 bg-muted" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Bounce Rate</span>
              <span className="text-lg font-bold text-foreground">
                {(marketingStats?.email?.avgBounceRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <Progress value={marketingStats?.email?.avgBounceRate || 0} className="h-2 bg-muted" />
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
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-muted/50 border-input text-foreground"
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

// SMS Tab Component
function SmsTab({
  campaigns,
  marketingStats,
  isLoading,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  formatNumber,
}: {
  campaigns: Campaign[];
  marketingStats: MarketingStats | null;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  formatNumber: (n: number) => string;
}) {
  return (
    <div className="space-y-6">
      {/* SMS Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sent", value: formatNumber(marketingStats?.sms?.totalSent || 0), icon: Send, color: "green" },
          { label: "Delivered", value: formatNumber(marketingStats?.sms?.totalDelivered || 0), icon: CheckCircle2, color: "emerald" },
          { label: "Clicked", value: formatNumber(marketingStats?.sms?.totalClicked || 0), icon: MousePointer, color: "blue" },
          { label: "Campaigns", value: marketingStats?.sms?.totalCampaigns || 0, icon: MessageSquare, color: "purple" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${stat.color}-500/20`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">
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
              <span className="text-lg font-bold text-foreground">
                {(marketingStats?.sms?.avgDeliveryRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <Progress value={marketingStats?.sms?.avgDeliveryRate || 0} className="h-2 bg-muted" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Click Rate</span>
              <span className="text-lg font-bold text-foreground">
                {(marketingStats?.sms?.avgClickRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <Progress value={marketingStats?.sms?.avgClickRate || 0} className="h-2 bg-muted" />
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
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-muted/50 border-input text-foreground"
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

// Campaign Card Component (for overview)
function CampaignCard({ campaign }: { campaign: Campaign }) {
  const openRate = campaign.sent > 0 ? Math.round((campaign.opened / campaign.sent) * 100) : 0;
  const clickRate = campaign.opened > 0 ? Math.round((campaign.clicked / campaign.opened) * 100) : 0;
  const progress = campaign.audience > 0 ? Math.round((campaign.sent / campaign.audience) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-brand-500/20">
              {campaign.type === "EMAIL" || campaign.type === "email" ? (
                <Mail className="w-6 h-6 text-brand-500" />
              ) : (
                <MessageSquare className="w-6 h-6 text-brand-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-foreground">
                  {campaign.name}
                </h3>
                <Badge className={typeColors[campaign.type] || typeColors.email}>{campaign.type}</Badge>
                <Badge className={statusColors[campaign.status] || statusColors.draft}>{campaign.status}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {campaign.audience.toLocaleString()} audience
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {campaign.startDate}
                    {campaign.endDate && ` - ${campaign.endDate}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {campaign.sent.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {openRate}%
                </p>
                <p className="text-xs text-muted-foreground">Open Rate</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {clickRate}%
                </p>
                <p className="text-xs text-muted-foreground">Click Rate</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(campaign.status === "active" || campaign.status === "ACTIVE") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-yellow-500 hover:text-yellow-400 hover:bg-muted/50"
                >
                  <Pause className="w-4 h-4" />
                </Button>
              )}
              {(campaign.status === "paused" || campaign.status === "PAUSED") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-green-500 hover:text-green-400 hover:bg-muted/50"
                >
                  <Play className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {campaign.status !== "draft" && campaign.status !== "DRAFT" && campaign.audience > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Progress
              </span>
              <span className="text-sm font-medium text-foreground">
                {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-2 bg-muted" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Email Campaign Card Component
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
                <h3 className="font-semibold text-foreground">
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
                  Owner: {campaign.owner}
                </span>
                <span className="text-xs text-muted-foreground">
                  {campaign.startDate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {campaign.sent.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-green-500">
                  {campaign.openRate?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-muted-foreground">Opened</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-blue-500">
                  {campaign.clickRate?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-muted-foreground">Clicked</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-red-500">
                  {campaign.bounced || 0}
                </p>
                <p className="text-xs text-muted-foreground">Bounced</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// SMS Campaign Card Component
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
                <h3 className="font-semibold text-foreground">
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
                <p className="text-lg font-semibold text-foreground">
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
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
