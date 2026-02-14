import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

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
      scheduledAt,
      status,
      imageUrl,
      imageSource,
      imageOverlayText,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (subject !== undefined) updateData.subject = subject;
    if (preheaderText !== undefined) updateData.preheaderText = preheaderText;
    if (fromName !== undefined) updateData.fromName = fromName;
    if (replyTo !== undefined) updateData.replyTo = replyTo;
    if (content !== undefined) updateData.content = content;
    if (contentHtml !== undefined) updateData.contentHtml = contentHtml;
    if (contactListId !== undefined) updateData.contactListId = contactListId;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (imageSource !== undefined) updateData.imageSource = imageSource;
    if (imageOverlayText !== undefined) updateData.imageOverlayText = imageOverlayText;
    if (scheduledAt !== undefined) {
      updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      if (scheduledAt && campaign.status === "DRAFT") {
        updateData.status = "SCHEDULED";
      }
    }
    if (status !== undefined) {
      updateData.status = status.toUpperCase();
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
