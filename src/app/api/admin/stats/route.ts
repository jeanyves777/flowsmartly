import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Get date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Fetch all stats in parallel
    const [
      totalUsers,
      usersLastMonth,
      usersPreviousMonth,
      totalPosts,
      postsLastMonth,
      totalPageViews,
      pageViewsLastMonth,
      pageViewsPreviousMonth,
      activeVisitors,
      totalRevenue,
      revenueLastMonth,
      revenuePreviousMonth,
      recentActivity,
      topPages,
      topCountries,
    ] = await Promise.all([
      // Total users
      prisma.user.count({ where: { deletedAt: null } }),
      // Users created in last 30 days
      prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null },
      }),
      // Users created in previous 30 days (for comparison)
      prisma.user.count({
        where: {
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          deletedAt: null,
        },
      }),
      // Total posts
      prisma.post.count({ where: { deletedAt: null } }),
      // Posts in last 30 days
      prisma.post.count({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null },
      }),
      // Total page views (last 30 days)
      prisma.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      // Page views last 30 days
      prisma.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      // Page views previous 30 days
      prisma.pageView.count({
        where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      // Active visitors (last 5 minutes)
      prisma.realtimeVisitor.count({
        where: {
          lastActiveAt: { gte: new Date(now.getTime() - 5 * 60 * 1000) },
        },
      }),
      // Total revenue (all time earnings)
      prisma.earning.aggregate({ _sum: { amountCents: true } }),
      // Revenue last 30 days
      prisma.earning.aggregate({
        _sum: { amountCents: true },
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      // Revenue previous 30 days
      prisma.earning.aggregate({
        _sum: { amountCents: true },
        where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      // Recent audit activity
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          userId: true,
          category: true,
          severity: true,
          createdAt: true,
          metadata: true,
        },
      }),
      // Top pages
      prisma.pageView.groupBy({
        by: ["path"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      // Top countries
      prisma.pageView.groupBy({
        by: ["country"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
        where: { createdAt: { gte: thirtyDaysAgo }, country: { not: null } },
      }),
    ]);

    // Calculate growth percentages
    const userGrowth = usersPreviousMonth > 0
      ? ((usersLastMonth - usersPreviousMonth) / usersPreviousMonth) * 100
      : usersLastMonth > 0 ? 100 : 0;

    const pageViewGrowth = pageViewsPreviousMonth > 0
      ? ((pageViewsLastMonth - pageViewsPreviousMonth) / pageViewsPreviousMonth) * 100
      : pageViewsLastMonth > 0 ? 100 : 0;

    const currentRevenue = revenueLastMonth._sum.amountCents || 0;
    const previousRevenue = revenuePreviousMonth._sum.amountCents || 0;
    const revenueGrowth = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : currentRevenue > 0 ? 100 : 0;

    // Get user info for recent activity
    const userIds = recentActivity
      .map((a) => a.userId)
      .filter((id): id is string => id !== null);

    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true },
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Format recent activity
    const formattedActivity = recentActivity.map((activity) => {
      const user = activity.userId ? userMap.get(activity.userId) : null;
      return {
        id: activity.id,
        action: activity.action,
        user: user?.email || user?.name || "System",
        category: activity.category,
        severity: activity.severity,
        time: activity.createdAt,
      };
    });

    // Format top pages
    const totalPageViewsCount = topPages.reduce((sum, p) => sum + p._count.id, 0);
    const formattedTopPages = topPages.map((page) => ({
      path: page.path,
      views: page._count.id,
      percentage: totalPageViewsCount > 0
        ? Math.round((page._count.id / totalPageViewsCount) * 100)
        : 0,
    }));

    // Format top countries
    const totalCountryViews = topCountries.reduce((sum, c) => sum + c._count.id, 0);
    const formattedTopCountries = topCountries.map((country) => ({
      country: country.country || "Unknown",
      visitors: country._count.id,
      percentage: totalCountryViews > 0
        ? Math.round((country._count.id / totalCountryViews) * 100)
        : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          userGrowth: Math.round(userGrowth * 10) / 10,
          activeUsers: usersLastMonth,
          totalPageViews: pageViewsLastMonth,
          pageViewGrowth: Math.round(pageViewGrowth * 10) / 10,
          totalPosts,
          postsGrowth: 0,
          totalRevenue: (totalRevenue._sum.amountCents || 0) / 100,
          revenueGrowth: Math.round(revenueGrowth * 10) / 10,
          activeVisitors,
        },
        recentActivity: formattedActivity,
        topPages: formattedTopPages,
        topCountries: formattedTopCountries,
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch stats" } },
      { status: 500 }
    );
  }
}
