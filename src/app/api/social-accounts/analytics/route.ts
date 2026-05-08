import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const ANALYTICS_REFRESH_PLATFORMS = new Set(["facebook", "instagram", "youtube", "whatsapp"]);

type SocialAccountRecord = {
  id: string;
  platform: string;
  platformUserId: string | null;
  platformUsername: string | null;
  platformDisplayName: string | null;
  platformAvatarUrl: string | null;
  accessToken?: string | null;
  tokenExpiresAt: Date | null;
  scopes: string;
  connectedAt: Date;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  engagementRate: number | null;
  impressions: number | null;
  reach: number | null;
  profileViews: number | null;
  analyticsUpdatedAt: Date | null;
};

type RefreshResult = {
  success: boolean;
  status: "synced" | "limited" | "needs_token" | "token_expired" | "unsupported" | "sync_failed";
  message: string;
};

function normalizePlatformKey(platform: string) {
  if (platform.startsWith("facebook_")) return "facebook";
  if (platform.startsWith("instagram_")) return "instagram";
  if (platform === "x") return "twitter";
  return platform;
}

function deriveCachedStatus(account: SocialAccountRecord): RefreshResult {
  const platformKey = normalizePlatformKey(account.platform);
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() < Date.now()) {
    return { success: false, status: "token_expired", message: "Token expired. Reconnect this account to refresh live analytics." };
  }
  if (!account.accessToken && platformKey !== "whatsapp") {
    return { success: false, status: "needs_token", message: "This account is missing an access token." };
  }
  if (!ANALYTICS_REFRESH_PLATFORMS.has(platformKey)) {
    return { success: false, status: "unsupported", message: "Live analytics refresh for this platform needs a provider collector and approved API scopes." };
  }
  if (!account.analyticsUpdatedAt) {
    return { success: false, status: "limited", message: "Connected, but analytics have not been synced yet." };
  }
  return { success: true, status: "synced", message: "Analytics synced from the connected account." };
}

function formatAnalyticsAccount(account: SocialAccountRecord, refreshResult?: RefreshResult) {
  const platformKey = normalizePlatformKey(account.platform);
  const tokenExpired = account.tokenExpiresAt ? account.tokenExpiresAt.getTime() < Date.now() : false;
  const status = refreshResult || deriveCachedStatus(account);

  return {
    id: account.id,
    platform: account.platform,
    platformKey,
    platformUserId: account.platformUserId,
    platformUsername: account.platformUsername,
    platformDisplayName: account.platformDisplayName,
    platformAvatarUrl: account.platformAvatarUrl,
    followersCount: account.followersCount,
    followingCount: account.followingCount,
    postsCount: account.postsCount,
    engagementRate: account.engagementRate,
    impressions: account.impressions,
    reach: account.reach,
    profileViews: account.profileViews,
    analyticsUpdatedAt: account.analyticsUpdatedAt,
    connectedAt: account.connectedAt,
    tokenExpiresAt: account.tokenExpiresAt,
    hasAccessToken: Boolean(account.accessToken),
    tokenExpired,
    analyticsRefreshSupported: ANALYTICS_REFRESH_PLATFORMS.has(platformKey),
    analyticsStatus: status.status,
    analyticsMessage: status.message,
    scopes: account.scopes,
  };
}

function sumInsightValues(data: unknown) {
  if (!data || typeof data !== "object") return 0;
  const record = data as { values?: Array<{ value?: unknown }> };
  if (!Array.isArray(record.values)) return 0;
  return record.values.reduce((sum, item) => {
    const value = typeof item.value === "number" ? item.value : Number(item.value || 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function getInsightByName(insights: unknown, name: string) {
  if (!insights || typeof insights !== "object") return null;
  const data = (insights as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  return data.find((item) => item && typeof item === "object" && (item as { name?: string }).name === name) || null;
}

function parseNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const message = data?.error?.message || `Provider returned ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const refresh = request.nextUrl.searchParams.get("refresh") === "true";
    const accounts = await prisma.socialAccount.findMany({
      where: {
        userId: session.userId,
        isActive: true,
      },
    });

    const refreshResults = new Map<string, RefreshResult>();

    if (refresh) {
      for (const account of accounts) {
        const result = await fetchPlatformAnalytics(account);
        refreshResults.set(account.id, result);
      }
    }

    const updatedAccounts = refresh
      ? await prisma.socialAccount.findMany({
          where: {
            userId: session.userId,
            isActive: true,
          },
        })
      : accounts;

    return NextResponse.json({
      success: true,
      analytics: updatedAccounts.map((account) => formatAnalyticsAccount(account, refreshResults.get(account.id))),
      refreshSummary: refresh
        ? {
            synced: Array.from(refreshResults.values()).filter((result) => result.status === "synced").length,
            partial: Array.from(refreshResults.values()).filter((result) => result.status === "limited").length,
            blocked: Array.from(refreshResults.values()).filter((result) => !result.success).length,
          }
        : null,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch analytics" } },
      { status: 500 }
    );
  }
}

async function fetchPlatformAnalytics(account: SocialAccountRecord): Promise<RefreshResult> {
  const platform = normalizePlatformKey(account.platform);
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() < Date.now()) {
    return { success: false, status: "token_expired", message: "Token expired. Reconnect this account to refresh live analytics." };
  }
  if (!account.accessToken && platform !== "whatsapp") {
    return { success: false, status: "needs_token", message: "This account is missing an access token." };
  }

  try {
    switch (platform) {
      case "facebook":
        return await fetchFacebookAnalytics(account);
      case "instagram":
        return await fetchInstagramAnalytics(account);
      case "youtube":
        return await fetchYouTubeAnalytics(account);
      case "whatsapp":
        return await fetchWhatsAppAnalytics(account);
      default:
        return {
          success: false,
          status: "unsupported",
          message: "Live analytics refresh for this platform needs a provider collector and approved API scopes.",
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider sync failed";
    console.error(`Failed to fetch analytics for ${account.platform}:`, error);
    return { success: false, status: "sync_failed", message };
  }
}

async function fetchFacebookAnalytics(account: SocialAccountRecord): Promise<RefreshResult> {
  const fields = "fan_count,followers_count,engagement,picture.type(large)";
  const pageUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${account.platformUserId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(account.accessToken || "")}`;
  const page = await fetchJson(pageUrl);

  const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const insightsUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${account.platformUserId}/insights?metric=page_impressions,page_post_engagements,page_views_total&period=day&since=${since}&access_token=${encodeURIComponent(account.accessToken || "")}`;
  const insights = await fetchJson(insightsUrl).catch((error) => {
    console.warn("Facebook insights unavailable:", error);
    return null;
  });

  const impressions = insights ? sumInsightValues(getInsightByName(insights, "page_impressions")) : null;
  const engagements = insights ? sumInsightValues(getInsightByName(insights, "page_post_engagements")) : null;
  const profileViews = insights ? sumInsightValues(getInsightByName(insights, "page_views_total")) : null;
  const engagementRate = impressions && engagements !== null && impressions > 0
    ? Math.round((engagements / impressions) * 1000) / 10
    : null;

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      followersCount: parseNumber(page.followers_count || page.fan_count),
      impressions,
      profileViews,
      engagementRate,
      platformAvatarUrl: page.picture?.data?.url || account.platformAvatarUrl,
      analyticsUpdatedAt: new Date(),
    },
  });

  return {
    success: true,
    status: insights ? "synced" : "limited",
    message: insights
      ? "Facebook page followers and insights synced."
      : "Facebook page followers synced. Insights need the correct Page Insights permission.",
  };
}

async function fetchInstagramAnalytics(account: SocialAccountRecord): Promise<RefreshResult> {
  const fields = "followers_count,media_count,profile_picture_url,username,name";
  const profileUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${account.platformUserId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(account.accessToken || "")}`;
  const profile = await fetchJson(profileUrl);

  const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const insightsUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${account.platformUserId}/insights?metric=reach,profile_views,total_interactions&period=day&since=${since}&access_token=${encodeURIComponent(account.accessToken || "")}`;
  const insights = await fetchJson(insightsUrl).catch((error) => {
    console.warn("Instagram insights unavailable:", error);
    return null;
  });

  const reach = insights ? sumInsightValues(getInsightByName(insights, "reach")) : null;
  const profileViews = insights ? sumInsightValues(getInsightByName(insights, "profile_views")) : null;
  const interactions = insights ? sumInsightValues(getInsightByName(insights, "total_interactions")) : null;
  const engagementRate = reach && interactions !== null && reach > 0
    ? Math.round((interactions / reach) * 1000) / 10
    : null;

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      followersCount: parseNumber(profile.followers_count),
      postsCount: parseNumber(profile.media_count),
      reach,
      profileViews,
      engagementRate,
      platformUsername: profile.username || account.platformUsername,
      platformDisplayName: profile.name || account.platformDisplayName,
      platformAvatarUrl: profile.profile_picture_url || account.platformAvatarUrl,
      analyticsUpdatedAt: new Date(),
    },
  });

  return {
    success: true,
    status: insights ? "synced" : "limited",
    message: insights
      ? "Instagram profile and insights synced."
      : "Instagram profile synced. Insights need an eligible business account and approved scopes.",
  };
}

async function fetchYouTubeAnalytics(account: SocialAccountRecord): Promise<RefreshResult> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${encodeURIComponent(account.platformUserId || "")}&access_token=${encodeURIComponent(account.accessToken || "")}`;
  const data = await fetchJson(url);
  const item = data.items?.[0];

  if (!item) {
    return { success: false, status: "sync_failed", message: "YouTube channel was not returned by the provider." };
  }

  const stats = item.statistics || {};
  const snippet = item.snippet || {};

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      followersCount: parseNumber(stats.subscriberCount),
      postsCount: parseNumber(stats.videoCount),
      profileViews: parseNumber(stats.viewCount),
      platformDisplayName: snippet.title || account.platformDisplayName,
      platformAvatarUrl: snippet.thumbnails?.default?.url || snippet.thumbnails?.medium?.url || account.platformAvatarUrl,
      analyticsUpdatedAt: new Date(),
    },
  });

  return { success: true, status: "limited", message: "YouTube channel totals synced. Reach and engagement require YouTube Analytics API scopes." };
}

async function fetchWhatsAppAnalytics(account: SocialAccountRecord): Promise<RefreshResult> {
  const messageStats = await prisma.whatsAppMessage.groupBy({
    by: ["direction"],
    where: {
      conversation: {
        socialAccountId: account.id,
      },
    },
    _count: true,
  });

  const totalMessages = messageStats.reduce((sum, stat) => sum + stat._count, 0);
  const outboundMessages = messageStats
    .filter((stat) => stat.direction === "outbound")
    .reduce((sum, stat) => sum + stat._count, 0);

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      postsCount: outboundMessages,
      profileViews: totalMessages,
      analyticsUpdatedAt: new Date(),
    },
  });

  return { success: true, status: "synced", message: "WhatsApp message activity synced from FlowSmartly conversations." };
}
