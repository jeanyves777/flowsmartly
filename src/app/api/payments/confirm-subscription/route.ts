import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { notifySubscriptionActivated } from "@/lib/notifications";
import { createInvoice } from "@/lib/invoices";

/**
 * POST /api/payments/confirm-subscription
 *
 * Called by the client after Stripe payment confirmation (including 3DS).
 * Verifies the subscription is active with Stripe, then updates the user's
 * plan in the database immediately — no need to wait for the async webhook.
 * The webhook is still the safety net / idempotent backup.
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

    // Retrieve the subscription from Stripe to verify status
    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    // Verify the subscription belongs to this user
    if (sub.metadata.userId !== session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // Only proceed if subscription is actually active
    if (sub.status !== "active" && sub.status !== "trialing") {
      return NextResponse.json({
        success: false,
        error: `Subscription not active (status: ${sub.status})`,
      });
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
