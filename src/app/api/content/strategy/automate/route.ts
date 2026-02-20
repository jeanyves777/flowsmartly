import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { isAutomatableCategory } from "@/lib/strategy/credit-estimator";

interface TaskConfig {
  taskId: string;
  enabled: boolean;
  includeMedia: boolean;
  mediaType: "image" | "video";
  mediaStyle: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek: number;
  time: string;
  customPrompt: string;
}

// POST /api/content/strategy/automate - Create automations from strategy tasks
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
      taskConfigs,
      globalTone = "professional",
      globalEndDate,
      platforms = ["feed"],
    } = body as {
      strategyId: string;
      taskConfigs: TaskConfig[];
      globalTone: string;
      globalEndDate: string;
      platforms: string[];
    };

    if (!strategyId || !taskConfigs?.length) {
      return NextResponse.json(
        { success: false, error: { message: "Strategy ID and task configs are required" } },
        { status: 400 }
      );
    }

    // Load strategy with tasks
    const strategy = await prisma.marketingStrategy.findUnique({
      where: { id: strategyId },
      include: { tasks: true },
    });

    if (!strategy || strategy.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Strategy not found" } },
        { status: 404 }
      );
    }

    if (strategy.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: { message: "Strategy must be ACTIVE to automate" } },
        { status: 400 }
      );
    }

    // Load brand kit for AI prompt context
    let brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });
    if (!brandKit) {
      brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
      });
    }

    const brandContext = brandKit
      ? [
          `Write as ${brandKit.name}${brandKit.tagline ? ` — "${brandKit.tagline}"` : ""}.`,
          brandKit.uniqueValue ? `Key value proposition: ${brandKit.uniqueValue}` : null,
          (() => { try { const kw = JSON.parse(brandKit.keywords); return kw.length > 0 ? `Focus on: ${kw.join(", ")}` : null; } catch { return null; } })(),
          (() => { try { const pr = JSON.parse(brandKit.products); return pr.length > 0 ? `Products/services: ${pr.join(", ")}` : null; } catch { return null; } })(),
          (() => { try { const ht = JSON.parse(brandKit.hashtags); return ht.length > 0 ? `Use hashtags: ${ht.join(" ")}` : null; } catch { return null; } })(),
          (() => { try { const pe = JSON.parse(brandKit.personality); return pe.length > 0 ? `Personality: ${pe.join(", ")}` : null; } catch { return null; } })(),
        ].filter(Boolean).join("\n")
      : "";

    // Build task map for quick lookup
    const taskMap = new Map(strategy.tasks.map((t) => [t.id, t]));

    // Create automations for each enabled task
    const createdAutomations: string[] = [];
    const taskUpdates: Array<{ taskId: string; automationId: string; status: string }> = [];

    for (const config of taskConfigs) {
      const task = taskMap.get(config.taskId);
      if (!task) continue;

      const category = task.category || "content";

      if (!config.enabled || !isAutomatableCategory(category)) {
        continue;
      }

      // Build AI prompt from task description + brand context
      const taskPrompt = config.customPrompt ||
        `Write an engaging social media post about: ${task.title}. ${task.description || ""} ${brandContext}`;

      const schedule = JSON.stringify({
        frequency: config.frequency,
        dayOfWeek: config.dayOfWeek,
        time: config.time,
      });

      const automation = await prisma.postAutomation.create({
        data: {
          userId: session.userId,
          name: `Strategy: ${task.title}`,
          type: "AI_GENERATED",
          enabled: true,
          schedule,
          topic: task.title,
          aiPrompt: taskPrompt,
          aiTone: globalTone,
          includeMedia: config.includeMedia,
          mediaType: config.includeMedia ? config.mediaType : null,
          mediaStyle: config.includeMedia ? config.mediaStyle : null,
          platforms: JSON.stringify(platforms),
          startDate: task.startDate || new Date(),
          endDate: globalEndDate ? new Date(globalEndDate) : null,
          strategyTaskId: task.id,
          sourceStrategyId: strategyId,
        },
      });

      createdAutomations.push(automation.id);
      taskUpdates.push({
        taskId: task.id,
        automationId: automation.id,
        status: "AUTOMATED",
      });
    }

    // Update all strategy tasks with automation status
    const allTaskUpdates = strategy.tasks.map((task) => {
      const update = taskUpdates.find((u) => u.taskId === task.id);
      if (update) {
        return prisma.strategyTask.update({
          where: { id: task.id },
          data: {
            automationStatus: "AUTOMATED",
            automationId: update.automationId,
          },
        });
      }

      // Non-automated tasks: label as AUTOMATABLE or MANUAL_ONLY
      const category = task.category || "content";
      const status = isAutomatableCategory(category) ? "AUTOMATABLE" : "MANUAL_ONLY";
      return prisma.strategyTask.update({
        where: { id: task.id },
        data: { automationStatus: status },
      });
    });

    await prisma.$transaction(allTaskUpdates);

    // Create notification
    await prisma.notification.create({
      data: {
        userId: session.userId,
        type: "STRATEGY_AUTOMATION_STARTED",
        title: "Strategy Automation Launched",
        message: `${createdAutomations.length} automation${createdAutomations.length > 1 ? "s" : ""} created from "${strategy.name}"`,
        data: JSON.stringify({
          strategyId,
          strategyName: strategy.name,
          automationCount: createdAutomations.length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        automationIds: createdAutomations,
        automatedTaskCount: createdAutomations.length,
        totalTasks: strategy.tasks.length,
        strategyName: strategy.name,
      },
    });
  } catch (error) {
    console.error("Strategy automate error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create strategy automations" } },
      { status: 500 }
    );
  }
}
