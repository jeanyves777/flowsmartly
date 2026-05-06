import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);
const CALENDAR_NOTES_STRATEGY = "Calendar Notes";

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
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const category = typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : "Calendar note";
    const priority = VALID_PRIORITIES.has(body.priority) ? body.priority : "MEDIUM";
    const startDate = (body.startDate || body.dueDate) ? new Date(body.startDate || body.dueDate) : null;
    const dueDate = (body.dueDate || body.startDate) ? new Date(body.dueDate || body.startDate) : null;

    if (!title) {
      return NextResponse.json(
        { success: false, error: { message: "title is required" } },
        { status: 400 }
      );
    }

    if (!startDate || Number.isNaN(startDate.getTime()) || !dueDate || Number.isNaN(dueDate.getTime())) {
      return NextResponse.json(
        { success: false, error: { message: "startDate and dueDate must be valid dates" } },
        { status: 400 }
      );
    }

    if (dueDate <= startDate) {
      return NextResponse.json(
        { success: false, error: { message: "dueDate must be after startDate" } },
        { status: 400 }
      );
    }

    const note = await prisma.$transaction(async (tx) => {
      let strategy = await tx.marketingStrategy.findFirst({
        where: {
          userId: session.userId,
          name: CALENDAR_NOTES_STRATEGY,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (!strategy) {
        strategy = await tx.marketingStrategy.create({
          data: {
            userId: session.userId,
            name: CALENDAR_NOTES_STRATEGY,
            description: "Calendar notes, team prompts, and lightweight campaign planning.",
            status: "ACTIVE",
            aiGenerated: false,
          },
          select: { id: true },
        });
      }

      const sortOrder = await tx.strategyTask.count({
        where: { strategyId: strategy.id },
      });

      const created = await tx.strategyTask.create({
        data: {
          strategyId: strategy.id,
          title,
          description: description || null,
          status: "TODO",
          priority,
          category,
          startDate,
          dueDate,
          calendarOverrides: "{}",
          sortOrder,
          aiSuggested: false,
          progress: 0,
        },
        include: {
          strategy: {
            select: { id: true, name: true },
          },
        },
      });

      await tx.marketingStrategy.update({
        where: { id: strategy.id },
        data: { totalTasks: { increment: 1 } },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      data: {
        note: {
          id: note.id,
          title: note.title,
          description: note.description,
          status: note.status,
          priority: note.priority,
          category: note.category,
          startDate: note.startDate?.toISOString() || null,
          dueDate: note.dueDate?.toISOString() || null,
          calendarOverrides: {},
          strategyId: note.strategy.id,
          strategyName: note.strategy.name,
        },
      },
    });
  } catch (error) {
    console.error("Create schedule note error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create schedule note" } },
      { status: 500 }
    );
  }
}
