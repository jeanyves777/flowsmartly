import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * Plans that have access to premium features (AI, SMS, Ads)
 */
export const PRO_PLUS_PLANS = ["PRO", "BUSINESS", "ENTERPRISE", "ADMIN", "AGENT"];

/**
 * Check if a user's plan allows access to a premium feature.
 * Users on a free plan can still access features if they have purchased credits.
 * Returns a 403 NextResponse if blocked, or null if access is allowed.
 *
 * Usage in API routes:
 *   const gate = await checkPlanAccess(session.user.plan, "AI content generation", session.userId);
 *   if (gate) return gate;
 */
export async function checkPlanAccess(
  userPlan: string,
  featureName: string,
  userId?: string
): Promise<NextResponse | null> {
  if (PRO_PLUS_PLANS.includes(userPlan)) {
    return null;
  }

  // Free plan — allow if user has purchased credits
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiCredits: true, freeCredits: true },
    });

    if (user) {
      const purchasedCredits = Math.max(0, user.aiCredits - (user.freeCredits || 0));
      if (purchasedCredits > 0) {
        return null;
      }
    }
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "PLAN_UPGRADE_REQUIRED",
        message: `${featureName} requires a Pro plan or higher, or purchased credits.`,
      },
    },
    { status: 403 }
  );
}
