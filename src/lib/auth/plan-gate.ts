import { NextResponse } from "next/server";

/**
 * Plans that have access to premium features (AI, SMS, Ads)
 */
export const PRO_PLUS_PLANS = ["PRO", "BUSINESS", "ENTERPRISE", "ADMIN"];

/**
 * Check if a user's plan allows access to a premium feature.
 * Returns a 403 NextResponse if the plan is insufficient, or null if access is allowed.
 *
 * Usage in API routes:
 *   const gate = checkPlanAccess(session.user.plan, "AI content generation");
 *   if (gate) return gate;
 */
export function checkPlanAccess(
  userPlan: string,
  featureName: string
): NextResponse | null {
  if (!PRO_PLUS_PLANS.includes(userPlan)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PLAN_UPGRADE_REQUIRED",
          message: `${featureName} requires a Pro plan or higher.`,
        },
      },
      { status: 403 }
    );
  }
  return null;
}
