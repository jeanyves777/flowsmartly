import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const VALID_CAMPAIGN_STATUSES = new Set([
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "SENDING",
  "SENT",
  "PAUSED",
  "FAILED",
]);

function parseOptionalSchedule(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new Error("Scheduled time must be a valid date");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Scheduled time must be a valid date");
  }
  if (date <= new Date()) {
    throw new Error("Scheduled time must be in the future");
  }
  return date;
}

// GET /api/campaigns/[campaignId] - Get a single campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId: session.userId },
      include: {
        contactList: {
          select: {
            id: true,
            name: true,
            totalCount: true,
            activeCount: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          type: campaign.type.toLowerCase(),
          status: campaign.status.toLowerCase(),
          subject: campaign.subject,
          preheaderText: campaign.preheaderText,
          fromName: campaign.fromName,
          replyTo: campaign.replyTo,
          content: campaign.content,
          contentHtml: campaign.contentHtml,
          contactList: campaign.contactList,
          sent: campaign.sentCount,
          delivered: campaign.deliveredCount,
          failed: campaign.failedCount,
          opened: campaign.openCount,
          clicked: campaign.clickCount,
          bounced: campaign.bounceCount,
          unsubscribed: campaign.unsubCount,
          templateId: campaign.templateId,
          sectionsJson: campaign.sectionsJson,
          contactListId: campaign.contactListId,
          customRecipients: campaign.customRecipients,
          excludedRecipients: campaign.excludedRecipients,
          imageUrl: campaign.imageUrl,
          imageSource: campaign.imageSource,
          imageOverlayText: campaign.imageOverlayText,
          scheduledAt: campaign.scheduledAt?.toISOString(),
          sentAt: campaign.sentAt?.toISOString(),
          createdAt: campaign.createdAt.toISOString(),
          updatedAt: campaign.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Get campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch campaign" } },
      { status: 500 }
    );
  }
}

// PATCH /api/campaigns/[campaignId] - Update a campaign
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId: session.userId },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign not found" } },
        { status: 404 }
      );
    }

    // Cannot edit sent campaigns
    if (campaign.status === "SENT") {
      return NextResponse.json(
        { success: false, error: { message: "Cannot edit sent campaigns" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      subject,
      preheaderText,
      fromName,
      replyTo,
      content,
      contentHtml,
      contactListId,
      templateId,
      sectionsJson,
      customRecipients,
      excludedRecipients,
      scheduledAt,
      status,
      imageUrl,
      imageSource,
      imageOverlayText,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return NextResponse.json(
          { success: false, error: { message: "Campaign name is required" } },
          { status: 400 }
        );
      }
      updateData.name = String(name).trim();
    }
    if (subject !== undefined) updateData.subject = subject;
    if (preheaderText !== undefined) updateData.preheaderText = preheaderText;
    if (fromName !== undefined) updateData.fromName = fromName;
    if (replyTo !== undefined) updateData.replyTo = replyTo;
    if (content !== undefined) {
      if (!String(content).trim()) {
        return NextResponse.json(
          { success: false, error: { message: "Content is required" } },
          { status: 400 }
        );
      }
      updateData.content = content;
    }
    if (contentHtml !== undefined) updateData.contentHtml = contentHtml;
    if (sectionsJson !== undefined) updateData.sectionsJson = sectionsJson;
    if (contactListId !== undefined) {
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
      updateData.contactListId = contactListId || null;
    }
    if (templateId !== undefined) {
      if (templateId) {
        const template = await prisma.emailTemplate.findFirst({
          where: {
            id: templateId,
            OR: [{ userId: session.userId }, { isDefault: true }],
          },
        });

        if (!template) {
          return NextResponse.json(
            { success: false, error: { message: "Email template not found" } },
            { status: 404 }
          );
        }
      }
      updateData.templateId = templateId || null;
    }
    if (customRecipients !== undefined) updateData.customRecipients = customRecipients;
    if (excludedRecipients !== undefined) updateData.excludedRecipients = excludedRecipients;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (imageSource !== undefined) updateData.imageSource = imageSource;
    if (imageOverlayText !== undefined) updateData.imageOverlayText = imageOverlayText;
    if (scheduledAt !== undefined) {
      let parsedScheduledAt: Date | null = null;
      try {
        parsedScheduledAt = parseOptionalSchedule(scheduledAt);
      } catch (err) {
        return NextResponse.json(
          { success: false, error: { message: err instanceof Error ? err.message : "Invalid scheduled time" } },
          { status: 400 }
        );
      }
      updateData.scheduledAt = parsedScheduledAt;
      if (parsedScheduledAt && campaign.status === "DRAFT") {
        updateData.status = "SCHEDULED";
      }
    }
    if (status !== undefined) {
      const normalizedStatus = String(status).toUpperCase();
      if (!VALID_CAMPAIGN_STATUSES.has(normalizedStatus)) {
        return NextResponse.json(
          { success: false, error: { message: "Invalid campaign status" } },
          { status: 400 }
        );
      }
      updateData.status = normalizedStatus;
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        campaign: {
          id: updatedCampaign.id,
          name: updatedCampaign.name,
          status: updatedCampaign.status.toLowerCase(),
          updatedAt: updatedCampaign.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Update campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update campaign" } },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns/[campaignId] - Delete a campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId: session.userId },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign not found" } },
        { status: 404 }
      );
    }

    // Cannot delete active or sent campaigns
    if (["ACTIVE", "SENT"].includes(campaign.status)) {
      return NextResponse.json(
        { success: false, error: { message: "Cannot delete active or sent campaigns" } },
        { status: 400 }
      );
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Campaign deleted successfully" },
    });
  } catch (error) {
    console.error("Delete campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete campaign" } },
      { status: 500 }
    );
  }
}
