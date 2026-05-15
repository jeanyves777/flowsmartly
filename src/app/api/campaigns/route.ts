import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import type {
  CampaignListResponse,
  CampaignResponse,
  CampaignStatus,
  CampaignType,
  CreateCampaignResponse,
} from "@/api/contracts/campaigns";
import type { ApiResponse } from "@/api/contracts/common";
import { getSmsReadiness } from "@/lib/sms/readiness";

const VALID_CAMPAIGN_TYPES = new Set(["EMAIL", "SMS"]);
const VALID_CAMPAIGN_STATUSES = new Set([
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "SENDING",
  "SENT",
  "PAUSED",
  "FAILED",
]);

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseFutureDate(value: unknown, fieldName: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  if (date <= new Date()) {
    throw new Error(`${fieldName} must be in the future`);
  }
  return date;
}

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
    const search = (searchParams.get("search") || "").trim();
    const page = parsePositiveInt(searchParams.get("page"), 1, 100000);
    const limit = parsePositiveInt(searchParams.get("limit"), 20, 100);

    const where: Record<string, unknown> = {
      userId: session.userId,
    };

    if (type && type !== "all") {
      const normalizedType = type.toUpperCase();
      if (!VALID_CAMPAIGN_TYPES.has(normalizedType)) {
        return NextResponse.json(
          { success: false, error: { message: "Invalid campaign type" } },
          { status: 400 }
        );
      }
      where.type = normalizedType;
    }

    if (status && status !== "all") {
      const normalizedStatus = status.toUpperCase();
      if (!VALID_CAMPAIGN_STATUSES.has(normalizedStatus)) {
        return NextResponse.json(
          { success: false, error: { message: "Invalid campaign status" } },
          { status: 400 }
        );
      }
      where.status = normalizedStatus;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { subject: { contains: search } },
      ];
    }

    const statsWhere = { ...where };
    delete statsWhere.status;

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
      prisma.campaign.count({ where: statsWhere }),
      prisma.campaign.count({ where: { ...statsWhere, status: "ACTIVE" } }),
      prisma.campaign.count({ where: { ...statsWhere, status: "SENT" } }),
      prisma.campaign.count({ where: { ...statsWhere, status: "DRAFT" } }),
    ]);

    // Calculate average open rate
    const sentCampaignsData = await prisma.campaign.findMany({
      where: { ...statsWhere, status: "SENT", sentCount: { gt: 0 } },
      select: { sentCount: true, openCount: true },
    });

    const totalSent = sentCampaignsData.reduce((sum, c) => sum + c.sentCount, 0);
    const totalOpened = sentCampaignsData.reduce((sum, c) => sum + c.openCount, 0);
    const avgOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

    const formattedCampaigns: CampaignResponse[] = campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      type: campaign.type.toLowerCase() as CampaignType,
      status: campaign.status.toLowerCase() as CampaignStatus,
      subject: campaign.subject,
      audience: campaign.contactList?.totalCount || 0,
      sent: campaign.sentCount,
      delivered: campaign.deliveredCount,
      failed: campaign.failedCount,
      opened: campaign.openCount,
      clicked: campaign.clickCount,
      bounced: campaign.bounceCount,
      unsubscribed: campaign.unsubCount,
      messageLength: campaign.type === "SMS" ? campaign.content.length : undefined,
      segments: campaign.type === "SMS" ? Math.max(1, Math.ceil(campaign.content.length / 160)) : undefined,
      openRate:
        campaign.sentCount > 0
          ? Math.round((campaign.openCount / campaign.sentCount) * 100)
          : 0,
      clickRate:
        campaign.openCount > 0
          ? Math.round((campaign.clickCount / campaign.openCount) * 100)
          : 0,
      contactList: campaign.contactList ?? null,
      scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
      sentAt: campaign.sentAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    }));

    const payload: CampaignListResponse = {
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
    };

    return NextResponse.json<ApiResponse<CampaignListResponse>>({
      success: true,
      data: payload,
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
      sectionsJson,
      templateId,
      contactListId,
      customRecipients,
      excludedRecipients,
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

    const normalizedType = typeof type === "string" ? type.toUpperCase() : "";
    if (!VALID_CAMPAIGN_TYPES.has(normalizedType)) {
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

    // Block SMS campaign creation until compliance, number, and carrier registration are complete.
    if (normalizedType === "SMS") {
      const readiness = await getSmsReadiness(session.userId);
      if (!readiness.ready) {
        return NextResponse.json(
          { success: false, error: { message: readiness.reason || "SMS setup must be completed before creating campaigns." } },
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

    let parsedScheduledAt: Date | null = null;
    try {
      parsedScheduledAt = parseFutureDate(scheduledAt, "Scheduled time");
    } catch (err) {
      return NextResponse.json(
        { success: false, error: { message: err instanceof Error ? err.message : "Invalid scheduled time" } },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        type: normalizedType,
        subject,
        preheaderText,
        fromName,
        replyTo,
        content,
        contentHtml,
        sectionsJson: sectionsJson || null,
        templateId: templateId || null,
        customRecipients: customRecipients || null,
        excludedRecipients: excludedRecipients || null,
        imageUrl: imageUrl || null,
        imageSource: imageSource || null,
        imageOverlayText: imageOverlayText || null,
        contactListId: contactListId || null,
        status: parsedScheduledAt ? "SCHEDULED" : "DRAFT",
        scheduledAt: parsedScheduledAt,
      },
    });

    const payload: CreateCampaignResponse = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type.toLowerCase() as CampaignType,
        status: campaign.status.toLowerCase() as CampaignStatus,
        createdAt: campaign.createdAt.toISOString(),
      },
    };

    return NextResponse.json<ApiResponse<CreateCampaignResponse>>({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create campaign" } },
      { status: 500 }
    );
  }
}
