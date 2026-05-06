import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { syncActivitiesForStrategy } from "@/lib/strategy/activity-matcher";

// POST /api/content/strategy/sync - Sync posts, campaigns, and automations into strategy progress
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const strategies = await prisma.marketingStrategy.findMany({
      where: { userId: session.userId, status: "ACTIVE" },
      select: { id: true, name: true },
    });

    let tasksUpdated = 0;
    let tasksAutoCompleted = 0;
    const results: Array<{
      strategyId: string;
      strategyName: string;
      tasksUpdated: number;
      tasksAutoCompleted: number;
    }> = [];

    for (const strategy of strategies) {
      const result = await syncActivitiesForStrategy(strategy.id, session.userId);
      tasksUpdated += result.tasksUpdated;
      tasksAutoCompleted += result.tasksAutoCompleted;
      results.push({
        strategyId: strategy.id,
        strategyName: strategy.name,
        tasksUpdated: result.tasksUpdated,
        tasksAutoCompleted: result.tasksAutoCompleted,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        strategyCount: strategies.length,
        tasksUpdated,
        tasksAutoCompleted,
        results,
      },
    });
  } catch (error) {
    console.error("Strategy workspace sync error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to sync strategy activity" } },
      { status: 500 }
    );
  }
}
