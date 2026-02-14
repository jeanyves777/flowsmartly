import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/marketing/email - Get all email campaigns (admin view)
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {
      type: "EMAIL",
    };

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
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
            },
          },
          contactList: {
            select: {
              id: true,
              name: true,
              totalCount: true,
            },
          },
          _count: {
            select: {
              sends: true,
            },
          },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    // Get overall stats
    const [totalCampaigns, sentCampaigns, totalSent, totalOpened, totalClicked] = await Promise.all([
      prisma.campaign.count({ where: { type: "EMAIL" } }),
      prisma.campaign.count({ where: { type: "EMAIL", status: "SENT" } }),
      prisma.campaign.aggregate({
        where: { type: "EMAIL" },
        _sum: { sentCount: true },
      }),
      prisma.campaign.aggregate({
        where: { type: "EMAIL" },
        _sum: { openCount: true },
      }),
      prisma.campaign.aggregate({
        where: { type: "EMAIL" },
        _sum: { clickCount: true },
      }),
    ]);

    const totalSentCount = totalSent._sum.sentCount || 0;
    const totalOpenedCount = totalOpened._sum.openCount || 0;
    const totalClickedCount = totalClicked._sum.clickCount || 0;

    const formattedCampaigns = campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      status: campaign.status.toLowerCase(),
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      openCount: campaign.openCount,
      clickCount: campaign.clickCount,
      bounceCount: campaign.bounceCount,
      unsubCount: campaign.unsubCount,
      openRate: campaign.sentCount > 0
        ? Math.round((campaign.openCount / campaign.sentCount) * 100 * 10) / 10
        : 0,
      clickRate: campaign.openCount > 0
        ? Math.round((campaign.clickCount / campaign.openCount) * 100 * 10) / 10
        : 0,
      scheduledAt: campaign.scheduledAt?.toISOString(),
      sentAt: campaign.sentAt?.toISOString(),
      createdAt: campaign.createdAt.toISOString(),
      user: campaign.user,
      contactList: campaign.contactList,
      recipientCount: campaign._count.sends,
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
          sent: sentCampaigns,
          totalEmailsSent: totalSentCount,
          totalOpened: totalOpenedCount,
          totalClicked: totalClickedCount,
          avgOpenRate: totalSentCount > 0
            ? Math.round((totalOpenedCount / totalSentCount) * 100 * 10) / 10
            : 0,
          avgClickRate: totalOpenedCount > 0
            ? Math.round((totalClickedCount / totalOpenedCount) * 100 * 10) / 10
            : 0,
        },
      },
    });
  } catch (error) {
    console.error("Get admin email campaigns error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch email campaigns" } },
      { status: 500 }
    );
  }
}
