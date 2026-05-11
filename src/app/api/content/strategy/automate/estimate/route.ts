import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { estimateAutomationCredits } from "@/lib/strategy/credit-estimator";

// POST /api/content/strategy/automate/estimate - Get credit estimate for automating a strategy
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      strategyId,
      taskIds,
      frequency = "ONCE",
      includeMedia = true,
      mediaType = "image",
      endDate,
      platforms = [],
      taskConfigs,
    } = body;

    if (!strategyId) {
      return NextResponse.json(
        { success: false, error: { message: "Strategy ID is required" } },
        { status: 400 }
      );
    }

    // Load strategy with tasks
    const strategy = await prisma.marketingStrategy.findUnique({
      where: { id: strategyId },
      include: {
        tasks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!strategy || strategy.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Strategy not found" } },
        { status: 404 }
      );
    }

    // Get user credits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });
    const [socialAccounts, marketingConfig] = await Promise.all([
      prisma.socialAccount.findMany({
        where: { userId: session.userId, isActive: true },
        select: { platform: true },
      }),
      prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: {
          emailProvider: true,
          emailEnabled: true,
          emailVerified: true,
          smsEnabled: true,
          smsVerified: true,
          smsPhoneNumber: true,
          smsComplianceStatus: true,
        },
      }),
    ]);
    const connectedPlatforms = socialAccounts.map((account) =>
      account.platform.startsWith("facebook_")
        ? "facebook"
        : account.platform.startsWith("instagram_")
          ? "instagram"
          : account.platform
    );
    const emailReady = !!(
      marketingConfig &&
      marketingConfig.emailProvider !== "NONE" &&
      marketingConfig.emailEnabled &&
      marketingConfig.emailVerified
    );
    const smsReady = !!(
      marketingConfig?.smsEnabled &&
      marketingConfig.smsVerified &&
      marketingConfig.smsPhoneNumber &&
      marketingConfig.smsComplianceStatus === "APPROVED"
    );

    // Use strategy end date or provided end date
    const effectiveEndDate =
      endDate ||
      (() => {
        // Default: 3 months from now
        const d = new Date();
        d.setMonth(d.getMonth() + 3);
        return d.toISOString().split("T")[0];
      })();

    const estimate = await estimateAutomationCredits(strategy.tasks, {
      frequency,
      includeMedia,
      mediaType,
      endDate: effectiveEndDate,
      userCredits: user?.aiCredits || 0,
      selectedTaskIds: Array.isArray(taskIds) ? taskIds : undefined,
      selectedPlatforms: Array.isArray(platforms) ? platforms : [],
      connectedPlatforms,
      emailReady,
      smsReady,
      taskConfigs: Array.isArray(taskConfigs) ? taskConfigs : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        strategyName: strategy.name,
        ...estimate,
      },
    });
  } catch (error) {
    console.error("Estimate automation credits error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to estimate credits" } },
      { status: 500 }
    );
  }
}
