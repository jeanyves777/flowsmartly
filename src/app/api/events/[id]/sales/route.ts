import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/events/[id]/sales — Ticket sales dashboard data (auth required, owner only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 1. Verify event ownership
    const event = await prisma.event.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: { message: "Event not found" } },
        { status: 404 }
      );
    }

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const skip = (page - 1) * limit;

    // 3. Build search filter
    const searchFilter = search
      ? {
          OR: [
            { buyerEmail: { contains: search } },
            { buyerName: { contains: search } },
          ],
        }
      : {};

    // 4. Get aggregated summary for COMPLETED orders
    const [completedAgg, refundAgg] = await Promise.all([
      prisma.ticketOrder.aggregate({
        where: { eventId: id, status: "COMPLETED" },
        _sum: {
          amountCents: true,
          platformFeeCents: true,
          organizerAmountCents: true,
        },
        _count: true,
      }),
      prisma.ticketOrder.aggregate({
        where: {
          eventId: id,
          refundedAmountCents: { gt: 0 },
        },
        _sum: {
          refundedAmountCents: true,
        },
      }),
    ]);

    const summary = {
      totalOrders: completedAgg._count,
      totalRevenueCents: completedAgg._sum.amountCents || 0,
      platformFeeCents: completedAgg._sum.platformFeeCents || 0,
      organizerAmountCents: completedAgg._sum.organizerAmountCents || 0,
      totalRefundedCents: refundAgg._sum.refundedAmountCents || 0,
    };

    // 5. Get paginated orders (all statuses) with search
    const [orders, totalCount] = await Promise.all([
      prisma.ticketOrder.findMany({
        where: { eventId: id, ...searchFilter },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.ticketOrder.count({
        where: { eventId: id, ...searchFilter },
      }),
    ]);

    // 6. Get daily sales data for the last 30 days (for chart)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentCompletedOrders = await prisma.ticketOrder.findMany({
      where: {
        eventId: id,
        status: "COMPLETED",
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
        amountCents: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by date in JS for SQLite compatibility
    const dailySalesMap = new Map<string, { count: number; amountCents: number }>();
    for (const order of recentCompletedOrders) {
      const date = new Date(order.createdAt).toISOString().split("T")[0];
      const existing = dailySalesMap.get(date);
      if (existing) {
        existing.count += 1;
        existing.amountCents += order.amountCents;
      } else {
        dailySalesMap.set(date, { count: 1, amountCents: order.amountCents });
      }
    }

    const dailySales = Array.from(dailySalesMap.entries()).map(
      ([date, data]) => ({
        date,
        count: data.count,
        amountCents: data.amountCents,
      })
    );

    // 7. Return response
    return NextResponse.json({
      success: true,
      data: {
        summary,
        orders,
        dailySales,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get ticket sales error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch ticket sales" } },
      { status: 500 }
    );
  }
}
