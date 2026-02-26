"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";
import { WhatsAppConnect } from "@/components/whatsapp/whatsapp-connect";

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
        if (success === "facebook_connected" && pages) {
          desc = `Successfully connected ${pages} Facebook Page(s)`;
        } else if (success === "instagram_connected" && accountsCount) {
          desc = `Successfully connected ${accountsCount} Instagram account(s)`;
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

      // Fetch accounts for each platform
      const platforms = ["facebook", "instagram", "youtube", "whatsapp", "twitter", "linkedin", "tiktok", "pinterest", "threads"];

      for (const platform of platforms) {
        try {
          const response = await fetch(`/api/social-accounts?platform=${platform}`);
          const data = await response.json();

          if (data.success && data.accounts) {
            allAccounts.push(...data.accounts);
          }
        } catch (err) {
          console.error(`Error fetching ${platform} accounts:`, err);
        }
      }

      setAccounts(allAccounts);
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

  // Group accounts by platform
  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.platform]) {
      acc[account.platform] = [];
    }
    acc[account.platform].push(account);
    return acc;
  }, {} as Record<string, SocialAccount[]>);

  // Only show platforms with credentials configured
  const availablePlatforms = [
    { id: "facebook", name: "Facebook Pages", connectUrl: "/api/social/facebook/connect" },
    { id: "instagram", name: "Instagram", connectUrl: "/api/social/instagram/connect" },
    { id: "whatsapp", name: "WhatsApp Business", connectUrl: "" }, // Uses Embedded Signup (WhatsAppConnect component)
    { id: "youtube", name: "YouTube", connectUrl: "/api/social/youtube/connect" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-white" />
            </div>
            Social Accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your connected social media accounts
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Accounts you've connected to FlowSmartly
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">No accounts connected</p>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your social media accounts to start posting
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAccounts).map(([platform, platformAccounts]) => {
                const meta = PLATFORM_META[platform as keyof typeof PLATFORM_META];
                const Icon = meta?.icon || Link2;

                return (
                  <div key={platform}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${PLATFORM_COLORS[platform] || "from-gray-500 to-gray-700"} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-semibold capitalize">{meta?.label || platform}</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {platformAccounts.length} connected
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {platformAccounts.map((account) => {
                        const tokenStatus = getTokenStatus(account);
                        return (
                          <div
                            key={account.id}
                            className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              {account.platformAvatarUrl && (
                                <img
                                  src={account.platformAvatarUrl}
                                  alt={account.platformDisplayName}
                                  className="w-10 h-10 rounded-full"
                                />
                              )}
                              <div>
                                <p className="font-medium text-sm">
                                  {account.platformDisplayName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {account.platformUsername}
                                </p>
                                <p className={`text-xs mt-0.5 ${tokenStatus.color}`}>
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
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                onClick={() => setDisconnectTarget({ id: account.id, platform, name: account.platformDisplayName })}
                              >
                                <Trash2 className="w-4 h-4" />
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

      {/* Available Platforms */}
      <Card>
        <CardHeader>
          <CardTitle>Connect More Accounts</CardTitle>
          <CardDescription>
            Add more social media accounts to expand your reach
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availablePlatforms.map((platform) => {
              const meta = PLATFORM_META[platform.id as keyof typeof PLATFORM_META];
              const Icon = meta?.icon || Link2;
              const isConnected = !!groupedAccounts[platform.id];

              // WhatsApp uses Embedded Signup (FB.login + config_id) instead of redirect
              if (platform.id === "whatsapp") {
                return (
                  <div
                    key={platform.id}
                    className="flex items-center justify-between p-4 rounded-xl border hover:border-brand-500/50 transition-all text-left hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${PLATFORM_COLORS[platform.id]} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{platform.name}</p>
                        {isConnected && (
                          <p className="text-xs text-green-500">
                            {groupedAccounts[platform.id].length} connected
                          </p>
                        )}
                      </div>
                    </div>
                    <WhatsAppConnect
                      onSuccess={() => fetchAccounts()}
                      buttonText="Connect"
                      variant="outline"
                      size="sm"
                      icon="connect"
                    />
                  </div>
                );
              }

              return (
                <button
                  key={platform.id}
                  onClick={() => window.location.href = platform.connectUrl}
                  className="flex items-center justify-between p-4 rounded-xl border hover:border-brand-500/50 transition-all text-left hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${PLATFORM_COLORS[platform.id] || "from-gray-500 to-gray-700"} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{platform.name}</p>
                      {isConnected && (
                        <p className="text-xs text-green-500">
                          {groupedAccounts[platform.id].length} connected
                        </p>
                      )}
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
