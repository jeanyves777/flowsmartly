import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

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
    ] = await Promise.all([
      // Get user with credits
      prisma.user.findUnique({
        where: { id: userId },
        select: { aiCredits: true, plan: true, name: true },
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
            gte: new Date(new Date().setDate(1)), // First of month
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

    return NextResponse.json({
      success: true,
      data: {
        user: {
          name: user?.name || "User",
          plan: user?.plan || "STARTER",
          aiCredits: user?.aiCredits || 0,
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
