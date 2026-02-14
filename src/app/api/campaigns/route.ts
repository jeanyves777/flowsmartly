import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/campaigns - Get user's campaigns
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
    const type = searchParams.get("type"); // email, sms
    const status = searchParams.get("status");
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {
      userId: session.userId,
    };

    if (type && type !== "all") {
      where.type = type.toUpperCase();
    }

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { subject: { contains: search } },
      ];
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contactList: {
            select: {
              id: true,
              name: true,
              totalCount: true,
            },
          },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    // Get stats
    const [totalCampaigns, activeCampaigns, sentCampaigns, draftCampaigns] = await Promise.all([
      prisma.campaign.count({ where: { userId: session.userId } }),
      prisma.campaign.count({ where: { userId: session.userId, status: "ACTIVE" } }),
      prisma.campaign.count({ where: { userId: session.userId, status: "SENT" } }),
      prisma.campaign.count({ where: { userId: session.userId, status: "DRAFT" } }),
    ]);

    // Calculate average open rate
    const sentCampaignsData = await prisma.campaign.findMany({
      where: { userId: session.userId, status: "SENT", sentCount: { gt: 0 } },
      select: { sentCount: true, openCount: true },
    });

    const totalSent = sentCampaignsData.reduce((sum, c) => sum + c.sentCount, 0);
    const totalOpened = sentCampaignsData.reduce((sum, c) => sum + c.openCount, 0);
    const avgOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

    const formattedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      type: campaign.type.toLowerCase(),
      status: campaign.status.toLowerCase(),
      subject: campaign.subject,
      audience: campaign.contactList?.totalCount || 0,
      sent: campaign.sentCount,
      delivered: campaign.deliveredCount,
      failed: campaign.failedCount,
      opened: campaign.openCount,
      clicked: campaign.clickCount,
      bounced: campaign.bounceCount,
      unsubscribed: campaign.unsubCount,
      openRate: campaign.sentCount > 0 ? Math.round((campaign.openCount / campaign.sentCount) * 100) : 0,
      clickRate: campaign.openCount > 0 ? Math.round((campaign.clickCount / campaign.openCount) * 100) : 0,
      contactList: campaign.contactList,
      scheduledAt: campaign.scheduledAt?.toISOString(),
      sentAt: campaign.sentAt?.toISOString(),
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        campaigns: formattedCampaigns,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        stats: {
          total: totalCampaigns,
          active: activeCampaigns,
          sent: sentCampaigns,
          draft: draftCampaigns,
          avgOpenRate,
        },
      },
    });
  } catch (error) {
    console.error("Get campaigns error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch campaigns" } },
      { status: 500 }
    );
  }
}

// POST /api/campaigns - Create a new campaign
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
      subject,
      preheaderText,
      fromName,
      replyTo,
      content,
      contentHtml,
      contactListId,
      scheduledAt,
      imageUrl,
      imageSource,
      imageOverlayText,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign name is required" } },
        { status: 400 }
      );
    }

    if (!type || !["EMAIL", "SMS"].includes(type.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid campaign type" } },
        { status: 400 }
      );
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Content is required" } },
        { status: 400 }
      );
    }

    // Block SMS campaign creation when toll-free verification is not approved
    if (type.toUpperCase() === "SMS") {
      const smsConfig = await prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: {
          smsEnabled: true,
          smsPhoneNumber: true,
          smsTollfreeVerifyStatus: true,
        },
      });

      if (!smsConfig?.smsEnabled || !smsConfig.smsPhoneNumber) {
        return NextResponse.json(
          { success: false, error: { message: "SMS is not configured. Rent a phone number first." } },
          { status: 400 }
        );
      }

      if (smsConfig.smsTollfreeVerifyStatus && smsConfig.smsTollfreeVerifyStatus !== "TWILIO_APPROVED") {
        const msg = smsConfig.smsTollfreeVerifyStatus === "TWILIO_REJECTED"
          ? "Your toll-free number verification was rejected. You cannot create SMS campaigns until this is resolved."
          : "Your toll-free number is still under carrier review. You can create SMS campaigns once verification is approved (typically 1-5 business days).";
        return NextResponse.json(
          { success: false, error: { message: msg } },
          { status: 403 }
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

    const campaign = await prisma.campaign.create({
      data: {
        userId: session.userId,
        name,
        type: type.toUpperCase(),
        subject,
        preheaderText,
        fromName,
        replyTo,
        content,
        contentHtml,
        imageUrl: imageUrl || null,
        imageSource: imageSource || null,
        imageOverlayText: imageOverlayText || null,
        contactListId,
        status: scheduledAt ? "SCHEDULED" : "DRAFT",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          type: campaign.type.toLowerCase(),
          status: campaign.status.toLowerCase(),
          createdAt: campaign.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create campaign" } },
      { status: 500 }
    );
  }
}
