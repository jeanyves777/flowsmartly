"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Link2,
  Check,
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
  ExternalLink,
  X,
  Info,
  ArrowUpRight,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";
import { formatSocialAccountLimit, getSocialAccountLimit } from "@/lib/social/account-limits";

// Platform colors
const PLATFORM_COLORS: Record<string, string> = {
  facebook: "from-blue-500 to-blue-600",
  instagram: "from-purple-500 to-pink-500",
  twitter: "from-gray-700 to-gray-900",
  linkedin: "from-blue-500 to-blue-700",
  tiktok: "from-gray-900 to-pink-500",
  youtube: "from-red-500 to-red-700",
  pinterest: "from-red-400 to-red-600",
  threads: "from-gray-800 to-gray-950",
  whatsapp: "from-green-500 to-green-600",
};

interface SocialAccount {
  id: string;
  platform: string;
  platformUserId: string;
  platformUsername: string;
  platformDisplayName: string;
  platformAvatarUrl: string | null;
  connectedAt: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
}

interface ErrorInfo {
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
  icon?: "error" | "warning" | "info";
}

interface AccountMeta {
  plan: string;
  connectedCount: number;
  accountLimit: number | null;
  remainingSlots: number | null;
}

const ERROR_MAP: Record<string, ErrorInfo> = {
  // YouTube errors
  youtube_no_channel: {
    title: "No YouTube Channel Found",
    description: "Your Google account doesn't have a YouTube channel. You need to create a YouTube channel first before connecting it to FlowSmartly.",
    actionLabel: "Create YouTube Channel",
    actionUrl: "https://www.youtube.com/create_channel",
    icon: "info",
  },
  youtube_auth_denied: {
    title: "YouTube Authorization Denied",
    description: "The authorization was denied or the access token was not received. Please try connecting again and make sure to accept all permissions.",
    icon: "warning",
  },
  youtube_api_error: {
    title: "YouTube API Error",
    description: "There was an issue communicating with YouTube. This might be a temporary problem. Please try again in a few minutes.",
    icon: "error",
  },
  youtube_connect_failed: {
    title: "YouTube Connection Failed",
    description: "Something went wrong while connecting your YouTube account. Please try again.",
    icon: "error",
  },
  // Facebook errors
  facebook_auth_failed: {
    title: "Facebook Authorization Failed",
    description: "You denied access or the authorization timed out. Please try connecting again and accept the required permissions.",
    icon: "warning",
  },
  facebook_no_pages: {
    title: "No Facebook Pages Found",
    description: "Your Facebook account doesn't have any Pages. You need to create a Facebook Page first to connect it to FlowSmartly.",
    actionLabel: "Create Facebook Page",
    actionUrl: "https://www.facebook.com/pages/create",
    icon: "info",
  },
  facebook_connect_failed: {
    title: "Facebook Connection Failed",
    description: "Something went wrong while connecting your Facebook account. Please try again.",
    icon: "error",
  },
  // Instagram errors
  instagram_auth_failed: {
    title: "Instagram Authorization Failed",
    description: "You denied access or the authorization timed out. Please try connecting again.",
    icon: "warning",
  },
  no_instagram_accounts: {
    title: "No Instagram Business Account Found",
    description: "No Instagram Business or Creator account was found linked to your Facebook Pages. To connect Instagram, you need to:\n1. Have an Instagram Business or Creator account\n2. Link it to a Facebook Page you manage",
    actionLabel: "Learn How to Set Up",
    actionUrl: "https://help.instagram.com/502981923235522",
    icon: "info",
  },
  instagram_connect_failed: {
    title: "Instagram Connection Failed",
    description: "Something went wrong while connecting your Instagram account. Please try again.",
    icon: "error",
  },
  // WhatsApp errors
  whatsapp_auth_failed: {
    title: "WhatsApp Authorization Failed",
    description: "You denied access or the authorization timed out. Please try connecting again.",
    icon: "warning",
  },
  no_phone_numbers: {
    title: "No WhatsApp Phone Numbers Found",
    description: "No WhatsApp Business phone numbers were found on your account. Make sure you have a WhatsApp Business account set up with an active phone number.",
    actionLabel: "Learn About WhatsApp Business",
    actionUrl: "https://business.whatsapp.com/",
    icon: "info",
  },
  connect_failed: {
    title: "WhatsApp Connection Failed",
    description: "Something went wrong while connecting your WhatsApp account. Please try again.",
    icon: "error",
  },
  // LinkedIn errors
  linkedin_auth_failed: {
    title: "LinkedIn Authorization Failed",
    description: "You denied access or the authorization timed out. Please try connecting again.",
    icon: "warning",
  },
  linkedin_connect_failed: {
    title: "LinkedIn Connection Failed",
    description: "Something went wrong while connecting your LinkedIn account. Please try again.",
    icon: "error",
  },
  // TikTok errors
  tiktok_auth_failed: {
    title: "TikTok Authorization Failed",
    description: "You denied access or the authorization timed out. Please try connecting again.",
    icon: "warning",
  },
  tiktok_connect_failed: {
    title: "TikTok Connection Failed",
    description: "Something went wrong while connecting your TikTok account. Please try again.",
    icon: "error",
  },
  // Twitter/X errors
  twitter_auth_failed: {
    title: "X (Twitter) Authorization Failed",
    description: "You denied access or the authorization timed out. Please try connecting again.",
    icon: "warning",
  },
  twitter_connect_failed: {
    title: "X (Twitter) Connection Failed",
    description: "Something went wrong while connecting your X account. Please try again.",
    icon: "error",
  },
  // Pinterest errors
  pinterest_auth_failed: {
    title: "Pinterest Authorization Failed",
    description: "You denied access or the authorization timed out. Please try connecting again.",
    icon: "warning",
  },
  pinterest_connect_failed: {
    title: "Pinterest Connection Failed",
    description: "Something went wrong while connecting your Pinterest account. Please try again.",
    icon: "error",
  },
  social_account_limit_reached: {
    title: "Account Limit Reached",
    description: "Your current plan has no open social profile slots. Upgrade your plan or disconnect an inactive profile before adding another page.",
    actionLabel: "Upgrade Plan",
    actionUrl: "/settings/upgrade",
    icon: "info",
  },
  // Generic
  missing_params: {
    title: "Connection Error",
    description: "Some required information was missing during the connection process. Please try again.",
    icon: "error",
  },
  no_code: {
    title: "Authorization Incomplete",
    description: "The authorization process was not completed. Please try connecting again.",
    icon: "warning",
  },
};

const SUCCESS_MAP: Record<string, { title: string; description: string }> = {
  facebook_connected: { title: "Facebook Connected!", description: "Your Facebook Page has been connected successfully." },
  instagram_connected: { title: "Instagram Connected!", description: "Your Instagram account has been connected successfully." },
  youtube_connected: { title: "YouTube Connected!", description: "Your YouTube channel has been connected successfully." },
  whatsapp_connected: { title: "WhatsApp Connected!", description: "Your WhatsApp Business account has been connected successfully." },
  linkedin_connected: { title: "LinkedIn Connected!", description: "Your LinkedIn account has been connected successfully." },
  twitter_connected: { title: "X (Twitter) Connected!", description: "Your X account has been connected successfully." },
  tiktok_connected: { title: "TikTok Connected!", description: "Your TikTok account has been connected successfully." },
  pinterest_connected: { title: "Pinterest Connected!", description: "Your Pinterest account has been connected successfully." },
};

export default function SocialAccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorModal, setErrorModal] = useState<ErrorInfo | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; platform: string; name: string } | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [accountMeta, setAccountMeta] = useState<AccountMeta>({
    plan: "STARTER",
    connectedCount: 0,
    accountLimit: getSocialAccountLimit("STARTER"),
    remainingSlots: getSocialAccountLimit("STARTER"),
  });

  function getTokenStatus(account: SocialAccount): { label: string; color: string } {
    if (!account.tokenExpiresAt) {
      return { label: "No expiry", color: "text-green-500" };
    }
    const expiresAt = new Date(account.tokenExpiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return { label: "Expired", color: "text-red-500" };
    } else if (daysLeft <= 3) {
      return { label: `Expires in ${daysLeft}d`, color: "text-red-500" };
    } else if (daysLeft <= 14) {
      return { label: `Expires in ${daysLeft}d`, color: "text-yellow-500" };
    } else {
      return { label: `Expires in ${daysLeft}d`, color: "text-green-500" };
    }
  }

  // Handle success/error messages from OAuth callbacks
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const pages = searchParams.get("pages");
    const accountsCount = searchParams.get("accounts");

    if (success) {
      const successInfo = SUCCESS_MAP[success];
      if (successInfo) {
        let desc = successInfo.description;
        const skipped = Number(searchParams.get("skipped") || "0");
        if (success === "facebook_connected" && pages) {
          desc = `Successfully connected ${pages} Facebook Page(s)`;
        } else if (success === "instagram_connected" && accountsCount) {
          desc = `Successfully connected ${accountsCount} Instagram account(s)`;
        }
        if (skipped > 0) {
          desc += `. ${skipped} additional profile${skipped === 1 ? "" : "s"} stayed unconnected because of your plan limit.`;
        }
        toast({ title: successInfo.title, description: desc });
      }
      router.replace("/social-accounts");
    } else if (error) {
      const errorInfo = ERROR_MAP[error];
      if (errorInfo && (errorInfo.actionUrl || errorInfo.icon === "info")) {
        // Show modal for actionable errors
        setErrorModal(errorInfo);
      } else {
        // Show toast for simple errors
        toast({
          title: errorInfo?.title || "Connection Failed",
          description: errorInfo?.description || "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
      router.replace("/social-accounts");
    }
  }, [searchParams, toast, router]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      setIsLoading(true);
      const allAccounts: SocialAccount[] = [];
      const overviewResponse = await fetch("/api/social-accounts");
      const overviewData = await overviewResponse.json();
      if (overviewData.success && overviewData.data) {
        setAccountMeta({
          plan: overviewData.data.plan || "STARTER",
          connectedCount: overviewData.data.connectedCount || 0,
          accountLimit:
            overviewData.data.accountLimit === undefined
              ? getSocialAccountLimit(overviewData.data.plan)
              : overviewData.data.accountLimit,
          remainingSlots:
            overviewData.data.remainingSlots === undefined
              ? null
              : overviewData.data.remainingSlots,
        });
      }

      // Fetch accounts for each platform
      const platforms = ["facebook", "instagram", "youtube", "whatsapp", "twitter", "linkedin", "tiktok", "pinterest", "threads"];
      const platformResults = await Promise.all(platforms.map(async (platform) => {
        try {
          const response = await fetch(`/api/social-accounts?platform=${platform}`);
          const data = await response.json();

          if (data.success && data.accounts) {
            return data.accounts as SocialAccount[];
          }
        } catch (err) {
          console.error(`Error fetching ${platform} accounts:`, err);
        }
        return [];
      }));

      allAccounts.push(...platformResults.flat());

      setAccounts(allAccounts);
      setAccountMeta((prev) => ({
        ...prev,
        connectedCount: allAccounts.length,
        remainingSlots:
          prev.accountLimit === null
            ? null
            : Math.max(0, prev.accountLimit - allAccounts.length),
      }));
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast({
        title: "Error",
        description: "Failed to load social accounts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchAccounts();
    setIsRefreshing(false);
    toast({ title: "Refreshed!", description: "Account list updated" });
  }

  async function handleDisconnect() {
    if (!disconnectTarget) return;
    setIsDisconnecting(true);

    try {
      const response = await fetch(`/api/social-accounts/${disconnectTarget.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Disconnected",
          description: `${disconnectTarget.name} has been disconnected successfully`,
        });
        fetchAccounts();
      } else {
        throw new Error(data.error?.message || "Failed to disconnect");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disconnect account",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
      setDisconnectTarget(null);
    }
  }

  // Group accounts by base platform (facebook_123 -> facebook, instagram_456 -> instagram)
  const groupedAccounts = accounts.reduce((acc, account) => {
    const basePlatform = account.platform.startsWith("facebook_") ? "facebook"
      : account.platform.startsWith("instagram_") ? "instagram"
      : account.platform;
    if (!acc[basePlatform]) {
      acc[basePlatform] = [];
    }
    acc[basePlatform].push(account);
    return acc;
  }, {} as Record<string, SocialAccount[]>);

  const accountLimit = accountMeta.accountLimit;
  const connectedCount = accounts.length;
  const remainingSlots =
    accountLimit === null ? null : Math.max(0, accountLimit - connectedCount);
  const usagePercent =
    accountLimit === null || accountLimit === 0
      ? 100
      : Math.min(100, Math.round((connectedCount / accountLimit) * 100));
  const isAtLimit = accountLimit !== null && connectedCount >= accountLimit;
  const connectedPlatformCount = Object.keys(groupedAccounts).length;
  const healthIssues = accounts.filter((account) => getTokenStatus(account).label === "Expired").length;

  // Only show platforms with credentials configured
  const availablePlatforms = [
    { id: "facebook", name: "Facebook Pages", connectUrl: "/api/social/facebook/connect" },
    { id: "instagram", name: "Instagram", connectUrl: "/api/social/instagram/connect" },
    { id: "twitter", name: "X / Twitter", connectUrl: "/api/social/twitter/connect" },
    { id: "whatsapp", name: "WhatsApp Business", connectUrl: "/api/social/whatsapp/connect" },
    { id: "youtube", name: "YouTube", connectUrl: "/api/social/youtube/connect" },
    { id: "pinterest", name: "Pinterest", connectUrl: "/api/social/pinterest/connect" },
    { id: "linkedin", name: "LinkedIn", connectUrl: "/api/social/linkedin/connect" },
    { id: "tiktok", name: "TikTok", connectUrl: "/api/social/tiktok/connect" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-background p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 text-sm font-semibold">
              <Link2 className="h-4 w-4 text-brand-500" />
              Channels
            </span>
            <span className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground">
              <strong className="text-foreground">{connectedCount}</strong>
              / {formatSocialAccountLimit(accountLimit)}
            </span>
            <span className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground">
              <strong className="text-foreground">{connectedPlatformCount}</strong>
              platform{connectedPlatformCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground">
              <ShieldCheck className={`h-4 w-4 ${healthIssues === 0 ? "text-emerald-500" : "text-amber-500"}`} />
              {healthIssues === 0 ? "Healthy" : `${healthIssues} expired`}
            </span>
            <Badge variant={isAtLimit ? "destructive" : "secondary"} className="h-9 rounded-lg px-3">
              {isAtLimit ? "Limit reached" : remainingSlots === null ? "Unlimited" : `${remainingSlots} open`}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => window.location.href = "/api/social/facebook/connect"} disabled={isAtLimit} className="h-9">
              {isAtLimit ? <Lock className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              Facebook Pages
            </Button>
            <Button variant="outline" asChild className="h-9">
              <Link href="/settings/upgrade">
                Upgrade
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" onClick={handleRefresh} disabled={isRefreshing} className="h-9">
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
        {accountLimit !== null && (
          <Progress value={usagePercent} className="mt-3 h-1.5" />
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card className="self-start border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              Connected profiles
              <Badge variant="secondary">{connectedCount}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10">
                <Link2 className="h-6 w-6 text-brand-500" />
              </div>
              <p className="font-semibold">No profiles connected yet</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Connect your first page to unlock multi-platform publishing and scheduling.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedAccounts).map(([platform, platformAccounts]) => {
                const meta = PLATFORM_META[platform as keyof typeof PLATFORM_META];
                const Icon = meta?.icon || Link2;

                return (
                  <div key={platform} className="rounded-2xl border bg-muted/20 p-3">
                    <div className="mb-3 flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${PLATFORM_COLORS[platform] || "from-gray-500 to-gray-700"}`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold capitalize">{meta?.label || platform}</h3>
                        <p className="text-xs text-muted-foreground">
                          {platformAccounts.length} connected profile{platformAccounts.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="ml-auto">
                        Active
                      </Badge>
                    </div>

                    <div className="grid gap-2">
                      {platformAccounts.map((account) => {
                        const tokenStatus = getTokenStatus(account);
                        return (
                          <div
                            key={account.id}
                            className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3"
                          >
                            <div className="flex items-center gap-3">
                              {account.platformAvatarUrl ? (
                                <img
                                  src={account.platformAvatarUrl}
                                  alt={account.platformDisplayName}
                                  className="h-11 w-11 rounded-full border object-cover"
                                />
                              ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-full border bg-muted">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                  {account.platformDisplayName}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {account.platformUsername}
                                </p>
                                <p className={`mt-0.5 text-xs ${tokenStatus.color}`}>
                                  {tokenStatus.label}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {tokenStatus.label === "Expired" ? (
                                <Badge variant="outline" className="text-red-500 border-red-500/50">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Expired
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-500 border-green-500/50">
                                  <Check className="w-3 h-3 mr-1" />
                                  Connected
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                                onClick={() => setDisconnectTarget({ id: account.id, platform, name: account.platformDisplayName })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </CardContent>
        </Card>

        <Card className="self-start border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              Connect channels
              <Badge variant={isAtLimit ? "destructive" : "secondary"}>
                {isAtLimit ? "Full" : "Open"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid gap-3">
            {availablePlatforms.map((platform) => {
              const meta = PLATFORM_META[platform.id as keyof typeof PLATFORM_META];
              const Icon = meta?.icon || Link2;
              const isConnected = !!groupedAccounts[platform.id];
              const disableConnect = isAtLimit && !isConnected;

              return (
                <button
                  key={platform.id}
                  onClick={() => {
                    if (!disableConnect) window.location.href = platform.connectUrl;
                  }}
                  disabled={disableConnect}
                  className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
                    disableConnect
                      ? "cursor-not-allowed bg-muted/30 opacity-60"
                      : "hover:border-brand-500/50 hover:bg-brand-500/5 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${PLATFORM_COLORS[platform.id] || "from-gray-500 to-gray-700"}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{platform.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {disableConnect
                          ? "Upgrade required"
                          : isConnected
                            ? `${groupedAccounts[platform.id].length} connected`
                            : "Available to connect"}
                      </p>
                    </div>
                  </div>
                  {disableConnect ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
          {isAtLimit && (
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">Your current channel limit is full.</p>
                  <p className="mt-1 text-muted-foreground">
                    Upgrade to add more pages, or disconnect a channel that no longer needs publishing access.
                  </p>
                </div>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      {/* Error Modal */}
      {errorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden border"
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                {errorModal.icon === "info" ? (
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Info className="w-4 h-4 text-blue-500" />
                  </div>
                ) : errorModal.icon === "warning" ? (
                  <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                )}
                <h3 className="font-semibold">{errorModal.title}</h3>
              </div>
              <button
                onClick={() => setErrorModal(null)}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {errorModal.description}
              </p>
            </div>
            <div className="flex items-center gap-3 p-4 border-t bg-muted/30">
              {errorModal.actionUrl && (
                <Button
                  onClick={() => window.open(errorModal.actionUrl, "_blank")}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {errorModal.actionLabel}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setErrorModal(null)}
                className={errorModal.actionUrl ? "" : "flex-1"}
              >
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {disconnectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden border"
          >
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Disconnect Account?</h3>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to disconnect <span className="font-medium text-foreground">{disconnectTarget.name}</span>?
                You won&apos;t be able to post to this account until you reconnect it.
              </p>
            </div>
            <div className="flex items-center gap-3 p-4 border-t bg-muted/30">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDisconnectTarget(null)}
                disabled={isDisconnecting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  "Disconnect"
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
