import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";

// GET /api/store/[slug]/account/orders/[orderId] — Single order detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, currency: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId: store.id, customerEmail: customer.email },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    return NextResponse.json({
      ...order,
      items: JSON.parse(order.items || "[]"),
      shippingAddress: JSON.parse(order.shippingAddress || "{}"),
      currency: store.currency,
    });
  } catch (err) {
    console.error("Store customer order detail error:", err);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
