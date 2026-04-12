import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

/**
 * POST /api/ecommerce/orders/[id]/refund
 * Store owner issues a full refund for a card-paid order via Stripe.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const { id } = await params;

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

    const order = await prisma.order.findFirst({
      where: { id, storeId: store.id },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    if (order.status === "REFUNDED") {
      return NextResponse.json(
        { success: false, error: { code: "ALREADY_REFUNDED", message: "Order is already refunded" } },
        { status: 400 }
      );
    }

    if (order.paymentMethod !== "card" || !order.paymentId) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_REFUNDABLE", message: "Only card-paid orders can be refunded via this method" } },
        { status: 400 }
      );
    }

    if (order.paymentStatus !== "paid") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_PAID", message: "Order has not been paid yet" } },
        { status: 400 }
      );
    }

    // Issue refund through Stripe
    await stripe.refunds.create({ payment_intent: order.paymentId });

    // Stripe webhook will handle order status update + inventory restore + stats.
    // But mark immediately so the UI reflects the change.
    const updated = await prisma.order.update({
      where: { id },
      data: { status: "REFUNDED", paymentStatus: "refunded" },
    });

    return NextResponse.json({
      success: true,
      data: { order: { ...updated, items: JSON.parse(updated.items), shippingAddress: JSON.parse(updated.shippingAddress) } },
    });
  } catch (error: any) {
    console.error("Refund error:", error);
    return NextResponse.json(
      { success: false, error: { code: "REFUND_FAILED", message: error?.message || "Refund failed" } },
      { status: 500 }
    );
  }
}
