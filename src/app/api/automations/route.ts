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
import { getHolidayById } from "@/lib/marketing/holidays";

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
    const holidayIds = getHolidayIds(triggerObj);
    if (holidayIds.length === 1) {
      triggerObj.holidayId = holidayIds[0];
    } else {
      throw new Error("Holiday automations require a holidayId in the trigger");
    }
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

function getHolidayIds(triggerObj: Record<string, unknown>) {
  const rawIds = Array.isArray(triggerObj.holidayIds)
    ? triggerObj.holidayIds
    : Array.isArray(triggerObj.selectedHolidayIds)
      ? triggerObj.selectedHolidayIds
      : typeof triggerObj.holidayId === "string"
        ? [triggerObj.holidayId]
        : [];

  return [...new Set(rawIds.filter((id): id is string => typeof id === "string" && !!id.trim()))];
}

function singleHolidayTrigger(triggerObj: Record<string, unknown>, holidayId: string, selectedCount: number) {
  const next: Record<string, unknown> = {
    ...triggerObj,
    holidayId,
    selectedHolidayCount: selectedCount,
  };
  delete next.holidayIds;
  delete next.selectedHolidayIds;
  return next;
}

function formatAutomationResponse(automation: {
  id: string;
  name: string;
  type: string;
  trigger: string;
  enabled: boolean;
  campaignType: string;
  templateId: string | null;
  subject: string | null;
  content: string;
  contentHtml: string | null;
  imageUrl?: string | null;
  imageSource?: string | null;
  imageOverlayText?: string | null;
  sendTime: string;
  daysOffset: number;
  timezone: string;
  contactListId: string | null;
  contactList: { id: string; name: string; totalCount: number } | null;
  totalSent: number;
  lastTriggered: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { logs: number };
}): AutomationResponse {
  return {
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
    templateId: automation.templateId,
    subject: automation.subject,
    content: automation.content,
    contentHtml: automation.contentHtml,
    imageUrl: automation.imageUrl ?? null,
    imageSource: automation.imageSource ?? null,
    imageOverlayText: automation.imageOverlayText ?? null,
    sendTime: automation.sendTime,
    daysOffset: automation.daysOffset,
    timezone: automation.timezone,
    contactListId: automation.contactListId,
    contactList: automation.contactList ?? null,
    totalSent: automation.totalSent,
    lastTriggered: automation.lastTriggered?.toISOString() || null,
    logsCount: automation._count?.logs,
    createdAt: automation.createdAt.toISOString(),
    updatedAt: automation.updatedAt.toISOString(),
  };
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

    const formattedAutomations: AutomationResponse[] = automations.map(formatAutomationResponse);

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
      templateId,
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
      emails,
    } = body;

    const perEventEmails = Array.isArray(emails)
      ? (emails as Array<{
          holidayId?: string;
          subject?: string;
          content?: string;
          contentHtml?: string;
        }>).filter((entry) => entry && typeof entry === "object")
      : [];

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

    let normalizedTriggers: Record<string, unknown>[];
    let normalizedDaysOffset: number;
    const typeUpper = type.toUpperCase();
    try {
      const triggerObj = trigger && typeof trigger === "object" && !Array.isArray(trigger)
        ? { ...(trigger as Record<string, unknown>) }
        : {};
      if (typeUpper === "HOLIDAY") {
        const holidayIds = getHolidayIds(triggerObj);
        for (const holidayId of holidayIds) {
          if (!getHolidayById(holidayId)) {
            throw new Error(`Unknown holiday selected: ${holidayId}`);
          }
        }
        normalizedTriggers = holidayIds.length > 1 || (holidayIds.length === 1 && !triggerObj.holidayId)
          ? holidayIds.map((holidayId) =>
              normalizeTrigger(typeUpper, singleHolidayTrigger(triggerObj, holidayId, holidayIds.length))
            )
          : [normalizeTrigger(typeUpper, trigger)];
      } else {
        normalizedTriggers = [normalizeTrigger(typeUpper, trigger)];
      }
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

    let validatedTemplateId: string | null = null;
    if (templateId) {
      const template = await prisma.emailTemplate.findFirst({
        where: {
          id: templateId,
          OR: [{ userId: session.userId }, { isDefault: true }],
        },
        select: { id: true },
      });

      if (!template) {
        return NextResponse.json(
          { success: false, error: { message: "Email template not found" } },
          { status: 404 }
        );
      }
      validatedTemplateId = template.id;
    }

    const baseName = name.trim();
    const emailOverridesByHolidayId = new Map<string, { subject?: string; content?: string; contentHtml?: string }>();
    let fallbackEmailOverride: { subject?: string; content?: string; contentHtml?: string } | null = null;
    for (const entry of perEventEmails) {
      if (typeof entry.holidayId === "string" && entry.holidayId.trim()) {
        emailOverridesByHolidayId.set(entry.holidayId, entry);
      } else if (!fallbackEmailOverride) {
        fallbackEmailOverride = entry;
      }
    }

    const createInputs = normalizedTriggers.map((normalizedTrigger) => {
      const holidayId = typeof normalizedTrigger.holidayId === "string" ? normalizedTrigger.holidayId : null;
      const holiday = holidayId ? getHolidayById(holidayId) : null;
      const override =
        (holidayId && emailOverridesByHolidayId.get(holidayId)) || fallbackEmailOverride || {};
      const finalSubject = (override.subject ?? subject) || null;
      const finalContent = override.content ?? content ?? "";
      const finalContentHtml = override.contentHtml ?? contentHtml ?? null;
      return {
        userId: session.userId,
        name: normalizedTriggers.length > 1 && holiday ? `${baseName} - ${holiday.name}` : baseName,
        type: typeUpper,
        trigger: JSON.stringify(normalizedTrigger),
        campaignType: campaignType.toUpperCase(),
        templateId: validatedTemplateId,
        subject: finalSubject,
        content: finalContent,
        contentHtml: finalContentHtml,
        sendTime: sendTime || "09:00",
        daysOffset: normalizedDaysOffset,
        timezone: timezone || "UTC",
        contactListId: contactListId || null,
        imageUrl: imageUrl || null,
        imageSource: imageSource || null,
        imageOverlayText: imageOverlayText || null,
        enabled: enabled === true,
      };
    });

    const createdAutomations = await prisma.$transaction(
      createInputs.map((data) =>
        prisma.automation.create({
          data,
          include: {
            contactList: {
              select: {
                id: true,
                name: true,
                totalCount: true,
              },
            },
          },
        })
      )
    );

    const payload: CreateAutomationResponse = {
      automation: formatAutomationResponse(createdAutomations[0]),
      automations: createdAutomations.map(formatAutomationResponse),
      createdCount: createdAutomations.length,
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
