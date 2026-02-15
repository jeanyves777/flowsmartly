import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/earnings - Get user's earnings data
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
    const range = searchParams.get("range") || "30d";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch earnings data
    const [
      earnings,
      totalEarnings,
      totalEarningsAllTime,
      pendingPayouts,
      completedPayouts,
      earningsBySource,
      recentPayouts,
    ] = await Promise.all([
      // Earnings for this period with pagination
      prisma.earning.findMany({
        where: { userId: session.userId, createdAt: { gte: startDate } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      // Total earnings this period
      prisma.earning.aggregate({
        where: { userId: session.userId, createdAt: { gte: startDate } },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
      // All-time earnings
      prisma.earning.aggregate({
        where: { userId: session.userId },
        _sum: { amountCents: true },
      }),
      // Pending payouts
      prisma.payout.aggregate({
        where: { userId: session.userId, status: "PENDING" },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
      // Completed payouts
      prisma.payout.aggregate({
        where: { userId: session.userId, status: "COMPLETED" },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
      // Earnings by source
      prisma.earning.groupBy({
        by: ["source"],
        where: { userId: session.userId, createdAt: { gte: startDate } },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
      // Recent payouts
      prisma.payout.findMany({
        where: { userId: session.userId },
        orderBy: { requestedAt: "desc" },
        take: 5,
      }),
    ]);

    // Get user's current balance
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { balanceCents: true },
    });

    // Format earnings by source
    const sourceBreakdown = earningsBySource.map(s => ({
      source: s.source,
      amount: (s._sum.amountCents || 0) / 100,
      count: s._count.id,
    }));

    // Daily earnings for chart
    const dailyEarnings = await prisma.earning.groupBy({
      by: ["createdAt"],
      where: { userId: session.userId, createdAt: { gte: startDate } },
      _sum: { amountCents: true },
    });

    // Aggregate by day
    const dayMap = new Map<string, number>();
    dailyEarnings.forEach(e => {
      const date = e.createdAt.toISOString().split("T")[0];
      const existing = dayMap.get(date) || 0;
      dayMap.set(date, existing + (e._sum.amountCents || 0));
    });

    const chartData = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        amount: amount / 100,
      }));

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          currentBalance: (user?.balanceCents || 0) / 100,
          periodEarnings: (totalEarnings._sum.amountCents || 0) / 100,
          allTimeEarnings: (totalEarningsAllTime._sum.amountCents || 0) / 100,
          pendingPayouts: (pendingPayouts._sum.amountCents || 0) / 100,
          completedPayouts: (completedPayouts._sum.amountCents || 0) / 100,
          transactionCount: totalEarnings._count.id,
        },
        earnings: earnings.map(e => ({
          id: e.id,
          amount: e.amountCents / 100,
          source: e.source,
          sourceId: e.sourceId,
          createdAt: e.createdAt.toISOString(),
        })),
        sourceBreakdown,
        chartData,
        recentPayouts: recentPayouts.map(p => ({
          id: p.id,
          amount: p.amountCents / 100,
          method: p.method,
          status: p.status.toLowerCase(),
          requestedAt: p.requestedAt.toISOString(),
          processedAt: p.processedAt?.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total: totalEarnings._count.id,
          pages: Math.ceil(totalEarnings._count.id / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get earnings error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch earnings" } },
      { status: 500 }
    );
  }
}

// POST /api/earnings/payout - Request a payout
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Block agent impersonation from financial actions
    if (session.agentId) {
      return NextResponse.json(
        { success: false, error: { message: "This action is restricted in agent mode" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { amount, method, accountInfo } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid amount" } },
        { status: 400 }
      );
    }

    if (!method || !["PAYPAL", "BANK", "STRIPE"].includes(method)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid payout method" } },
        { status: 400 }
      );
    }

    // Get user's current balance
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { balanceCents: true },
    });

    const amountCents = Math.round(amount * 100);

    if (!user || user.balanceCents < amountCents) {
      return NextResponse.json(
        { success: false, error: { message: "Insufficient balance" } },
        { status: 400 }
      );
    }

    // Minimum payout amount check ($10)
    if (amountCents < 1000) {
      return NextResponse.json(
        { success: false, error: { message: "Minimum payout amount is $10" } },
        { status: 400 }
      );
    }

    // Create payout request and deduct from balance
    const [payout] = await prisma.$transaction([
      prisma.payout.create({
        data: {
          userId: session.userId,
          amountCents,
          method,
          accountInfo: JSON.stringify(accountInfo || {}),
          status: "PENDING",
        },
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: { balanceCents: { decrement: amountCents } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        payout: {
          id: payout.id,
          amount: payout.amountCents / 100,
          method: payout.method,
          status: payout.status.toLowerCase(),
          requestedAt: payout.requestedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Request payout error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to request payout" } },
      { status: 500 }
    );
  }
}
