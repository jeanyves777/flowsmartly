import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const VALID_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"];

// GET /api/content/strategy/[id] - Fetch a single strategy by ID with all tasks
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const strategy = await prisma.marketingStrategy.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { sortOrder: "asc" },
        },
      },
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
          error: { message: "Not authorized to view this strategy" },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        strategy: {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          status: strategy.status,
          aiGenerated: strategy.aiGenerated,
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
    console.error("Get strategy by ID error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch strategy" } },
      { status: 500 }
    );
  }
}

// PATCH /api/content/strategy/[id] - Update strategy status, name, or description
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, name, description } = body;

    // Validate ownership
    const existing = await prisma.marketingStrategy.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Strategy not found" } },
        { status: 404 }
      );
    }

    if (existing.userId !== session.userId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Not authorized to update this strategy" },
        },
        { status: 403 }
      );
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    // If activating, archive all other active strategies for this user
    if (status === "ACTIVE") {
      await prisma.marketingStrategy.updateMany({
        where: { userId: session.userId, status: "ACTIVE", NOT: { id } },
        data: { status: "ARCHIVED" },
      });
    }

    // Build update data from provided fields
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;

    const strategy = await prisma.marketingStrategy.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        strategy: {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          status: strategy.status,
          aiGenerated: strategy.aiGenerated,
          totalTasks: strategy.totalTasks,
          completedTasks: strategy.completedTasks,
          createdAt: strategy.createdAt.toISOString(),
          updatedAt: strategy.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Update strategy error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update strategy" } },
      { status: 500 }
    );
  }
}

// DELETE /api/content/strategy/[id] - Delete a strategy
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

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
