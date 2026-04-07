import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/ecommerce - Overview of all stores, products, orders
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const tab = searchParams.get("tab") || "stores";

    if (tab === "orders") {
      const orderWhere: Record<string, unknown> = {};
      if (search) {
        orderWhere.OR = [
          { customerName: { contains: search } },
          { customerEmail: { contains: search } },
          { orderNumber: { contains: search } },
        ];
      }

      const [orders, orderTotal] = await Promise.all([
        prisma.order.findMany({
          where: orderWhere,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            store: { select: { id: true, name: true, slug: true } },
          },
        }),
        prisma.order.count({ where: orderWhere }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          orders: orders.map((o) => {
            let itemCount = 0;
            try { itemCount = JSON.parse(o.items).length; } catch {}
            return {
              id: o.id,
              orderNumber: o.orderNumber,
              customerName: o.customerName,
              customerEmail: o.customerEmail,
              status: o.status,
              paymentStatus: o.paymentStatus,
              totalCents: o.totalCents,
              currency: o.currency,
              itemCount,
              store: o.store,
              createdAt: o.createdAt.toISOString(),
            };
          }),
          pagination: { page, limit, total: orderTotal, totalPages: Math.ceil(orderTotal / limit) },
        },
      });
    }

    // Default: stores tab
    const storeWhere: Record<string, unknown> = { deletedAt: null };
    if (search) {
      storeWhere.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ];
    }

    const [stores, storeTotal, stats] = await Promise.all([
      prisma.store.findMany({
        where: storeWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.store.count({ where: storeWhere }),
      Promise.all([
        prisma.store.count({ where: { deletedAt: null } }),
        prisma.store.count({ where: { deletedAt: null, isActive: true } }),
        prisma.order.count(),
        prisma.store.aggregate({ where: { deletedAt: null }, _sum: { totalRevenueCents: true, platformFeesCollectedCents: true } }),
        prisma.product.count(),
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stores: stores.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          isActive: s.isActive,
          setupComplete: s.setupComplete,
          ecomPlan: s.ecomPlan,
          ecomSubscriptionStatus: s.ecomSubscriptionStatus,
          stripeOnboardingComplete: s.stripeOnboardingComplete,
          productCount: s.productCount,
          orderCount: s.orderCount,
          totalRevenueCents: s.totalRevenueCents,
          platformFeesCollectedCents: s.platformFeesCollectedCents,
          customDomain: s.customDomain,
          createdAt: s.createdAt.toISOString(),
          user: s.user,
        })),
        pagination: { page, limit, total: storeTotal, totalPages: Math.ceil(storeTotal / limit) },
        stats: {
          totalStores: stats[0],
          activeStores: stats[1],
          totalOrders: stats[2],
          totalRevenueCents: stats[3]._sum.totalRevenueCents || 0,
          platformFeesCents: stats[3]._sum.platformFeesCollectedCents || 0,
          totalProducts: stats[4],
        },
      },
    });
  } catch (error) {
    console.error("Admin ecommerce error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch ecommerce data" } }, { status: 500 });
  }
}
