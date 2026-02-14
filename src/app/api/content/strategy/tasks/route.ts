import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkAndAwardMilestones } from "@/lib/strategy/scoring";

// POST /api/content/strategy/tasks - Add a task to a strategy
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
      title,
      description,
      priority,
      category,
      startDate,
      dueDate,
    } = body;

    if (!strategyId) {
      return NextResponse.json(
        { success: false, error: { message: "strategyId is required" } },
        { status: 400 }
      );
    }

    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Task title is required" } },
        { status: 400 }
      );
    }

    // Validate strategy ownership
    const strategy = await prisma.marketingStrategy.findUnique({
      where: { id: strategyId },
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
          error: { message: "Not authorized to add tasks to this strategy" },
        },
        { status: 403 }
      );
    }

    // Auto-calculate sortOrder (append to end)
    const maxSortOrder = await prisma.strategyTask.aggregate({
      where: { strategyId },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

    // Validate priority if provided
    const validPriorities = ["LOW", "MEDIUM", "HIGH"];
    const taskPriority =
      priority && validPriorities.includes(priority) ? priority : "MEDIUM";

    const task = await prisma.strategyTask.create({
      data: {
        strategyId,
        title: title.trim(),
        description: description || null,
        priority: taskPriority,
        category: category || null,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: nextSortOrder,
      },
    });

    // Update strategy's totalTasks count
    await prisma.marketingStrategy.update({
      where: { id: strategyId },
      data: { totalTasks: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: {
        task: {
          id: task.id,
          strategyId: task.strategyId,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          category: task.category,
          startDate: task.startDate?.toISOString() || null,
          dueDate: task.dueDate?.toISOString() || null,
          completedAt: null,
          sortOrder: task.sortOrder,
          autoCompleted: false,
          progress: 0,
          matchedActivities: "[]",
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Create strategy task error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create task" } },
      { status: 500 }
    );
  }
}

// PATCH /api/content/strategy/tasks - Update a task
export async function PATCH(request: NextRequest) {
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
      id,
      status,
      title,
      description,
      priority,
      category,
      startDate,
      dueDate,
      sortOrder,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Task id is required" } },
        { status: 400 }
      );
    }

    // Find task and validate ownership via strategy
    const existingTask = await prisma.strategyTask.findUnique({
      where: { id },
      include: {
        strategy: {
          select: { userId: true, id: true },
        },
      },
    });

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: { message: "Task not found" } },
        { status: 404 }
      );
    }

    if (existingTask.strategy.userId !== session.userId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Not authorized to update this task" },
        },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description || null;
    if (priority !== undefined) {
      const validPriorities = ["LOW", "MEDIUM", "HIGH"];
      if (validPriorities.includes(priority)) {
        updateData.priority = priority;
      }
    }
    if (category !== undefined) updateData.category = category || null;
    if (startDate !== undefined)
      updateData.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined)
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    // Handle status change
    if (status !== undefined) {
      const validStatuses = ["TODO", "IN_PROGRESS", "DONE"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: `Status must be one of: ${validStatuses.join(", ")}`,
            },
          },
          { status: 400 }
        );
      }
      updateData.status = status;

      // If status changes to DONE, set completedAt
      if (status === "DONE" && existingTask.status !== "DONE") {
        updateData.completedAt = new Date();
      }
      // If status changes from DONE to something else, clear completedAt
      if (status !== "DONE" && existingTask.status === "DONE") {
        updateData.completedAt = null;
      }
    }

    const updatedTask = await prisma.strategyTask.update({
      where: { id },
      data: updateData,
    });

    // Recalculate strategy's completedTasks count
    const completedCount = await prisma.strategyTask.count({
      where: {
        strategyId: existingTask.strategyId,
        status: "DONE",
      },
    });

    await prisma.marketingStrategy.update({
      where: { id: existingTask.strategyId },
      data: { completedTasks: completedCount },
    });

    // Fire-and-forget: check milestones when a task is marked DONE
    if (status === "DONE" && existingTask.status !== "DONE") {
      checkAndAwardMilestones(existingTask.strategyId, session.userId).catch(
        (err) => console.error("Milestone check failed:", err)
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        task: {
          id: updatedTask.id,
          strategyId: updatedTask.strategyId,
          title: updatedTask.title,
          description: updatedTask.description,
          status: updatedTask.status,
          priority: updatedTask.priority,
          category: updatedTask.category,
          startDate: updatedTask.startDate?.toISOString() || null,
          dueDate: updatedTask.dueDate?.toISOString() || null,
          completedAt: updatedTask.completedAt?.toISOString() || null,
          sortOrder: updatedTask.sortOrder,
          autoCompleted: updatedTask.autoCompleted,
          progress: updatedTask.progress,
          matchedActivities: updatedTask.matchedActivities,
          createdAt: updatedTask.createdAt.toISOString(),
          updatedAt: updatedTask.updatedAt.toISOString(),
        },
        completedTasks: completedCount,
      },
    });
  } catch (error) {
    console.error("Update strategy task error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update task" } },
      { status: 500 }
    );
  }
}

// DELETE /api/content/strategy/tasks - Delete a task
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

    // Find task and validate ownership via strategy
    const task = await prisma.strategyTask.findUnique({
      where: { id },
      include: {
        strategy: {
          select: { userId: true, id: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: { message: "Task not found" } },
        { status: 404 }
      );
    }

    if (task.strategy.userId !== session.userId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Not authorized to delete this task" },
        },
        { status: 403 }
      );
    }

    const strategyId = task.strategyId;

    await prisma.strategyTask.delete({ where: { id } });

    // Recalculate strategy's totalTasks and completedTasks count
    const [totalCount, completedCount] = await Promise.all([
      prisma.strategyTask.count({ where: { strategyId } }),
      prisma.strategyTask.count({ where: { strategyId, status: "DONE" } }),
    ]);

    await prisma.marketingStrategy.update({
      where: { id: strategyId },
      data: {
        totalTasks: totalCount,
        completedTasks: completedCount,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        deleted: true,
        id,
        totalTasks: totalCount,
        completedTasks: completedCount,
      },
    });
  } catch (error) {
    console.error("Delete strategy task error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete task" } },
      { status: 500 }
    );
  }
}
