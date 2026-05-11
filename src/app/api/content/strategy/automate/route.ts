import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { normalizeTaskCategory } from "@/lib/strategy/categories";
import {
  estimateAutomationCredits,
  isAutomatableCategory,
  isEmailCategory,
} from "@/lib/strategy/credit-estimator";
import { qualifyStrategyTaskForAutomation } from "@/lib/strategy/automation-readiness";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";
import { buildStrategyAutomationPrompt } from "@/lib/strategy/automation-execution";

interface TaskConfig {
  taskId: string;
  enabled: boolean;
  includeMedia: boolean;
  mediaType: "image" | "video";
  mediaStyle: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek: number;
  time: string;
  platforms?: string[];
  startDate?: string;
  endDate?: string;
  customPrompt: string;
}

function normalizePlatform(platform: string) {
  if (platform.startsWith("facebook_")) return "facebook";
  if (platform.startsWith("instagram_")) return "instagram";
  return platform;
}

function safePlatforms(platforms: unknown, fallback: string[]) {
  const raw = Array.isArray(platforms)
    ? platforms.filter((platform): platform is string => typeof platform === "string")
    : fallback;
  const normalized = raw.map(normalizePlatform).filter(Boolean);
  return [...new Set(normalized)];
}

function combineDateAndTime(dateValue: Date | string | null | undefined, timeValue: string) {
  const date = dateValue ? new Date(dateValue) : new Date();
  const [h, m] = (timeValue || "09:00").split(":");
  date.setHours(parseInt(h || "9", 10), parseInt(m || "0", 10), 0, 0);
  if (date <= new Date()) date.setDate(date.getDate() + 1);
  return date;
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
      platforms = [],
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

    const [user, socialAccounts, marketingConfig] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true },
      }),
      prisma.socialAccount.findMany({
        where: { userId: session.userId, isActive: true },
        select: { platform: true },
      }),
      prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: {
          emailProvider: true,
          emailEnabled: true,
          emailVerified: true,
          smsEnabled: true,
          smsVerified: true,
          smsPhoneNumber: true,
          smsComplianceStatus: true,
        },
      }),
    ]);
    const connectedPlatforms = [...new Set(socialAccounts.map((account) => normalizePlatform(account.platform)))];
    const emailReady = !!(
      marketingConfig &&
      marketingConfig.emailProvider !== "NONE" &&
      marketingConfig.emailEnabled &&
      marketingConfig.emailVerified
    );
    const smsReady = !!(
      marketingConfig?.smsEnabled &&
      marketingConfig.smsVerified &&
      marketingConfig.smsPhoneNumber &&
      marketingConfig.smsComplianceStatus === "APPROVED"
    );

    // Build task map for quick lookup
    const taskMap = new Map(strategy.tasks.map((t) => [t.id, t]));
    const enabledConfigs = taskConfigs.filter((config) => config.enabled);
    const readyTaskIds = new Set<string>();
    const blockedTasks: Array<{ taskId: string; title: string; blockers: string[] }> = [];

    for (const config of enabledConfigs) {
      const task = taskMap.get(config.taskId);
      if (!task) continue;

      const configPlatforms = safePlatforms(config.platforms, platforms);
      const missingConnections = configPlatforms.filter(
        (platform) => platform !== "feed" && !connectedPlatforms.includes(platform)
      );
      const readiness = qualifyStrategyTaskForAutomation(task, {
        includeMedia: config.includeMedia,
        mediaType: config.mediaType,
        selectedPlatforms: configPlatforms,
        connectedPlatforms,
        emailReady,
        smsReady,
        requireDestination: true,
      });

      if (readiness.qualified && missingConnections.length === 0) {
        readyTaskIds.add(task.id);
      } else {
        blockedTasks.push({
          taskId: task.id,
          title: task.title,
          blockers: [
            ...readiness.blockers,
            ...missingConnections.map((platform) => `Connect ${platform} before scheduling this item`),
          ],
        });
      }
    }

    if (readyTaskIds.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "No selected plan item is ready for automation",
            blockedTasks,
          },
        },
        { status: 400 }
      );
    }

    const mostExpensiveMediaType = enabledConfigs.some((config) => config.mediaType === "video")
      ? "video"
      : "image";
    const estimate = await estimateAutomationCredits(strategy.tasks, {
      frequency: enabledConfigs[0]?.frequency || "WEEKLY",
      includeMedia: enabledConfigs.some((config) => config.includeMedia),
      mediaType: mostExpensiveMediaType,
      endDate: globalEndDate || new Date(Date.now() + 90 * 86400000).toISOString(),
      userCredits: user?.aiCredits || 0,
      selectedTaskIds: [...readyTaskIds],
      selectedPlatforms: [
        ...new Set(
          enabledConfigs
            .filter((config) => readyTaskIds.has(config.taskId))
            .flatMap((config) => safePlatforms(config.platforms, platforms))
        ),
      ],
      connectedPlatforms,
      emailReady,
      smsReady,
      taskConfigs: enabledConfigs
        .filter((config) => readyTaskIds.has(config.taskId))
        .map((config) => ({
          taskId: config.taskId,
          frequency: config.frequency,
          includeMedia: config.includeMedia,
          mediaType: config.mediaType,
          startDate: config.startDate,
          endDate: config.endDate || globalEndDate,
          platforms: safePlatforms(config.platforms, platforms),
        })),
    });

    if (!estimate.hasEnoughCredits) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Not enough credits for the scheduled AI runs. Required: ${estimate.totalCredits}, Available: ${estimate.userCredits}`,
            estimate,
          },
        },
        { status: 402 }
      );
    }

    // Create automations for each enabled task
    const createdAutomations: string[] = [];
    const createdCampaigns: string[] = [];
    const taskUpdates: Array<{ taskId: string; automationId: string; status: string }> = [];

    for (const config of taskConfigs) {
      const task = taskMap.get(config.taskId);
      if (!task) continue;

      const category = normalizeTaskCategory(task.category);

      if (!config.enabled || !readyTaskIds.has(task.id) || !isAutomatableCategory(category)) {
        continue;
      }

      // EMAIL tasks → create Campaign (email blast) record
      if (isEmailCategory(category)) {
        const emailSubject = config.customPrompt
          ? config.customPrompt.substring(0, 150)
          : `${task.title} — ${brandKit?.name || "Update"}`;

        const emailContent = config.customPrompt ||
          `Email campaign about: ${task.title}. ${task.description || ""}\n\n${brandContext}`;

        // Calculate scheduled send time from frequency config
        const scheduledAt = combineDateAndTime(config.startDate || task.startDate, config.time);

        const campaign = await prisma.campaign.create({
          data: {
            userId: session.userId,
            name: `Strategy: ${task.title}`,
            type: "EMAIL",
            subject: emailSubject,
            content: emailContent,
            contentHtml: null,
            fromName: brandKit?.name || null,
            imageUrl: null,
            imageSource: config.includeMedia ? "ai" : null,
            status: "DRAFT",
            scheduledAt,
          },
        });

        createdCampaigns.push(campaign.id);
        taskUpdates.push({
          taskId: task.id,
          automationId: campaign.id,
          status: "AUTOMATED",
        });
        continue;
      }

      // SOCIAL/CONTENT tasks → create PostAutomation record
      const configPlatforms = safePlatforms(config.platforms, platforms);
      const taskPrompt = buildStrategyAutomationPrompt({
        taskTitle: task.title,
        taskDescription: task.description,
        category,
        platforms: configPlatforms,
        brandContext,
        customPrompt: config.customPrompt,
        includeMedia: config.includeMedia,
        mediaType: config.mediaType,
        mediaStyle: config.mediaStyle,
      });

      const schedule = JSON.stringify({
        frequency: config.frequency,
        dayOfWeek: config.dayOfWeek,
        time: config.time,
        firstRunDate: config.startDate || task.startDate?.toISOString() || null,
        platforms: configPlatforms,
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
          platforms: JSON.stringify(configPlatforms),
          startDate: combineDateAndTime(config.startDate || task.startDate, config.time),
          endDate: config.endDate ? new Date(config.endDate) : globalEndDate ? new Date(globalEndDate) : null,
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
      const readiness = qualifyStrategyTaskForAutomation(task, {
        includeMedia: false,
        mediaType: "image",
        selectedPlatforms: [],
        connectedPlatforms,
        emailReady,
        smsReady,
        requireDestination: false,
      });
      const status = readiness.type !== "manual" && isAutomatableCategory(normalizeTaskCategory(task.category))
        ? "AUTOMATABLE"
        : "MANUAL_ONLY";
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
        message: `${createdAutomations.length + createdCampaigns.length} automation${(createdAutomations.length + createdCampaigns.length) > 1 ? "s" : ""} created from "${strategy.name}"${createdCampaigns.length > 0 ? ` (${createdCampaigns.length} email campaign${createdCampaigns.length > 1 ? "s" : ""})` : ""}`,
        data: JSON.stringify({
          strategyId,
          strategyName: strategy.name,
          automationCount: createdAutomations.length,
          campaignCount: createdCampaigns.length,
          skippedCount: blockedTasks.length,
        }),
      },
    });

    await triggerActivitySyncForUser(session.userId).catch((err) =>
      console.error("Strategy sync after strategy automation launch failed:", err)
    );

    return NextResponse.json({
      success: true,
      data: {
        automationIds: createdAutomations,
        campaignIds: createdCampaigns,
        automatedTaskCount: createdAutomations.length + createdCampaigns.length,
        postAutomationCount: createdAutomations.length,
        emailCampaignCount: createdCampaigns.length,
        totalTasks: strategy.tasks.length,
        strategyName: strategy.name,
        blockedTasks,
        creditEstimate: estimate,
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
