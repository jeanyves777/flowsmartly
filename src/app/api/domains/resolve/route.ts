import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/domains/resolve?domain=mybrandstore.com
 * Internal endpoint used by Next.js middleware to resolve custom domains to store slugs.
 */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  }

  // Look up the domain in StoreDomain table
  const storeDomain = await prisma.storeDomain.findUnique({
    where: { domainName: domain.toLowerCase() },
    select: {
      storeId: true,
      isPrimary: true,
      registrarStatus: true,
      store: {
        select: {
          slug: true,
          isActive: true,
        },
      },
    },
  });

  if (!storeDomain || !storeDomain.store?.isActive) {
    // Also check if it matches a store's customDomain field directly
    const storeByCustomDomain = await prisma.store.findFirst({
      where: {
        customDomain: domain.toLowerCase(),
        isActive: true,
      },
      select: { slug: true },
    });

    if (storeByCustomDomain) {
      return NextResponse.json({ slug: storeByCustomDomain.slug, type: "store" });
    }

    // Check WebsiteDomain table
    const websiteDomain = await prisma.websiteDomain.findUnique({
      where: { domainName: domain.toLowerCase() },
      select: {
        website: { select: { slug: true, status: true } },
      },
    });

    if (websiteDomain?.website.status === "PUBLISHED") {
      return NextResponse.json({ slug: websiteDomain.website.slug, type: "website" });
    }

    // Check Website.customDomain field directly
    const websiteByDomain = await prisma.website.findFirst({
      where: { customDomain: domain.toLowerCase(), status: "PUBLISHED", deletedAt: null },
      select: { slug: true },
    });

    if (websiteByDomain) {
      return NextResponse.json({ slug: websiteByDomain.slug, type: "website" });
    }

    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json({ slug: storeDomain.store.slug, type: "store" });
}
