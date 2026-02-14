import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/content/strategy - Fetch user's active marketing strategy with all tasks
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Try to find the ACTIVE strategy first
    let strategy = await prisma.marketingStrategy.findFirst({
      where: { userId: session.userId, status: "ACTIVE" },
      include: {
        tasks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Fallback: if no ACTIVE strategy, get latest and auto-set it to ACTIVE
    if (!strategy) {
      strategy = await prisma.marketingStrategy.findFirst({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        include: {
          tasks: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (strategy) {
        await prisma.marketingStrategy.update({
          where: { id: strategy.id },
          data: { status: "ACTIVE" },
        });
        (strategy as typeof strategy & { status: string }).status = "ACTIVE";
      }
    }

    if (!strategy) {
      return NextResponse.json({
        success: true,
        data: { strategy: null },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        strategy: {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          aiGenerated: strategy.aiGenerated,
          status: strategy.status,
          totalTasks: strategy.totalTasks,
          completedTasks: strategy.completedTasks,
          tasks: strategy.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            category: task.category,
            startDate: task.startDate?.toISOString() || null,
            dueDate: task.dueDate?.toISOString() || null,
            completedAt: task.completedAt?.toISOString() || null,
            sortOrder: task.sortOrder,
            aiSuggested: task.aiSuggested,
            autoCompleted: task.autoCompleted,
            progress: task.progress,
            matchedActivities: task.matchedActivities,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
          })),
          createdAt: strategy.createdAt.toISOString(),
          updatedAt: strategy.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Get strategy error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch strategy" } },
      { status: 500 }
    );
  }
}

// POST /api/content/strategy - Create a new strategy
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
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Strategy name is required" } },
        { status: 400 }
      );
    }

    const strategy = await prisma.marketingStrategy.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        description: description || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        strategy: {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          aiGenerated: strategy.aiGenerated,
          totalTasks: strategy.totalTasks,
          completedTasks: strategy.completedTasks,
          tasks: [],
          createdAt: strategy.createdAt.toISOString(),
          updatedAt: strategy.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Create strategy error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create strategy" } },
      { status: 500 }
    );
  }
}

// DELETE /api/content/strategy - Delete a strategy (cascades to tasks via Prisma)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "id search parameter is required" },
        },
        { status: 400 }
      );
    }

    // Validate ownership
    const strategy = await prisma.marketingStrategy.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!strategy) {
      return NextResponse.json(
        { success: false, error: { message: "Strategy not found" } },
        { status: 404 }
      );
    }

    if (strategy.userId !== session.userId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Not authorized to delete this strategy" },
        },
        { status: 403 }
      );
    }

    // Delete strategy (tasks cascade automatically via Prisma onDelete: Cascade)
    await prisma.marketingStrategy.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { deleted: true, id },
    });
  } catch (error) {
    console.error("Delete strategy error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete strategy" } },
      { status: 500 }
    );
  }
}
