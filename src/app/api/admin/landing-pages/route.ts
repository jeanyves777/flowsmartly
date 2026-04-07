import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/landing-pages - List all landing pages
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
      ];
    }
    if (status) where.status = status;

    const [pages, total, stats] = await Promise.all([
      prisma.landingPage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { formSubmissions: true } },
        },
      }),
      prisma.landingPage.count({ where }),
      Promise.all([
        prisma.landingPage.count(),
        prisma.landingPage.count({ where: { status: "PUBLISHED" } }),
        prisma.landingPage.aggregate({ _sum: { views: true } }),
        prisma.formSubmission.count(),
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        landingPages: pages.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          pageType: p.pageType,
          status: p.status,
          views: p.views,
          publishedAt: p.publishedAt?.toISOString() || null,
          createdAt: p.createdAt.toISOString(),
          user: p.user,
          submissionCount: p._count.formSubmissions,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          total: stats[0],
          published: stats[1],
          totalViews: stats[2]._sum.views || 0,
          totalSubmissions: stats[3],
        },
      },
    });
  } catch (error) {
    console.error("Admin landing pages error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch landing pages" } }, { status: 500 });
  }
}
