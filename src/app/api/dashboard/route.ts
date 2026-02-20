import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { presignAllUrls } from "@/lib/utils/s3-client";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Get user's stats in parallel
    const [
      user,
      brandKit,
      postsCount,
      totalViews,
      totalLikes,
      totalComments,
      followersCount,
      followingCount,
      totalEarnings,
      recentPosts,
      aiUsageCount,
      // Agent profile (if exists)
      agentProfile,
      // Trending topics
      trendingTags,
      // Sponsored / promoted posts for sidebar
      promotedPosts,
      // Ad campaigns
      adCampaigns,
      // Trending posts (most engaged)
      trendingPosts,
    ] = await Promise.all([
      // Get user with credits
      prisma.user.findUnique({
        where: { id: userId },
        select: { aiCredits: true, plan: true, name: true, avatarUrl: true },
      }),
      // Check if user has a brand kit set up
      prisma.brandKit.findFirst({
        where: { userId, isDefault: true },
        select: { id: true, name: true, isComplete: true },
      }),
      // Posts count
      prisma.post.count({ where: { userId, deletedAt: null } }),
      // Total views from posts
      prisma.post.aggregate({
        where: { userId, deletedAt: null },
        _sum: { viewCount: true },
      }),
      // Total likes from posts
      prisma.post.aggregate({
        where: { userId, deletedAt: null },
        _sum: { likeCount: true },
      }),
      // Total comments from posts
      prisma.post.aggregate({
        where: { userId, deletedAt: null },
        _sum: { commentCount: true },
      }),
      // Followers count
      prisma.follow.count({ where: { followingId: userId } }),
      // Following count
      prisma.follow.count({ where: { followerId: userId } }),
      // Total earnings
      prisma.earning.aggregate({
        where: { userId },
        _sum: { amountCents: true },
      }),
      // Recent posts for activity
      prisma.post.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          caption: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          createdAt: true,
        },
      }),
      // AI usage this month
      prisma.aIUsage.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(new Date().setDate(1)),
          },
        },
      }),
      // Agent profile
      prisma.agentProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          status: true,
          specialties: true,
          minPricePerMonth: true,
          performanceScore: true,
          totalEarningsCents: true,
          clientCount: true,
          reviews: {
            select: { rating: true },
          },
          _count: {
            select: {
              reviews: true,
              clients: true,
            },
          },
        },
      }),
      // Trending tags (top 5 from recent posts — parse JSON hashtags like /api/feed/trending)
      prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          hashtags: { not: "[]" },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { hashtags: true },
      }),
      // Promoted posts
      prisma.post.findMany({
        where: {
          isPromoted: true,
          deletedAt: null,
          status: "PUBLISHED",
          userId: { not: userId },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          caption: true,
          mediaUrl: true,
          campaignId: true,
          user: {
            select: { name: true, avatarUrl: true },
          },
        },
      }),
      // Active ad campaigns
      prisma.adCampaign.findMany({
        where: {
          status: "ACTIVE",
          userId: { not: userId },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          name: true,
          headline: true,
          description: true,
          mediaUrl: true,
          destinationUrl: true,
          ctaText: true,
        },
      }),
      // Trending posts (most engagement in last 7 days)
      prisma.post.findMany({
        where: {
          deletedAt: null,
          status: "PUBLISHED",
          userId: { not: userId },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: [
          { likeCount: "desc" },
          { commentCount: "desc" },
          { viewCount: "desc" },
        ],
        take: 3,
        select: {
          id: true,
          caption: true,
          mediaUrl: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          user: {
            select: { name: true, avatarUrl: true },
          },
        },
      }),
    ]);

    // Calculate engagement (likes + comments)
    const engagement = (totalLikes._sum.likeCount || 0) + (totalComments._sum.commentCount || 0);

    // Format earnings
    const earningsCents = totalEarnings._sum.amountCents || 0;
    const earningsFormatted = (earningsCents / 100).toFixed(2);

    // Build recent activity from real data
    const recentActivity = recentPosts.map((post) => ({
      type: "post",
      title: post.caption ? post.caption.substring(0, 50) + (post.caption.length > 50 ? "..." : "") : "New post",
      views: post.viewCount,
      likes: post.likeCount,
      comments: post.commentCount,
      createdAt: post.createdAt,
    }));

    // Agent stats (if user is an agent)
    let agentStats = null;
    if (agentProfile) {
      const avgRating = agentProfile.reviews.length > 0
        ? agentProfile.reviews.reduce((sum, r) => sum + r.rating, 0) / agentProfile.reviews.length
        : 0;
      agentStats = {
        isApproved: agentProfile.status === "APPROVED",
        status: agentProfile.status,
        totalClients: agentProfile._count.clients,
        totalReviews: agentProfile._count.reviews,
        avgRating: Math.round(avgRating * 10) / 10,
        minPricePerMonth: agentProfile.minPricePerMonth,
        performanceScore: agentProfile.performanceScore,
        totalEarnings: (agentProfile.totalEarningsCents / 100).toFixed(2),
        specialties: agentProfile.specialties,
      };
    }

    // Process trending tags — parse JSON hashtags array per post, count individual tags
    const hashtagCounts: Record<string, number> = {};
    if (Array.isArray(trendingTags)) {
      (trendingTags as Array<{ hashtags: string | null }>).forEach((post) => {
        try {
          const tags: string[] = JSON.parse(post.hashtags || "[]");
          tags.forEach((tag: string) => {
            const normalized = tag.toLowerCase();
            hashtagCounts[normalized] = (hashtagCounts[normalized] || 0) + 1;
          });
        } catch { /* skip malformed */ }
      });
    }
    const trending = Object.entries(hashtagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({
        tag: tag.startsWith("#") ? tag : `#${tag}`,
        postCount: count,
      }));

    // Sidebar data
    const sidebar = {
      sponsoredAds: adCampaigns.map((ad) => ({
        id: ad.id,
        name: ad.name,
        headline: ad.headline,
        description: ad.description,
        mediaUrl: ad.mediaUrl,
        destinationUrl: ad.destinationUrl,
        ctaText: ad.ctaText,
      })),
      promotedPosts: promotedPosts.map((p) => ({
        id: p.id,
        content: p.caption || "",
        mediaUrl: p.mediaUrl || null,
        destinationUrl: null,
        authorName: p.user.name,
        authorAvatar: p.user.avatarUrl,
      })),
      trendingPosts: trendingPosts.map((p) => ({
        id: p.id,
        content: p.caption || "",
        mediaUrl: p.mediaUrl || null,
        viewCount: p.viewCount,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        authorName: p.user.name,
        authorAvatar: p.user.avatarUrl,
      })),
      trendingTopics: trending,
    };

    // Presign S3 URLs in sidebar data (avatars, media, etc.)
    const presignedSidebar = await presignAllUrls(sidebar);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          name: user?.name || "User",
          plan: user?.plan || "STARTER",
          aiCredits: user?.aiCredits || 0,
          avatarUrl: user?.avatarUrl ? await presignAllUrls(user.avatarUrl) : null,
        },
        brandKit: brandKit ? {
          id: brandKit.id,
          name: brandKit.name,
          isComplete: brandKit.isComplete,
        } : null,
        stats: {
          totalViews: totalViews._sum.viewCount || 0,
          engagement,
          followers: followersCount,
          following: followingCount,
          earnings: parseFloat(earningsFormatted),
          postsCount,
        },
        aiUsage: {
          thisMonth: aiUsageCount,
        },
        recentActivity,
        agentStats,
        sidebar: presignedSidebar,
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch dashboard data" } },
      { status: 500 }
    );
  }
}
