import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/websites - List all websites
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
    const buildStatus = searchParams.get("buildStatus") || "";

    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { customDomain: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (buildStatus) where.buildStatus = buildStatus;

    const [websites, total, stats] = await Promise.all([
      prisma.website.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { pages: true, domains: true, formSubmissions: true } },
        },
      }),
      prisma.website.count({ where }),
      Promise.all([
        prisma.website.count({ where: { deletedAt: null } }),
        prisma.website.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
        prisma.website.count({ where: { deletedAt: null, buildStatus: "error" } }),
        prisma.website.count({ where: { deletedAt: null, customDomain: { not: null } } }),
        prisma.website.aggregate({ where: { deletedAt: null }, _sum: { totalViews: true } }),
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        websites: websites.map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          customDomain: w.customDomain,
          status: w.status,
          buildStatus: w.buildStatus,
          lastBuildAt: w.lastBuildAt?.toISOString() || null,
          lastBuildError: w.lastBuildError,
          generatorVersion: w.generatorVersion,
          pageCount: w.pageCount,
          totalViews: w.totalViews,
          publishedAt: w.publishedAt?.toISOString() || null,
          createdAt: w.createdAt.toISOString(),
          user: w.user,
          _count: w._count,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          total: stats[0],
          published: stats[1],
          errors: stats[2],
          customDomains: stats[3],
          totalViews: stats[4]._sum.totalViews || 0,
        },
      },
    });
  } catch (error) {
    console.error("Admin websites error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch websites" } }, { status: 500 });
  }
}

// DELETE /api/admin/websites - Delete a website
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await request.json();
    await prisma.website.update({ where: { id }, data: { deletedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete website error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete website" } }, { status: 500 });
  }
}
