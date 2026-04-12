import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/ecommerce/store-alerts
 * Returns real-time alert data for the store dashboard banners.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        complianceStatus: true,
        warningCount: true,
        lastWarningReason: true,
        suspendedReason: true,
      },
    });

    if (!store) {
      return NextResponse.json({ success: false, error: "No store" }, { status: 404 });
    }

    // Low stock products
    const lowStockProducts = await prisma.product.findMany({
      where: {
        storeId: store.id,
        trackInventory: true,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { name: true, quantity: true, lowStockThreshold: true },
    });
    const lowStock = lowStockProducts.filter((p) => p.quantity <= p.lowStockThreshold);
    const outOfStock = lowStock.filter((p) => p.quantity === 0);

    // New orders (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newOrderCount = await prisma.order.count({
      where: { storeId: store.id, createdAt: { gte: oneDayAgo } },
    });

    // Unfulfilled orders (PENDING or CONFIRMED)
    const unfulfilledCount = await prisma.order.count({
      where: { storeId: store.id, status: { in: ["PENDING", "CONFIRMED"] } },
    });

    // Return requests pending
    const returnRequestCount = await prisma.order.count({
      where: { storeId: store.id, returnRequested: true, status: { not: "REFUNDED" } },
    });

    // Average rating from feedback
    const feedbackAgg = await prisma.orderFeedback.aggregate({
      where: { storeId: store.id },
      _avg: { rating: true },
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        lowStock: {
          count: lowStock.length,
          outOfStock: outOfStock.length,
          products: lowStock.slice(0, 5).map((p) => ({ name: p.name, quantity: p.quantity })),
        },
        newOrders: newOrderCount,
        unfulfilled: unfulfilledCount,
        returnRequests: returnRequestCount,
        compliance: {
          status: store.complianceStatus,
          warningCount: store.warningCount,
          lastReason: store.lastWarningReason,
          suspendedReason: store.suspendedReason,
        },
        feedback: {
          averageRating: feedbackAgg._avg.rating ? Math.round(feedbackAgg._avg.rating * 10) / 10 : null,
          totalReviews: feedbackAgg._count.id,
        },
      },
    });
  } catch (error) {
    console.error("Store alerts error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch alerts" }, { status: 500 });
  }
}
