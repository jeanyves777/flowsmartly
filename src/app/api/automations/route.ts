import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const VALID_TYPES = ["BIRTHDAY", "HOLIDAY", "WELCOME", "RE_ENGAGEMENT", "CUSTOM", "TRIAL_ENDING", "PAYMENT_FAILED", "ABANDONED_CART", "INACTIVITY", "ANNIVERSARY", "SUBSCRIPTION_CHANGE"];
const VALID_CAMPAIGN_TYPES = ["EMAIL", "SMS"];

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

    const formattedAutomations = automations.map((automation) => ({
      id: automation.id,
      name: automation.name,
      type: automation.type,
      trigger: (() => {
        try {
          return JSON.parse(automation.trigger);
        } catch {
          return {};
        }
      })(),
      enabled: automation.enabled,
      campaignType: automation.campaignType,
      subject: automation.subject,
      content: automation.content,
      contentHtml: automation.contentHtml,
      sendTime: automation.sendTime,
      daysOffset: automation.daysOffset,
      timezone: automation.timezone,
      contactListId: automation.contactListId,
      contactList: automation.contactList,
      totalSent: automation.totalSent,
      lastTriggered: automation.lastTriggered?.toISOString() || null,
      logsCount: automation._count.logs,
      createdAt: automation.createdAt.toISOString(),
      updatedAt: automation.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        automations: formattedAutomations,
        stats: {
          total: totalAutomations,
          active: activeCount,
          totalSent,
        },
      },
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

    // For HOLIDAY type, trigger must contain holidayId
    if (type.toUpperCase() === "HOLIDAY") {
      const triggerObj = typeof trigger === "object" ? trigger : {};
      if (!triggerObj?.holidayId) {
        return NextResponse.json(
          {
            success: false,
            error: { message: "Holiday automations require a holidayId in the trigger" },
          },
          { status: 400 }
        );
      }
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
    const triggerString =
      trigger && typeof trigger === "object"
        ? JSON.stringify(trigger)
        : trigger || "{}";

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
        daysOffset: daysOffset !== undefined ? parseInt(String(daysOffset), 10) : 0,
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

    return NextResponse.json({
      success: true,
      data: {
        automation: {
          id: automation.id,
          name: automation.name,
          type: automation.type,
          trigger: (() => {
            try {
              return JSON.parse(automation.trigger);
            } catch {
              return {};
            }
          })(),
          enabled: automation.enabled,
          campaignType: automation.campaignType,
          subject: automation.subject,
          content: automation.content,
          contentHtml: automation.contentHtml,
          sendTime: automation.sendTime,
          daysOffset: automation.daysOffset,
          timezone: automation.timezone,
          contactListId: automation.contactListId,
          contactList: automation.contactList,
          totalSent: automation.totalSent,
          lastTriggered: automation.lastTriggered?.toISOString() || null,
          createdAt: automation.createdAt.toISOString(),
          updatedAt: automation.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Create automation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create automation" } },
      { status: 500 }
    );
  }
}
