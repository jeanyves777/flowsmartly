import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/ecommerce/earnings
 * Returns store earnings breakdown: monthly revenue, payment methods,
 * platform fee, net earnings, and Stripe Connect status.
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
      select: {
        id: true,
        name: true,
        currency: true,
        totalRevenueCents: true,
        platformFeesCollectedCents: true,
        platformFeePercent: true,
        stripeConnectAccountId: true,
        stripeOnboardingComplete: true,
        orderCount: true,
      },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    // Fetch all paid/delivered orders in the last 12 months
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const orders = await prisma.order.findMany({
      where: {
        storeId: store.id,
        paymentStatus: { in: ["paid"] },
        createdAt: { gte: since },
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      select: {
        totalCents: true,
        platformFeeCents: true,
        storeOwnerAmountCents: true,
        paymentMethod: true,
        currency: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Monthly breakdown
    const monthlyMap: Record<string, { revenue: number; orders: number; net: number; fees: number }> = {};
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 7); // "2026-04"
      if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, orders: 0, net: 0, fees: 0 };
      monthlyMap[key].revenue += o.totalCents;
      monthlyMap[key].orders += 1;
      monthlyMap[key].fees += o.platformFeeCents;
      monthlyMap[key].net += o.storeOwnerAmountCents || (o.totalCents - o.platformFeeCents);
    }
    const monthly = Object.entries(monthlyMap).map(([month, data]) => ({ month, ...data }));

    // Payment method breakdown
    const methodMap: Record<string, { revenue: number; count: number }> = {};
    for (const o of orders) {
      const m = o.paymentMethod || "unknown";
      if (!methodMap[m]) methodMap[m] = { revenue: 0, count: 0 };
      methodMap[m].revenue += o.totalCents;
      methodMap[m].count += 1;
    }
    const byMethod = Object.entries(methodMap).map(([method, data]) => ({ method, ...data }));

    // Totals (lifetime from store record, last-12m from orders above)
    const last12Revenue = orders.reduce((s, o) => s + o.totalCents, 0);
    const last12Fees = orders.reduce((s, o) => s + o.platformFeeCents, 0);
    const last12Net = orders.reduce((s, o) => s + (o.storeOwnerAmountCents || (o.totalCents - o.platformFeeCents)), 0);

    return NextResponse.json({
      success: true,
      data: {
        store: {
          currency: store.currency,
          platformFeePercent: store.platformFeePercent,
          stripeConnectAccountId: store.stripeConnectAccountId,
          stripeOnboardingComplete: store.stripeOnboardingComplete,
        },
        lifetime: {
          revenueCents: store.totalRevenueCents,
          platformFeesCents: store.platformFeesCollectedCents,
          netCents: store.totalRevenueCents - store.platformFeesCollectedCents,
          orderCount: store.orderCount,
        },
        last12Months: {
          revenueCents: last12Revenue,
          platformFeesCents: last12Fees,
          netCents: last12Net,
          orderCount: orders.length,
        },
        monthly,
        byMethod,
      },
    });
  } catch (error) {
    console.error("Earnings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch earnings" } },
      { status: 500 }
    );
  }
}
