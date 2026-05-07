import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { normalizeTaskCategory } from "@/lib/strategy/categories";
import { checkAndAwardMilestones } from "@/lib/strategy/scoring";

const VALID_STATUSES = new Set(["TODO", "IN_PROGRESS", "DONE"]);

interface ReorderItem {
  id: string;
  status: string;
  sortOrder: number;
}

function serializeTask(task: {
  id: string;
  strategyId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  sortOrder: number;
  autoCompleted: boolean;
  progress: number;
  matchedActivities: string;
  automationStatus: string;
  automationId: string | null;
  aiSuggested: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: task.id,
    strategyId: task.strategyId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    category: task.category ? normalizeTaskCategory(task.category) : null,
    startDate: task.startDate?.toISOString() || null,
    dueDate: task.dueDate?.toISOString() || null,
    completedAt: task.completedAt?.toISOString() || null,
    sortOrder: task.sortOrder,
    autoCompleted: task.autoCompleted,
    progress: task.progress,
    matchedActivities: task.matchedActivities,
    automationStatus: task.automationStatus,
    automationId: task.automationId,
    aiSuggested: task.aiSuggested,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

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
    const strategyId = typeof body.strategyId === "string" ? body.strategyId : "";
    const items = Array.isArray(body.items) ? body.items : [];

    if (!strategyId || items.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "strategyId and items are required" } },
        { status: 400 }
      );
    }

    const normalizedItems: ReorderItem[] = items.map((item: { id?: unknown; status?: unknown; sortOrder?: unknown }) => ({
      id: typeof item.id === "string" ? item.id : "",
      status: typeof item.status === "string" ? item.status : "",
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
    }));

    if (
      normalizedItems.some((item) => !item.id || !VALID_STATUSES.has(item.status)) ||
      new Set(normalizedItems.map((item) => item.id)).size !== normalizedItems.length
    ) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid task reorder payload" } },
        { status: 400 }
      );
    }

    const strategy = await prisma.marketingStrategy.findUnique({
      where: { id: strategyId },
      select: { id: true, userId: true },
    });

    if (!strategy || strategy.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Strategy not found" } },
        { status: 404 }
      );
    }

    const existingTasks = await prisma.strategyTask.findMany({
      where: { strategyId },
    });
    const existingMap = new Map(existingTasks.map((task) => [task.id, task]));

    if (
      normalizedItems.length !== existingTasks.length ||
      normalizedItems.some((item) => !existingMap.has(item.id))
    ) {
      return NextResponse.json(
        { success: false, error: { message: "Reorder payload does not match this strategy" } },
        { status: 400 }
      );
    }

    const newlyDone = normalizedItems.filter((item) => {
      const existing = existingMap.get(item.id);
      return existing && existing.status !== "DONE" && item.status === "DONE";
    }).length;

    const result = await prisma.$transaction(async (tx) => {
      await Promise.all(
        normalizedItems.map((item) => {
          const existing = existingMap.get(item.id);
          return tx.strategyTask.update({
            where: { id: item.id },
            data: {
              status: item.status,
              sortOrder: item.sortOrder,
              completedAt:
                item.status === "DONE"
                  ? existing?.completedAt || new Date()
                  : existing?.status === "DONE"
                  ? null
                  : existing?.completedAt,
            },
          });
        })
      );

      const [tasks, totalTasks, completedTasks] = await Promise.all([
        tx.strategyTask.findMany({
          where: { strategyId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
        tx.strategyTask.count({ where: { strategyId } }),
        tx.strategyTask.count({ where: { strategyId, status: "DONE" } }),
      ]);

      await tx.marketingStrategy.update({
        where: { id: strategyId },
        data: { totalTasks, completedTasks },
      });

      return { tasks, totalTasks, completedTasks };
    });

    if (newlyDone > 0) {
      checkAndAwardMilestones(strategyId, session.userId).catch((err) =>
        console.error("Milestone check failed:", err)
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tasks: result.tasks.map(serializeTask),
        totalTasks: result.totalTasks,
        completedTasks: result.completedTasks,
      },
    });
  } catch (error) {
    console.error("Reorder strategy tasks error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to reorder tasks" } },
      { status: 500 }
    );
  }
}
