import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/user/onboarding-state - Combined onboarding state for progressive banners
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const [user, brandKit, strategy, automation] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          emailVerified: true,
          dismissedBanners: true,
        },
      }),
      prisma.brandKit.findFirst({
        where: { userId: session.userId, isComplete: true },
        select: { id: true },
      }),
      prisma.marketingStrategy.findFirst({
        where: { userId: session.userId, status: "ACTIVE" },
        select: { id: true },
      }),
      prisma.postAutomation.findFirst({
        where: { userId: session.userId, sourceStrategyId: { not: null } },
        select: { id: true },
      }),
    ]);

    let dismissedBanners: string[] = [];
    try {
      dismissedBanners = JSON.parse(user?.dismissedBanners || "[]");
    } catch {
      dismissedBanners = [];
    }

    return NextResponse.json({
      success: true,
      data: {
        emailVerified: user?.emailVerified || false,
        brandSetup: !!brandKit,
        hasStrategy: !!strategy,
        strategyId: strategy?.id || null,
        hasAutomation: !!automation,
        dismissedBanners,
      },
    });
  } catch (error) {
    console.error("Onboarding state error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch onboarding state" } },
      { status: 500 }
    );
  }
}
