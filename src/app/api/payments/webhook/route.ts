import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS, type PlanId } from "@/lib/stripe";
import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import {
  notifyCreditPurchase,
  notifyPaymentMethodAdded,
  notifySubscriptionActivated,
  notifySubscriptionRenewed,
  notifySubscriptionCancelled,
} from "@/lib/notifications";
import type Stripe from "stripe";
import { calculateAndAwardCommission } from "@/lib/referrals";

export const runtime = "nodejs";

// Process the webhook event (shared between verified and dev mode)
async function processWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata ?? {};

      const { userId, type, packageId, credits, bonus, planId } = metadata;

      if (!userId) {
        console.error("[Stripe Webhook] Missing userId in session metadata");
        break;
      }

      if (type === "credit_purchase") {
        const totalCredits =
          parseInt(credits || "0", 10) + parseInt(bonus || "0", 10);

        await creditService.addCredits({
          userId,
          type: TRANSACTION_TYPES.PURCHASE,
          amount: totalCredits,
          description: `Purchased ${credits} credits${bonus && parseInt(bonus, 10) > 0 ? ` + ${bonus} bonus` : ""} (Package: ${packageId})`,
          referenceType: "stripe_purchase",
          referenceId: session.id,
        });

        // Update stripeCustomerId if not already set
        if (session.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer as string },
          });
        }

        // Get user details for notification
        const purchaseUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true, aiCredits: true },
        });

        // Send credit purchase notification
        if (purchaseUser) {
          notifyCreditPurchase({
            userId,
            email: purchaseUser.email,
            name: purchaseUser.name,
            credits: totalCredits,
            amountCents: session.amount_total || 0,
            newBalance: purchaseUser.aiCredits,
          }).catch((err) => console.error("Failed to send credit purchase notification:", err));
        }

        // Process referral commission (fire-and-forget)
        calculateAndAwardCommission({
          payerUserId: userId,
          paymentAmountCents: session.amount_total || 0,
          sourceType: "CREDIT_PURCHASE",
          sourcePaymentId: session.id,
        }).catch((err) => console.error("[Stripe Webhook] Referral commission error:", err));

        console.log(
          `[Stripe Webhook] Credit purchase completed: ${totalCredits} credits for user ${userId}`
        );
      } else if (type === "subscription") {
        const validPlanId = planId as PlanId;
        const plan = PLANS[validPlanId];

        if (!plan) {
          console.error(
            `[Stripe Webhook] Invalid planId in metadata: ${planId}`
          );
          break;
        }

        // Update user plan and expiration
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: validPlanId,
            planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            stripeCustomerId: session.customer as string,
          },
        });

        // Add monthly credits based on plan
        await creditService.addCredits({
          userId,
          type: TRANSACTION_TYPES.SUBSCRIPTION,
          amount: plan.monthlyCredits,
          description: `${plan.name} plan monthly credits`,
          referenceType: "stripe_subscription",
          referenceId: session.id,
        });

        // Send subscription activated notification
        const subUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });

        if (subUser) {
          notifySubscriptionActivated({
            userId,
            email: subUser.email,
            name: subUser.name,
            planName: plan.name,
            monthlyCredits: plan.monthlyCredits,
            amountCents: session.amount_total || 0,
            interval: "monthly",
          }).catch((err) => console.error("Failed to send subscription activated notification:", err));
        }

        // Process referral commission (fire-and-forget)
        calculateAndAwardCommission({
          payerUserId: userId,
          paymentAmountCents: session.amount_total || 0,
          sourceType: "SUBSCRIPTION",
          sourcePaymentId: session.id,
        }).catch((err) => console.error("[Stripe Webhook] Referral commission error:", err));

        console.log(
          `[Stripe Webhook] Subscription activated: ${validPlanId} plan for user ${userId} (+${plan.monthlyCredits} credits)`
        );
      }

      break;
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const piMetadata = paymentIntent.metadata ?? {};

      if (piMetadata.type !== "credit_purchase" || !piMetadata.userId) {
        break;
      }

      // Idempotency: check if we already processed this payment
      const existingPiTx = await prisma.creditTransaction.findFirst({
        where: {
          referenceId: paymentIntent.id,
          referenceType: "stripe_payment",
        },
      });

      if (existingPiTx) {
        console.log(`[Stripe Webhook] PaymentIntent ${paymentIntent.id} already processed, skipping`);
        break;
      }

      const piCredits = parseInt(piMetadata.credits || "0", 10);
      const piBonus = parseInt(piMetadata.bonus || "0", 10);
      const piTotalCredits = piCredits + piBonus;

      await creditService.addCredits({
        userId: piMetadata.userId,
        type: TRANSACTION_TYPES.PURCHASE,
        amount: piTotalCredits,
        description: `Purchased ${piCredits} credits${piBonus > 0 ? ` + ${piBonus} bonus` : ""} (Package: ${piMetadata.packageId})`,
        referenceType: "stripe_payment",
        referenceId: paymentIntent.id,
      });

      // Get user details for notification
      const piUser = await prisma.user.findUnique({
        where: { id: piMetadata.userId },
        select: { email: true, name: true, aiCredits: true },
      });

      if (piUser) {
        notifyCreditPurchase({
          userId: piMetadata.userId,
          email: piUser.email,
          name: piUser.name,
          credits: piTotalCredits,
          amountCents: paymentIntent.amount,
          newBalance: piUser.aiCredits,
        }).catch((err) => console.error("Failed to send credit purchase notification:", err));
      }

      // Process referral commission (fire-and-forget)
      calculateAndAwardCommission({
        payerUserId: piMetadata.userId,
        paymentAmountCents: paymentIntent.amount,
        sourceType: "CREDIT_PURCHASE",
        sourcePaymentId: paymentIntent.id,
      }).catch((err) => console.error("[Stripe Webhook] Referral commission error:", err));

      console.log(
        `[Stripe Webhook] PaymentIntent credit purchase: ${piTotalCredits} credits for user ${piMetadata.userId}`
      );
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;

      // v2026 API: subscription info is under invoice.parent.subscription_details
      const subDetails = invoice.parent?.subscription_details;
      if (!subDetails || !stripe) break;

      const subscriptionId = typeof subDetails.subscription === "string"
        ? subDetails.subscription
        : subDetails.subscription?.id;
      if (!subscriptionId) break;

      // Use metadata from invoice snapshot, fall back to fetching subscription
      let subMetadata = subDetails.metadata ?? {};
      if (!subMetadata.type) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        subMetadata = sub.metadata ?? {};
      }

      if (subMetadata.type !== "subscription" || !subMetadata.userId) {
        break;
      }

      // Idempotency: check if we already processed this invoice
      const existingInvTx = await prisma.creditTransaction.findFirst({
        where: {
          referenceId: invoice.id,
          referenceType: "stripe_subscription",
        },
      });

      if (existingInvTx) {
        console.log(`[Stripe Webhook] Invoice ${invoice.id} already processed, skipping`);
        break;
      }

      const subPlanId = subMetadata.planId as PlanId;
      const subPlan = PLANS[subPlanId];

      if (!subPlan) {
        console.error(`[Stripe Webhook] Invalid planId in subscription metadata: ${subMetadata.planId}`);
        break;
      }

      // Update user plan
      await prisma.user.update({
        where: { id: subMetadata.userId },
        data: {
          plan: subPlanId,
          planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Add monthly credits
      const subMonthlyCredits = parseInt(subMetadata.monthlyCredits || String(subPlan.monthlyCredits), 10);
      await creditService.addCredits({
        userId: subMetadata.userId,
        type: TRANSACTION_TYPES.SUBSCRIPTION,
        amount: subMonthlyCredits,
        description: `${subPlan.name} plan monthly credits`,
        referenceType: "stripe_subscription",
        referenceId: invoice.id,
      });

      // Send subscription renewed notification
      const renewUser = await prisma.user.findUnique({
        where: { id: subMetadata.userId },
        select: { email: true, name: true },
      });

      if (renewUser) {
        notifySubscriptionRenewed({
          userId: subMetadata.userId,
          email: renewUser.email,
          name: renewUser.name,
          planName: subPlan.name,
          monthlyCredits: subMonthlyCredits,
          amountCents: invoice.amount_paid || 0,
        }).catch((err) => console.error("Failed to send subscription renewed notification:", err));
      }

      // Process referral commission (fire-and-forget)
      calculateAndAwardCommission({
        payerUserId: subMetadata.userId,
        paymentAmountCents: invoice.amount_paid || 0,
        sourceType: "SUBSCRIPTION",
        sourcePaymentId: invoice.id,
      }).catch((err) => console.error("[Stripe Webhook] Referral commission error:", err));

      console.log(
        `[Stripe Webhook] Subscription invoice paid: ${subPlanId} plan for user ${subMetadata.userId} (+${subMonthlyCredits} credits)`
      );
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Find user by stripeCustomerId and reset plan to STARTER
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        // Capture previous plan before resetting
        const previousPlan = user.plan || "Unknown";

        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: "STARTER",
            planExpiresAt: null,
          },
        });

        // Send subscription cancelled notification
        notifySubscriptionCancelled({
          userId: user.id,
          email: user.email,
          name: user.name,
          planName: previousPlan,
        }).catch((err) => console.error("Failed to send subscription cancelled notification:", err));

        console.log(
          `[Stripe Webhook] Subscription cancelled: user ${user.id} reset to STARTER plan`
        );
      } else {
        console.warn(
          `[Stripe Webhook] No user found for stripeCustomerId: ${customerId}`
        );
      }

      break;
    }

    case "setup_intent.succeeded": {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      const siMetadata = setupIntent.metadata ?? {};
      const siUserId = siMetadata.userId;

      if (!siUserId) break;

      // Get the payment method details
      const pmId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

      if (!pmId || !stripe) break;

      const pm = await stripe.paymentMethods.retrieve(pmId);
      const cardBrand = pm.card?.brand || "card";
      const last4 = pm.card?.last4 || "****";

      // Get user details
      const siUser = await prisma.user.findUnique({
        where: { id: siUserId },
        select: { email: true, name: true },
      });

      if (siUser) {
        notifyPaymentMethodAdded({
          userId: siUserId,
          email: siUser.email,
          name: siUser.name,
          cardBrand,
          last4,
        }).catch((err) => console.error("Failed to send payment method added notification:", err));
      }

      console.log(
        `[Stripe Webhook] Payment method added: ${cardBrand} ****${last4} for user ${siUserId}`
      );
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  // Dev mode: process without signature verification
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn(
      "[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set — processing without signature verification (dev mode)"
    );

    try {
      const event = JSON.parse(body) as Stripe.Event;
      await processWebhookEvent(event);
      return NextResponse.json({ received: true, mode: "dev" }, { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Stripe Webhook] Dev mode error: ${message}`);
      return NextResponse.json(
        { error: `Dev mode webhook failed: ${message}` },
        { status: 500 }
      );
    }
  }

  // Production mode: verify signature
  if (!sig) {
    console.error("[Stripe Webhook] Missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  if (!stripe) {
    console.error("[Stripe Webhook] Stripe is not configured");
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Stripe Webhook] Signature verification failed: ${message}`);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  try {
    await processWebhookEvent(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Stripe Webhook] Error processing event: ${message}`);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
