import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/marketing/stats - Get marketing overview stats
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
    const range = searchParams.get("range") || "30d";

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get email stats
    const emailStats = await prisma.campaign.aggregate({
      where: { type: "EMAIL", createdAt: { gte: startDate } },
      _count: { id: true },
      _sum: {
        sentCount: true,
        deliveredCount: true,
        openCount: true,
        clickCount: true,
        bounceCount: true,
        unsubCount: true,
      },
    });

    // Get SMS stats
    const smsStats = await prisma.campaign.aggregate({
      where: { type: "SMS", createdAt: { gte: startDate } },
      _count: { id: true },
      _sum: {
        sentCount: true,
        deliveredCount: true,
        clickCount: true,
        bounceCount: true,
        unsubCount: true,
      },
    });

    // Get total contacts
    const [totalContacts, emailOptedIn, smsOptedIn, activeContacts] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { emailOptedIn: true } }),
      prisma.contact.count({ where: { smsOptedIn: true } }),
      prisma.contact.count({ where: { status: "ACTIVE" } }),
    ]);

    // Get recent campaigns
    const recentCampaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Get top performing campaigns
    const topEmailCampaigns = await prisma.campaign.findMany({
      where: { type: "EMAIL", status: "SENT" },
      orderBy: { openCount: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        sentCount: true,
        openCount: true,
        clickCount: true,
      },
    });

    const topSmsCampaigns = await prisma.campaign.findMany({
      where: { type: "SMS", status: "SENT" },
      orderBy: { deliveredCount: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        sentCount: true,
        deliveredCount: true,
        clickCount: true,
      },
    });

    // Calculate rates
    const emailSent = emailStats._sum.sentCount || 0;
    const emailOpened = emailStats._sum.openCount || 0;
    const emailClicked = emailStats._sum.clickCount || 0;
    const smsSent = smsStats._sum.sentCount || 0;
    const smsDelivered = smsStats._sum.deliveredCount || 0;
    const smsClicked = smsStats._sum.clickCount || 0;

    return NextResponse.json({
      success: true,
      data: {
        email: {
          campaigns: emailStats._count.id,
          sent: emailSent,
          delivered: emailStats._sum.deliveredCount || 0,
          opened: emailOpened,
          clicked: emailClicked,
          bounced: emailStats._sum.bounceCount || 0,
          unsubscribed: emailStats._sum.unsubCount || 0,
          openRate: emailSent > 0 ? Math.round((emailOpened / emailSent) * 100 * 10) / 10 : 0,
          clickRate: emailOpened > 0 ? Math.round((emailClicked / emailOpened) * 100 * 10) / 10 : 0,
          topCampaigns: topEmailCampaigns.map((c) => ({
            ...c,
            openRate: c.sentCount > 0 ? Math.round((c.openCount / c.sentCount) * 100 * 10) / 10 : 0,
          })),
        },
        sms: {
          campaigns: smsStats._count.id,
          sent: smsSent,
          delivered: smsDelivered,
          clicked: smsClicked,
          bounced: smsStats._sum.bounceCount || 0,
          unsubscribed: smsStats._sum.unsubCount || 0,
          deliveryRate: smsSent > 0 ? Math.round((smsDelivered / smsSent) * 100 * 10) / 10 : 0,
          clickRate: smsDelivered > 0 ? Math.round((smsClicked / smsDelivered) * 100 * 10) / 10 : 0,
          topCampaigns: topSmsCampaigns.map((c) => ({
            ...c,
            deliveryRate: c.sentCount > 0 ? Math.round((c.deliveredCount / c.sentCount) * 100 * 10) / 10 : 0,
          })),
        },
        contacts: {
          total: totalContacts,
          active: activeContacts,
          emailOptedIn,
          smsOptedIn,
        },
        recentCampaigns: recentCampaigns.map((c) => ({
          id: c.id,
          type: c.type.toLowerCase(),
          name: c.name,
          status: c.status.toLowerCase(),
          sentCount: c.sentCount,
          createdAt: c.createdAt.toISOString(),
          user: c.user,
        })),
      },
    });
  } catch (error) {
    console.error("Get marketing stats error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch marketing stats" } },
      { status: 500 }
    );
  }
}
