import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/domains - List all website domains + store domains
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
    const tab = searchParams.get("tab") || "website";

    if (tab === "store") {
      const storeWhere: Record<string, unknown> = {};
      if (search) {
        storeWhere.domainName = { contains: search };
      }

      const [domains, total] = await Promise.all([
        prisma.storeDomain.findMany({
          where: storeWhere,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            store: { select: { id: true, name: true, slug: true, user: { select: { id: true, name: true, email: true } } } },
          },
        }),
        prisma.storeDomain.count({ where: storeWhere }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          domains: domains.map((d) => ({
            id: d.id,
            domainName: d.domainName,
            tld: d.tld,
            type: "store",
            registrarStatus: d.registrarStatus,
            sslStatus: d.sslStatus,
            isPrimary: d.isPrimary,
            isConnected: d.isConnected,
            createdAt: d.createdAt.toISOString(),
            store: d.store ? { id: d.store.id, name: d.store.name, slug: d.store.slug } : null,
            user: d.store?.user || { id: "", name: "Unknown", email: "" },
          })),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    }

    // Website domains
    const webWhere: Record<string, unknown> = {};
    if (search) {
      webWhere.domainName = { contains: search };
    }

    const [domains, total, stats] = await Promise.all([
      prisma.websiteDomain.findMany({
        where: webWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          website: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.websiteDomain.count({ where: webWhere }),
      Promise.all([
        prisma.websiteDomain.count(),
        prisma.websiteDomain.count({ where: { registrarStatus: "active" } }),
        prisma.storeDomain.count(),
        prisma.storeDomain.count({ where: { registrarStatus: "active" } }),
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        domains: domains.map((d) => ({
          id: d.id,
          domainName: d.domainName,
          tld: d.tld,
          type: "website",
          registrarStatus: d.registrarStatus,
          registrarOrderId: d.registrarOrderId,
          createdAt: d.createdAt.toISOString(),
          website: d.website,
          user: d.user,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          websiteDomains: stats[0],
          activeWebsiteDomains: stats[1],
          storeDomains: stats[2],
          activeStoreDomains: stats[3],
        },
      },
    });
  } catch (error) {
    console.error("Admin domains error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch domains" } }, { status: 500 });
  }
}
