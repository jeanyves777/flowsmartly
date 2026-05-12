import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/ecommerce/trial-check
 * Legacy cron endpoint retained for compatibility. FlowShop is now included
 * with an active FlowSmartly account, so old trial/expired stores are migrated
 * back to active free access instead of being expired.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
        { status: 401 }
      );
    }

    const migrated = await prisma.store.updateMany({
      where: {
        ecomSubscriptionStatus: { in: ["free_trial", "expired", "trialing"] },
      },
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
      data: { migrated: migrated.count, reminders: 0, expired: 0 },
    });
  } catch (error) {
    console.error("Trial check cron error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Trial check failed" } },
      { status: 500 }
    );
  }
}
