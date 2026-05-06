import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);
const VALID_STATUSES = new Set(["TODO", "IN_PROGRESS", "DONE"]);

async function getOwnedTask(taskId: string, userId: string) {
  const task = await prisma.strategyTask.findUnique({
    where: { id: taskId },
    include: {
      strategy: {
        select: { id: true, name: true, userId: true },
      },
    },
  });

  if (!task || task.strategy.userId !== userId) return null;
  return task;
}

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
    const existing = await getOwnedTask(id, session.userId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Note not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json(
          { success: false, error: { message: "title is required" } },
          { status: 400 }
        );
      }
      updateData.title = title;
    }

    if (body.description !== undefined) {
      updateData.description = typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
    }

    if (body.category !== undefined) {
      updateData.category = typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : "Calendar note";
    }

    if (body.priority !== undefined && VALID_PRIORITIES.has(body.priority)) {
      updateData.priority = body.priority;
    }

    if (body.status !== undefined && VALID_STATUSES.has(body.status)) {
      updateData.status = body.status;
      updateData.completedAt = body.status === "DONE" ? new Date() : null;
    }

    const dueDateInput = body.dueDate ?? body.startDate;
    if (dueDateInput !== undefined) {
      const dueDate = dueDateInput ? new Date(dueDateInput) : null;
      if (dueDateInput && (!dueDate || Number.isNaN(dueDate.getTime()))) {
        return NextResponse.json(
          { success: false, error: { message: "dueDate must be a valid date" } },
          { status: 400 }
        );
      }
      updateData.startDate = dueDate;
      updateData.dueDate = dueDate;
    }

    const updated = await prisma.strategyTask.update({
      where: { id },
      data: updateData,
      include: {
        strategy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        note: {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          status: updated.status,
          priority: updated.priority,
          category: updated.category,
          startDate: updated.startDate?.toISOString() || null,
          dueDate: updated.dueDate?.toISOString() || null,
          strategyId: updated.strategy.id,
          strategyName: updated.strategy.name,
        },
      },
    });
  } catch (error) {
    console.error("Update schedule note error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update schedule note" } },
      { status: 500 }
    );
  }
}

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
    const existing = await getOwnedTask(id, session.userId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Note not found" } },
        { status: 404 }
      );
    }

    await prisma.strategyTask.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete schedule note error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete schedule note" } },
      { status: 500 }
    );
  }
}
