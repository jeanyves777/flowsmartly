import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe";
import { createEcommerceSubscription } from "@/lib/stripe/ecommerce";
import { ECOM_BASIC_TRIAL_DAYS, ECOM_PRO_TRIAL_DAYS } from "@/lib/domains/pricing";

/**
 * POST /api/ecommerce/activate
 * Activate the FlowShop e-commerce add-on.
 * - Basic plan: 30-day free trial, NO card required.
 * - Pro plan: 14-day free trial, card required.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Check if user already has a store
    const existingStore = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true, ecomSubscriptionStatus: true },
    });

    if (
      existingStore &&
      ["active", "trialing", "free_trial"].includes(existingStore.ecomSubscriptionStatus)
    ) {
      return NextResponse.json(
        { success: false, error: { code: "ALREADY_ACTIVE", message: "FlowShop is already active" } },
        { status: 409 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true, stripeCustomerId: true, country: true, region: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const paymentMethodId = body.paymentMethodId as string | undefined;
    const plan = (body.plan === "pro" ? "pro" : "basic") as "basic" | "pro";

    // Pro plan always requires a card
    if (plan === "pro" && !paymentMethodId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CARD_REQUIRED",
            message: "Pro plan requires a payment method. Please add a card before activating.",
          },
        },
        { status: 400 }
      );
    }

    // ── Basic plan without card: internal free trial (no Stripe subscription) ──
    if (plan === "basic" && !paymentMethodId) {
      const now = new Date();
      const trialEnds = new Date(now.getTime() + ECOM_BASIC_TRIAL_DAYS * 24 * 60 * 60 * 1000);

      const storeData = {
        ecomSubscriptionId: null as string | null,
        ecomSubscriptionStatus: "free_trial",
        ecomPlan: "basic" as const,
        isActive: true,
        freeTrialStartedAt: now,
        freeTrialEndsAt: trialEnds,
        freeTrialRemindersSent: "[]",
      };

      if (!existingStore) {
        await prisma.store.create({
          data: {
            userId: session.userId,
            name: user.name || "My Store",
            slug: `store-${session.userId.slice(0, 8)}`,
            region: user.region,
            country: user.country,
            ...storeData,
          },
        });
      } else {
        await prisma.store.update({
          where: { userId: session.userId },
          data: storeData,
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          subscriptionId: null,
          status: "free_trial",
          plan: "basic",
          trialEnds: trialEnds.toISOString(),
          cardRequired: false,
        },
      });
    }

    // ── Stripe subscription path (Pro, or Basic with card) ──
    const customerId = await getOrCreateStripeCustomer(session.userId);

    const result = await createEcommerceSubscription({
      userId: session.userId,
      customerId,
      paymentMethodId: paymentMethodId!,
      plan,
    });

    const isActive = result.status === "active" || result.status === "trialing";
    const subStatus = result.status === "trialing" ? "trialing" : result.status === "active" ? "active" : "inactive";
    const trialDays = plan === "pro" ? ECOM_PRO_TRIAL_DAYS : ECOM_BASIC_TRIAL_DAYS;

    if (!existingStore) {
      await prisma.store.create({
        data: {
          userId: session.userId,
          name: user.name || "My Store",
          slug: `store-${session.userId.slice(0, 8)}`,
          region: user.region,
          country: user.country,
          ecomSubscriptionId: result.subscriptionId,
          ecomSubscriptionStatus: subStatus,
          ecomPlan: plan,
          isActive,
        },
      });
    } else {
      await prisma.store.update({
        where: { userId: session.userId },
        data: {
          ecomSubscriptionId: result.subscriptionId,
          ecomSubscriptionStatus: subStatus,
          ecomPlan: plan,
          isActive,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: result.subscriptionId,
        status: result.status,
        plan,
        trialEnds: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error("E-commerce activation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to activate e-commerce" } },
      { status: 500 }
    );
  }
}
