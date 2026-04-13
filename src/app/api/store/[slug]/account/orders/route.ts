import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  paymentId: true,
  totalCents: true,
  subtotalCents: true,
  shippingCents: true,
  currency: true,
  items: true,
  createdAt: true,
  trackingNumber: true,
};

// GET /api/store/[slug]/account/orders — Customer's order history
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = 10;
    const where = { storeId: store.id, customerEmail: customer.email };

    // Pending card orders awaiting payment (show as "Payment Required" reminders)
    const pendingPayments = await prisma.order.findMany({
      where: { ...where, paymentMethod: "card", paymentStatus: "pending" },
      orderBy: { createdAt: "desc" },
      select: ORDER_SELECT,
    });

    // Confirmed orders (paid cards + all non-card methods)
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: {
          ...where,
          NOT: { paymentMethod: "card", paymentStatus: "pending" },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: ORDER_SELECT,
      }),
      prisma.order.count({
        where: {
          ...where,
          NOT: { paymentMethod: "card", paymentStatus: "pending" },
        },
      }),
    ]);

    const parse = (o: typeof orders[0]) => ({ ...o, items: JSON.parse(o.items || "[]") });

    return NextResponse.json({
      orders: orders.map(parse),
      pendingPayments: pendingPayments.map(parse),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Store customer orders error:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

