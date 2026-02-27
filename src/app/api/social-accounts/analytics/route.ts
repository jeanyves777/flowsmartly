import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/social-accounts/analytics
 * Fetches and updates analytics for all connected social accounts
 */
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

    // Get all active social accounts
    const accounts = await prisma.socialAccount.findMany({
      where: {
        userId: session.userId,
        isActive: true,
      },
    });

    // If refresh requested, fetch latest analytics from platforms
    if (refresh) {
      for (const account of accounts) {
        try {
          await fetchPlatformAnalytics(account);
        } catch (error) {
          console.error(`Failed to fetch analytics for ${account.platform}:`, error);
        }
      }

      // Re-fetch accounts with updated analytics
      const updatedAccounts = await prisma.socialAccount.findMany({
        where: {
          userId: session.userId,
          isActive: true,
        },
        select: {
          id: true,
          platform: true,
          platformDisplayName: true,
          platformAvatarUrl: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
          engagementRate: true,
          impressions: true,
          reach: true,
          profileViews: true,
          analyticsUpdatedAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        analytics: updatedAccounts,
      });
    }

    // Return cached analytics
    return NextResponse.json({
      success: true,
      analytics: accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        platformDisplayName: a.platformDisplayName,
        platformAvatarUrl: a.platformAvatarUrl,
        followersCount: a.followersCount,
        followingCount: a.followingCount,
        postsCount: a.postsCount,
        engagementRate: a.engagementRate,
        impressions: a.impressions,
        reach: a.reach,
        profileViews: a.profileViews,
        analyticsUpdatedAt: a.analyticsUpdatedAt,
      })),
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch analytics" } },
      { status: 500 }
    );
  }
}

async function fetchPlatformAnalytics(account: any) {
  if (!account.accessToken) {
    return;
  }

  // Facebook pages stored as "facebook_<pageId>", Instagram as "instagram_<igId>"
  const platform = account.platform.startsWith("facebook_") ? "facebook"
    : account.platform.startsWith("instagram_") ? "instagram"
    : account.platform;

  switch (platform) {
    case "facebook":
      await fetchFacebookAnalytics(account);
      break;
    case "instagram":
      await fetchInstagramAnalytics(account);
      break;
    case "youtube":
      await fetchYouTubeAnalytics(account);
      break;
    case "whatsapp":
      await fetchWhatsAppAnalytics(account);
      break;
    // Add more platforms as needed
  }
}

async function fetchFacebookAnalytics(account: any) {
  try {
    // Fetch page insights
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${account.platformUserId}?fields=fan_count,followers_count,engagement&access_token=${account.accessToken}`
    );

    const data = await response.json();

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        followersCount: data.fan_count || data.followers_count || 0,
        analyticsUpdatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Facebook analytics error:", error);
  }
}

async function fetchInstagramAnalytics(account: any) {
  try {
    // Fetch Instagram Business Account insights
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${account.platformUserId}?fields=followers_count,media_count,profile_picture_url&access_token=${account.accessToken}`
    );

    const data = await response.json();

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        followersCount: data.followers_count || 0,
        postsCount: data.media_count || 0,
        analyticsUpdatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Instagram analytics error:", error);
  }
}

async function fetchYouTubeAnalytics(account: any) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${account.platformUserId}&access_token=${account.accessToken}`
    );

    const data = await response.json();

    if (data.items && data.items[0]) {
      const stats = data.items[0].statistics;

      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          followersCount: parseInt(stats.subscriberCount || "0"),
          postsCount: parseInt(stats.videoCount || "0"),
          profileViews: parseInt(stats.viewCount || "0"),
          analyticsUpdatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("YouTube analytics error:", error);
  }
}

async function fetchWhatsAppAnalytics(account: any) {
  try {
    // WhatsApp analytics from our database
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

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        postsCount: totalMessages, // Using messages sent as "posts"
        analyticsUpdatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("WhatsApp analytics error:", error);
  }
}
