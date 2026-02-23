import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { stripe } from "@/lib/stripe";

// POST /api/events/[id]/refund — Process refund for a ticket order (auth required, owner only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 1. Verify event ownership
    const event = await prisma.event.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: { message: "Event not found" } },
        { status: 404 }
      );
    }

    // 2. Parse body
    const body = await request.json();
    const { ticketOrderId, amount } = body as {
      ticketOrderId?: string;
      amount?: number; // Amount in cents for partial refund; omit for full refund
    };

    if (!ticketOrderId) {
      return NextResponse.json(
        { success: false, error: { message: "ticketOrderId is required" } },
        { status: 400 }
      );
    }

    // 3. Find the ticket order
    const order = await prisma.ticketOrder.findFirst({
      where: { id: ticketOrderId, eventId: id },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { message: "Ticket order not found" } },
        { status: 404 }
      );
    }

    // 4. Validate order status — can only refund completed orders
    if (order.status !== "COMPLETED" && order.status !== "PARTIALLY_REFUNDED") {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Cannot refund order with status "${order.status}". Only completed or partially refunded orders can be refunded.`,
          },
        },
        { status: 400 }
      );
    }

    // 5. Calculate refund amount
    const remainingRefundable = order.amountCents - order.refundedAmountCents;

    if (remainingRefundable <= 0) {
      return NextResponse.json(
        { success: false, error: { message: "Order has already been fully refunded" } },
        { status: 400 }
      );
    }

    let refundAmount: number;
    if (amount !== undefined && amount !== null) {
      // Partial refund
      if (amount <= 0) {
        return NextResponse.json(
          { success: false, error: { message: "Refund amount must be greater than 0" } },
          { status: 400 }
        );
      }
      if (amount > remainingRefundable) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: `Refund amount ($${(amount / 100).toFixed(2)}) exceeds refundable amount ($${(remainingRefundable / 100).toFixed(2)})`,
            },
          },
          { status: 400 }
        );
      }
      refundAmount = amount;
    } else {
      // Full refund of remaining amount
      refundAmount = remainingRefundable;
    }

    // 6. Verify Stripe is configured and order has a payment intent
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: { message: "Payment processing is not configured" } },
        { status: 503 }
      );
    }

    if (!order.stripePaymentIntentId) {
      return NextResponse.json(
        { success: false, error: { message: "No payment intent found for this order. Cannot process refund." } },
        { status: 400 }
      );
    }

    // 7. Process refund via Stripe
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      amount: refundAmount,
    });

    if (refund.status === "failed") {
      return NextResponse.json(
        { success: false, error: { message: "Stripe refund failed. Please try again or contact support." } },
        { status: 500 }
      );
    }

    // 8. Determine new order status
    const newRefundedTotal = order.refundedAmountCents + refundAmount;
    const isFullyRefunded = newRefundedTotal >= order.amountCents;
    const newStatus = isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED";

    // 9. Update TicketOrder
    const updatedOrder = await prisma.ticketOrder.update({
      where: { id: order.id },
      data: {
        refundedAmountCents: { increment: refundAmount },
        refundedAt: new Date(),
        status: newStatus,
      },
    });

    // 10. Update Event totalRefundedCents
    await prisma.event.update({
      where: { id: event.id },
      data: {
        totalRefundedCents: { increment: refundAmount },
      },
    });

    // 11. If fully refunded, cancel the associated EventRegistration
    if (isFullyRefunded) {
      await prisma.eventRegistration.updateMany({
        where: {
          eventId: id,
          ticketOrderId: order.id,
        },
        data: {
          status: "cancelled",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        order: updatedOrder,
        refundAmount,
        stripeRefundId: refund.id,
        isFullyRefunded,
      },
    });
  } catch (error) {
    console.error("Ticket refund error:", error);

    // Handle Stripe-specific errors
    const stripeError = error as { type?: string; message?: string };
    if (stripeError.type?.startsWith("Stripe")) {
      return NextResponse.json(
        { success: false, error: { message: stripeError.message || "Stripe refund failed" } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: { message: "Failed to process refund" } },
      { status: 500 }
    );
  }
}
