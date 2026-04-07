import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/automations - List all user automations
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { subject: { contains: search } },
      ];
    }
    if (type) where.type = type;

    const [automations, total, stats] = await Promise.all([
      prisma.automation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { logs: true } },
        },
      }),
      prisma.automation.count({ where }),
      Promise.all([
        prisma.automation.count(),
        prisma.automation.count({ where: { enabled: true } }),
        prisma.automation.aggregate({ _sum: { totalSent: true } }),
        prisma.automationLog.count(),
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        automations: automations.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          campaignType: a.campaignType,
          enabled: a.enabled,
          totalSent: a.totalSent,
          lastTriggered: a.lastTriggered?.toISOString() || null,
          createdAt: a.createdAt.toISOString(),
          user: a.user,
          logCount: a._count.logs,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          total: stats[0],
          active: stats[1],
          totalSent: stats[2]._sum.totalSent || 0,
          totalLogs: stats[3],
        },
      },
    });
  } catch (error) {
    console.error("Admin automations error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch automations" } }, { status: 500 });
  }
}
