import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/content/strategy/plans - List all strategies for the user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const strategies = await prisma.marketingStrategy.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        aiGenerated: true,
        totalTasks: true,
        completedTasks: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        strategies: strategies.map((strategy) => ({
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          status: strategy.status,
          aiGenerated: strategy.aiGenerated,
          totalTasks: strategy.totalTasks,
          completedTasks: strategy.completedTasks,
          createdAt: strategy.createdAt.toISOString(),
          updatedAt: strategy.updatedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("List strategies error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch strategies" } },
      { status: 500 }
    );
  }
}
