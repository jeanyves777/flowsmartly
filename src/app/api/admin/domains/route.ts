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
    const websiteCustomDomainRows = await prisma.website.findMany({
      where: {
        customDomain: { not: null },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        customDomain: true,
        status: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    const websiteCustomDomains = new Set(
      websiteCustomDomainRows
        .map((website) => website.customDomain?.toLowerCase())
        .filter((domain): domain is string => Boolean(domain))
    );

    if (tab === "store") {
      const storeWhere: Record<string, unknown> = {};
      if (search) {
        storeWhere.domainName = { contains: search };
      }
      if (websiteCustomDomains.size > 0) {
        storeWhere.NOT = { domainName: { in: Array.from(websiteCustomDomains) } };
      }

      const [domains, total, stats] = await Promise.all([
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
        getDomainStats(websiteCustomDomainRows),
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
            registrarVerificationStatus: d.registrarVerificationStatus,
            registrarVerificationDeadline: d.registrarVerificationDeadline?.toISOString() || null,
            registrarVerificationDaysToSuspend: d.registrarVerificationDaysToSuspend,
            registrarVerificationEmailBounced: d.registrarVerificationEmailBounced,
            registrarVerificationLastCheckedAt: d.registrarVerificationLastCheckedAt?.toISOString() || null,
            registrarVerificationLastSentAt: d.registrarVerificationLastSentAt?.toISOString() || null,
            registrarVerificationError: d.registrarVerificationError,
            sslStatus: d.sslStatus,
            isPrimary: d.isPrimary,
            isConnected: d.isConnected,
            createdAt: d.createdAt.toISOString(),
            store: d.store ? { id: d.store.id, name: d.store.name, slug: d.store.slug } : null,
            user: d.store?.user || { id: "", name: "Unknown", email: "" },
          })),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
          stats,
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
      getDomainStats(websiteCustomDomainRows),
    ]);

    const persistedDomainNames = new Set(domains.map((domain) => domain.domainName.toLowerCase()));
    const syntheticDomains = websiteCustomDomainRows
      .filter((website) => website.customDomain)
      .filter((website) => !persistedDomainNames.has(website.customDomain!.toLowerCase()))
      .filter((website) => !search || website.customDomain!.toLowerCase().includes(search.toLowerCase()))
      .map((website) => ({
        id: `website:${website.id}`,
        domainName: website.customDomain!,
        tld: website.customDomain!.split(".").pop() || "",
        type: "website",
        registrarStatus: website.status === "PUBLISHED" ? "active" : "pending",
        registrarOrderId: null,
        createdAt: website.updatedAt.toISOString(),
        website: { id: website.id, name: website.name, slug: website.slug },
        user: website.user,
      }));

    const mergedDomains = [
      ...domains.map((d) => ({
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
      ...syntheticDomains,
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const mergedTotal = total + syntheticDomains.length;

    return NextResponse.json({
      success: true,
      data: {
        domains: mergedDomains.slice(0, limit),
        pagination: { page, limit, total: mergedTotal, totalPages: Math.ceil(mergedTotal / limit) },
        stats: {
          websiteDomains: stats.websiteDomains,
          activeWebsiteDomains: stats.activeWebsiteDomains,
          storeDomains: stats.storeDomains,
          activeStoreDomains: stats.activeStoreDomains,
        },
      },
    });
  } catch (error) {
    console.error("Admin domains error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch domains" } }, { status: 500 });
  }
}

async function getDomainStats(websiteCustomDomainRows: Array<{
  customDomain: string | null;
  status: string;
}>) {
  const websiteCustomDomains = websiteCustomDomainRows
    .map((website) => website.customDomain?.toLowerCase())
    .filter((domain): domain is string => Boolean(domain));

  const [persistedWebsiteDomains, activePersistedWebsiteDomains, storeDomains, activeStoreDomains] = await Promise.all([
    prisma.websiteDomain.findMany({ select: { domainName: true } }),
    prisma.websiteDomain.findMany({ where: { registrarStatus: "active" }, select: { domainName: true } }),
    prisma.storeDomain.count({
      where: websiteCustomDomains.length > 0
        ? { NOT: { domainName: { in: websiteCustomDomains } } }
        : undefined,
    }),
    prisma.storeDomain.count({
      where: {
        registrarStatus: "active",
        ...(websiteCustomDomains.length > 0 ? { NOT: { domainName: { in: websiteCustomDomains } } } : {}),
      },
    }),
  ]);

  const persistedWebsiteDomainNames = new Set(persistedWebsiteDomains.map((domain) => domain.domainName.toLowerCase()));
  const activePersistedWebsiteDomainNames = new Set(activePersistedWebsiteDomains.map((domain) => domain.domainName.toLowerCase()));
  const syntheticWebsiteDomains = websiteCustomDomainRows.filter((website) => {
    const domain = website.customDomain?.toLowerCase();
    return domain && !persistedWebsiteDomainNames.has(domain);
  });
  const syntheticActiveWebsiteDomains = syntheticWebsiteDomains.filter((website) => {
    const domain = website.customDomain?.toLowerCase();
    return website.status === "PUBLISHED" || (domain ? activePersistedWebsiteDomainNames.has(domain) : false);
  });

  return {
    websiteDomains: persistedWebsiteDomainNames.size + syntheticWebsiteDomains.length,
    activeWebsiteDomains: activePersistedWebsiteDomainNames.size + syntheticActiveWebsiteDomains.length,
    storeDomains,
    activeStoreDomains,
  };
}
