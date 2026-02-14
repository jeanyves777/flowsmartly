import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { syncActivitiesForStrategy } from "@/lib/strategy/activity-matcher";

// POST /api/content/strategy/activity-sync — Cron: daily activity sync
export async function POST(request: NextRequest) {
  try {
    // Auth: CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Find all ACTIVE strategies
    const strategies = await prisma.marketingStrategy.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, userId: true },
    });

    let processedCount = 0;
    let tasksUpdated = 0;
    let tasksAutoCompleted = 0;
    const errors: string[] = [];

    for (const strategy of strategies) {
      try {
        const result = await syncActivitiesForStrategy(
          strategy.id,
          strategy.userId
        );
        tasksUpdated += result.tasksUpdated;
        tasksAutoCompleted += result.tasksAutoCompleted;
        processedCount++;
      } catch (err) {
        console.error(
          `Activity sync failed for strategy ${strategy.id}:`,
          err
        );
        errors.push(
          `${strategy.id}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processedCount,
        tasksUpdated,
        tasksAutoCompleted,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("Activity sync cron error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to run activity sync" } },
      { status: 500 }
    );
  }
}
