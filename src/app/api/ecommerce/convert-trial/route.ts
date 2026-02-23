import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe";
import { convertFreeTrialToSubscription } from "@/lib/stripe/ecommerce";

/**
 * POST /api/ecommerce/convert-trial
 * Convert a free trial to a paid Basic subscription by adding a card.
 * Called when a user on free_trial or expired adds a payment method.
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

    const body = await request.json().catch(() => ({}));
    const paymentMethodId = body.paymentMethodId as string | undefined;

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: { code: "CARD_REQUIRED", message: "A payment method is required." } },
        { status: 400 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "No store found." } },
        { status: 404 }
      );
    }

    if (!["free_trial", "expired"].includes(store.ecomSubscriptionStatus)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_STATUS", message: "Store is not on a free trial." } },
        { status: 400 }
      );
    }

    const customerId = await getOrCreateStripeCustomer(session.userId);

    const result = await convertFreeTrialToSubscription({
      userId: session.userId,
      customerId,
      paymentMethodId,
    });

    await prisma.store.update({
      where: { id: store.id },
      data: {
        ecomSubscriptionId: result.subscriptionId,
        ecomSubscriptionStatus: result.status === "active" ? "active" : "inactive",
        isActive: result.status === "active",
        freeTrialStartedAt: null,
        freeTrialEndsAt: null,
        freeTrialRemindersSent: "[]",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: result.subscriptionId,
        status: result.status,
      },
    });
  } catch (error) {
    console.error("Convert trial error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to convert trial." } },
      { status: 500 }
    );
  }
}
