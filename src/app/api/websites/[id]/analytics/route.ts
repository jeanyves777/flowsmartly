import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/websites/[id]/analytics?range=7d|30d|90d|today
 * Returns aggregated analytics for this website
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, totalViews: true, createdAt: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const range = request.nextUrl.searchParams.get("range") || "30d";
    const days = range === "today" ? 1 : range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Query PageViews linked to this website
    // Match by websiteId (custom domain tracking) OR path prefix (direct access)
    const sitePrefix = `/sites/${website.slug}`;
    const pageViews = await prisma.pageView.findMany({
      where: {
        OR: [
          { websiteId: website.id },
          { path: { startsWith: sitePrefix } },
        ],
        createdAt: { gte: since },
      },
      select: {
        id: true, path: true, country: true, city: true, deviceType: true,
        browser: true, os: true, referrer: true, createdAt: true,
        utmSource: true, utmMedium: true, utmCampaign: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    // Aggregate stats
    const totalViews = pageViews.length;
    const uniqueVisitors = new Set(pageViews.map((pv) => pv.id)).size; // approximate

    // Country breakdown
    const countryMap: Record<string, number> = {};
    const cityMap: Record<string, number> = {};
    const deviceMap: Record<string, number> = {};
    const browserMap: Record<string, number> = {};
    const osMap: Record<string, number> = {};
    const pageMap: Record<string, number> = {};
    const referrerMap: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};

    for (const pv of pageViews) {
      if (pv.country) countryMap[pv.country] = (countryMap[pv.country] || 0) + 1;
      if (pv.city) cityMap[pv.city] = (cityMap[pv.city] || 0) + 1;
      if (pv.deviceType) deviceMap[pv.deviceType] = (deviceMap[pv.deviceType] || 0) + 1;
      if (pv.browser) browserMap[pv.browser] = (browserMap[pv.browser] || 0) + 1;
      if (pv.os) osMap[pv.os] = (osMap[pv.os] || 0) + 1;
      if (pv.path) {
        const cleanPath = pv.path.replace(`/sites/${website.slug}`, "") || "/";
        pageMap[cleanPath] = (pageMap[cleanPath] || 0) + 1;
      }
      if (pv.referrer) {
        try {
          const ref = new URL(pv.referrer).hostname;
          referrerMap[ref] = (referrerMap[ref] || 0) + 1;
        } catch {
          referrerMap[pv.referrer] = (referrerMap[pv.referrer] || 0) + 1;
        }
      }
      const day = pv.createdAt.toISOString().split("T")[0];
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    }

    const sortObj = (obj: Record<string, number>, limit = 10) =>
      Object.entries(obj).sort(([, a], [, b]) => b - a).slice(0, limit).map(([name, count]) => ({ name, count }));

    // Real-time visitors (active in last 5 min)
    const realtimeVisitors = await prisma.realtimeVisitor.count({
      where: { lastActiveAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
    });

    return NextResponse.json({
      overview: {
        totalViews: website.totalViews,
        periodViews: totalViews,
        uniqueVisitors,
        realtimeVisitors,
        siteAge: Math.floor((Date.now() - website.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      },
      geo: {
        countries: sortObj(countryMap),
        cities: sortObj(cityMap, 20),
      },
      devices: {
        types: sortObj(deviceMap),
        browsers: sortObj(browserMap),
        os: sortObj(osMap),
      },
      pages: sortObj(pageMap, 20),
      referrers: sortObj(referrerMap),
      daily: Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, views]) => ({ date, views })),
    });
  } catch (err) {
    console.error("Website analytics error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
