import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getOrCreateStripeCustomer, stripe } from "@/lib/stripe";

// ListSmartly pricing
const LS_PLANS = {
  basic: {
    name: "ListSmartly Basic",
    priceCentsMonthly: 700,  // $7/mo
    stripePriceId: process.env.STRIPE_LISTSMARTLY_BASIC_PRICE_ID || "",
  },
  pro: {
    name: "ListSmartly Pro",
    priceCentsMonthly: 1500, // $15/mo
    stripePriceId: process.env.STRIPE_LISTSMARTLY_PRO_PRICE_ID || "",
  },
};

/**
 * GET /api/listsmartly/subscription
 * Get current user's ListSmartly subscription details.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const profile = await prisma.listSmartlyProfile.findFirst({
      where: { userId: session.userId },
      select: {
        id: true,
        lsPlan: true,
        lsSubscriptionId: true,
        lsSubscriptionStatus: true,
        freeTrialStartedAt: true,
        freeTrialEndsAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "No ListSmartly profile found" }, { status: 404 });
    }

    // Check if trial has expired
    if (profile.lsSubscriptionStatus === "trialing" && profile.freeTrialEndsAt) {
      if (new Date(profile.freeTrialEndsAt) < new Date()) {
        // Trial expired — update status
        await prisma.listSmartlyProfile.update({
          where: { id: profile.id },
          data: { lsSubscriptionStatus: "inactive" },
        });
        profile.lsSubscriptionStatus = "inactive";
      }
    }

    const planConfig = LS_PLANS[profile.lsPlan as keyof typeof LS_PLANS] || LS_PLANS.basic;

    return NextResponse.json({
      success: true,
      data: {
        plan: profile.lsPlan,
        planName: planConfig.name,
        priceMonthly: planConfig.priceCentsMonthly,
        subscriptionId: profile.lsSubscriptionId,
        status: profile.lsSubscriptionStatus,
        trialStartedAt: profile.freeTrialStartedAt,
        trialEndsAt: profile.freeTrialEndsAt,
      },
    });
  } catch (err) {
    console.error("[ListSmartly Subscription] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}

/**
 * PATCH /api/listsmartly/subscription
 * Change plan or subscribe via Stripe.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { plan, action } = body;

    const profile = await prisma.listSmartlyProfile.findFirst({
      where: { userId: session.userId },
      select: { id: true, lsPlan: true, lsSubscriptionId: true, lsSubscriptionStatus: true },
    });

    if (!profile) return NextResponse.json({ error: "No ListSmartly profile" }, { status: 404 });

    // ── Subscribe (create Stripe subscription) ──
    if (action === "subscribe") {
      const targetPlan = plan || profile.lsPlan;
      const planConfig = LS_PLANS[targetPlan as keyof typeof LS_PLANS];
      if (!planConfig) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

      if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

      if (!planConfig.stripePriceId) {
        // No Stripe price ID configured — just activate the plan directly
        await prisma.listSmartlyProfile.update({
          where: { id: profile.id },
          data: { lsPlan: targetPlan, lsSubscriptionStatus: "active" },
        });
        return NextResponse.json({ success: true, message: "Plan activated" });
      }

      const customerId = await getOrCreateStripeCustomer(session.userId);

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: planConfig.stripePriceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/listsmartly/settings?subscription=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/listsmartly/settings?subscription=cancelled`,
        metadata: {
          type: "listsmartly_subscription",
          userId: session.userId,
          profileId: profile.id,
          plan: targetPlan,
        },
      });

      return NextResponse.json({ success: true, data: { checkoutUrl: checkoutSession.url } });
    }

    // ── Change plan (local only, for admin or trial users) ──
    if (plan && (plan === "basic" || plan === "pro")) {
      await prisma.listSmartlyProfile.update({
        where: { id: profile.id },
        data: { lsPlan: plan },
      });

      return NextResponse.json({ success: true, message: `Plan changed to ${plan}` });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err) {
    console.error("[ListSmartly Subscription] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}

/**
 * DELETE /api/listsmartly/subscription
 * Cancel ListSmartly subscription.
 */
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const profile = await prisma.listSmartlyProfile.findFirst({
      where: { userId: session.userId },
      select: { id: true, lsSubscriptionId: true, lsSubscriptionStatus: true },
    });

    if (!profile) return NextResponse.json({ error: "No ListSmartly profile" }, { status: 404 });

    // Cancel Stripe subscription if exists
    if (profile.lsSubscriptionId && stripe) {
      try {
        await stripe.subscriptions.cancel(profile.lsSubscriptionId);
      } catch (err) {
        console.error("[ListSmartly] Failed to cancel Stripe subscription:", err);
      }
    }

    await prisma.listSmartlyProfile.update({
      where: { id: profile.id },
      data: { lsSubscriptionStatus: "cancelled", lsSubscriptionId: null },
    });

    return NextResponse.json({ success: true, message: "Subscription cancelled" });
  } catch (err) {
    console.error("[ListSmartly Subscription] DELETE error:", err);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
