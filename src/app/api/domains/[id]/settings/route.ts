import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { purgeZoneCache } from "@/lib/domains/cloudflare-client";

/**
 * PATCH /api/domains/[id]/settings
 * Update domain settings: autoRenew, whoisPrivacy, link to store/website.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const domain = await prisma.storeDomain.findUnique({
      where: { id },
      select: { id: true, userId: true, storeId: true, domainName: true, cloudflareZoneId: true },
    });

    if (!domain) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Domain not found" } },
        { status: 404 }
      );
    }

    if (domain.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "You do not own this domain" } },
        { status: 403 }
      );
    }

    // Build update data from allowed fields
    const updateData: Record<string, unknown> = {};
    let needsCachePurge = false;
    let actionMessage = "Settings updated";

    if (typeof body.autoRenew === "boolean") {
      updateData.autoRenew = body.autoRenew;
    }

    if (typeof body.whoisPrivacy === "boolean") {
      updateData.whoisPrivacy = body.whoisPrivacy;
    }

    // Link to store
    if (body.linkToStore === true) {
      const store = await prisma.store.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      if (store) {
        updateData.storeId = store.id;
        needsCachePurge = true;
        actionMessage = `${domain.domainName} is now linked to your store`;
      } else {
        return NextResponse.json(
          { success: false, error: { code: "NO_STORE", message: "You don't have a FlowShop store to link" } },
          { status: 400 }
        );
      }
    } else if (body.linkToStore === false) {
      updateData.storeId = null;
      needsCachePurge = true;
      actionMessage = "Store unlinked from domain";
    }

    // Link to website
    if (typeof body.linkToWebsite === "string" && body.linkToWebsite) {
      const website = await prisma.website.findFirst({
        where: { id: body.linkToWebsite, userId: session.userId, deletedAt: null },
        select: { id: true, slug: true, customDomain: true },
      });
      if (!website) {
        return NextResponse.json(
          { success: false, error: { code: "WEBSITE_NOT_FOUND", message: "Website not found" } },
          { status: 404 }
        );
      }
      // Update website's customDomain
      await prisma.website.update({
        where: { id: website.id },
        data: { customDomain: domain.domainName },
      });
      needsCachePurge = true;
      actionMessage = `${domain.domainName} is now serving your website`;
    } else if (body.linkToWebsite === null) {
      // Find websites using this domain before unlinking
      const linkedWebsites = await prisma.website.findMany({
        where: { customDomain: domain.domainName, userId: session.userId },
        select: { id: true, slug: true },
      });
      // Unlink from any website that uses this domain
      await prisma.website.updateMany({
        where: { customDomain: domain.domainName, userId: session.userId },
        data: { customDomain: null },
      });
      needsCachePurge = true;
      actionMessage = "Website unlinked from domain";
    }

    // Link to website by linkToWebsite=null is handled above

    if (Object.keys(updateData).length > 0) {
      await prisma.storeDomain.update({
        where: { id },
        data: updateData,
      });
    }

    // Purge Cloudflare cache when domain assignment changes
    if (needsCachePurge && domain.cloudflareZoneId) {
      purgeZoneCache(domain.cloudflareZoneId).catch((err) =>
        console.error("[DomainSettings] Cache purge failed (non-fatal):", err)
      );
    }

    // Return updated domain
    const updated = await prisma.storeDomain.findUnique({
      where: { id },
      select: {
        id: true,
        domainName: true,
        autoRenew: true,
        whoisPrivacy: true,
        storeId: true,
        isPrimary: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { domain: updated },
      message: actionMessage,
    });
  } catch (error) {
    console.error("Domain settings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update domain settings" } },
      { status: 500 }
    );
  }
}

// No rebuild or link manipulation needed when linking/unlinking domains.
// basePath is always '/sites/{slug}' — the middleware handles custom domain
// routing by rewriting all paths transparently. This means:
// - Preview on flowsmartly.com: works (paths use /sites/slug/...)
// - Custom domain: middleware rewrites / → /sites/slug/, works
// - No broken states during link/unlink
