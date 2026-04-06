import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { purchaseDomain } from "@/lib/domains/manager";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_ECOMMERCE!;

/**
 * POST - Handle Stripe webhooks for e-commerce payments
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 400 }
    );
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error("No orderId in session metadata");
    return;
  }

  // Update order status
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: "paid",
      status: "CONFIRMED",
      paymentId: session.payment_intent as string,
    },
    include: { store: true },
  });

  // Update store stats
  await prisma.store.update({
    where: { id: order.storeId },
    data: {
      orderCount: { increment: 1 },
      totalRevenueCents: { increment: order.storeOwnerAmountCents },
      platformFeesCollectedCents: { increment: order.platformFeeCents },
    },
  });

  // TODO: Send confirmation email to customer
  // TODO: Send notification to store owner
  console.log(`Order ${order.orderNumber} confirmed!`);
}

async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  const { type, orderId, storeId, userId, domainName, tld, sld } = paymentIntent.metadata ?? {};

  // ── Domain purchase ──
  if (type === "domain_purchase" && userId && sld && tld) {
    try {
      // Check if domain was already registered (idempotency)
      const existing = await prisma.storeDomain.findUnique({
        where: { domainName: domainName || `${sld}.${tld}` },
      });
      if (existing) {
        console.log(`Domain ${domainName} already registered, skipping duplicate webhook`);
        return;
      }

      // Fetch user's Brand Identity for registrant contact
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId },
        select: { name: true, email: true, phone: true, address: true, city: true, state: true, zip: true, country: true },
      });

      const contact = brandKit?.name && brandKit?.email && brandKit?.phone && brandKit?.address
        ? {
            first_name: brandKit.name.split(/\s+/)[0] || "Domain",
            last_name: brandKit.name.split(/\s+/).slice(1).join(" ") || "Owner",
            org_name: brandKit.name,
            address1: brandKit.address,
            city: brandKit.city || "New York",
            state: brandKit.state || "NY",
            postal_code: brandKit.zip || "10001",
            country: brandKit.country?.length === 2 ? brandKit.country : "US",
            phone: brandKit.phone.startsWith("+") ? brandKit.phone : `+1.${brandKit.phone.replace(/\D/g, "")}`,
            email: brandKit.email,
          }
        : undefined;

      const result = await purchaseDomain({
        storeId: storeId || null,
        userId,
        domainName: sld,
        tld,
        isFree: false,
        contact,
      });
      console.log(`Domain ${result.domainName} registered after payment ${paymentIntent.id}`);

      // Create invoice for the domain purchase
      const { createInvoice } = await import("@/lib/invoices");
      const domainUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      await createInvoice({
        userId,
        type: "domain_purchase",
        items: [
          {
            description: `Domain registration: ${result.domainName} (1 year)`,
            quantity: 1,
            unitPriceCents: paymentIntent.amount,
            totalCents: paymentIntent.amount,
          },
        ],
        totalCents: paymentIntent.amount,
        paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
        paymentId: paymentIntent.id,
        customerName: domainUser?.name || undefined,
        customerEmail: domainUser?.email || undefined,
      });
      console.log(`Invoice created for domain ${result.domainName}`);

      // Send notifications
      const { notifyDomainRegistered } = await import("@/lib/notifications/domain");
      await notifyDomainRegistered(userId, result.domainName);
    } catch (error: any) {
      console.error(`Failed to register domain ${domainName} after payment:`, error);

      // Send failure notification
      const { notifyDomainRegistrationFailed } = await import("@/lib/notifications/domain");
      if (userId) await notifyDomainRegistrationFailed(userId, domainName || `${sld}.${tld}`, error.message);
    }
    return;
  }

  // ── Order payment ──
  if (!orderId) return;

  await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: "paid" },
  });

  console.log(`Payment succeeded for order ${orderId}`);
}

async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string;

  // Find order by payment intent
  const order = await prisma.order.findFirst({
    where: { paymentId: paymentIntentId },
  });

  if (!order) return;

  const refundedAmountCents = charge.amount_refunded;

  // Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "refunded",
      status: "REFUNDED",
    },
  });

  // Reverse platform fees (subtract from collected fees)
  await prisma.store.update({
    where: { id: order.storeId },
    data: {
      totalRevenueCents: { decrement: refundedAmountCents },
      platformFeesCollectedCents: { decrement: order.platformFeeCents },
    },
  });

  console.log(`Order ${order.orderNumber} refunded`);
}
