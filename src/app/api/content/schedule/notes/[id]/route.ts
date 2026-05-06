import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);
const VALID_STATUSES = new Set(["TODO", "IN_PROGRESS", "DONE"]);
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type CalendarOverrides = Record<string, { startTime?: string; endTime?: string }>;

function parseCalendarOverrides(value?: string | null): CalendarOverrides {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

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

    if (body.occurrenceDate !== undefined) {
      const occurrenceDate = typeof body.occurrenceDate === "string" ? body.occurrenceDate : "";
      const occurrenceStartTime = typeof body.occurrenceStartTime === "string" ? body.occurrenceStartTime : "";
      const occurrenceEndTime = typeof body.occurrenceEndTime === "string" ? body.occurrenceEndTime : "";

      if (!DATE_KEY_PATTERN.test(occurrenceDate)) {
        return NextResponse.json(
          { success: false, error: { message: "occurrenceDate must be YYYY-MM-DD" } },
          { status: 400 }
        );
      }

      if (!TIME_PATTERN.test(occurrenceStartTime) || !TIME_PATTERN.test(occurrenceEndTime)) {
        return NextResponse.json(
          { success: false, error: { message: "occurrence times must use HH:mm format" } },
          { status: 400 }
        );
      }

      if (timeToMinutes(occurrenceEndTime) <= timeToMinutes(occurrenceStartTime)) {
        return NextResponse.json(
          { success: false, error: { message: "occurrence end time must be after start time" } },
          { status: 400 }
        );
      }

      const calendarOverrides = parseCalendarOverrides(existing.calendarOverrides);
      calendarOverrides[occurrenceDate] = {
        startTime: occurrenceStartTime,
        endTime: occurrenceEndTime,
      };
      updateData.calendarOverrides = JSON.stringify(calendarOverrides);
    }

    let nextStartDate = existing.startDate;
    let nextDueDate = existing.dueDate;

    if (body.startDate !== undefined) {
      const startDate = body.startDate ? new Date(body.startDate) : null;
      if (body.startDate && (!startDate || Number.isNaN(startDate.getTime()))) {
        return NextResponse.json(
          { success: false, error: { message: "startDate must be a valid date" } },
          { status: 400 }
        );
      }
      updateData.startDate = startDate;
      nextStartDate = startDate;
    }

    if (body.dueDate !== undefined) {
      const dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.dueDate && (!dueDate || Number.isNaN(dueDate.getTime()))) {
        return NextResponse.json(
          { success: false, error: { message: "dueDate must be a valid date" } },
          { status: 400 }
        );
      }
      updateData.dueDate = dueDate;
      nextDueDate = dueDate;
    }

    const changedTimeline = body.startDate !== undefined || body.dueDate !== undefined;
    if (changedTimeline && nextStartDate && nextDueDate && nextDueDate <= nextStartDate) {
      return NextResponse.json(
        { success: false, error: { message: "dueDate must be after startDate" } },
        { status: 400 }
      );
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
          calendarOverrides: parseCalendarOverrides(updated.calendarOverrides),
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
