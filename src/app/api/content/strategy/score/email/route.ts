import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { calculateStrategyScore } from "@/lib/strategy/scoring";
import { createNotification, NOTIFICATION_TYPES } from "@/lib/notifications";
import { sendStrategyReportEmail } from "@/lib/email";

function getMonthPeriod(year: number, month: number) {
  return {
    periodStart: new Date(year, month - 1, 1),
    periodEnd: new Date(year, month, 0, 23, 59, 59),
  };
}

function isValidMonth(year: number, month: number) {
  return Number.isInteger(year) && Number.isInteger(month) && year >= 2000 && month >= 1 && month <= 12;
}

// POST /api/content/strategy/score/email - Send the selected monthly report to the current user.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const month = parseInt(String(body.month || now.getMonth() + 1), 10);
    const year = parseInt(String(body.year || now.getFullYear()), 10);

    if (!isValidMonth(year, month)) {
      return NextResponse.json(
        { success: false, error: { message: "A valid month and year are required" } },
        { status: 400 }
      );
    }

    const strategy = await prisma.marketingStrategy.findFirst({
      where: { userId: session.userId, status: "ACTIVE" },
      include: { tasks: true },
    });

    if (!strategy) {
      return NextResponse.json(
        { success: false, error: { message: "No active strategy found" } },
        { status: 404 }
      );
    }

    const stored = await prisma.strategyScore.findUnique({
      where: {
        userId_strategyId_month_year: {
          userId: session.userId,
          strategyId: strategy.id,
          month,
          year,
        },
      },
    });

    const { periodStart, periodEnd } = getMonthPeriod(year, month);
    const posts = await prisma.post.findMany({
      where: {
        userId: session.userId,
        deletedAt: null,
        publishedAt: { gte: periodStart, lte: periodEnd },
      },
      select: { id: true, caption: true, hashtags: true, publishedAt: true, createdAt: true },
    });

    const liveScore = calculateStrategyScore({
      tasks: strategy.tasks,
      posts,
      periodStart,
      periodEnd,
    });

    const factors = stored
      ? {
          completion: stored.completionScore,
          onTime: stored.onTimeScore,
          consistency: stored.consistencyScore,
          adherence: stored.adherenceScore,
          production: stored.productionScore,
        }
      : liveScore.factors;

    const score = stored?.overallScore ?? liveScore.overall;
    const result = await sendStrategyReportEmail({
      to: session.user.email,
      name: session.user.name || "there",
      score,
      month,
      year,
      strategyName: strategy.name,
      factors,
      aiInsights: stored?.aiInsights || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error || "Report email failed" } },
        { status: 500 }
      );
    }

    await createNotification({
      userId: session.userId,
      type: NOTIFICATION_TYPES.STRATEGY_MONTHLY_REPORT,
      title: "Strategy report email sent",
      message: `Your ${year}-${String(month).padStart(2, "0")} strategy report was sent to ${session.user.email}.`,
      data: { month, year, score, strategyId: strategy.id },
      actionUrl: `/content/strategy/reports/${year}-${String(month).padStart(2, "0")}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        month,
        year,
        score,
        sentTo: session.user.email,
        messageId: result.messageId || null,
      },
    });
  } catch (error) {
    console.error("Send strategy report email error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to send strategy report email" } },
      { status: 500 }
    );
  }
}
