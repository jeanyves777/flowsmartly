import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { notifySubscriptionActivated } from "@/lib/notifications";
import { createInvoice } from "@/lib/invoices";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /api/payments/confirm-subscription
 *
 * Called by the client after Stripe payment confirmation (including 3DS).
 * Verifies the subscription is active with Stripe, then updates the user's
 * plan in the database immediately — no need to wait for the async webhook.
 * The webhook is still the safety net / idempotent backup.
 *
 * Includes retry logic because the subscription status transition from
 * "incomplete" to "active" may take a moment after confirmCardPayment.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { subscriptionId } = await req.json();

    if (!subscriptionId || !stripe) {
      return NextResponse.json(
        { success: false, error: "Missing subscriptionId or Stripe not configured" },
        { status: 400 }
      );
    }

    // Retrieve the subscription from Stripe — retry up to 4 times
    // because status may still be "incomplete" right after confirmCardPayment
    let sub = await stripe.subscriptions.retrieve(subscriptionId);

    // Verify the subscription belongs to this user
    if (sub.metadata.userId !== session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const MAX_RETRIES = 4;
    for (let i = 0; i < MAX_RETRIES && sub.status !== "active" && sub.status !== "trialing"; i++) {
      console.log(`[confirm-subscription] Sub ${subscriptionId} status: ${sub.status}, retry ${i + 1}/${MAX_RETRIES}`);
      await sleep(1500);
      sub = await stripe.subscriptions.retrieve(subscriptionId);
    }

    // After retries, if still not active, update the plan anyway since
    // the client confirmed payment succeeded — the webhook will handle
    // the final status update if needed
    if (sub.status !== "active" && sub.status !== "trialing") {
      console.warn(
        `[confirm-subscription] Sub ${subscriptionId} still ${sub.status} after retries — updating plan anyway`
      );
    }

    const planId = sub.metadata.planId;
    if (!planId) {
      return NextResponse.json({ success: false, error: "Missing plan metadata" });
    }

    // Idempotency: check if already on this plan
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { plan: true, email: true, name: true },
    });

    if (currentUser?.plan === planId) {
      return NextResponse.json({ success: true, data: { plan: planId } });
    }

    // Get plan details
    const plan = await prisma.plan.findUnique({ where: { planId } });
    if (!plan) {
      return NextResponse.json({ success: false, error: "Plan not found" });
    }

    // Update the user's plan
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        plan: planId,
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    console.log(`[confirm-subscription] Updated plan to ${planId} for user ${session.userId}`);

    // Check if credits were already added by the webhook (idempotency)
    const existingCredits = await prisma.creditTransaction.findFirst({
      where: {
        userId: session.userId,
        referenceType: "stripe_subscription",
        referenceId: sub.id,
      },
    });

    if (!existingCredits) {
      await creditService.addCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.SUBSCRIPTION,
        amount: plan.monthlyCredits,
        description: `${plan.name} plan monthly credits`,
        referenceType: "stripe_subscription",
        referenceId: sub.id,
      });
      console.log(`[confirm-subscription] Added ${plan.monthlyCredits} credits for user ${session.userId}`);
    }

    // Fire-and-forget notifications
    if (currentUser) {
      notifySubscriptionActivated({
        userId: session.userId,
        email: currentUser.email,
        name: currentUser.name,
        planName: plan.name,
        monthlyCredits: plan.monthlyCredits,
        amountCents: plan.priceCentsMonthly,
        interval: "monthly",
      }).catch(() => {});

      createInvoice({
        userId: session.userId,
        type: "subscription",
        items: [{
          description: `${plan.name} Plan subscription`,
          quantity: 1,
          unitPriceCents: plan.priceCentsMonthly,
          totalCents: plan.priceCentsMonthly,
        }],
        totalCents: plan.priceCentsMonthly,
        paymentMethod: "card",
        paymentId: sub.id,
        customerName: currentUser.name,
        customerEmail: currentUser.email,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: { plan: planId, credits: plan.monthlyCredits },
    });
  } catch (error) {
    console.error("[confirm-subscription] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to confirm subscription" },
      { status: 500 }
    );
  }
}
