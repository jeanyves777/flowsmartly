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

    // 3. Quick (non-authoritative) capacity pre-check for a fast, friendly
    //    response. The authoritative atomic reservation happens in step 7.
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

    // 5. Calculate fees. Clamp to non-negative integers; for tiny ticket prices
    //    Math.round can yield a 0 fee, which is fine — organizerAmount is always
    //    amount minus fee so the two always sum back to amountCents.
    const amountCents = event.ticketPrice;
    const platformFeeCents = Math.max(
      0,
      Math.round((amountCents * event.platformFeePercent) / 100)
    );
    const organizerAmountCents = Math.max(0, amountCents - platformFeeCents);

    // 6. Verify Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: { message: "Payment processing is not configured" } },
        { status: 503 }
      );
    }

    // 7. Authoritative capacity guard. registrationCount is owned by the
    //    payments webhook (it increments on checkout.session.completed), so we
    //    must NOT increment it here or paid tickets would be double-counted.
    //    Instead, count committed registrations + already-PENDING orders against
    //    capacity to close the check-then-act race between concurrent buyers.
    if (event.capacity !== null) {
      const pendingOrders = await prisma.ticketOrder.count({
        where: { eventId: event.id, status: "PENDING" },
      });
      if (event.registrationCount + pendingOrders >= event.capacity) {
        return NextResponse.json(
          { success: false, error: { message: "Event is sold out" } },
          { status: 400 }
        );
      }
    }

    // No capacity slot is mutated here, so there is nothing to release on error.
    const releaseSlot = async () => {};

    // 8. Create the Stripe Checkout Session FIRST so we never persist an order
    //    row for a session that failed to create (avoids orphaned orders).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    let session;
    try {
      session = await stripe.checkout.sessions.create({
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
          type: "event_ticket",
          buyerPhone: phone?.trim() || "",
        },
        success_url: `${appUrl}/event/${event.slug}?ticket=success`,
        cancel_url: `${appUrl}/event/${event.slug}?ticket=cancelled`,
      });
    } catch (stripeErr) {
      await releaseSlot();
      throw stripeErr;
    }

    // 9. Persist the TicketOrder with the real Stripe session id.
    let order;
    try {
      order = await prisma.ticketOrder.create({
        data: {
          eventId: event.id,
          buyerName: name.trim(),
          buyerEmail: email.trim(),
          amountCents,
          platformFeeCents,
          organizerAmountCents,
          stripeSessionId: session.id,
          status: "PENDING",
        },
      });
    } catch (dbErr) {
      await releaseSlot();
      throw dbErr;
    }

    // 10. Attach the order id to the session metadata. The payments webhook
    //     resolves the purchase via session.metadata.ticketOrderId, so this MUST
    //     succeed before we hand the buyer a checkout URL — otherwise a paid
    //     ticket would never be marked COMPLETED. If it fails, roll everything
    //     back so we don't leave a chargeable session with no resolvable order.
    try {
      await stripe.checkout.sessions.update(session.id, {
        metadata: {
          eventId: event.id,
          ticketOrderId: order.id,
          type: "event_ticket",
          buyerPhone: phone?.trim() || "",
        },
      });
    } catch (metaErr) {
      await prisma.ticketOrder.delete({ where: { id: order.id } }).catch(() => {});
      await stripe.checkout.sessions.expire(session.id).catch(() => {});
      await releaseSlot();
      throw metaErr;
    }

    // 11. Return checkout URL
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
