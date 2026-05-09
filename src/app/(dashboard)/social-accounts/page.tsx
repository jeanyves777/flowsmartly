"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ClipboardList,
  ExternalLink,
  Globe2,
  Inbox,
  Link2,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Radio,
  RefreshCw,
  SearchCheck,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";
import { formatSocialAccountLimit, getSocialAccountLimit } from "@/lib/social/account-limits";

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "from-blue-500 to-blue-600",
  instagram: "from-purple-500 to-pink-500",
  twitter: "from-gray-700 to-gray-950",
  linkedin: "from-blue-500 to-blue-700",
  tiktok: "from-gray-900 to-pink-500",
  youtube: "from-red-500 to-red-700",
  pinterest: "from-red-500 to-red-700",
  threads: "from-gray-800 to-gray-950",
  whatsapp: "from-green-500 to-green-600",
};

const PUBLISHING_PLATFORMS = [
  { id: "facebook", name: "Facebook Pages", connectUrl: "/api/social/facebook/connect" },
  { id: "instagram", name: "Instagram", connectUrl: "/api/social/instagram/connect" },
  { id: "twitter", name: "X / Twitter", connectUrl: "/api/social/twitter/connect" },
  { id: "youtube", name: "YouTube", connectUrl: "/api/social/youtube/connect" },
  { id: "pinterest", name: "Pinterest", connectUrl: "/api/social/pinterest/connect" },
  { id: "linkedin", name: "LinkedIn", connectUrl: "/api/social/linkedin/connect" },
  { id: "tiktok", name: "TikTok", connectUrl: "/api/social/tiktok/connect" },
];

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

interface AccountMeta {
  plan: string;
  connectedCount: number;
  accountLimit: number | null;
  remainingSlots: number | null;
}

interface GoogleBusinessSummary {
  connected: boolean;
  profileId: string | null;
  businessName: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  listingUrl: string | null;
  status: string;
  rating: number | null;
  reviewCount: number;
  seoHealthScore: number;
  citationScore: number;
  coverageScore: number;
  consistencyScore: number;
  reviewScore: number;
  lastCheckedAt: string | null;
  connectHref: string;
  dashboardHref: string;
}

interface ErrorInfo {
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
}

const ERROR_MAP: Record<string, ErrorInfo> = {
  youtube_no_channel: {
    title: "No YouTube channel found",
    description: "Create a YouTube channel first, then reconnect it to FlowSmartly.",
    actionLabel: "Create YouTube channel",
    actionUrl: "https://www.youtube.com/create_channel",
  },
  facebook_no_pages: {
    title: "No Facebook Pages found",
    description: "Connect a Facebook account that manages at least one Page.",
    actionLabel: "Create Facebook Page",
    actionUrl: "https://www.facebook.com/pages/create",
  },
  no_instagram_accounts: {
    title: "No Instagram Business account found",
    description: "Instagram publishing requires a Business or Creator account linked to a Facebook Page.",
    actionLabel: "Set up Instagram Business",
    actionUrl: "https://help.instagram.com/502981923235522",
  },
  no_phone_numbers: {
    title: "No WhatsApp phone number found",
    description: "Connect a WhatsApp Business account that has an active phone number.",
    actionLabel: "Learn about WhatsApp Business",
    actionUrl: "https://business.whatsapp.com/",
  },
  social_account_limit_reached: {
    title: "Account limit reached",
    description: "Upgrade your plan or disconnect an inactive profile before adding another publishing channel.",
    actionLabel: "Upgrade plan",
    actionUrl: "/settings/upgrade",
  },
  missing_params: {
    title: "Connection incomplete",
    description: "Some connection details were missing. Please try again.",
  },
};

const SUCCESS_MAP: Record<string, string> = {
  facebook_connected: "Facebook Page connected.",
  instagram_connected: "Instagram account connected.",
  youtube_connected: "YouTube channel connected.",
  whatsapp_connected: "WhatsApp Business account connected.",
  linkedin_connected: "LinkedIn account connected.",
  twitter_connected: "X account connected.",
  tiktok_connected: "TikTok account connected.",
  pinterest_connected: "Pinterest account connected.",
};

const DEFAULT_GOOGLE_BUSINESS: GoogleBusinessSummary = {
  connected: false,
  profileId: null,
  businessName: "Google Business Profile",
  address: null,
  phone: null,
  website: null,
  listingUrl: null,
  status: "not_connected",
  rating: null,
  reviewCount: 0,
  seoHealthScore: 0,
  citationScore: 0,
  coverageScore: 0,
  consistencyScore: 0,
  reviewScore: 0,
  lastCheckedAt: null,
  connectHref: "/listsmartly/onboarding?source=social-accounts",
  dashboardHref: "/listsmartly/dashboard",
};

function basePlatform(platform: string): string {
  if (platform.startsWith("facebook_")) return "facebook";
  if (platform.startsWith("instagram_")) return "instagram";
  return platform;
}

function initials(name: string | null | undefined): string {
  return (name || "A").trim().charAt(0).toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return "Not checked yet";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export default function SocialAccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [googleBusiness, setGoogleBusiness] = useState<GoogleBusinessSummary>(DEFAULT_GOOGLE_BUSINESS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorPanel, setErrorPanel] = useState<ErrorInfo | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; platform: string; name: string } | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [accountMeta, setAccountMeta] = useState<AccountMeta>({
    plan: "STARTER",
    connectedCount: 0,
    accountLimit: getSocialAccountLimit("STARTER"),
    remainingSlots: getSocialAccountLimit("STARTER"),
  });

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const pages = searchParams.get("pages");
    const accountsCount = searchParams.get("accounts");
    const skipped = Number(searchParams.get("skipped") || "0");

    if (success) {
      let description = SUCCESS_MAP[success] || "Connection completed.";
      if (success === "facebook_connected" && pages) description = `${pages} Facebook Page${pages === "1" ? "" : "s"} connected.`;
      if (success === "instagram_connected" && accountsCount) description = `${accountsCount} Instagram account${accountsCount === "1" ? "" : "s"} connected.`;
      if (skipped > 0) description += ` ${skipped} profile${skipped === 1 ? "" : "s"} skipped because of the plan limit.`;
      toast({ title: "Channel connected", description });
      router.replace("/social-accounts");
    } else if (error) {
      const errorInfo = ERROR_MAP[error] || {
        title: "Connection failed",
        description: "The platform did not finish connecting. Please try again.",
      };
      setErrorPanel(errorInfo);
      router.replace("/social-accounts");
    }
  }, [router, searchParams, toast]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    const section = searchParams.get("section");
    if (isLoading || !section) return;
    window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [isLoading, searchParams]);

  async function fetchAccounts() {
    try {
      setIsLoading(true);
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
        setGoogleBusiness(overviewData.data.googleBusiness || DEFAULT_GOOGLE_BUSINESS);
      }

      const platforms = ["facebook", "instagram", "youtube", "whatsapp", "twitter", "linkedin", "tiktok", "pinterest", "threads"];
      const platformResults = await Promise.all(platforms.map(async (platform) => {
        try {
          const response = await fetch(`/api/social-accounts?platform=${platform}`);
          const data = await response.json();
          if (data.success && data.accounts) return data.accounts as SocialAccount[];
        } catch (error) {
          console.error(`Error fetching ${platform} accounts:`, error);
        }
        return [];
      }));

      const allAccounts = platformResults.flat();
      setAccounts(allAccounts);
      setAccountMeta((prev) => ({
        ...prev,
        connectedCount: allAccounts.length,
        remainingSlots:
          prev.accountLimit === null ? null : Math.max(0, prev.accountLimit - allAccounts.length),
      }));
    } catch (error) {
      console.error("Error fetching social accounts:", error);
      toast({
        title: "Could not load accounts",
        description: "Refresh the page or try again in a moment.",
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
    toast({ title: "Refreshed", description: "Connection data was updated." });
  }

  async function handleDisconnect() {
    if (!disconnectTarget) return;
    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/social-accounts/${disconnectTarget.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to disconnect");
      toast({ title: "Disconnected", description: `${disconnectTarget.name} was disconnected.` });
      await fetchAccounts();
    } catch (error) {
      toast({
        title: "Could not disconnect",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
      setDisconnectTarget(null);
    }
  }

  function getTokenStatus(account: SocialAccount): { label: string; color: string; expired: boolean } {
    if (!account.tokenExpiresAt) return { label: "No expiry", color: "text-emerald-600", expired: false };
    const daysLeft = Math.ceil((new Date(account.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: "Expired", color: "text-red-600", expired: true };
    if (daysLeft <= 3) return { label: `Expires in ${daysLeft}d`, color: "text-red-600", expired: false };
    if (daysLeft <= 14) return { label: `Expires in ${daysLeft}d`, color: "text-amber-600", expired: false };
    return { label: `Expires in ${daysLeft}d`, color: "text-emerald-600", expired: false };
  }

  const groupedAccounts = useMemo(() => {
    return accounts.reduce((acc, account) => {
      const key = basePlatform(account.platform);
      if (!acc[key]) acc[key] = [];
      acc[key].push(account);
      return acc;
    }, {} as Record<string, SocialAccount[]>);
  }, [accounts]);

  const publishingAccounts = accounts.filter((account) => basePlatform(account.platform) !== "whatsapp");
  const whatsappAccounts = groupedAccounts.whatsapp || [];
  const accountLimit = accountMeta.accountLimit;
  const connectedCount = accounts.length;
  const remainingSlots = accountLimit === null ? null : Math.max(0, accountLimit - connectedCount);
  const usagePercent = accountLimit === null || accountLimit === 0 ? 100 : Math.min(100, Math.round((connectedCount / accountLimit) * 100));
  const isAtLimit = accountLimit !== null && connectedCount >= accountLimit;
  const expiredCount = accounts.filter((account) => getTokenStatus(account).expired).length;

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-2xl border bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_34%)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                <Link2 className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold">Connection command center</h1>
                <p className="text-sm text-muted-foreground">
                  Manage publishing channels, WhatsApp Business, and Google Business Profile without losing context.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-9" onClick={() => document.getElementById("publishing-channels")?.scrollIntoView({ behavior: "smooth" })}>
              <Send className="mr-2 h-4 w-4" />
              Channels
            </Button>
            <Button variant="outline" className="h-9" onClick={() => document.getElementById("whatsapp-business")?.scrollIntoView({ behavior: "smooth" })}>
              <MessageCircle className="mr-2 h-4 w-4 text-emerald-600" />
              WhatsApp
            </Button>
            <Button className="h-9 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => document.getElementById("google-business")?.scrollIntoView({ behavior: "smooth" })}>
              <SearchCheck className="mr-2 h-4 w-4" />
              Google Listing
            </Button>
            <Button variant="ghost" onClick={handleRefresh} disabled={isRefreshing} className="h-9">
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <CommandMetric icon={Send} label="Publishing profiles" value={String(publishingAccounts.length)} tone="brand" />
          <CommandMetric icon={MessageCircle} label="WhatsApp numbers" value={String(whatsappAccounts.length)} tone="emerald" />
          <CommandMetric icon={SearchCheck} label="Google profile" value={googleBusiness.connected ? "Live" : "Not connected"} tone={googleBusiness.connected ? "emerald" : "amber"} />
          <CommandMetric icon={ShieldCheck} label="Connection health" value={expiredCount ? `${expiredCount} expired` : "Healthy"} tone={expiredCount ? "amber" : "blue"} />
        </div>
        {accountLimit !== null && <Progress value={usagePercent} className="mt-4 h-1.5" />}
      </section>

      <section id="publishing-channels" className="scroll-mt-24 grid gap-5 xl:grid-cols-[1fr_0.86fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/10 text-sky-600">
                  <Radio className="h-4 w-4" />
                </span>
                Publishing channels
              </span>
              <Badge variant={isAtLimit ? "destructive" : "secondary"}>
                {connectedCount} / {formatSocialAccountLimit(accountLimit)}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              These channels are used for posts, scheduled publishing, and campaign distribution. WhatsApp and Google are managed in their own sections below.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {PUBLISHING_PLATFORMS.map((platform) => {
                const isConnected = !!groupedAccounts[platform.id];
                const disableConnect = isAtLimit && !isConnected;
                return (
                  <PlatformConnectCard
                    key={platform.id}
                    platform={platform}
                    connectedCount={groupedAccounts[platform.id]?.length || 0}
                    disabled={disableConnect}
                    onConnect={() => {
                      if (!disableConnect) window.location.href = platform.connectUrl;
                    }}
                  />
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

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              Connected publishing profiles
              <Badge variant="secondary">{publishingAccounts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectedAccountsList
              isLoading={isLoading}
              groupedAccounts={Object.fromEntries(Object.entries(groupedAccounts).filter(([platform]) => platform !== "whatsapp"))}
              getTokenStatus={getTokenStatus}
              onDisconnect={(account, platform) => setDisconnectTarget({ id: account.id, platform, name: account.platformDisplayName })}
            />
          </CardContent>
        </Card>
      </section>

      <section id="whatsapp-business" className="scroll-mt-24 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <WhatsAppBusinessPanel
          accounts={whatsappAccounts}
          isLoading={isLoading}
          isAtLimit={isAtLimit}
          getTokenStatus={getTokenStatus}
          onConnect={() => {
            if (!isAtLimit || whatsappAccounts.length > 0) window.location.href = "/api/social/whatsapp/connect";
          }}
          onDisconnect={(account) => setDisconnectTarget({ id: account.id, platform: "whatsapp", name: account.platformDisplayName })}
        />
        <Card className="border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_32%)] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <ClipboardList className="h-4 w-4" />
              </span>
              WhatsApp Business abilities
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              WhatsApp is more than a channel. It powers inbox conversations, approved templates, customer automations, and status updates.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <AbilityCard icon={Inbox} title="Inbox" description="Reply to customer conversations and keep message history tied to the connected number." href="/whatsapp?tab=inbox" />
            <AbilityCard icon={ClipboardList} title="Templates" description="Create and manage Meta-approved WhatsApp templates for campaigns and automations." href="/whatsapp?tab=templates" />
            <AbilityCard icon={RefreshCw} title="Automations" description="Trigger customer follow-ups, reminders, and campaign messages from verified flows." href="/whatsapp?tab=automations" />
            <AbilityCard icon={Radio} title="Status" description="Publish image or video status updates when the connected account supports it." href="/whatsapp?tab=status" />
          </CardContent>
        </Card>
      </section>

      <GoogleBusinessPanel google={googleBusiness} routerPush={router.push} />

      {errorPanel && (
        <FloatingPanel onClose={() => setErrorPanel(null)} title={errorPanel.title} icon={<AlertCircle className="h-4 w-4 text-amber-600" />}>
          <p className="text-sm text-muted-foreground">{errorPanel.description}</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {errorPanel.actionUrl && (
              <Button
                onClick={() => {
                  if (errorPanel.actionUrl?.startsWith("/")) router.push(errorPanel.actionUrl);
                  else window.open(errorPanel.actionUrl, "_blank", "noopener,noreferrer");
                }}
              >
                {errorPanel.actionLabel || "Open"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" onClick={() => setErrorPanel(null)}>Close</Button>
          </div>
        </FloatingPanel>
      )}

      {disconnectTarget && (
        <FloatingPanel onClose={() => setDisconnectTarget(null)} title="Disconnect profile" icon={<Trash2 className="h-4 w-4 text-red-600" />}>
          <p className="text-sm text-muted-foreground">
            Disconnect <span className="font-semibold text-foreground">{disconnectTarget.name}</span>? Scheduled posts and automations will not be able to use this profile until it is reconnected.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDisconnectTarget(null)} disabled={isDisconnecting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
              {isDisconnecting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}

function CommandMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "brand" | "emerald" | "amber" | "blue";
}) {
  const toneClass = {
    brand: "bg-brand-500/10 text-brand-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    blue: "bg-blue-500/10 text-blue-600",
  }[tone];
  return (
    <div className="rounded-xl border bg-background/78 p-3">
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

function PlatformConnectCard({
  platform,
  connectedCount,
  disabled,
  onConnect,
}: {
  platform: { id: string; name: string; connectUrl: string };
  connectedCount: number;
  disabled: boolean;
  onConnect: () => void;
}) {
  const meta = PLATFORM_META[platform.id as keyof typeof PLATFORM_META];
  const Icon = meta?.icon || Link2;
  return (
    <button
      type="button"
      onClick={onConnect}
      disabled={disabled}
      className={`group flex min-h-[92px] items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${
        disabled
          ? "cursor-not-allowed bg-muted/30 opacity-60"
          : "bg-background hover:-translate-y-0.5 hover:border-brand-500/50 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${PLATFORM_COLORS[platform.id] || "from-gray-500 to-gray-700"}`}>
          <Icon className="h-5 w-5 text-white" />
        </span>
        <div>
          <p className="font-semibold">{platform.name}</p>
          <p className="text-xs text-muted-foreground">
            {disabled ? "Upgrade required" : connectedCount ? `${connectedCount} connected` : "Connect for publishing"}
          </p>
        </div>
      </div>
      {disabled ? <Lock className="h-4 w-4 text-muted-foreground" /> : connectedCount ? <Check className="h-5 w-5 text-emerald-600" /> : <Plus className="h-5 w-5 text-muted-foreground group-hover:text-brand-600" />}
    </button>
  );
}

function ConnectedAccountsList({
  isLoading,
  groupedAccounts,
  getTokenStatus,
  onDisconnect,
}: {
  isLoading: boolean;
  groupedAccounts: Record<string, SocialAccount[]>;
  getTokenStatus: (account: SocialAccount) => { label: string; color: string; expired: boolean };
  onDisconnect: (account: SocialAccount, platform: string) => void;
}) {
  const entries = Object.entries(groupedAccounts);
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-xl" />)}
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
        <Link2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
        <p className="font-semibold">No publishing profiles connected yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Use the channel cards to connect the accounts that can publish posts.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {entries.map(([platform, platformAccounts]) => {
        const meta = PLATFORM_META[platform as keyof typeof PLATFORM_META];
        const Icon = meta?.icon || Link2;
        return (
          <div key={platform} className="rounded-2xl border bg-muted/20 p-3">
            <div className="mb-3 flex items-center gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${PLATFORM_COLORS[platform] || "from-gray-500 to-gray-700"}`}>
                <Icon className="h-5 w-5 text-white" />
              </span>
              <div>
                <p className="font-semibold">{meta?.label || platform}</p>
                <p className="text-xs text-muted-foreground">{platformAccounts.length} connected profile{platformAccounts.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            <div className="grid gap-2">
              {platformAccounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  platform={platform}
                  getTokenStatus={getTokenStatus}
                  onDisconnect={onDisconnect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AccountRow({
  account,
  platform,
  getTokenStatus,
  onDisconnect,
}: {
  account: SocialAccount;
  platform: string;
  getTokenStatus: (account: SocialAccount) => { label: string; color: string; expired: boolean };
  onDisconnect: (account: SocialAccount, platform: string) => void;
}) {
  const meta = PLATFORM_META[platform as keyof typeof PLATFORM_META];
  const Icon = meta?.icon || Link2;
  const tokenStatus = getTokenStatus(account);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3">
      <div className="flex min-w-0 items-center gap-3">
        {account.platformAvatarUrl ? (
          <img src={account.platformAvatarUrl} alt="" className="h-11 w-11 rounded-full border object-cover" />
        ) : (
          <span className="relative grid h-11 w-11 place-items-center rounded-full border bg-muted text-sm font-bold">
            {initials(account.platformDisplayName)}
            <span className={`absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br ${PLATFORM_COLORS[platform] || "from-gray-500 to-gray-700"} text-white`}>
              <Icon className="h-3 w-3" />
            </span>
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{account.platformDisplayName || meta?.label || platform}</p>
          <p className="truncate text-xs text-muted-foreground">{account.platformUsername || account.platformUserId}</p>
          <p className={`mt-0.5 text-xs ${tokenStatus.color}`}>{tokenStatus.label}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline" className={tokenStatus.expired ? "border-red-500/50 text-red-600" : "border-emerald-500/50 text-emerald-600"}>
          {tokenStatus.expired ? <AlertCircle className="mr-1 h-3 w-3" /> : <Check className="mr-1 h-3 w-3" />}
          {tokenStatus.expired ? "Expired" : "Connected"}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-600"
          onClick={() => onDisconnect(account, platform)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function WhatsAppBusinessPanel({
  accounts,
  isLoading,
  isAtLimit,
  getTokenStatus,
  onConnect,
  onDisconnect,
}: {
  accounts: SocialAccount[];
  isLoading: boolean;
  isAtLimit: boolean;
  getTokenStatus: (account: SocialAccount) => { label: string; color: string; expired: boolean };
  onConnect: () => void;
  onDisconnect: (account: SocialAccount) => void;
}) {
  const hasAccounts = accounts.length > 0;
  return (
    <Card className="border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_34%)] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <MessageCircle className="h-4 w-4" />
            </span>
            WhatsApp Business
          </span>
          <Badge className={hasAccounts ? "bg-emerald-600" : "bg-amber-600"}>
            {hasAccounts ? `${accounts.length} connected` : "Not connected"}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage WhatsApp separately from social publishing so templates, inbox, and automation permissions stay clear.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : hasAccounts ? (
          <div className="space-y-2">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                platform="whatsapp"
                getTokenStatus={getTokenStatus}
                onDisconnect={(account) => onDisconnect(account)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-emerald-500/30 bg-background/70 p-5">
            <p className="font-semibold">No WhatsApp Business number connected.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect WhatsApp when you want to send customer messages, approved templates, status updates, or automation follow-ups.
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onConnect} disabled={isAtLimit && !hasAccounts} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {isAtLimit && !hasAccounts ? <Lock className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {hasAccounts ? "Add or refresh WhatsApp" : "Connect WhatsApp Business"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/whatsapp">
              Open WhatsApp workspace
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AbilityCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border bg-background/80 p-4 transition hover:-translate-y-0.5 hover:border-emerald-500/35 hover:shadow-sm">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

function GoogleBusinessPanel({
  google,
  routerPush,
}: {
  google: GoogleBusinessSummary;
  routerPush: (href: string) => void;
}) {
  const connected = google.connected;
  const score = connected ? google.seoHealthScore : 82;
  const rating = connected && google.rating ? google.rating.toFixed(1) : "4.8";
  const reviews = connected ? google.reviewCount : 128;
  const coverage = connected ? google.coverageScore : 76;
  const citation = connected ? google.citationScore : 74;
  const consistency = connected ? google.consistencyScore : 79;
  const reviewScore = connected ? google.reviewScore : 88;

  return (
    <section id="google-business" className="scroll-mt-24">
      <Card className="overflow-hidden border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.13),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_34%)] shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <SearchCheck className="h-4 w-4" />
                </span>
                Google Business Profile and SEO health
                <Badge className={connected ? "bg-emerald-600" : "bg-amber-600"}>
                  {connected ? "Live connected" : "Not connected"}
                </Badge>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                This is the dedicated place for Google listing connection, local SEO health, reviews, and visibility tracking.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => routerPush(connected ? google.dashboardHref : google.connectHref)}
              >
                {connected ? "Manage Google profile" : "Connect Google profile"}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
              {connected && google.listingUrl && (
                <Button variant="outline" onClick={() => window.open(google.listingUrl!, "_blank", "noopener,noreferrer")}>
                  Open listing
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!connected && (
            <div className="mb-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Google Business Profile is not connected. The stats below are example placeholders, not your real business data.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    After connection, FlowSmartly will pull live Google listing status, reviews, local SEO health, and monthly recommendations.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border bg-background/80 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-white shadow-sm">
                      <span className="text-xl font-black text-blue-600">G</span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold">{google.businessName}</p>
                      <p className="truncate text-sm text-muted-foreground">{google.address || google.website || "Google Business Profile"}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    <InfoLine icon={MapPin} value={google.address || "Address sync after connection"} />
                    <InfoLine icon={Phone} value={google.phone || "Phone sync after connection"} />
                    <InfoLine icon={Globe2} value={google.website || "Website sync after connection"} />
                    <InfoLine icon={RefreshCw} value={`Last checked: ${formatDate(google.lastCheckedAt)}`} />
                  </div>
                </div>
                <div
                  className="grid h-24 w-24 shrink-0 place-items-center rounded-full p-2"
                  style={{ background: `conic-gradient(rgb(16 185 129) ${score * 3.6}deg, rgb(229 231 235) 0deg)` }}
                >
                  <div className="grid h-full w-full place-items-center rounded-full bg-background text-center">
                    <p className="text-xl font-black">{score}</p>
                    <p className="-mt-1 text-[9px] uppercase text-muted-foreground">SEO score</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <GoogleStat icon={Star} label="Rating" value={rating} helper={`${reviews} reviews`} />
                <GoogleStat icon={SearchCheck} label="Coverage" value={`${coverage}`} helper="Local listing reach" />
                <GoogleStat icon={BadgeCheck} label="Status" value={connected ? "Live" : "Preview"} helper={google.status.replace(/_/g, " ")} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SeoHealthCard icon={ShieldCheck} label="Citation health" value={citation} description="Business name, address, and phone consistency across local directories." />
              <SeoHealthCard icon={MapPin} label="Location coverage" value={coverage} description="How much of the local listing footprint is live and discoverable." />
              <SeoHealthCard icon={Star} label="Review strength" value={reviewScore} description="Rating, review volume, and customer proof quality." />
              <SeoHealthCard icon={SearchCheck} label="NAP consistency" value={consistency} description="How consistently Google and listing directories describe the business." />
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function InfoLine({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/35 px-2.5 py-2 text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
      <span className="min-w-0 truncate">{value}</span>
    </div>
  );
}

function GoogleStat({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-4 w-4 text-emerald-600" />
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
}

function SeoHealthCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border bg-background/78 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-2xl font-black">{Math.round(value)}</span>
      </div>
      <p className="mt-3 font-semibold">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Progress value={Math.max(0, Math.min(100, value))} className="mt-3 h-1.5" />
    </div>
  );
}

function FloatingPanel({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed right-4 top-24 z-50 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-background shadow-2xl"
    >
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted">{icon}</span>
          <p className="font-semibold">{title}</p>
        </div>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
}
