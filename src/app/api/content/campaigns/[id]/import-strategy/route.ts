import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { mapStrategyTaskToContentAutomation } from "@/lib/content/strategy-to-campaign";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id: campaignId } = await params;

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const strategyId = typeof body.strategyId === "string" ? body.strategyId : "";
  const taskIds = Array.isArray(body.taskIds)
    ? (body.taskIds as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  if (!strategyId || taskIds.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: "strategyId and taskIds are required" } },
      { status: 400 },
    );
  }

  const campaign = await prisma.contentCampaign.findFirst({
    where: { id: campaignId, userId: session.userId },
    select: {
      id: true,
      defaultTone: true,
      defaultPlatforms: true,
      endDate: true,
    },
  });
  if (!campaign) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign not found" } },
      { status: 404 },
    );
  }

  // Load tasks from the strategy and verify ownership of the strategy
  const tasks = await prisma.strategyTask.findMany({
    where: {
      id: { in: taskIds },
      strategy: { id: strategyId, userId: session.userId },
    },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      startDate: true,
      dueDate: true,
    },
  });
  if (tasks.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: "No matching tasks found" } },
      { status: 404 },
    );
  }

  let defaultPlatforms: string[] = [];
  try {
    defaultPlatforms = JSON.parse(campaign.defaultPlatforms || "[]");
  } catch {
    defaultPlatforms = [];
  }

  const created: string[] = [];
  const skipped: { taskId: string; reason: string }[] = [];

  for (const task of tasks) {
    const payload = mapStrategyTaskToContentAutomation({
      task,
      userId: session.userId,
      campaignId: campaign.id,
      defaultTone: campaign.defaultTone ?? undefined,
      defaultPlatforms,
      globalEndDate: campaign.endDate,
    });
    if (!payload) {
      skipped.push({ taskId: task.id, reason: "not_qualified_for_social" });
      continue;
    }
    const automation = await prisma.contentAutomation.create({ data: payload });
    created.push(automation.id);
    await prisma.contentCampaignStrategyTask
      .upsert({
        where: {
          campaignId_strategyTaskId: {
            campaignId: campaign.id,
            strategyTaskId: task.id,
          },
        },
        create: { campaignId: campaign.id, strategyTaskId: task.id },
        update: {},
      })
      .catch(() => undefined);
  }

  // Stamp the campaign with its source strategy if not already set
  await prisma.contentCampaign.updateMany({
    where: { id: campaign.id, sourceStrategyId: null },
    data: { sourceStrategyId: strategyId },
  });

  return NextResponse.json({
    success: true,
    data: { created, skipped },
  });
}
