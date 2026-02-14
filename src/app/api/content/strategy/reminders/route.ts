import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { sendStrategyReminderEmail } from "@/lib/email";
import { getNotificationPreferences } from "@/lib/notifications";

// POST /api/content/strategy/reminders
// Called by external cron service daily. Protected by CRON_SECRET.
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Find all ACTIVE strategies with tasks due within 3 days
    const activeStrategies = await prisma.marketingStrategy.findMany({
      where: { status: "ACTIVE" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tasks: {
          where: {
            status: { not: "DONE" },
            dueDate: { gte: now, lte: threeDaysFromNow },
          },
          orderBy: { dueDate: "asc" },
        },
      },
    });

    let sentCount = 0;
    let skippedCount = 0;

    for (const strategy of activeStrategies) {
      if (strategy.tasks.length === 0) continue;

      // Check user notification preference
      const prefs = await getNotificationPreferences(strategy.user.id);
      if (!prefs.email.strategy) {
        skippedCount++;
        continue;
      }

      try {
        await sendStrategyReminderEmail({
          to: strategy.user.email,
          name: strategy.user.name || "there",
          strategyName: strategy.name,
          upcomingTasks: strategy.tasks.map((t) => ({
            title: t.title,
            category: t.category || "general",
            priority: t.priority,
            dueDate: t.dueDate!.toISOString(),
            daysUntilDue: Math.max(
              0,
              Math.ceil((t.dueDate!.getTime() - now.getTime()) / 86400000)
            ),
          })),
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send reminder for strategy ${strategy.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: { sentCount, skippedCount, totalStrategies: activeStrategies.length },
    });
  } catch (error) {
    console.error("Strategy reminders error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to process reminders" } },
      { status: 500 }
    );
  }
}
