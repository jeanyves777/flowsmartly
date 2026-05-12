import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { normalizeTaskCategory } from "@/lib/strategy/categories";
import {
  estimateAutomationCredits,
  isAutomatableCategory,
} from "@/lib/strategy/credit-estimator";
import { qualifyStrategyTaskForAutomation } from "@/lib/strategy/automation-readiness";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";
import { buildStrategyAutomationPrompt } from "@/lib/strategy/automation-execution";
import { getBlogReadinessForUser } from "@/lib/website/blog-posting";
import { ai } from "@/lib/ai/client";

interface TaskConfig {
  taskId: string;
  enabled: boolean;
  includeMedia: boolean;
  mediaType: "image" | "video";
  mediaStyle: string;
  frequency: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek: number;
  time: string;
  platforms?: string[];
  startDate?: string;
  endDate?: string;
  customPrompt: string;
  contactListId?: string | null;
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
  return date;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function plainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

function fallbackStrategyEmailDraft(params: {
  title: string;
  description?: string | null;
  brandName: string;
  brandContext: string;
  customPrompt?: string;
}) {
  const topic = (params.customPrompt || params.description || params.title).replace(/\s+/g, " ").trim();
  const subject = params.title.replace(/^(create|build|design|launch|write)\s+/i, "").slice(0, 90);
  const content = [
    "Hi {{firstName}},",
    `${params.brandName} has something useful to share with you.`,
    topic,
    "Take a moment to review it today, and reply if you would like help choosing the next best step.",
    `- ${params.brandName}`,
  ].join("\n\n");

  return {
    subject: subject || `${params.brandName} update`,
    preheaderText: topic.slice(0, 140),
    content,
    contentHtml: plainTextToHtml(content),
  };
}

async function buildStrategyEmailDraft(params: {
  title: string;
  description?: string | null;
  brandName: string;
  brandContext: string;
  customPrompt?: string;
  tone: string;
}) {
  const fallback = fallbackStrategyEmailDraft(params);

  try {
    const generated = await ai.generateJSON<{
      subject?: string;
      preheaderText?: string;
      content?: string;
      contentHtml?: string;
    }>(
      `Turn this strategy task into one ready-to-send email campaign draft.

Brand context:
${params.brandContext || `Brand: ${params.brandName}`}

Tone: ${params.tone}
Task title: ${params.title}
Task description: ${params.description || ""}
Extra instruction: ${params.customPrompt || ""}

Rules:
- Do not return a plan, checklist, framework, or instructions.
- Write the actual email the customer receives.
- Use {{firstName}} only if personalization helps.
- Keep the subject under 90 characters.
- Return JSON with subject, preheaderText, content, and contentHtml.`,
      {
        maxTokens: 1400,
        temperature: 0.4,
        systemPrompt:
          "You are a lifecycle email copywriter. Produce finished customer-facing email copy, not planning notes.",
      }
    );

    const subject = typeof generated?.subject === "string" ? generated.subject.trim().slice(0, 120) : "";
    const content = typeof generated?.content === "string" ? generated.content.trim() : "";
    if (!subject || content.length < 80 || /\b(create|build|design|segment|launch)\b.+\b(email|sequence|flow|track)\b/i.test(content.slice(0, 220))) {
      return fallback;
    }

    const html = typeof generated?.contentHtml === "string" && generated.contentHtml.trim().length > 20
      ? generated.contentHtml.trim()
      : plainTextToHtml(content);

    return {
      subject,
      preheaderText:
        typeof generated?.preheaderText === "string" && generated.preheaderText.trim()
          ? generated.preheaderText.trim().slice(0, 180)
          : fallback.preheaderText,
      content,
      contentHtml: html,
    };
  } catch (error) {
    console.warn("Strategy email draft generation failed; using fallback copy:", error);
    return fallback;
  }
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

    const [user, socialAccounts, marketingConfig, blogReadiness] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true, timezone: true },
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
      getBlogReadinessForUser(session.userId),
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
    const blogReady = blogReadiness.ready;

    // Build task map for quick lookup
    const taskMap = new Map(strategy.tasks.map((t) => [t.id, t]));
    const enabledConfigs = taskConfigs.filter((config) => config.enabled);
    const readyTaskIds = new Set<string>();
    const readyTypes = new Map<string, string>();
    const blockedTasks: Array<{ taskId: string; title: string; blockers: string[] }> = [];

    for (const config of enabledConfigs) {
      const task = taskMap.get(config.taskId);
      if (!task) continue;

      const configPlatforms = safePlatforms(config.platforms, platforms);
      const missingConnections = configPlatforms.filter(
        (platform) => platform !== "feed" && platform !== "blog" && !connectedPlatforms.includes(platform)
      );
      const readiness = qualifyStrategyTaskForAutomation(task, {
        includeMedia: config.includeMedia,
        mediaType: config.mediaType,
        selectedPlatforms: configPlatforms,
        connectedPlatforms,
        emailReady,
        smsReady,
        blogReady,
        requireDestination: true,
      });

      if (readiness.qualified && missingConnections.length === 0) {
        readyTaskIds.add(task.id);
        readyTypes.set(task.id, readiness.type);
      } else {
        blockedTasks.push({
          taskId: task.id,
          title: task.title,
          blockers: [
            ...readiness.blockers,
            ...(readiness.type === "blog" ? blogReadiness.blockers : []),
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
      frequency: enabledConfigs[0]?.frequency || "ONCE",
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
      blogReady,
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
            message: `Not enough credits for the next automation run. Required: ${estimate.requiredCredits}, Available: ${estimate.userCredits}`,
            estimate,
          },
        },
        { status: 402 }
      );
    }

    // Create automations for each enabled task
    const createdPostAutomations: string[] = [];
    const createdEmailAutomations: string[] = [];
    const taskUpdates: Array<{ taskId: string; automationId: string; status: string }> = [];
    const selectedContactListIds = [
      ...new Set(
        enabledConfigs
          .map((config) => config.contactListId)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      ),
    ];
    const validContactListIds =
      selectedContactListIds.length > 0
        ? new Set(
            (
              await prisma.contactList.findMany({
                where: { id: { in: selectedContactListIds }, userId: session.userId },
                select: { id: true },
              })
            ).map((list) => list.id)
          )
        : new Set<string>();
    const invalidContactListId = selectedContactListIds.find((id) => !validContactListIds.has(id));
    if (invalidContactListId) {
      return NextResponse.json(
        { success: false, error: { message: "One selected contact list was not found" } },
        { status: 404 }
      );
    }

    for (const config of taskConfigs) {
      const task = taskMap.get(config.taskId);
      if (!task) continue;

      const category = normalizeTaskCategory(task.category);
      const automationType = readyTypes.get(task.id) || "post";

      if (!config.enabled || !readyTaskIds.has(task.id) || !isAutomatableCategory(category)) {
        continue;
      }

      // EMAIL tasks -> create real Email Automation records, not draft campaigns.
      if (automationType === "email") {
        const emailDraft = await buildStrategyEmailDraft({
          title: task.title,
          description: task.description,
          brandName: brandKit?.name || "FlowSmartly",
          brandContext,
          customPrompt: config.customPrompt,
          tone: globalTone,
        });
        // Calculate scheduled send time from frequency config
        const scheduledAt = combineDateAndTime(config.startDate || task.startDate, config.time);

        const emailAutomation = await prisma.automation.create({
          data: {
            userId: session.userId,
            name: `Strategy: ${task.title}`,
            type: "CUSTOM",
            trigger: JSON.stringify({
              source: "strategy",
              strategyId,
              strategyTaskId: task.id,
              scheduledAt: scheduledAt.toISOString(),
              frequency: config.frequency,
              dayOfWeek: config.dayOfWeek,
              time: config.time,
            }),
            enabled: true,
            campaignType: "EMAIL",
            subject: emailDraft.subject,
            content: emailDraft.content,
            contentHtml: emailDraft.contentHtml,
            sendTime: config.time || "09:00",
            daysOffset: 0,
            timezone: user?.timezone || "UTC",
            contactListId: config.contactListId || null,
          },
        });

        createdEmailAutomations.push(emailAutomation.id);
        taskUpdates.push({
          taskId: task.id,
          automationId: emailAutomation.id,
          status: "AUTOMATED",
        });
        continue;
      }

      // SOCIAL/CONTENT tasks → create PostAutomation record
      const configPlatforms = safePlatforms(config.platforms, platforms);
      if (automationType === "blog") {
        if (!blogReadiness.website) {
          blockedTasks.push({
            taskId: task.id,
            title: task.title,
            blockers: blogReadiness.blockers.length
              ? blogReadiness.blockers
              : ["Publish a website with an active Blog page before scheduling blog automation"],
          });
          continue;
        }

        const schedule = JSON.stringify({
          frequency: config.frequency,
          dayOfWeek: config.dayOfWeek,
          time: config.time,
          triggerType: config.frequency === "ONCE" ? "one_time" : "recurring",
          firstRunDate: config.startDate || task.startDate?.toISOString() || null,
          platforms: ["blog"],
          contentType: "blog",
          websiteId: blogReadiness.website.id,
        });
        const isOneTime = config.frequency === "ONCE";
        const blogPrompt = [
          "BLOG AUTOMATION EXECUTION BRIEF",
          "Write one complete website blog article when this automation runs.",
          `Primary task: ${task.title}`,
          task.description ? `Task details: ${task.description}` : null,
          config.customPrompt ? `User direction: ${config.customPrompt}` : null,
          `Target website: ${blogReadiness.website.name}`,
          brandContext ? `Brand context:\n${brandContext}` : null,
          "Execution rule: write the real article and optional hero image direction. Do not output a plan, outline, draft note, or placeholder link.",
        ].filter(Boolean).join("\n");

        const automation = await prisma.postAutomation.create({
          data: {
            userId: session.userId,
            name: `Strategy: ${task.title}`,
            type: isOneTime ? "EVENT_BASED" : "AI_GENERATED",
            enabled: true,
            schedule,
            topic: task.title,
            aiPrompt: blogPrompt,
            aiTone: globalTone,
            includeMedia: config.includeMedia,
            mediaType: config.includeMedia ? "image" : null,
            mediaStyle: config.includeMedia ? config.mediaStyle : null,
            platforms: JSON.stringify(["blog"]),
            startDate: combineDateAndTime(config.startDate || task.startDate, config.time),
            endDate: isOneTime
              ? null
              : config.endDate
              ? new Date(config.endDate)
              : globalEndDate
              ? new Date(globalEndDate)
              : null,
            strategyTaskId: task.id,
            sourceStrategyId: strategyId,
          },
        });

        createdPostAutomations.push(automation.id);
        taskUpdates.push({
          taskId: task.id,
          automationId: automation.id,
          status: "AUTOMATED",
        });
        continue;
      }

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
        triggerType: config.frequency === "ONCE" ? "one_time" : "recurring",
        firstRunDate: config.startDate || task.startDate?.toISOString() || null,
        platforms: configPlatforms,
      });
      const isOneTime = config.frequency === "ONCE";

      const automation = await prisma.postAutomation.create({
        data: {
          userId: session.userId,
          name: `Strategy: ${task.title}`,
          type: isOneTime ? "EVENT_BASED" : "AI_GENERATED",
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
          endDate: isOneTime
            ? null
            : config.endDate
            ? new Date(config.endDate)
            : globalEndDate
            ? new Date(globalEndDate)
            : null,
          strategyTaskId: task.id,
          sourceStrategyId: strategyId,
        },
      });

      createdPostAutomations.push(automation.id);
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
        blogReady,
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
        message: `${createdPostAutomations.length + createdEmailAutomations.length} automation${(createdPostAutomations.length + createdEmailAutomations.length) > 1 ? "s" : ""} created from "${strategy.name}"${createdEmailAutomations.length > 0 ? ` (${createdEmailAutomations.length} email automation${createdEmailAutomations.length > 1 ? "s" : ""})` : ""}`,
        data: JSON.stringify({
          strategyId,
          strategyName: strategy.name,
          automationCount: createdPostAutomations.length,
          emailAutomationCount: createdEmailAutomations.length,
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
        automationIds: [...createdPostAutomations, ...createdEmailAutomations],
        postAutomationIds: createdPostAutomations,
        emailAutomationIds: createdEmailAutomations,
        automatedTaskCount: createdPostAutomations.length + createdEmailAutomations.length,
        postAutomationCount: createdPostAutomations.length,
        emailAutomationCount: createdEmailAutomations.length,
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
