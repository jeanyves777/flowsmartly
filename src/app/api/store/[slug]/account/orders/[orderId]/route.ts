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

