import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

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
    const filter = searchParams.get("filter") || "all";
    const sort = searchParams.get("sort") || "recent";
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Build where clause
    const where: Record<string, unknown> = {};

    if (filter === "leads") {
      where.OR = [
        { email: { not: null } },
        { phone: { not: null } },
      ];
    } else if (filter === "new") {
      where.firstSeenAt = { gte: dayAgo };
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { phone: { contains: search } },
        { city: { contains: search } },
        { country: { contains: search } },
      ];
    }

    // Build order clause
    let orderBy: Record<string, string> = { lastSeenAt: "desc" };
    if (sort === "score") {
      orderBy = { leadScore: "desc" };
    } else if (sort === "visits") {
      orderBy = { totalVisits: "desc" };
    }

    // Fetch visitors with pagination
    const [visitors, total, stats] = await Promise.all([
      prisma.visitor.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sessions: {
            orderBy: { startedAt: "desc" },
            take: 1,
          },
          pageViews: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              path: true,
              title: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.visitor.count({ where }),
      // Get stats
      Promise.all([
        prisma.visitor.count(),
        prisma.visitor.count({ where: { firstSeenAt: { gte: dayAgo } } }),
        prisma.visitor.count({
          where: { OR: [{ email: { not: null } }, { phone: { not: null } }] },
        }),
        prisma.realtimeVisitor.count({
          where: { lastActiveAt: { gte: new Date(now.getTime() - 5 * 60 * 1000) } },
        }),
      ]),
    ]);

    // Format visitors
    const formattedVisitors = visitors.map((visitor) => ({
      id: visitor.id,
      fingerprint: visitor.fingerprint || `fp_${visitor.id.slice(0, 10)}`,
      email: visitor.email,
      phone: visitor.phone,
      firstName: visitor.firstName,
      lastName: visitor.lastName,
      country: visitor.country || "Unknown",
      city: visitor.city || "Unknown",
      region: visitor.region || "",
      device: visitor.device || "Unknown",
      deviceType: visitor.deviceType || "desktop",
      browser: visitor.browser ? `${visitor.browser} ${visitor.browserVersion || ""}`.trim() : "Unknown",
      os: visitor.os ? `${visitor.os} ${visitor.osVersion || ""}`.trim() : "Unknown",
      firstSeen: visitor.firstSeenAt,
      lastSeen: visitor.lastSeenAt,
      totalVisits: visitor.totalVisits,
      totalPageViews: visitor.totalPageViews,
      totalTimeOnSite: visitor.sessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      leadScore: visitor.leadScore,
      isLead: !!(visitor.email || visitor.phone),
      source: visitor.firstUtmSource || "direct",
      referrer: visitor.firstReferrer,
      sessions: visitor.sessions.map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        duration: s.duration,
        pageViews: s.pageViews,
      })),
      recentPages: visitor.pageViews.map((pv) => ({
        path: pv.path,
        title: pv.title || pv.path,
        time: pv.createdAt,
      })),
    }));

    return NextResponse.json({
      success: true,
      data: {
        visitors: formattedVisitors,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          totalVisitors: stats[0],
          newToday: stats[1],
          leads: stats[2],
          activeNow: stats[3],
        },
      },
    });
  } catch (error) {
    console.error("Admin visitors error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch visitors" } },
      { status: 500 }
    );
  }
}
