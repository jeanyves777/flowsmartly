import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/ecommerce/orders
 * List orders for user's store with filtering, pagination, and stats.
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

    // Find user's store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const paymentMethod = searchParams.get("paymentMethod");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build where clause
    const where: Record<string, unknown> = { storeId: store.id };

    if (status) {
      where.status = status;
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerEmail: { contains: search } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(dateTo + "T23:59:59.999Z");
      }
    }

    // Fetch orders and count in parallel
    const [orders, total, stats] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          deliveryAssignment: {
            include: {
              driver: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.order.count({ where }),
      // Stats for the store (unfiltered)
      Promise.all([
        prisma.order.count({ where: { storeId: store.id } }),
        prisma.order.aggregate({
          where: { storeId: store.id, status: { not: "CANCELLED" } },
          _sum: { totalCents: true },
        }),
        prisma.order.count({ where: { storeId: store.id, status: "PENDING" } }),
        prisma.order.count({ where: { storeId: store.id, status: "DELIVERED" } }),
      ]),
    ]);

    const [totalOrders, revenueAgg, pendingCount, deliveredCount] = stats;

    // Parse JSON fields
    const parsedOrders = orders.map((order) => ({
      ...order,
      items: JSON.parse(order.items),
      shippingAddress: JSON.parse(order.shippingAddress),
      deliveryAssignment: order.deliveryAssignment
        ? {
            ...order.deliveryAssignment,
            pickupAddress: JSON.parse(order.deliveryAssignment.pickupAddress),
            deliveryAddress: JSON.parse(order.deliveryAssignment.deliveryAddress),
            proofOfDelivery: JSON.parse(order.deliveryAssignment.proofOfDelivery),
            locationHistory: JSON.parse(order.deliveryAssignment.locationHistory),
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        orders: parsedOrders,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        stats: {
          totalOrders,
          totalRevenueCents: revenueAgg._sum.totalCents || 0,
          pendingCount,
          deliveredCount,
        },
      },
    });
  } catch (error) {
    console.error("List orders error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch orders" } },
      { status: 500 }
    );
  }
}
