import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const type = searchParams.get("type") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.name = { contains: search };
    }

    if (status !== "all") {
      where.status = status.toUpperCase();
    }

    if (type !== "all") {
      where.type = type.toUpperCase();
    }

    // Get date ranges for stats
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch campaigns with user info
    const [campaigns, total, stats] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
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
      // Get stats
      Promise.all([
        prisma.campaign.count(),
        prisma.campaign.count({ where: { status: "ACTIVE" } }),
        prisma.campaign.count({ where: { status: "SENT" } }),
        prisma.campaign.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        // Total reach (sum of sentCount)
        prisma.campaign.aggregate({ _sum: { sentCount: true } }),
        // Total opens
        prisma.campaign.aggregate({ _sum: { openCount: true } }),
      ]),
    ]);

    // Calculate average open rate
    const totalSent = stats[4]._sum.sentCount || 0;
    const totalOpens = stats[5]._sum.openCount || 0;
    const avgOpenRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;

    // Format campaigns
    const formattedCampaigns = campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      type: campaign.type.toLowerCase(),
      status: campaign.status.toLowerCase(),
      audience: campaign.contactList?.totalCount || 0,
      sent: campaign.sentCount,
      opened: campaign.openCount,
      clicked: campaign.clickCount,
      bounced: campaign.bounceCount,
      startDate: campaign.scheduledAt?.toISOString().split("T")[0] || campaign.createdAt.toISOString().split("T")[0],
      endDate: campaign.sentAt?.toISOString().split("T")[0] || null,
      owner: campaign.user.name || campaign.user.email,
      ownerId: campaign.user.id,
    }));

    return NextResponse.json({
      success: true,
      data: {
        campaigns: formattedCampaigns,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          total: stats[0],
          active: stats[1],
          completed: stats[2],
          thisMonth: stats[3],
          totalReach: totalSent,
          avgOpenRate,
        },
      },
    });
  } catch (error) {
    console.error("Admin campaigns error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch campaigns" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign ID and status required" } },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id },
      data: { status: status.toUpperCase() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin update campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update campaign" } },
      { status: 500 }
    );
  }
}
