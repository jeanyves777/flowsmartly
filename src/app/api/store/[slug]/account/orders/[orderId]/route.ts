import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";
import { stripe } from "@/lib/stripe";

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

    // Normalize the address so the generated store UI (which may read either
    // `street`/`line1`/`line2`) always finds what it expects. Two legacy
    // shapes exist in the DB: `{street, city, state, zip, country}` (from
    // checkout) and `{line1, line2, city, state, zip, country}` (from the
    // update-address PATCH).
    const rawAddr = (() => {
      try { return JSON.parse(order.shippingAddress || "{}") as Record<string, unknown>; }
      catch { return {}; }
    })();
    const normalizedAddress = {
      name: (rawAddr.name as string) || order.customerName,
      line1: (rawAddr.line1 as string) || (rawAddr.street as string) || "",
      street: (rawAddr.street as string) || (rawAddr.line1 as string) || "",
      line2: (rawAddr.line2 as string) || "",
      city: (rawAddr.city as string) || "",
      state: (rawAddr.state as string) || "",
      zip: (rawAddr.zip as string) || "",
      country: (rawAddr.country as string) || "",
    };

    return NextResponse.json({
      ...order,
      items: JSON.parse(order.items || "[]"),
      shippingAddress: normalizedAddress,
      currency: store.currency,
    });
  } catch (err) {
    console.error("Store customer order detail error:", err);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

// PUT /api/store/[slug]/account/orders/[orderId] — Customer return request
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;
    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, userId: true, user: { select: { email: true, name: true } } },
    });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId: store.id, customerEmail: customer.email },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (order.status !== "DELIVERED") {
      return NextResponse.json({ error: "Return requests are only available for delivered orders" }, { status: 400 });
    }

    if (order.returnRequested) {
      return NextResponse.json({ error: "A return request has already been submitted" }, { status: 400 });
    }

    const body = await request.json();
    const reason = (body.reason || "").trim();
    if (!reason) return NextResponse.json({ error: "Return reason is required" }, { status: 400 });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { returnRequested: true, returnReason: reason },
    });

    // Notify store owner
    const { sendNewOrderAlertEmail } = await import("@/lib/email/commerce");
    const { baseTemplate } = await import("@/lib/email/index");
    const { sendEmail } = await import("@/lib/email/index");
    const ownerEmail = store.user?.email;
    if (ownerEmail) {
      sendEmail({
        to: ownerEmail,
        subject: `Return Request - Order #${order.orderNumber} | ${store.name}`,
        html: baseTemplate(
          `<h2>Return Request Received</h2>
           <p>A customer has requested a return for Order <strong>#${order.orderNumber}</strong>.</p>
           <div class="stats-box">
             <table style="width:100%;">
               <tr><td style="padding:6px 0;color:#71717a;">Customer</td><td style="padding:6px 0;text-align:right;">${order.customerName}</td></tr>
               <tr><td style="padding:6px 0;color:#71717a;">Email</td><td style="padding:6px 0;text-align:right;">${order.customerEmail}</td></tr>
             </table>
           </div>
           <div class="highlight"><strong>Reason:</strong> ${reason}</div>
           <a href="${process.env.NEXT_PUBLIC_APP_URL}/ecommerce/orders/${order.id}" class="button">View Order</a>`,
          `Return request for order #${order.orderNumber}`
        ),
      }).catch((e) => console.error("Return request email error:", e));
    }

    return NextResponse.json({
      ...updated,
      items: JSON.parse(updated.items || "[]"),
      shippingAddress: JSON.parse(updated.shippingAddress || "{}"),
    });
  } catch (err) {
    console.error("Return request error:", err);
    return NextResponse.json({ error: "Failed to submit return request" }, { status: 500 });
  }
}

// PATCH /api/store/[slug]/account/orders/[orderId]
// action: "cancel"          — customer cancels a pre-shipment order
// action: "update_address"  — customer changes shipping address before fulfillment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;
    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, name: true, user: { select: { email: true } } },
    });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId: store.id, customerEmail: customer.email },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const PRE_FULFILLMENT = ["PENDING", "CONFIRMED", "PROCESSING"];
    const body = await request.json();
    const action = body.action as string;

    // ── Cancel Order ──────────────────────────────────────────────────────
    if (action === "cancel") {
      if (!PRE_FULFILLMENT.includes(order.status)) {
        return NextResponse.json(
          { error: order.status === "SHIPPED" || order.status === "DELIVERED"
              ? "Order has already shipped. Wait for delivery, then request a return."
              : "This order cannot be cancelled." },
          { status: 400 }
        );
      }

      // Issue Stripe refund if card payment was already charged
      if (order.paymentMethod === "card" && order.paymentStatus === "paid" && order.paymentId && stripe) {
        try {
          await stripe.refunds.create({
            payment_intent: order.paymentId,
            reason: "requested_by_customer",
          });
        } catch (e) {
          console.error("Stripe refund error on cancellation:", e);
          return NextResponse.json({ error: "Failed to process refund. Please contact support." }, { status: 500 });
        }
      }

      // Restore inventory
      const items: Array<{ productId: string; variantId?: string; quantity: number }> =
        JSON.parse(order.items || "[]");
      await Promise.all(
        items.map(item =>
          item.productId
            ? prisma.product.updateMany({
                where: { id: item.productId },
                data: { quantity: { increment: item.quantity } },
              })
            : Promise.resolve()
        )
      );

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          paymentStatus: order.paymentStatus === "paid" ? "refunded" : order.paymentStatus,
        },
      });

      return NextResponse.json({
        ...updated,
        items: JSON.parse(updated.items || "[]"),
        shippingAddress: JSON.parse(updated.shippingAddress || "{}"),
      });
    }

    // ── Update Shipping Address ───────────────────────────────────────────
    if (action === "update_address") {
      if (!PRE_FULFILLMENT.includes(order.status)) {
        return NextResponse.json(
          { error: "Shipping address can only be changed before the order is shipped." },
          { status: 400 }
        );
      }

      const addr = body.address as {
        name?: string; line1: string; line2?: string;
        city: string; state?: string; zip?: string; country: string;
      };
      if (!addr?.line1 || !addr?.city || !addr?.country) {
        return NextResponse.json({ error: "Address line 1, city, and country are required." }, { status: 400 });
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { shippingAddress: JSON.stringify(addr) },
      });

      return NextResponse.json({
        ...updated,
        items: JSON.parse(updated.items || "[]"),
        shippingAddress: JSON.parse(updated.shippingAddress || "{}"),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Order PATCH error:", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

