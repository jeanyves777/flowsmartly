"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Lock,
  Megaphone,
  MoreHorizontal,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
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
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { AISpinner } from "@/components/shared/ai-generation-loader";

interface AdCampaign {
  id: string;
  name: string;
  status: string;
  approvalStatus: string;
  adType: string;
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
  headline: string | null;
  description: string | null;
  destinationUrl: string | null;
  mediaUrl: string | null;
  rejectionReason: string | null;
  providers?: string[];
  post: {
    id: string;
    caption: string;
    mediaUrl: string | null;
  } | null;
  adPage: {
    id: string;
    slug: string;
    views: number;
    clicks: number;
  } | null;
  landingPage: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
  } | null;
  createdAt: string;
}

interface AdStats {
  total: number;
  active: number;
  pending: number;
  totalSpent: number;
  totalImpressions: number;
}

interface AdProvider {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
}

const AD_TYPE_META: Record<string, { label: string; icon: ComponentType<{ className?: string }>; href: string }> = {
  POST: { label: "Post boost", icon: ImageIcon, href: "/ads/create?type=POST" },
  PRODUCT_LINK: { label: "Product ad", icon: ShoppingBag, href: "/ads/create?type=PRODUCT_LINK" },
  LANDING_PAGE: { label: "Landing page", icon: FileText, href: "/ads/create?type=LANDING_PAGE" },
  EXTERNAL_URL: { label: "Link ad", icon: ExternalLink, href: "/ads/create?type=EXTERNAL_URL" },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300" },
  paused: { label: "Paused", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  draft: { label: "Draft", className: "border-muted-foreground/25 bg-muted text-muted-foreground" },
  completed: { label: "Completed", className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  scheduled: { label: "Scheduled", className: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  pending_review: { label: "In review", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  rejected: { label: "Rejected", className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" },
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending_review", label: "Review" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Done" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AdsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [stats, setStats] = useState<AdStats | null>(null);
  const [providers, setProviders] = useState<AdProvider[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdCampaign | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/ads?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch campaigns");
      }

      setCampaigns(data.data.campaigns || []);
      setStats(data.data.stats || null);
      setProviders(data.data.providers || []);
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

  const filteredCampaigns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return campaigns;
    return campaigns.filter((campaign) =>
      [campaign.name, campaign.headline, campaign.description, campaign.destinationUrl]
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [campaigns, searchQuery]);

  const totals = useMemo(() => {
    const budget = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);
    const clicks = campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0);
    const conversions = campaigns.reduce((sum, campaign) => sum + campaign.conversions, 0);
    const ctr = campaigns.length ? campaigns.reduce((sum, campaign) => sum + campaign.ctr, 0) / campaigns.length : 0;
    return { budget, clicks, conversions, ctr };
  }, [campaigns]);

  async function handleStatusChange(campaign: AdCampaign, nextStatus: "ACTIVE" | "PAUSED") {
    if (nextStatus === "ACTIVE" && campaign.approvalStatus !== "APPROVED") {
      toast({
        title: "Review required",
        description: "This ad must be approved before it can go active.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(campaign.id);
    try {
      const response = await fetch(`/api/ads/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to update campaign");

      await fetchCampaigns();
      toast({ title: nextStatus === "ACTIVE" ? "Campaign resumed" : "Campaign paused" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const campaignId = deleteTarget.id;
    setDeleteTarget(null);
    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/ads/${campaignId}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to delete campaign");

      await fetchCampaigns();
      toast({ title: "Campaign deleted" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  if (error && campaigns.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <h2 className="font-semibold">Ads could not load</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button onClick={fetchCampaigns} variant="outline" className="mt-4 gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-2 gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Simple AI ads
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">Ads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Launch, review, and pause campaigns from one clear workspace.
          </p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link href="/ads/create">
            <Plus className="h-4 w-4" />
            Create ad
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Spend</p>
                <p className="mt-1 text-2xl font-semibold">{formatCurrency(stats?.totalSpent || 0)}</p>
                <p className="text-xs text-muted-foreground">of {formatCurrency(totals.budget)} planned</p>
              </div>
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            {totals.budget > 0 && (
              <Progress value={Math.min(100, ((stats?.totalSpent || 0) / totals.budget) * 100)} className="mt-4 h-1.5" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Impressions</p>
                <p className="mt-1 text-2xl font-semibold">{formatNumber(stats?.totalImpressions || 0)}</p>
                <p className="text-xs text-muted-foreground">{formatNumber(totals.clicks)} clicks</p>
              </div>
              <MousePointerClick className="h-5 w-5 text-violet-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="mt-1 text-2xl font-semibold">{stats?.active || 0}</p>
                <p className="text-xs text-muted-foreground">{stats?.pending || 0} in review</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Results</p>
                <p className="mt-1 text-2xl font-semibold">{totals.ctr.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{formatNumber(totals.conversions)} conversions</p>
              </div>
              <BarChart3 className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {Object.entries(AD_TYPE_META).map(([id, item]) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={id}
                      href={item.href}
                      className="rounded-lg border bg-background p-4 transition hover:border-primary/50 hover:bg-muted/30"
                    >
                      <Icon className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Create with AI</p>
                    </Link>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search ads"
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setStatusFilter(filter.id)}
                      className={cn(
                        "whitespace-nowrap rounded-full border px-3 py-2 text-xs font-medium hover:border-primary/50",
                        statusFilter === filter.id && "border-primary bg-primary/5 text-primary"
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-40 rounded-lg" />)}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Megaphone className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
                <h2 className="font-semibold">No ads here yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery ? "Try a different search." : "Create a simple AI-guided ad to get started."}
                </p>
                <Button asChild className="mt-4 gap-2">
                  <Link href="/ads/create">
                    <Plus className="h-4 w-4" />
                    Create ad
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredCampaigns.map((campaign) => {
                const typeMeta = AD_TYPE_META[campaign.adType] || AD_TYPE_META.POST;
                const TypeIcon = typeMeta.icon;
                const statusMeta = STATUS_META[campaign.status] || STATUS_META.draft;
                const canResume = campaign.status === "paused" && campaign.approvalStatus === "APPROVED";
                const canPause = campaign.status === "active";
                const canDelete = campaign.status === "draft" || campaign.status === "scheduled";
                const hasMenuActions = Boolean(campaign.destinationUrl || campaign.adPage || canDelete);
                const previewImage = campaign.mediaUrl || campaign.post?.mediaUrl || campaign.landingPage?.thumbnailUrl;
                const title = campaign.headline || campaign.landingPage?.title || campaign.name;
                const description = campaign.description || campaign.post?.caption || campaign.destinationUrl || "No description yet";

                return (
                  <Card key={campaign.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="grid gap-0 lg:grid-cols-[180px_minmax(0,1fr)]">
                        <div className="relative min-h-40 bg-muted">
                          {previewImage ? (
                            <img src={previewImage} alt="" className="h-full min-h-40 w-full object-cover" />
                          ) : (
                            <div className="flex h-full min-h-40 items-center justify-center">
                              <TypeIcon className="h-9 w-9 text-muted-foreground/50" />
                            </div>
                          )}
                          <Badge className="absolute left-3 top-3 gap-1.5 bg-background/90 text-foreground backdrop-blur" variant="outline">
                            <TypeIcon className="h-3 w-3" />
                            {typeMeta.label}
                          </Badge>
                        </div>

                        <div className="space-y-4 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={statusMeta.className}>{statusMeta.label}</Badge>
                                {campaign.approvalStatus === "PENDING" && (
                                  <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                    <ShieldCheck className="h-3 w-3" />
                                    Awaiting approval
                                  </Badge>
                                )}
                                {campaign.approvalStatus === "REJECTED" && (
                                  <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300">Rejected</Badge>
                                )}
                              </div>
                              <h3 className="truncate text-lg font-semibold">{campaign.name}</h3>
                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{description}</p>
                            </div>

                            <div className="flex items-center gap-2">
                              {canPause && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStatusChange(campaign, "PAUSED")}
                                  disabled={actionLoading === campaign.id}
                                  className="gap-2"
                                >
                                  {actionLoading === campaign.id ? <AISpinner className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                                  Pause
                                </Button>
                              )}
                              {canResume && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStatusChange(campaign, "ACTIVE")}
                                  disabled={actionLoading === campaign.id}
                                  className="gap-2"
                                >
                                  {actionLoading === campaign.id ? <AISpinner className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                  Resume
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-9 w-9">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {!hasMenuActions && (
                                    <DropdownMenuItem disabled>No extra actions</DropdownMenuItem>
                                  )}
                                  {campaign.destinationUrl && (
                                    <DropdownMenuItem asChild>
                                      <a href={campaign.destinationUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Open destination
                                      </a>
                                    </DropdownMenuItem>
                                  )}
                                  {campaign.adPage && (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/ad/${campaign.adPage.slug}`} target="_blank">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Preview ad page
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(campaign)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {campaign.rejectionReason && (
                            <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                              {campaign.rejectionReason}
                            </div>
                          )}

                          <div className="grid gap-3 sm:grid-cols-4">
                            <Metric label="Spent" value={`${formatCurrency(campaign.spent)} / ${formatCurrency(campaign.budget)}`} />
                            <Metric label="Views" value={formatNumber(campaign.impressions)} />
                            <Metric label="Clicks" value={formatNumber(campaign.clicks)} />
                            <Metric label="CTR" value={`${campaign.ctr}%`} />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                            <div className="flex flex-wrap gap-2">
                              {(campaign.providers || ["feed"]).map((providerId) => {
                                const provider = providers.find((item) => item.id === providerId);
                                return (
                                  <span key={providerId} className="rounded-full border bg-background px-2.5 py-1">
                                    {provider?.name || providerId}
                                  </span>
                                );
                              })}
                            </div>
                            <span>
                              {formatDate(campaign.startDate)}
                              {campaign.endDate ? ` - ${formatDate(campaign.endDate)}` : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <h2 className="font-semibold">Provider readiness</h2>
                <p className="mt-1 text-sm text-muted-foreground">Connected providers can receive approved ads.</p>
              </div>
              <div className="space-y-2">
                {(providers.length ? providers : [{ id: "feed", name: "FlowSmartly Feed", enabled: true }]).map((provider) => (
                  <div key={provider.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{provider.name}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{provider.description || "Ad provider"}</p>
                    </div>
                    {provider.enabled ? (
                      <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300">Ready</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Setup
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <h2 className="font-semibold">Best next move</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stats?.pending
                    ? "Review is waiting before some ads can go live."
                    : campaigns.length
                      ? "Create a focused variant for your strongest offer."
                      : "Start with a post boost or product ad."}
                </p>
              </div>
              <Button asChild className="w-full gap-2">
                <Link href="/ads/create">
                  <Sparkles className="h-4 w-4" />
                  Build with AI
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{deleteTarget?.name}". Active and completed campaigns stay available for reporting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 text-white hover:bg-red-700">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
