import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { calculateStrategyScore } from "@/lib/strategy/scoring";
import { syncActivitiesForStrategy } from "@/lib/strategy/activity-matcher";

// GET /api/content/strategy/score — Current score for navbar polling
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Find ACTIVE strategy with tasks
    const strategy = await prisma.marketingStrategy.findFirst({
      where: { userId: session.userId, status: "ACTIVE" },
      include: { tasks: true },
    });

    // On-demand activity sync: fire-and-forget, debounced at 4 hours
    if (strategy) {
      const SYNC_DEBOUNCE_MS = 4 * 60 * 60 * 1000;
      const lastSync = strategy.lastActivitySync;
      if (
        !lastSync ||
        Date.now() - new Date(lastSync).getTime() > SYNC_DEBOUNCE_MS
      ) {
        syncActivitiesForStrategy(strategy.id, session.userId).catch((err) =>
          console.error("On-demand activity sync failed:", err)
        );
      }
    }

    if (!strategy || strategy.tasks.length === 0) {
      return NextResponse.json({
        success: true,
        data: { score: null, factors: null, trend: null, hasStrategy: false },
      });
    }

    // Current month period
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    // Fetch posts for the current month
    const posts = await prisma.post.findMany({
      where: {
        userId: session.userId,
        deletedAt: null,
        publishedAt: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true,
        caption: true,
        hashtags: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    const score = calculateStrategyScore({
      tasks: strategy.tasks,
      posts,
      periodStart,
      periodEnd,
    });

    // Get previous month's stored score for trend
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear =
      now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const previousScore = await prisma.strategyScore.findFirst({
      where: {
        userId: session.userId,
        strategyId: strategy.id,
        month: prevMonth,
        year: prevYear,
      },
      select: { overallScore: true },
    });

    const trend = previousScore
      ? score.overall - previousScore.overallScore
      : null;

    return NextResponse.json({
      success: true,
      data: {
        score: score.overall,
        factors: score.factors,
        trend,
        hasStrategy: true,
      },
    });
  } catch (error) {
    console.error("Get strategy score error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch score" } },
      { status: 500 }
    );
  }
}
