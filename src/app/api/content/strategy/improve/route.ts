import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ai } from "@/lib/ai/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { normalizeTaskCategory, TASK_CATEGORIES } from "@/lib/strategy/categories";

interface ImprovedTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  startDate: string;
  dueDate: string;
}

interface ImprovedStrategy {
  name: string;
  description: string;
  tasks: ImprovedTask[];
}

type StrategyWithTasks = Prisma.MarketingStrategyGetPayload<{
  include: { tasks: true };
}>;

function parseJSON(str: string | null | undefined, fallback: unknown = []): unknown {
  try {
    return JSON.parse(str || "");
  } catch {
    return fallback;
  }
}

function toISODate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeStrategy(strategy: StrategyWithTasks | null) {
  if (!strategy) return null;
  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    aiGenerated: strategy.aiGenerated,
    status: strategy.status,
    totalTasks: strategy.totalTasks,
    completedTasks: strategy.completedTasks,
    lastActivitySync: strategy.lastActivitySync?.toISOString() || null,
    tasks: strategy.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: normalizeTaskCategory(task.category),
      startDate: task.startDate?.toISOString() || null,
      dueDate: task.dueDate?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
      sortOrder: task.sortOrder,
      aiSuggested: task.aiSuggested,
      autoCompleted: task.autoCompleted,
      automationStatus: task.automationStatus,
      automationId: task.automationId,
      progress: task.progress,
      matchedActivities: task.matchedActivities,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    createdAt: strategy.createdAt.toISOString(),
    updatedAt: strategy.updatedAt.toISOString(),
  };
}

// POST /api/content/strategy/improve - Improve the current ACTIVE strategy in place
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
      goals,
      timeframe,
      focusAreas,
      platforms,
      additionalContext,
      competitorInfo,
      budget,
    } = body;

    if (!strategyId) {
      return NextResponse.json(
        { success: false, error: { message: "Strategy ID is required" } },
        { status: 400 }
      );
    }

    const strategy = await prisma.marketingStrategy.findUnique({
      where: { id: strategyId },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });

    if (!strategy || strategy.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Strategy not found" } },
        { status: 404 }
      );
    }

    if (strategy.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: { message: "Only ACTIVE strategies can be improved" } },
        { status: 400 }
      );
    }

    const creditCost = await getDynamicCreditCost("AI_IDEAS");
    if (session.user.aiCredits < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Not enough credits. Required: ${creditCost}, Available: ${session.user.aiCredits}`,
          },
        },
        { status: 402 }
      );
    }

    let brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });
    if (!brandKit) {
      brandKit = await prisma.brandKit.findFirst({ where: { userId: session.userId } });
    }

    const socialAccounts = await prisma.socialAccount.findMany({
      where: { userId: session.userId, isActive: true },
      select: { platform: true, platformUsername: true },
    });

    const marketingConfig = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
      select: {
        emailEnabled: true,
        emailVerified: true,
        emailProvider: true,
        smsEnabled: true,
        smsVerified: true,
        smsComplianceStatus: true,
      },
    });

    const emailReady = !!(
      marketingConfig?.emailEnabled &&
      marketingConfig.emailVerified &&
      marketingConfig.emailProvider &&
      marketingConfig.emailProvider !== "NONE"
    );
    const smsReady = !!(
      marketingConfig?.smsEnabled &&
      marketingConfig.smsVerified &&
      marketingConfig.smsComplianceStatus === "APPROVED"
    );

    const brandContext = brandKit
      ? [
          `Brand name: ${brandKit.name}`,
          brandKit.tagline ? `Tagline: ${brandKit.tagline}` : null,
          brandKit.description ? `Description: ${brandKit.description}` : null,
          brandKit.industry ? `Industry: ${brandKit.industry}` : null,
          brandKit.niche ? `Niche: ${brandKit.niche}` : null,
          brandKit.targetAudience ? `Target audience: ${brandKit.targetAudience}` : null,
          brandKit.voiceTone ? `Brand voice/tone: ${brandKit.voiceTone}` : null,
          brandKit.uniqueValue ? `Unique value proposition: ${brandKit.uniqueValue}` : null,
          (() => {
            const keywords = parseJSON(brandKit.keywords) as string[];
            return keywords.length ? `Keywords: ${keywords.join(", ")}` : null;
          })(),
          (() => {
            const products = parseJSON(brandKit.products) as string[];
            return products.length ? `Products/services: ${products.join(", ")}` : null;
          })(),
        ]
          .filter(Boolean)
          .join("\n")
      : "No brand identity set up.";

    const openTasks = strategy.tasks.filter(
      (task) => task.status !== "DONE" && !task.automationId && task.automationStatus !== "AUTOMATED"
    );
    const preservedTasks = strategy.tasks.filter(
      (task) => task.status === "DONE" || task.automationId || task.automationStatus === "AUTOMATED"
    );
    const timeframeText =
      timeframe === "1_MONTH" ? "1 month" : timeframe === "6_MONTHS" ? "6 months" : "3 months";
    const validCategories = new Set<string>(TASK_CATEGORIES);
    const selectedAreas = Array.isArray(focusAreas)
      ? focusAreas.filter((area: string) => validCategories.has(area))
      : ["content", "social", "email"];
    const today = new Date().toISOString().split("T")[0];
    const connectedPlatforms = socialAccounts.map((account) =>
      [account.platform, account.platformUsername].filter(Boolean).join(": ")
    );

    const improved = await ai.generateJSON<ImprovedStrategy>(
      `Improve the user's active marketing strategy in place. Keep the brand-specific thinking, but rewrite the open plan so it can pass automation readiness validation.

--- BRAND IDENTITY ---
${brandContext}

--- CURRENT ACTIVE STRATEGY ---
Name: ${strategy.name}
Description: ${strategy.description || "No description"}

Open items to improve or replace:
${openTasks
  .map(
    (task, index) =>
      `${index + 1}. [${task.category || "uncategorized"} / ${task.priority}] ${task.title}\n${task.description || ""}`
  )
  .join("\n\n") || "No open items"}

Preserved history that must not be recreated:
${preservedTasks.map((task) => `- ${task.title}`).join("\n") || "None"}

--- USER GOAL ---
${goals || "Improve this strategy and make the next work automation-ready."}

--- READINESS CONTEXT ---
Timeframe: ${timeframeText} starting from ${today}
Focus areas: ${selectedAreas.join(", ")}
Target platforms: ${Array.isArray(platforms) && platforms.length ? platforms.join(", ") : "FlowSmartly feed and connected accounts"}
Connected social accounts: ${connectedPlatforms.length ? connectedPlatforms.join(", ") : "Only FlowSmartly feed is guaranteed"}
Email sender ready: ${emailReady ? "yes" : "no"}
SMS approved: ${smsReady ? "yes" : "no"}
${competitorInfo ? `Competitor context: ${competitorInfo}` : ""}
${budget ? `Budget context: ${budget}` : ""}
${additionalContext ? `Additional context: ${additionalContext}` : ""}

--- AUTOMATION-READY RULES ---
Generate 12-20 open tasks. Most tasks must be category "content" or "social" so they can be automated into recurring posts.
Use category "email" only if the email sender is ready. Do not create SMS tasks unless SMS is approved.
Avoid tasks that require manual research, approvals, analytics review, website setup, account setup, or ad budget decisions unless they are clearly not automation tasks.
For automation-ready post tasks, write a clear executable content brief: destination, audience, offer/product angle, proof point, call to action, media need, and the next publishable output.
Do not produce plan/framework/recommendation tasks. If an old item asks for a plan, rewrite it into specific posts, email campaigns, SMS messages, images, or videos that an automation agent can create and schedule.
Good task titles start with verbs like "Publish", "Schedule", "Send", "Create", or "Launch".
Avoid visual/video blocker words like visual, image, photo, graphic, flyer, poster, Pinterest, pin, carousel, video, reel, TikTok, YouTube, story unless that task explicitly needs generated media.
If media is important, create a small number of tasks whose description says "Requires generated media" and explains whether image or video is required.
Keep dates realistic within the timeframe.

Return ONLY JSON:
{
  "name": "Improved strategy name",
  "description": "Brief explanation of the improved operating plan",
  "tasks": [{ "title", "description", "priority", "category", "startDate", "dueDate" }]
}`,
      {
        maxTokens: 8192,
        systemPrompt:
          "You are a senior marketing strategist and automation architect. Rewrite plans into concrete, brand-specific, automation-ready operating tasks. Return ONLY valid JSON.",
      }
    );

    if (!improved?.tasks || !Array.isArray(improved.tasks)) {
      return NextResponse.json(
        { success: false, error: { message: "AI failed to improve the strategy. Please try again." } },
        { status: 500 }
      );
    }

    const validPriorities = ["LOW", "MEDIUM", "HIGH"];
    const sanitizedTasks = improved.tasks
      .filter((task) => task.title?.trim())
      .slice(0, 24)
      .map((task, index) => ({
        title: task.title.trim(),
        description: task.description || null,
        priority: validPriorities.includes(task.priority) ? task.priority : "MEDIUM",
        category: normalizeTaskCategory(task.category),
        startDate: toISODate(task.startDate),
        dueDate: toISODate(task.dueDate),
        sortOrder: preservedTasks.length + index,
      }));

    const improvedStrategy = await prisma.$transaction(async (tx) => {
      await tx.strategyTask.deleteMany({
        where: {
          strategyId: strategy.id,
          status: { not: "DONE" },
          automationId: null,
          automationStatus: { not: "AUTOMATED" },
        },
      });

      await tx.marketingStrategy.update({
        where: { id: strategy.id },
        data: {
          name: improved.name?.trim() || strategy.name,
          description: improved.description || strategy.description,
          aiGenerated: true,
        },
      });

      if (sanitizedTasks.length > 0) {
        await tx.strategyTask.createMany({
          data: sanitizedTasks.map((task) => ({
            strategyId: strategy.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            category: task.category,
            startDate: task.startDate,
            dueDate: task.dueDate,
            sortOrder: task.sortOrder,
            aiSuggested: true,
          })),
        });
      }

      const [totalTasks, completedTasks] = await Promise.all([
        tx.strategyTask.count({ where: { strategyId: strategy.id } }),
        tx.strategyTask.count({ where: { strategyId: strategy.id, status: "DONE" } }),
      ]);

      await tx.marketingStrategy.update({
        where: { id: strategy.id },
        data: { totalTasks, completedTasks },
      });

      await tx.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: creditCost } },
      });

      await tx.creditTransaction.create({
        data: {
          userId: session.userId,
          type: "USAGE",
          amount: -creditCost,
          balanceAfter: session.user.aiCredits - creditCost,
          referenceType: "ai_usage",
          description: "AI strategy improvement",
        },
      });

      return tx.marketingStrategy.findUnique({
        where: { id: strategy.id },
        include: { tasks: { orderBy: { sortOrder: "asc" } } },
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        strategy: serializeStrategy(improvedStrategy),
        creditsUsed: creditCost,
        replacedOpenTasks: openTasks.length,
        preservedTasks: preservedTasks.length,
      },
    });
  } catch (error) {
    console.error("Improve strategy error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to improve strategy" } },
      { status: 500 }
    );
  }
}
