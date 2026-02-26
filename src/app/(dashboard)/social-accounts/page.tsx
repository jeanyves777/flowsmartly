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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";

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
}

export default function SocialAccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle success/error messages from OAuth callbacks
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const pages = searchParams.get("pages");
    const accountsCount = searchParams.get("accounts");

    if (success === "facebook_connected") {
      toast({
        title: "Facebook Pages Connected!",
        description: `Successfully connected ${pages || 1} Facebook Page(s)`,
      });
      // Clean URL
      router.replace("/social-accounts");
    } else if (success === "instagram_connected") {
      toast({
        title: "Instagram Connected!",
        description: `Successfully connected ${accountsCount || 1} Instagram account(s)`,
      });
      router.replace("/social-accounts");
    } else if (error) {
      toast({
        title: "Connection Failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
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

  async function handleDisconnect(accountId: string, platform: string) {
    if (!confirm(`Disconnect this ${platform} account?`)) return;

    try {
      const response = await fetch(`/api/social-accounts/${accountId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Disconnected",
          description: `${platform} account disconnected successfully`,
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
    }
  }

  function getErrorMessage(error: string): string {
    const messages: Record<string, string> = {
      facebook_auth_failed: "Facebook authorization failed",
      instagram_auth_failed: "Instagram authorization failed",
      whatsapp_auth_failed: "WhatsApp authorization failed",
      no_code: "Authorization code missing",
      missing_params: "Missing required parameters",
      no_instagram_accounts: "No Instagram Business accounts found. Make sure your Instagram account is connected to a Facebook Page.",
      instagram_connect_failed: "Failed to connect Instagram",
      facebook_connect_failed: "Failed to connect Facebook",
      no_phone_numbers: "No WhatsApp phone numbers found",
      connect_failed: "Connection failed",
    };
    return messages[error] || "An error occurred during connection";
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
    { id: "whatsapp", name: "WhatsApp Business", connectUrl: "/api/social/whatsapp/connect" },
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
                      {platformAccounts.map((account) => (
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
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-green-500 border-green-500/50">
                              <Check className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => handleDisconnect(account.id, platform)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
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

      {/* Help Card */}
      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Need Help?</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Having trouble connecting your accounts? Check our documentation or contact support.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="https://docs.flowsmartly.com/social-accounts" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Documentation
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
