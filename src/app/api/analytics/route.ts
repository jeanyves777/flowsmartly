import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/analytics - Get user's analytics data
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "7d";

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (range) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default: // 7d
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));

    // Fetch user's post analytics
    const [
      totalViews,
      previousViews,
      totalLikes,
      previousLikes,
      totalComments,
      previousComments,
      totalFollowers,
      previousFollowers,
      postsThisPeriod,
      topPosts,
    ] = await Promise.all([
      // Total views in period
      prisma.post.aggregate({
        where: { userId: session.userId, createdAt: { gte: startDate } },
        _sum: { viewCount: true },
      }),
      // Previous period views
      prisma.post.aggregate({
        where: { userId: session.userId, createdAt: { gte: previousStartDate, lt: startDate } },
        _sum: { viewCount: true },
      }),
      // Total likes
      prisma.post.aggregate({
        where: { userId: session.userId, createdAt: { gte: startDate } },
        _sum: { likeCount: true },
      }),
      // Previous likes
      prisma.post.aggregate({
        where: { userId: session.userId, createdAt: { gte: previousStartDate, lt: startDate } },
        _sum: { likeCount: true },
      }),
      // Total comments
      prisma.post.aggregate({
        where: { userId: session.userId, createdAt: { gte: startDate } },
        _sum: { commentCount: true },
      }),
      // Previous comments
      prisma.post.aggregate({
        where: { userId: session.userId, createdAt: { gte: previousStartDate, lt: startDate } },
        _sum: { commentCount: true },
      }),
      // Followers count
      prisma.follow.count({
        where: { followingId: session.userId, createdAt: { gte: startDate } },
      }),
      // Previous followers
      prisma.follow.count({
        where: { followingId: session.userId, createdAt: { gte: previousStartDate, lt: startDate } },
      }),
      // Posts created this period
      prisma.post.count({
        where: { userId: session.userId, createdAt: { gte: startDate } },
      }),
      // Top performing posts
      prisma.post.findMany({
        where: { userId: session.userId, status: "PUBLISHED" },
        orderBy: { viewCount: "desc" },
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
    ]);

    // Calculate growth percentages
    const calcGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const viewsTotal = totalViews._sum.viewCount || 0;
    const viewsPrevious = previousViews._sum.viewCount || 0;
    const likesTotal = totalLikes._sum.likeCount || 0;
    const likesPrevious = previousLikes._sum.likeCount || 0;
    const commentsTotal = totalComments._sum.commentCount || 0;
    const commentsPrevious = previousComments._sum.commentCount || 0;

    // Get engagement rate (likes + comments / views)
    const engagementRate = viewsTotal > 0
      ? Math.round(((likesTotal + commentsTotal) / viewsTotal) * 100 * 10) / 10
      : 0;

    // Boosted vs Organic breakdown
    const [boostedStats, organicStats, boostedPostCount, organicPostCount] = await Promise.all([
      prisma.post.aggregate({
        where: { userId: session.userId, createdAt: { gte: startDate }, isPromoted: true },
        _sum: { viewCount: true, likeCount: true, commentCount: true, shareCount: true },
      }),
      prisma.post.aggregate({
        where: { userId: session.userId, createdAt: { gte: startDate }, isPromoted: false },
        _sum: { viewCount: true, likeCount: true, commentCount: true, shareCount: true },
      }),
      prisma.post.count({
        where: { userId: session.userId, createdAt: { gte: startDate }, isPromoted: true },
      }),
      prisma.post.count({
        where: { userId: session.userId, createdAt: { gte: startDate }, isPromoted: false },
      }),
    ]);

    // Ad campaign stats for user
    const [activeCampaigns, totalAdSpent, totalImpressions, totalAdEarnings] = await Promise.all([
      prisma.adCampaign.count({ where: { userId: session.userId, status: "ACTIVE" } }),
      prisma.adCampaign.aggregate({
        where: { userId: session.userId },
        _sum: { spentCents: true },
      }),
      prisma.adCampaign.aggregate({
        where: { userId: session.userId },
        _sum: { impressions: true },
      }),
      prisma.earning.aggregate({
        where: { userId: session.userId, source: "AD_VIEW" },
        _sum: { amountCents: true },
      }),
    ]);

    // Shares total
    const totalShares = await prisma.post.aggregate({
      where: { userId: session.userId, createdAt: { gte: startDate } },
      _sum: { shareCount: true },
    });
    const sharesTotal = totalShares._sum.shareCount || 0;

    // Get daily data for chart
    const posts = await prisma.post.findMany({
      where: {
        userId: session.userId,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        isPromoted: true,
      },
    });

    // Aggregate by day
    const dayMap = new Map<string, { views: number; likes: number; comments: number; posts: number; boostedViews: number; organicViews: number }>();
    posts.forEach(post => {
      const date = post.createdAt.toISOString().split("T")[0];
      const existing = dayMap.get(date) || { views: 0, likes: 0, comments: 0, posts: 0, boostedViews: 0, organicViews: 0 };
      existing.views += post.viewCount;
      existing.likes += post.likeCount;
      existing.comments += post.commentCount;
      existing.posts += 1;
      if (post.isPromoted) {
        existing.boostedViews += post.viewCount;
      } else {
        existing.organicViews += post.viewCount;
      }
      dayMap.set(date, existing);
    });

    const chartData = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        ...data,
      }));

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          views: viewsTotal,
          viewsChange: calcGrowth(viewsTotal, viewsPrevious),
          likes: likesTotal,
          likesChange: calcGrowth(likesTotal, likesPrevious),
          comments: commentsTotal,
          commentsChange: calcGrowth(commentsTotal, commentsPrevious),
          followers: totalFollowers,
          followersChange: calcGrowth(totalFollowers, previousFollowers),
          engagementRate,
          postsThisPeriod,
          shares: sharesTotal,
        },
        boostedVsOrganic: {
          boosted: {
            posts: boostedPostCount,
            views: boostedStats._sum.viewCount || 0,
            likes: boostedStats._sum.likeCount || 0,
            comments: boostedStats._sum.commentCount || 0,
            shares: boostedStats._sum.shareCount || 0,
          },
          organic: {
            posts: organicPostCount,
            views: organicStats._sum.viewCount || 0,
            likes: organicStats._sum.likeCount || 0,
            comments: organicStats._sum.commentCount || 0,
            shares: organicStats._sum.shareCount || 0,
          },
        },
        adStats: {
          activeCampaigns,
          totalSpent: (totalAdSpent._sum.spentCents || 0) / 100,
          totalImpressions: totalImpressions._sum.impressions || 0,
          totalEarned: (totalAdEarnings._sum.amountCents || 0) / 100,
        },
        chartData,
        topPosts: topPosts.map(post => ({
          id: post.id,
          content: post.caption?.substring(0, 100) + (post.caption && post.caption.length > 100 ? "..." : ""),
          views: post.viewCount,
          likes: post.likeCount,
          comments: post.commentCount,
          createdAt: post.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch analytics" } },
      { status: 500 }
    );
  }
}
