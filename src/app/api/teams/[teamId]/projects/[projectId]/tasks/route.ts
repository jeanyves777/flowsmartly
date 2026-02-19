import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { canCreateTasks, canUpdateTask, canDeleteTask } from "@/lib/teams/permissions";
import { notifyTaskAssigned, notifyTaskStatusChanged } from "@/lib/notifications";

// GET /api/teams/[teamId]/projects/[projectId]/tasks - List tasks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId, projectId } = await params;

    // Verify team membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Not a team member" } },
        { status: 403 }
      );
    }

    // Verify project belongs to team
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    // Optional filters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const assigneeId = searchParams.get("assigneeId");
    const priority = searchParams.get("priority");

    const where: Record<string, unknown> = { projectId };
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (priority) where.priority = priority;

    const tasks = await prisma.projectTask.findMany({
      where,
      include: {
        _count: {
          select: { comments: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    // Fetch assignee user data
    const assigneeIds = [
      ...new Set(
        tasks
          .map((t) => t.assigneeId)
          .filter((id): id is string => id !== null)
      ),
    ];

    const assigneeUsers =
      assigneeIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, name: true, avatarUrl: true },
          })
        : [];

    const assigneeMap = new Map(assigneeUsers.map((u) => [u.id, u]));

    return NextResponse.json({
      success: true,
      data: tasks.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assigneeId,
        assignee: t.assigneeId ? assigneeMap.get(t.assigneeId) ?? null : null,
        createdById: t.createdById,
        startDate: t.startDate?.toISOString() ?? null,
        dueDate: t.dueDate?.toISOString() ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        sortOrder: t.sortOrder,
        progress: t.progress,
        attachments: t.attachments,
        commentCount: t._count.comments,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List tasks error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to list tasks" } },
      { status: 500 }
    );
  }
}

// POST /api/teams/[teamId]/projects/[projectId]/tasks - Create task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId, projectId } = await params;

    // Verify team membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Not a team member" } },
        { status: 403 }
      );
    }

    // Check permission
    if (!canCreateTasks(membership.role)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to create tasks" } },
        { status: 403 }
      );
    }

    // Verify project belongs to team
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, description, status, priority, assigneeId, startDate, dueDate, sortOrder } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Task title is required" } },
        { status: 400 }
      );
    }

    const task = await prisma.projectTask.create({
      data: {
        projectId,
        title: title.trim(),
        description: description?.trim() || null,
        status: status || "TODO",
        priority: priority || "MEDIUM",
        assigneeId: assigneeId || null,
        createdById: session.userId,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: sortOrder ?? 0,
      },
    });

    // Increment project totalTasks
    await prisma.project.update({
      where: { id: projectId },
      data: { totalTasks: { increment: 1 } },
    });

    // Notify assignee if different from creator (fire-and-forget)
    if (assigneeId && assigneeId !== session.userId) {
      notifyTaskAssigned({
        userId: assigneeId,
        taskTitle: task.title,
        projectName: project.name,
        assignedBy: session.userId,
        taskId: task.id,
        projectId: project.id,
        teamId,
      }).catch((err: unknown) => {
        console.error("Failed to send task assignment notification:", err);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        createdById: task.createdById,
        startDate: task.startDate?.toISOString() ?? null,
        dueDate: task.dueDate?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        sortOrder: task.sortOrder,
        progress: task.progress,
        attachments: task.attachments,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create task" } },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[teamId]/projects/[projectId]/tasks - Update task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId, projectId } = await params;

    // Verify team membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Not a team member" } },
        { status: 403 }
      );
    }

    // Verify project belongs to team
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      id,
      title,
      description,
      status,
      priority,
      assigneeId,
      startDate,
      dueDate,
      sortOrder,
      progress,
      attachments,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Task id is required" } },
        { status: 400 }
      );
    }

    // Find the existing task
    const task = await prisma.projectTask.findUnique({
      where: { id },
    });
    if (!task || task.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: { message: "Task not found" } },
        { status: 404 }
      );
    }

    // Check permission
    if (!canUpdateTask(membership.role, task.assigneeId, session.userId)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to update this task" } },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId || null;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (progress !== undefined) updateData.progress = progress;
    if (attachments !== undefined) updateData.attachments = attachments;

    // Handle status transitions for completedTasks count
    const statusChanged = status !== undefined && status !== task.status;
    const nowDone = statusChanged && status === "DONE" && task.status !== "DONE";
    const wasDone = statusChanged && task.status === "DONE" && status !== "DONE";

    if (nowDone) {
      updateData.completedAt = new Date();
    } else if (wasDone) {
      updateData.completedAt = null;
    }

    const updatedTask = await prisma.projectTask.update({
      where: { id },
      data: updateData,
    });

    // Update project completedTasks count
    if (nowDone) {
      await prisma.project.update({
        where: { id: projectId },
        data: { completedTasks: { increment: 1 } },
      });
    } else if (wasDone) {
      await prisma.project.update({
        where: { id: projectId },
        data: { completedTasks: { decrement: 1 } },
      });
    }

    // Notify new assignee if assigneeId changed (fire-and-forget)
    if (
      assigneeId !== undefined &&
      assigneeId !== task.assigneeId &&
      assigneeId &&
      assigneeId !== session.userId
    ) {
      notifyTaskAssigned({
        userId: assigneeId,
        taskTitle: updatedTask.title,
        projectName: project.name,
        assignedBy: session.userId,
        taskId: updatedTask.id,
        projectId: project.id,
        teamId,
      }).catch((err: unknown) => {
        console.error("Failed to send task assignment notification:", err);
      });
    }

    // Notify previous assignee of status change (fire-and-forget)
    if (
      statusChanged &&
      task.assigneeId &&
      task.assigneeId !== session.userId
    ) {
      notifyTaskStatusChanged({
        userId: task.assigneeId,
        taskTitle: updatedTask.title,
        projectName: project.name,
        oldStatus: task.status,
        newStatus: status,
        changedBy: session.userId,
        taskId: updatedTask.id,
        projectId: project.id,
        teamId,
      }).catch((err: unknown) => {
        console.error("Failed to send task status notification:", err);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedTask.id,
        projectId: updatedTask.projectId,
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        priority: updatedTask.priority,
        assigneeId: updatedTask.assigneeId,
        createdById: updatedTask.createdById,
        startDate: updatedTask.startDate?.toISOString() ?? null,
        dueDate: updatedTask.dueDate?.toISOString() ?? null,
        completedAt: updatedTask.completedAt?.toISOString() ?? null,
        sortOrder: updatedTask.sortOrder,
        progress: updatedTask.progress,
        attachments: updatedTask.attachments,
        createdAt: updatedTask.createdAt.toISOString(),
        updatedAt: updatedTask.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update task" } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/projects/[projectId]/tasks - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId, projectId } = await params;

    // Verify team membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Not a team member" } },
        { status: 403 }
      );
    }

    // Check permission
    if (!canDeleteTask(membership.role)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to delete tasks" } },
        { status: 403 }
      );
    }

    // Verify project belongs to team
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Task id is required" } },
        { status: 400 }
      );
    }

    // Find the task
    const task = await prisma.projectTask.findUnique({
      where: { id },
    });
    if (!task || task.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: { message: "Task not found" } },
        { status: 404 }
      );
    }

    // Delete the task
    await prisma.projectTask.delete({
      where: { id },
    });

    // Update project counts
    const updateData: Record<string, unknown> = {
      totalTasks: { decrement: 1 },
    };
    if (task.status === "DONE") {
      updateData.completedTasks = { decrement: 1 };
    }

    await prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete task" } },
      { status: 500 }
    );
  }
}
