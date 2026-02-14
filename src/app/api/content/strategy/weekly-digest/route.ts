import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { sendStrategyWeeklyDigestEmail } from "@/lib/email";
import { getNotificationPreferences } from "@/lib/notifications";

// POST /api/content/strategy/weekly-digest
// Called by external cron weekly (e.g., every Monday 9am). Protected by CRON_SECRET.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const activeStrategies = await prisma.marketingStrategy.findMany({
      where: { status: "ACTIVE" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tasks: true,
      },
    });

    let sentCount = 0;

    for (const strategy of activeStrategies) {
      const prefs = await getNotificationPreferences(strategy.user.id);
      if (!prefs.email.strategy) continue;

      const completedThisWeek = strategy.tasks.filter(
        (t) => t.status === "DONE" && t.completedAt && t.completedAt >= weekAgo
      ).length;

      const upcomingCount = strategy.tasks.filter(
        (t) =>
          t.status !== "DONE" &&
          t.dueDate &&
          t.dueDate >= now &&
          t.dueDate <= weekFromNow
      ).length;

      const overdueCount = strategy.tasks.filter(
        (t) => t.status !== "DONE" && t.dueDate && t.dueDate < now
      ).length;

      const progressPercent =
        strategy.totalTasks > 0
          ? Math.round((strategy.completedTasks / strategy.totalTasks) * 100)
          : 0;

      try {
        await sendStrategyWeeklyDigestEmail({
          to: strategy.user.email,
          name: strategy.user.name || "there",
          strategyName: strategy.name,
          completedThisWeek,
          totalCompleted: strategy.completedTasks,
          totalTasks: strategy.totalTasks,
          progressPercent,
          upcomingCount,
          overdueCount,
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send digest for strategy ${strategy.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: { sentCount, totalStrategies: activeStrategies.length },
    });
  } catch (error) {
    console.error("Strategy weekly digest error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to process weekly digest" } },
      { status: 500 }
    );
  }
}
