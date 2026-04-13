import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";
import { stripe } from "@/lib/stripe";

// GET /api/store/[slug]/orders/[orderId]/resume-payment
// Returns fresh clientSecret for a pending card order so the customer can retry payment
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;

    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId: store.id, customerEmail: customer.email },
      select: { id: true, paymentId: true, paymentStatus: true, paymentMethod: true, totalCents: true },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.paymentStatus === "paid") return NextResponse.json({ error: "Order already paid" }, { status: 400 });
    if (order.paymentMethod !== "card" || !order.paymentId) {
      return NextResponse.json({ error: "No card payment to resume" }, { status: 400 });
    }

    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

    const pi = await stripe.paymentIntents.retrieve(order.paymentId);
    if (pi.status === "succeeded") {
      // Webhook may not have fired yet — update order now
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: "paid", status: "CONFIRMED" },
      });
      return NextResponse.json({ error: "Order already paid" }, { status: 400 });
    }
    if (pi.status === "canceled") {
      return NextResponse.json({ error: "Payment session expired. Please place a new order." }, { status: 410 });
    }

    return NextResponse.json({
      success: true,
      data: { clientSecret: pi.client_secret, amount: order.totalCents, orderId: order.id },
    });
  } catch (err) {
    console.error("Resume payment error:", err);
    return NextResponse.json({ error: "Failed to resume payment" }, { status: 500 });
  }
}
