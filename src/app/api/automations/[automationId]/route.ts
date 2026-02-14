import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const VALID_TYPES = ["BIRTHDAY", "HOLIDAY", "WELCOME", "RE_ENGAGEMENT", "CUSTOM"];
const VALID_CAMPAIGN_TYPES = ["EMAIL", "SMS"];

// GET /api/automations/[automationId] - Get a single automation with stats, paginated logs, contact enrichment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const { automationId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const logLimit = Math.min(
      parseInt(request.nextUrl.searchParams.get("logLimit") || "50", 10),
      200
    );
    const logOffset = parseInt(
      request.nextUrl.searchParams.get("logOffset") || "0",
      10
    );

    // Fetch automation + stats + paginated logs in parallel
    const [automation, statusGroups, totalLogs] = await Promise.all([
      prisma.automation.findFirst({
        where: { id: automationId, userId: session.userId },
        include: {
          contactList: {
            select: { id: true, name: true, totalCount: true },
          },
        },
      }),
      prisma.automationLog.groupBy({
        by: ["status"],
        _count: true,
        where: { automationId },
      }),
      prisma.automationLog.count({ where: { automationId } }),
    ]);

    if (!automation) {
      return NextResponse.json(
        { success: false, error: { message: "Automation not found" } },
        { status: 404 }
      );
    }

    // Fetch paginated logs
    const logs = await prisma.automationLog.findMany({
      where: { automationId },
      orderBy: { sentAt: "desc" },
      take: logLimit,
      skip: logOffset,
    });

    // Enrich logs with contact names
    const contactIds = [
      ...new Set(logs.map((l) => l.contactId).filter(Boolean) as string[]),
    ];
    const contacts =
      contactIds.length > 0
        ? await prisma.contact.findMany({
            where: { id: { in: contactIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          })
        : [];
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    // Build stats
    const sent =
      statusGroups.find((g) => g.status === "SENT")?._count ?? 0;
    const failed =
      statusGroups.find((g) => g.status === "FAILED")?._count ?? 0;
    const skipped =
      statusGroups.find((g) => g.status === "SKIPPED")?._count ?? 0;
    const totalAttempted = sent + failed + skipped;

    const calcRate = (n: number, d: number) =>
      d === 0 ? 0 : Math.round((n / d) * 1000) / 10;

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
          stats: {
            totalAttempted,
            sent,
            failed,
            skipped,
            successRate: calcRate(sent, totalAttempted),
            failureRate: calcRate(failed, totalAttempted),
            skipRate: calcRate(skipped, totalAttempted),
          },
          logs: logs.map((log) => {
            const contact = log.contactId
              ? contactMap.get(log.contactId)
              : null;
            return {
              id: log.id,
              contactId: log.contactId,
              status: log.status,
              error: log.error,
              sentAt: log.sentAt.toISOString(),
              contactName: contact
                ? [contact.firstName, contact.lastName]
                    .filter(Boolean)
                    .join(" ") || null
                : null,
              contactEmail: contact?.email || null,
              contactPhone: contact?.phone || null,
            };
          }),
          totalLogs,
          createdAt: automation.createdAt.toISOString(),
          updatedAt: automation.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Get automation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch automation" } },
      { status: 500 }
    );
  }
}

// PATCH /api/automations/[automationId] - Update an automation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const { automationId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const automation = await prisma.automation.findFirst({
      where: { id: automationId, userId: session.userId },
    });

    if (!automation) {
      return NextResponse.json(
        { success: false, error: { message: "Automation not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      type,
      trigger,
      enabled,
      campaignType,
      subject,
      content,
      contentHtml,
      sendTime,
      daysOffset,
      timezone,
      contactListId,
      imageUrl,
      imageSource,
      imageOverlayText,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name.trim();

    if (type !== undefined) {
      if (!VALID_TYPES.includes(type.toUpperCase())) {
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
      updateData.type = type.toUpperCase();
    }

    if (trigger !== undefined) {
      updateData.trigger =
        trigger && typeof trigger === "object"
          ? JSON.stringify(trigger)
          : trigger || "{}";
    }

    if (enabled !== undefined) updateData.enabled = enabled === true;

    if (campaignType !== undefined) {
      if (!VALID_CAMPAIGN_TYPES.includes(campaignType.toUpperCase())) {
        return NextResponse.json(
          {
            success: false,
            error: { message: "Campaign type must be EMAIL or SMS" },
          },
          { status: 400 }
        );
      }
      updateData.campaignType = campaignType.toUpperCase();
    }

    if (subject !== undefined) updateData.subject = subject;
    if (content !== undefined) updateData.content = content;
    if (contentHtml !== undefined) updateData.contentHtml = contentHtml;
    if (sendTime !== undefined) updateData.sendTime = sendTime;
    if (daysOffset !== undefined) updateData.daysOffset = parseInt(String(daysOffset), 10);
    if (timezone !== undefined) updateData.timezone = timezone;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
    if (imageSource !== undefined) updateData.imageSource = imageSource || null;
    if (imageOverlayText !== undefined) updateData.imageOverlayText = imageOverlayText || null;

    if (contactListId !== undefined) {
      if (contactListId !== null) {
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
      updateData.contactListId = contactListId;
    }

    const updatedAutomation = await prisma.automation.update({
      where: { id: automationId },
      data: updateData,
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
          id: updatedAutomation.id,
          name: updatedAutomation.name,
          type: updatedAutomation.type,
          trigger: (() => {
            try {
              return JSON.parse(updatedAutomation.trigger);
            } catch {
              return {};
            }
          })(),
          enabled: updatedAutomation.enabled,
          campaignType: updatedAutomation.campaignType,
          subject: updatedAutomation.subject,
          content: updatedAutomation.content,
          contentHtml: updatedAutomation.contentHtml,
          sendTime: updatedAutomation.sendTime,
          daysOffset: updatedAutomation.daysOffset,
          timezone: updatedAutomation.timezone,
          contactListId: updatedAutomation.contactListId,
          contactList: updatedAutomation.contactList,
          totalSent: updatedAutomation.totalSent,
          lastTriggered: updatedAutomation.lastTriggered?.toISOString() || null,
          createdAt: updatedAutomation.createdAt.toISOString(),
          updatedAt: updatedAutomation.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Update automation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update automation" } },
      { status: 500 }
    );
  }
}

// DELETE /api/automations/[automationId] - Delete an automation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const { automationId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const automation = await prisma.automation.findFirst({
      where: { id: automationId, userId: session.userId },
    });

    if (!automation) {
      return NextResponse.json(
        { success: false, error: { message: "Automation not found" } },
        { status: 404 }
      );
    }

    await prisma.automation.delete({
      where: { id: automationId },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Automation deleted successfully" },
    });
  } catch (error) {
    console.error("Delete automation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete automation" } },
      { status: 500 }
    );
  }
}
