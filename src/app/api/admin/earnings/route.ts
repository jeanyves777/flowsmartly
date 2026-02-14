import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get("range") || "30d";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Calculate date ranges
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    switch (dateRange) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }

    // Fetch all data in parallel
    const [
      earnings,
      totalEarnings,
      currentPeriodRevenue,
      previousPeriodRevenue,
      activeSubscriptions,
      refunds,
      previousRefunds,
      revenueBySource,
    ] = await Promise.all([
      // Recent earnings with user info
      prisma.earning.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              plan: true,
            },
          },
        },
      }),
      // Total earnings count
      prisma.earning.count(),
      // Current period revenue
      prisma.earning.aggregate({
        _sum: { amountCents: true },
        where: { createdAt: { gte: startDate } },
      }),
      // Previous period revenue
      prisma.earning.aggregate({
        _sum: { amountCents: true },
        where: { createdAt: { gte: previousStartDate, lt: startDate } },
      }),
      // Active subscriptions (users with non-expired plans)
      prisma.user.count({
        where: {
          deletedAt: null,
          plan: { not: "STARTER" },
          OR: [
            { planExpiresAt: null },
            { planExpiresAt: { gte: now } },
          ],
        },
      }),
      // Refunds in current period
      prisma.payout.aggregate({
        _sum: { amountCents: true },
        _count: true,
        where: {
          status: "COMPLETED",
          processedAt: { gte: startDate },
        },
      }),
      // Refunds in previous period
      prisma.payout.aggregate({
        _sum: { amountCents: true },
        where: {
          status: "COMPLETED",
          processedAt: { gte: previousStartDate, lt: startDate },
        },
      }),
      // Revenue by source
      prisma.earning.groupBy({
        by: ["source"],
        _sum: { amountCents: true },
        where: { createdAt: { gte: startDate } },
        orderBy: { _sum: { amountCents: "desc" } },
      }),
    ]);

    // Calculate metrics
    const currentRevenue = currentPeriodRevenue._sum.amountCents || 0;
    const previousRevenue = previousPeriodRevenue._sum.amountCents || 0;
    const revenueGrowth = previousRevenue > 0
      ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
      : currentRevenue > 0 ? 100 : 0;

    const currentRefunds = refunds._sum.amountCents || 0;
    const prevRefunds = previousRefunds._sum.amountCents || 0;
    const refundChange = prevRefunds > 0
      ? Math.round(((currentRefunds - prevRefunds) / prevRefunds) * 100)
      : currentRefunds > 0 ? 100 : 0;

    // Format earnings as transactions
    const transactions = earnings.map((earning) => ({
      id: `TXN-${earning.id.slice(-6).toUpperCase()}`,
      type: earning.source === "REFUND" ? "refund" : earning.source === "SUBSCRIPTION" ? "subscription" : "one-time",
      user: earning.user.name || earning.user.email.split("@")[0],
      email: earning.user.email,
      amount: earning.amountCents / 100,
      status: "completed",
      date: earning.createdAt.toISOString().split("T")[0],
      plan: earning.user.plan || "N/A",
    }));

    // Format revenue by source
    const totalSourceRevenue = revenueBySource.reduce((sum, s) => sum + (s._sum.amountCents || 0), 0);
    const revenueBreakdown = revenueBySource.map((source) => ({
      source: source.source,
      revenue: (source._sum.amountCents || 0) / 100,
      percentage: totalSourceRevenue > 0
        ? Math.round(((source._sum.amountCents || 0) / totalSourceRevenue) * 100)
        : 0,
    }));

    // Calculate MRR (Monthly Recurring Revenue) - simplified
    const mrr = Math.round(currentRevenue / (dateRange === "30d" ? 1 : dateRange === "7d" ? 0.23 : dateRange === "90d" ? 3 : 12));

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total: totalEarnings,
          totalPages: Math.ceil(totalEarnings / limit),
        },
        stats: {
          totalRevenue: currentRevenue / 100,
          revenueGrowth,
          mrr: mrr / 100,
          activeSubscriptions,
          refunds: currentRefunds / 100,
          refundChange,
          refundCount: refunds._count || 0,
        },
        revenueBySource: revenueBreakdown,
      },
    });
  } catch (error) {
    console.error("Admin earnings error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch earnings" } },
      { status: 500 }
    );
  }
}
