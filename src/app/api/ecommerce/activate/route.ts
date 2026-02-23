import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe";
import { createEcommerceSubscription } from "@/lib/stripe/ecommerce";

/**
 * POST /api/ecommerce/activate
 * Activate the FlowShop e-commerce add-on with 14-day free trial.
 * Requires a paymentMethodId (card on file) — no Stripe Checkout redirect.
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

    if (existingStore && (existingStore.ecomSubscriptionStatus === "active" || existingStore.ecomSubscriptionStatus === "trialing")) {
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

    if (!paymentMethodId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CARD_REQUIRED",
            message: "A payment method is required. Please add a card before activating.",
          },
        },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(session.userId);

    // Create subscription with 14-day trial (card captured but not charged)
    const result = await createEcommerceSubscription({
      userId: session.userId,
      customerId,
      paymentMethodId,
    });

    // Store is active immediately (trial counts as active)
    const isActive = result.status === "active" || result.status === "trialing";
    const subStatus = result.status === "trialing" ? "trialing" : result.status === "active" ? "active" : "inactive";

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
          isActive,
        },
      });
    } else {
      await prisma.store.update({
        where: { userId: session.userId },
        data: {
          ecomSubscriptionId: result.subscriptionId,
          ecomSubscriptionStatus: subStatus,
          isActive,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: result.subscriptionId,
        status: result.status,
        trialEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
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
