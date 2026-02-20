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
      frequency = "WEEKLY",
      includeMedia = true,
      mediaType = "image",
      endDate,
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
