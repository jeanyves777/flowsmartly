import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/domains/resolve?domain=mybrand.com[&forceStore=1]
 * Internal endpoint used by Next.js middleware to resolve custom domains.
 *
 * Resolution priority:
 * 1. StoreDomain → Store (domain purchased/connected via domain management)
 * 2. Store.customDomain (legacy direct assignment)
 * 3. Website.customDomain (website linked to domain)
 * 4. WebsiteDomain table (if exists)
 *
 * When forceStore=1 (shop.domain.com), only returns store results.
 */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain");
  const forceStore = request.nextUrl.searchParams.get("forceStore") === "1";

  if (!domain) {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  }

  const domainLower = domain.toLowerCase();

  // Look up the domain in StoreDomain table
  const storeDomain = await prisma.storeDomain.findUnique({
    where: { domainName: domainLower },
    select: {
      storeId: true,
      isPrimary: true,
      registrarStatus: true,
      userId: true,
      store: {
        select: {
          slug: true,
          isActive: true,
          storeVersion: true,
        },
      },
    },
  });

  // If forceStore (shop.domain.com), look for a store linked to this domain's owner
  if (forceStore) {
    // First: check if StoreDomain has a linked store
    if (storeDomain?.store?.isActive) {
      return NextResponse.json({ slug: storeDomain.store.slug, type: "store", storeVersion: storeDomain.store.storeVersion });
    }

    // Second: check if the domain owner has any active store
    if (storeDomain?.userId) {
      const ownerStore = await prisma.store.findFirst({
        where: { userId: storeDomain.userId, isActive: true },
        select: { slug: true, storeVersion: true },
      });
      if (ownerStore) {
        return NextResponse.json({ slug: ownerStore.slug, type: "store", storeVersion: ownerStore.storeVersion });
      }
    }

    // Third: check Store.customDomain
    const storeByDomain = await prisma.store.findFirst({
      where: { customDomain: domainLower, isActive: true },
      select: { slug: true, storeVersion: true },
    });
    if (storeByDomain) {
      return NextResponse.json({ slug: storeByDomain.slug, type: "store", storeVersion: storeByDomain.storeVersion });
    }

    return NextResponse.json({ error: "No store found" }, { status: 404 });
  }

  // Normal resolution (not forceStore)

  // 1. StoreDomain → Store
  if (storeDomain?.store?.isActive) {
    return NextResponse.json({ slug: storeDomain.store.slug, type: "store", storeVersion: storeDomain.store.storeVersion });
  }

  // 2. Store.customDomain (direct assignment, no StoreDomain record)
  const storeByCustomDomain = await prisma.store.findFirst({
    where: { customDomain: domainLower, isActive: true },
    select: { slug: true, storeVersion: true },
  });
  if (storeByCustomDomain) {
    return NextResponse.json({ slug: storeByCustomDomain.slug, type: "store", storeVersion: storeByCustomDomain.storeVersion });
  }

  // 3. Website.customDomain
  const websiteByDomain = await prisma.website.findFirst({
    where: { customDomain: domainLower, status: "PUBLISHED", deletedAt: null },
    select: { slug: true },
  });
  if (websiteByDomain) {
    return NextResponse.json({ slug: websiteByDomain.slug, type: "website" });
  }

  // 4. WebsiteDomain table (if exists)
  try {
    const websiteDomain = await prisma.websiteDomain.findUnique({
      where: { domainName: domainLower },
      select: {
        website: { select: { slug: true, status: true } },
      },
    });
    if (websiteDomain?.website.status === "PUBLISHED") {
      return NextResponse.json({ slug: websiteDomain.website.slug, type: "website" });
    }
  } catch {
    // WebsiteDomain model may not exist — ignore
  }

  return NextResponse.json({ error: "Domain not found" }, { status: 404 });
}
