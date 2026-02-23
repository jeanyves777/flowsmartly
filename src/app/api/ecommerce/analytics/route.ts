import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

function getStartDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 86400000);
    case "30d":
      return new Date(now.getTime() - 30 * 86400000);
    case "90d":
      return new Date(now.getTime() - 90 * 86400000);
    case "1y":
      return new Date(now.getTime() - 365 * 86400000);
    default:
      return new Date(now.getTime() - 30 * 86400000);
  }
}

function getRangeDays(range: string): number {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "1y":
      return 365;
    default:
      return 30;
  }
}

/**
 * GET /api/ecommerce/analytics
 * Returns e-commerce analytics: revenue timeline, top products, order stats.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true, currency: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";
    const rangeDays = getRangeDays(range);
    const startDate = getStartDate(range);
    const previousPeriodStart = new Date(startDate.getTime() - rangeDays * 86400000);

    // Fetch current + previous period orders, view stats, status/payment distributions in parallel
    const [orders, previousOrders, viewsAgg, ordersByStatus, ordersByPayment] = await Promise.all([
      // Current period orders
      prisma.order.findMany({
        where: {
          storeId: store.id,
          status: { not: "CANCELLED" },
          createdAt: { gte: startDate },
        },
        select: {
          totalCents: true,
          createdAt: true,
          customerEmail: true,
          paymentMethod: true,
          status: true,
          items: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      // Previous period orders (for comparison)
      prisma.order.findMany({
        where: {
          storeId: store.id,
          status: { not: "CANCELLED" },
          createdAt: { gte: previousPeriodStart, lt: startDate },
        },
        select: { totalCents: true },
      }),
      // Total product views for conversion rate
      prisma.product.aggregate({
        where: { storeId: store.id, status: "ACTIVE", deletedAt: null },
        _sum: { viewCount: true },
      }),
      // Order status distribution (includes cancelled, for full picture)
      prisma.order.groupBy({
        by: ["status"],
        where: { storeId: store.id, createdAt: { gte: startDate } },
        _count: { id: true },
      }),
      // Payment method distribution
      prisma.order.groupBy({
        by: ["paymentMethod"],
        where: {
          storeId: store.id,
          status: { not: "CANCELLED" },
          createdAt: { gte: startDate },
        },
        _count: { id: true },
      }),
    ]);

    // --- Revenue Timeline ---
    const timelineMap = new Map<string, { revenueCents: number; orderCount: number }>();
    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      const entry = timelineMap.get(dateKey) || { revenueCents: 0, orderCount: 0 };
      entry.revenueCents += order.totalCents;
      entry.orderCount += 1;
      timelineMap.set(dateKey, entry);
    }

    // Fill in missing dates with zeros for continuous chart data
    const revenueTimeline: { date: string; revenueCents: number; orderCount: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= today) {
      const dateKey = cursor.toISOString().split("T")[0];
      const entry = timelineMap.get(dateKey);
      revenueTimeline.push({
        date: dateKey,
        revenueCents: entry?.revenueCents ?? 0,
        orderCount: entry?.orderCount ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // --- Top Products ---
    const productStats = new Map<
      string,
      { name: string; orderCount: number; revenueCents: number }
    >();
    for (const order of orders) {
      const items = JSON.parse(order.items || "[]") as {
        productId: string;
        name: string;
        priceCents: number;
        quantity: number;
      }[];
      for (const item of items) {
        const existing = productStats.get(item.productId) || {
          name: item.name,
          orderCount: 0,
          revenueCents: 0,
        };
        existing.orderCount += item.quantity;
        existing.revenueCents += item.priceCents * item.quantity;
        productStats.set(item.productId, existing);
      }
    }

    const topProductEntries = [...productStats.entries()]
      .sort((a, b) => b[1].revenueCents - a[1].revenueCents)
      .slice(0, 10);

    // Fetch view counts for top products
    const topProductIds = topProductEntries.map(([id]) => id);
    const productViews =
      topProductIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: topProductIds } },
            select: { id: true, viewCount: true },
          })
        : [];

    const viewCountMap = new Map(productViews.map((p) => [p.id, p.viewCount]));

    const topProducts = topProductEntries.map(([id, stats]) => ({
      id,
      name: stats.name,
      orderCount: stats.orderCount,
      revenueCents: stats.revenueCents,
      viewCount: viewCountMap.get(id) ?? 0,
    }));

    // --- Summary Stats ---
    const totalRevenueCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const totalOrders = orders.length;
    const averageOrderValueCents =
      totalOrders > 0 ? Math.round(totalRevenueCents / totalOrders) : 0;

    // Conversion rate: orders / product views * 100
    const totalViews = viewsAgg._sum.viewCount || 0;
    const conversionRate =
      totalViews > 0 ? Math.min(100, Math.round((totalOrders / totalViews) * 10000) / 100) : 0;

    // Repeat customer percentage
    const emailCounts = new Map<string, number>();
    for (const order of orders) {
      const email = order.customerEmail.toLowerCase();
      emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    }
    const uniqueCustomers = emailCounts.size;
    const repeatCustomers = [...emailCounts.values()].filter((count) => count > 1).length;
    const repeatCustomerPercent =
      uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 10000) / 100 : 0;

    // Period-over-period changes
    const previousRevenueCents = previousOrders.reduce((sum, o) => sum + o.totalCents, 0);
    const previousOrderCount = previousOrders.length;

    const revenueChange =
      previousRevenueCents > 0
        ? Math.round(((totalRevenueCents - previousRevenueCents) / previousRevenueCents) * 10000) /
          100
        : 0;
    const orderChange =
      previousOrderCount > 0
        ? Math.round(((totalOrders - previousOrderCount) / previousOrderCount) * 10000) / 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        revenueTimeline,
        topProducts,
        summary: {
          totalRevenueCents,
          totalOrders,
          averageOrderValueCents,
          conversionRate,
          repeatCustomerPercent,
          revenueChange,
          orderChange,
        },
        ordersByStatus: ordersByStatus.map((entry) => ({
          status: entry.status,
          count: entry._count.id,
        })),
        ordersByPayment: ordersByPayment.map((entry) => ({
          method: entry.paymentMethod || "unknown",
          count: entry._count.id,
        })),
        currency: store.currency,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { success: false, error: { code: "ANALYTICS_FAILED", message: "Failed to fetch analytics" } },
      { status: 500 }
    );
  }
}
