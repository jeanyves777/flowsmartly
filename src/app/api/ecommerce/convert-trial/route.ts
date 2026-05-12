import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * POST /api/ecommerce/convert-trial
 * Legacy compatibility endpoint. Store trials were retired when FlowShop
 * became included with an active FlowSmartly account.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "No store found." } },
        { status: 404 }
      );
    }

    await prisma.store.update({
      where: { id: store.id },
      data: {
        ecomSubscriptionId: null,
        ecomSubscriptionStatus: "active",
        ecomPlan: "free",
        isActive: true,
        freeTrialStartedAt: null,
        freeTrialEndsAt: null,
        freeTrialRemindersSent: "[]",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: null,
        status: "active",
        plan: "free",
      },
    });
  } catch (error) {
    console.error("Convert trial compatibility error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to activate FlowShop." } },
      { status: 500 }
    );
  }
}
