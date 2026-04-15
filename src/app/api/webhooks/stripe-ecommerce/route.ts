import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  handleEcommercePaymentSucceeded,
  handleEcommercePaymentFailedOrCanceled,
  handleEcommerceRefund,
  handleEcommerceAccountUpdated,
  handleEcommercePayoutEvent,
} from "@/lib/stripe/ecommerce-webhook";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

// This endpoint is kept for backwards compatibility — but in production the
// configured Stripe webhook points at /api/payments/webhook, which now also
// dispatches ecommerce events via the shared handlers.
const webhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET_ECOMMERCE ||
  process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    switch (event.type) {
      case "payment_intent.succeeded":
        await handleEcommercePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.canceled":
      case "payment_intent.payment_failed":
        await handleEcommercePaymentFailedOrCanceled(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleEcommerceRefund(event.data.object as Stripe.Charge);
        break;
      case "account.updated":
        await handleEcommerceAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "payout.paid":
      case "payout.failed":
      case "payout.canceled":
        await handleEcommercePayoutEvent(event.data.object as Stripe.Payout, event.account);
        break;
      default:
        console.log(`[stripe-ecommerce] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-ecommerce] Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 400 });
  }
}
