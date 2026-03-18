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

/**
 * Check if a user has access to a specific feature via their activated features.
 * Returns a 403 NextResponse if blocked, or null if access is allowed.
 *
 * Usage in API routes:
 *   const gate = await checkFeatureAccess(session.userId, "sms-marketing");
 *   if (gate) return gate;
 */
export async function checkFeatureAccess(
  userId: string,
  featureSlug: string
): Promise<NextResponse | null> {
  // Admin/Agent always have access
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  if (user && ["ADMIN", "AGENT"].includes(user.plan)) {
    return null;
  }

  // Check if user has this feature activated
  const userFeature = await prisma.userFeature.findFirst({
    where: {
      userId,
      isActive: true,
      feature: { slug: featureSlug },
    },
  });

  if (userFeature) {
    return null;
  }

  // Also allow if they haven't done onboarding yet (legacy users)
  if (user && !await prisma.user.findFirst({ where: { id: userId, onboardingComplete: true } })) {
    // Fall back to plan-based check for users who haven't onboarded
    return checkPlanAccess(user.plan, featureSlug, userId);
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "FEATURE_NOT_ACTIVATED",
        message: `This feature is not activated. Go to Settings > Features to enable it.`,
      },
    },
    { status: 403 }
  );
}
