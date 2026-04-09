import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";

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

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { storeId: store.id, customerEmail: customer.email },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalCents: true,
          subtotalCents: true,
          shippingCents: true,
          items: true,
          createdAt: true,
          trackingNumber: true,
        },
      }),
      prisma.order.count({ where: { storeId: store.id, customerEmail: customer.email } }),
    ]);

    return NextResponse.json({
      orders: orders.map(o => ({
        ...o,
        items: JSON.parse(o.items || "[]"),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Store customer orders error:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
