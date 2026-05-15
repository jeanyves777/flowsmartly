import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import type {
  AutomationListResponse,
  AutomationResponse,
  AutomationType,
  AutomationCampaignType,
  AutomationTrigger,
  CreateAutomationResponse,
} from "@/api/contracts/automations";
import type { ApiResponse } from "@/api/contracts/common";

const VALID_TYPES = ["BIRTHDAY", "HOLIDAY", "WELCOME", "RE_ENGAGEMENT", "CUSTOM", "TRIAL_ENDING", "PAYMENT_FAILED", "ABANDONED_CART", "INACTIVITY", "ANNIVERSARY", "SUBSCRIPTION_CHANGE"];
const VALID_CAMPAIGN_TYPES = ["EMAIL", "SMS"];

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeDaysOffset(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error("Days offset must be a number");
  }
  return Math.max(-30, Math.min(30, parsed));
}

function normalizeTrigger(type: string, trigger: unknown): Record<string, unknown> {
  const triggerObj = trigger && typeof trigger === "object" && !Array.isArray(trigger)
    ? { ...(trigger as Record<string, unknown>) }
    : {};

  if (type === "HOLIDAY" && !triggerObj.holidayId) {
    throw new Error("Holiday automations require a holidayId in the trigger");
  }

  if (type === "CUSTOM" && typeof triggerObj.frequency === "string") {
    const frequencyMap: Record<string, string> = {
      "one-time": "ONCE",
      once: "ONCE",
      daily: "DAILY",
      weekly: "WEEKLY",
      monthly: "MONTHLY",
    };
    triggerObj.frequency = frequencyMap[triggerObj.frequency.toLowerCase()] || triggerObj.frequency.toUpperCase();
    if (triggerObj.frequencyDay !== undefined) {
      const day = Number.parseInt(String(triggerObj.frequencyDay), 10);
      if (Number.isFinite(day)) {
        if (triggerObj.frequency === "WEEKLY") triggerObj.dayOfWeek = Math.max(0, Math.min(6, day));
        if (triggerObj.frequency === "MONTHLY") triggerObj.dayOfMonth = Math.max(1, Math.min(28, day));
      }
      delete triggerObj.frequencyDay;
    }
  }

  return triggerObj;
}

// GET /api/automations - List all user's automations
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const enabled = searchParams.get("enabled");
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {
      userId: session.userId,
    };

    if (type && VALID_TYPES.includes(type.toUpperCase())) {
      where.type = type.toUpperCase();
    }

    if (enabled !== null && enabled !== undefined && enabled !== "") {
      where.enabled = enabled === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { subject: { contains: search } },
      ];
    }

    const automations = await prisma.automation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        contactList: {
          select: {
            id: true,
            name: true,
            totalCount: true,
          },
        },
        _count: {
          select: { logs: true },
        },
      },
    });

    // Compute stats
    const allAutomations = await prisma.automation.findMany({
      where: { userId: session.userId },
      select: { enabled: true, totalSent: true },
    });

    const totalAutomations = allAutomations.length;
    const activeCount = allAutomations.filter((a) => a.enabled).length;
    const totalSent = allAutomations.reduce((sum, a) => sum + a.totalSent, 0);

    const formattedAutomations: AutomationResponse[] = automations.map((automation) => ({
      id: automation.id,
      name: automation.name,
      type: automation.type as AutomationType,
      trigger: ((): AutomationTrigger => {
        try {
          return JSON.parse(automation.trigger) as AutomationTrigger;
        } catch {
          return {};
        }
      })(),
      enabled: automation.enabled,
      campaignType: automation.campaignType as AutomationCampaignType,
      subject: automation.subject,
      content: automation.content,
      contentHtml: automation.contentHtml,
      sendTime: automation.sendTime,
      daysOffset: automation.daysOffset,
      timezone: automation.timezone,
      contactListId: automation.contactListId,
      contactList: automation.contactList ?? null,
      totalSent: automation.totalSent,
      lastTriggered: automation.lastTriggered?.toISOString() || null,
      logsCount: automation._count.logs,
      createdAt: automation.createdAt.toISOString(),
      updatedAt: automation.updatedAt.toISOString(),
    }));

    const payload: AutomationListResponse = {
      automations: formattedAutomations,
      stats: {
        total: totalAutomations,
        active: activeCount,
        totalSent,
      },
    };

    return NextResponse.json<ApiResponse<AutomationListResponse>>({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error("Get automations error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch automations" } },
      { status: 500 }
    );
  }
}

// POST /api/automations - Create a new automation
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
      name,
      type,
      trigger,
      campaignType,
      subject,
      content,
      contentHtml,
      sendTime,
      daysOffset,
      timezone,
      contactListId,
      enabled,
      imageUrl,
      imageSource,
      imageOverlayText,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Automation name is required" } },
        { status: 400 }
      );
    }

    if (!type || !VALID_TYPES.includes(type.toUpperCase())) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Invalid automation type. Must be one of: ${VALID_TYPES.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    if (!campaignType || !VALID_CAMPAIGN_TYPES.includes(campaignType.toUpperCase())) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Campaign type must be EMAIL or SMS" },
        },
        { status: 400 }
      );
    }

    let normalizedTrigger: Record<string, unknown>;
    let normalizedDaysOffset: number;
    try {
      normalizedTrigger = normalizeTrigger(type.toUpperCase(), trigger);
      normalizedDaysOffset = normalizeDaysOffset(daysOffset);
    } catch (err) {
      return NextResponse.json(
        { success: false, error: { message: err instanceof Error ? err.message : "Invalid automation settings" } },
        { status: 400 }
      );
    }

    if (sendTime !== undefined && !isValidTime(sendTime)) {
      return NextResponse.json(
        { success: false, error: { message: "Send time must use HH:mm format" } },
        { status: 400 }
      );
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Automation content is required" } },
        { status: 400 }
      );
    }

    // Validate contact list if provided
    if (contactListId) {
      const contactList = await prisma.contactList.findFirst({
        where: { id: contactListId, userId: session.userId },
      });

      if (!contactList) {
        return NextResponse.json(
          { success: false, error: { message: "Contact list not found" } },
          { status: 404 }
        );
      }
    }

    // Serialize trigger to JSON string
    const triggerString = JSON.stringify(normalizedTrigger);

    const automation = await prisma.automation.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        type: type.toUpperCase(),
        trigger: triggerString,
        campaignType: campaignType.toUpperCase(),
        subject: subject || null,
        content: content || "",
        contentHtml: contentHtml || null,
        sendTime: sendTime || "09:00",
        daysOffset: normalizedDaysOffset,
        timezone: timezone || "UTC",
        contactListId: contactListId || null,
        imageUrl: imageUrl || null,
        imageSource: imageSource || null,
        imageOverlayText: imageOverlayText || null,
        enabled: enabled === true,
      },
      include: {
        contactList: {
          select: {
            id: true,
            name: true,
            totalCount: true,
          },
        },
      },
    });

    const payload: CreateAutomationResponse = {
      automation: {
        id: automation.id,
        name: automation.name,
        type: automation.type as AutomationType,
        trigger: ((): AutomationTrigger => {
          try {
            return JSON.parse(automation.trigger) as AutomationTrigger;
          } catch {
            return {};
          }
        })(),
        enabled: automation.enabled,
        campaignType: automation.campaignType as AutomationCampaignType,
        subject: automation.subject,
        content: automation.content,
        contentHtml: automation.contentHtml,
        sendTime: automation.sendTime,
        daysOffset: automation.daysOffset,
        timezone: automation.timezone,
        contactListId: automation.contactListId,
        contactList: automation.contactList ?? null,
        totalSent: automation.totalSent,
        lastTriggered: automation.lastTriggered?.toISOString() || null,
        createdAt: automation.createdAt.toISOString(),
        updatedAt: automation.updatedAt.toISOString(),
      },
    };

    return NextResponse.json<ApiResponse<CreateAutomationResponse>>({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error("Create automation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create automation" } },
      { status: 500 }
    );
  }
}
