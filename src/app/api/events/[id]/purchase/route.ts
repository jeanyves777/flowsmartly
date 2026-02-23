import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";

// POST /api/events/[id]/purchase — Create Stripe Checkout Session for ticket purchase (public, no auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Get event (no auth — public buyers)
    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        ticketType: true,
        ticketPrice: true,
        ticketName: true,
        platformFeePercent: true,
        capacity: true,
        registrationCount: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: { message: "Event not found" } },
        { status: 404 }
      );
    }

    // 2. Validate event is eligible for paid ticket purchase
    if (event.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: { message: "Event is not currently active" } },
        { status: 400 }
      );
    }

    if (event.ticketType !== "paid") {
      return NextResponse.json(
        { success: false, error: { message: "This event does not have paid tickets" } },
        { status: 400 }
      );
    }

    if (!event.ticketPrice || event.ticketPrice <= 0) {
      return NextResponse.json(
        { success: false, error: { message: "Ticket price is not configured" } },
        { status: 400 }
      );
    }

    // 3. Check capacity
    if (event.capacity !== null && event.registrationCount >= event.capacity) {
      return NextResponse.json(
        { success: false, error: { message: "Event is sold out" } },
        { status: 400 }
      );
    }

    // 4. Parse and validate body
    const body = await request.json();
    const { name, email, phone } = body as {
      name?: string;
      email?: string;
      phone?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Name is required" } },
        { status: 400 }
      );
    }

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Email is required" } },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid email address" } },
        { status: 400 }
      );
    }

    // 5. Calculate fees
    const amountCents = event.ticketPrice;
    const platformFeeCents = Math.round(
      amountCents * event.platformFeePercent / 100
    );
    const organizerAmountCents = amountCents - platformFeeCents;

    // 6. Verify Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: { message: "Payment processing is not configured" } },
        { status: 503 }
      );
    }

    // 7. Create TicketOrder in DB with a placeholder stripeSessionId (will update after session creation)
    const order = await prisma.ticketOrder.create({
      data: {
        eventId: event.id,
        buyerName: name.trim(),
        buyerEmail: email.trim(),
        amountCents,
        platformFeeCents,
        organizerAmountCents,
        stripeSessionId: `pending_${Date.now()}`, // Temporary, updated below
        status: "PENDING",
      },
    });

    // 8. Create Stripe Checkout Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: event.ticketName || event.title,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: email.trim(),
      metadata: {
        eventId: event.id,
        ticketOrderId: order.id,
        type: "event_ticket",
        buyerPhone: phone?.trim() || "",
      },
      success_url: `${appUrl}/event/${event.slug}?ticket=success&orderId=${order.id}`,
      cancel_url: `${appUrl}/event/${event.slug}?ticket=cancelled`,
    });

    // 9. Update TicketOrder with the real stripeSessionId
    await prisma.ticketOrder.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    // 10. Return checkout URL
    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl: session.url,
        orderId: order.id,
      },
    });
  } catch (error) {
    console.error("Ticket purchase error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create checkout session" } },
      { status: 500 }
    );
  }
}
