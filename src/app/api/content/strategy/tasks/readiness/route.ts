import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ai } from "@/lib/ai/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { normalizeTaskCategory, type TaskCategory } from "@/lib/strategy/categories";
import {
  qualifyStrategyTaskForAutomation,
  type AutomationReadiness,
} from "@/lib/strategy/automation-readiness";

interface ReadyTask {
  title: string;
  description: string;
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  startDate?: string | null;
  dueDate?: string | null;
  readinessNotes?: string[];
}

interface RepairOptions {
  convertToPost?: boolean;
  removeMediaRequirement?: boolean;
  keepDates?: boolean;
}

interface ReadyTaskUpdate {
  title: string;
  description: string;
  category: TaskCategory;
  priority: "LOW" | "MEDIUM" | "HIGH";
  startDate: string | null;
  dueDate: string | null;
}

const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);
const MEDIA_BLOCKER_TERMS =
  /\b(visuals?|images?|photos?|graphics?|flyers?|posters?|creatives?|pinterest|pins?|carousels?|banners?|videos?|reels?|shorts?|youtube|tiktok|animations?|animated|stories|story|sms|text message|text blast|twilio|whatsapp)\b/gi;

function parseJSON(value: string | null | undefined, fallback: unknown = []): unknown {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanBlockerWords(value: string) {
  return value
    .replace(MEDIA_BLOCKER_TERMS, "content")
    .replace(/\s+/g, " ")
    .replace(/\bcontent content\b/gi, "content")
    .trim();
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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

function readinessForTask(
  task: {
    id: string;
    title: string;
    description?: string | null;
    category?: string | null;
    status?: string;
    automationId?: string | null;
    automationStatus?: string | null;
  },
  emailReady: boolean,
  smsReady: boolean
): AutomationReadiness {
  return qualifyStrategyTaskForAutomation(task, {
    selectedPlatforms: ["feed"],
    connectedPlatforms: [],
    includeMedia: false,
    mediaType: "image",
    emailReady,
    smsReady,
  });
}

function fallbackReadyTask(
  task: { title: string; description: string | null; priority: string },
  brandName: string
): ReadyTask {
  const cleanTitle = cleanBlockerWords(task.title);
  const cleanDescription = cleanBlockerWords(task.description || task.title);
  return {
    title: `Recurring customer post: ${cleanTitle}`.slice(0, 160),
    description: [
      `Create a recurring customer-facing post for ${brandName} about ${cleanTitle}.`,
      `Audience: the brand's best-fit customers.`,
      `Offer angle: ${cleanDescription}.`,
      "Proof point: explain why this matters and connect it to a real product, service, or customer outcome.",
      "Call to action: invite the reader to visit the brand, message the team, or explore the offer.",
      "Destination: publish first to the FlowSmartly feed, then extend to connected social channels when available.",
    ].join(" "),
    category: "content",
    priority: VALID_PRIORITIES.has(task.priority) ? (task.priority as ReadyTask["priority"]) : "MEDIUM",
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
    const taskId = typeof body.taskId === "string" ? body.taskId : "";
    const options: RepairOptions = typeof body.options === "object" && body.options ? body.options : {};

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: { message: "taskId is required" } },
        { status: 400 }
      );
    }

    const task = await prisma.strategyTask.findUnique({
      where: { id: taskId },
      include: {
        strategy: {
          select: { id: true, userId: true, name: true, description: true },
        },
      },
    });

    if (!task || task.strategy.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Task not found" } },
        { status: 404 }
      );
    }

    if (task.status === "DONE") {
      return NextResponse.json(
        { success: false, error: { message: "Completed items cannot be converted into new automations" } },
        { status: 400 }
      );
    }

    if (task.automationId || task.automationStatus === "AUTOMATED") {
      return NextResponse.json(
        { success: false, error: { message: "This item is already automated" } },
        { status: 400 }
      );
    }

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

    const currentReadiness = readinessForTask(task, emailReady, smsReady);
    if (currentReadiness.qualified) {
      const updatedTask = await prisma.strategyTask.update({
        where: { id: task.id },
        data: { automationStatus: "AUTOMATABLE" },
      });
      return NextResponse.json({
        success: true,
        data: {
          task: serializeTask(updatedTask),
          readiness: currentReadiness,
          creditsUsed: 0,
        },
      });
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

    const products = parseJSON(brandKit?.products, []) as string[];
    const keywords = parseJSON(brandKit?.keywords, []) as string[];
    const brandName = brandKit?.name || "this brand";
    const brandContext = brandKit
      ? [
          `Brand name: ${brandKit.name}`,
          brandKit.tagline ? `Tagline: ${brandKit.tagline}` : null,
          brandKit.description ? `Description: ${brandKit.description}` : null,
          brandKit.industry ? `Industry: ${brandKit.industry}` : null,
          brandKit.niche ? `Niche: ${brandKit.niche}` : null,
          brandKit.targetAudience ? `Target audience: ${brandKit.targetAudience}` : null,
          brandKit.voiceTone ? `Brand voice: ${brandKit.voiceTone}` : null,
          brandKit.uniqueValue ? `Unique value: ${brandKit.uniqueValue}` : null,
          products.length ? `Products/services: ${products.slice(0, 8).join(", ")}` : null,
          keywords.length ? `Keywords: ${keywords.slice(0, 10).join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "No brand identity is saved.";

    const generated = await ai.generateJSON<ReadyTask>(
      `Rewrite exactly one marketing strategy task so it passes automation readiness validation.

--- BRAND ---
${brandContext}

--- STRATEGY ---
Name: ${task.strategy.name}
Description: ${task.strategy.description || "No description"}

--- CURRENT ITEM ---
Title: ${task.title}
Description: ${task.description || "No description"}
Category: ${task.category || "content"}
Priority: ${task.priority}
Status: ${task.status}

--- CURRENT READINESS PROBLEMS ---
${currentReadiness.blockers.length ? currentReadiness.blockers.map((item) => `- ${item}`).join("\n") : "- None"}
${currentReadiness.requirements.length ? currentReadiness.requirements.map((item) => `- Requirement: ${item}`).join("\n") : ""}
${currentReadiness.warnings.length ? currentReadiness.warnings.map((item) => `- Warning: ${item}`).join("\n") : ""}

--- REPAIR OPTIONS ---
Convert to automatable post/email content: ${options.convertToPost !== false ? "yes" : "no"}
Remove media, video, SMS, or platform blocker wording: ${options.removeMediaRequirement !== false ? "yes" : "no"}
Keep dates and priority: ${options.keepDates !== false ? "yes" : "no"}
Guaranteed selected channel: FlowSmartly feed
Email ready: ${emailReady ? "yes" : "no"}
SMS ready: ${smsReady ? "yes" : "no"}

--- RULES ---
Return one item only.
Prefer category "content" or "social" so it can automate into recurring feed/social posts.
Use category "email" only if email is ready.
Do not use SMS unless SMS is ready.
If media is not enabled, avoid visual/video blocker words like visual, image, photo, graphic, flyer, poster, Pinterest, pin, carousel, video, reel, TikTok, YouTube, story.
The description must include audience, offer or product angle, proof point, call to action, and publishing destination.
Keep the item specific to the brand.

Return ONLY JSON:
{
  "title": "short actionable title",
  "description": "automation-ready brief",
  "category": "content",
  "priority": "LOW|MEDIUM|HIGH",
  "startDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "readinessNotes": ["what changed"]
}`,
      {
        maxTokens: 1800,
        systemPrompt:
          "You are FlowAI, a marketing automation strategist. Return only valid JSON and make the item pass automation readiness validation.",
      }
    );

    const fallback = fallbackReadyTask(task, brandName);
    const shouldStripBlockers = options.removeMediaRequirement !== false;
    const preferredCategory = options.convertToPost === false ? normalizeTaskCategory(generated?.category) : "content";
    let category: TaskCategory = normalizeTaskCategory(preferredCategory);
    if (category === "email" && !emailReady) category = "content";
    if (category === "ads" || category === "analytics") category = "content";

    const titleSource = safeString(generated?.title, fallback.title);
    const descriptionSource = safeString(generated?.description, fallback.description);
    const candidate = {
      id: task.id,
      title: shouldStripBlockers ? cleanBlockerWords(titleSource) : titleSource,
      description: shouldStripBlockers
        ? cleanBlockerWords(descriptionSource)
        : descriptionSource,
      category,
      status: task.status,
      automationId: null,
      automationStatus: "AUTOMATABLE",
    };
    let readiness = readinessForTask(candidate, emailReady, smsReady);

    let readyTask: ReadyTaskUpdate = {
      title: candidate.title || fallback.title,
      description: candidate.description || fallback.description,
      category,
      priority: VALID_PRIORITIES.has(generated?.priority || "")
        ? (generated?.priority as ReadyTask["priority"])
        : VALID_PRIORITIES.has(task.priority)
        ? (task.priority as ReadyTask["priority"])
        : fallback.priority,
      startDate: options.keepDates === false ? generated?.startDate || null : task.startDate?.toISOString() || null,
      dueDate: options.keepDates === false ? generated?.dueDate || null : task.dueDate?.toISOString() || null,
    };

    if (!readiness.qualified) {
      readyTask = {
        title: fallback.title,
        description: fallback.description,
        category: normalizeTaskCategory(fallback.category),
        priority: fallback.priority,
        startDate: task.startDate?.toISOString() || null,
        dueDate: task.dueDate?.toISOString() || null,
      };
      readiness = readinessForTask(
        {
          id: task.id,
          title: readyTask.title,
          description: readyTask.description,
          category: "content",
          status: task.status,
          automationId: null,
          automationStatus: "AUTOMATABLE",
        },
        emailReady,
        smsReady
      );
    }

    if (!readiness.qualified) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: readiness.blockers[0] || "This item still needs manual setup before automation",
          },
        },
        { status: 422 }
      );
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      const taskUpdate = await tx.strategyTask.update({
        where: { id: task.id },
        data: {
          title: readyTask.title,
          description: readyTask.description,
          category: readyTask.category,
          priority: readyTask.priority,
          startDate: options.keepDates === false ? toDate(readyTask.startDate) : task.startDate,
          dueDate: options.keepDates === false ? toDate(readyTask.dueDate) : task.dueDate,
          automationStatus: "AUTOMATABLE",
          aiSuggested: true,
        },
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
          referenceId: task.id,
          description: "AI strategy item readiness repair",
          metadata: JSON.stringify({
            feature: "strategy_task_readiness",
            taskId: task.id,
            strategyId: task.strategyId,
          }),
        },
      });

      return taskUpdate;
    });

    return NextResponse.json({
      success: true,
      data: {
        task: serializeTask(updatedTask),
        readiness,
        creditsUsed: creditCost,
        creditsRemaining: session.user.aiCredits - creditCost,
      },
    });
  } catch (error) {
    console.error("AI task readiness error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to prepare item for automation" } },
      { status: 500 }
    );
  }
}
