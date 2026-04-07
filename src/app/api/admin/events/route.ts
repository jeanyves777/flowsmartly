import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/events - List all events
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
    const status = searchParams.get("status") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { slug: { contains: search } },
        { venueName: { contains: search } },
      ];
    }
    if (status) where.status = status;

    const [events, total, stats] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { eventDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { registrations: true, ticketOrders: true } },
        },
      }),
      prisma.event.count({ where }),
      Promise.all([
        prisma.event.count(),
        prisma.event.count({ where: { status: "ACTIVE" } }),
        prisma.eventRegistration.count(),
        prisma.event.aggregate({ _sum: { totalRevenueCents: true } }),
        prisma.event.count({ where: { ticketType: "paid" } }),
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          slug: e.slug,
          status: e.status,
          eventDate: e.eventDate.toISOString(),
          endDate: e.endDate?.toISOString() || null,
          venueName: e.venueName,
          isOnline: e.isOnline,
          ticketType: e.ticketType,
          ticketPrice: e.ticketPrice,
          capacity: e.capacity,
          registrationCount: e.registrationCount,
          totalRevenueCents: e.totalRevenueCents,
          createdAt: e.createdAt.toISOString(),
          user: e.user,
          _count: e._count,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          total: stats[0],
          active: stats[1],
          totalRegistrations: stats[2],
          totalRevenueCents: stats[3]._sum.totalRevenueCents || 0,
          paidEvents: stats[4],
        },
      },
    });
  } catch (error) {
    console.error("Admin events error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch events" } }, { status: 500 });
  }
}
