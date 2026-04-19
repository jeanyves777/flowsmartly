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
      select: {
        id: true,
        userId: true,
        storeId: true,
        domainName: true,
        cloudflareZoneId: true,
        registrarStatus: true,
      },
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
    let storeToRebuild: string | null = null;

    if (typeof body.autoRenew === "boolean") {
      updateData.autoRenew = body.autoRenew;
    }

    if (typeof body.whoisPrivacy === "boolean") {
      updateData.whoisPrivacy = body.whoisPrivacy;
    }

    // Link to store
    if (body.linkToStore === true) {
      // Verify the domain is actually registered (not still in pending/failed state)
      if (domain.registrarStatus && !["active", "registered", "ok"].includes(domain.registrarStatus.toLowerCase())) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DOMAIN_NOT_READY",
              message: `Domain is not ready yet (status: ${domain.registrarStatus}). Wait for registration to complete before linking.`,
            },
          },
          { status: 400 }
        );
      }

      const store = await prisma.store.findUnique({
        where: { userId: session.userId },
        select: { id: true, slug: true, customDomain: true },
      });
      if (!store) {
        return NextResponse.json(
          { success: false, error: { code: "NO_STORE", message: "You don't have a FlowShop store to link" } },
          { status: 400 }
        );
      }

      // 1. Link this domain to the store on the StoreDomain row
      updateData.storeId = store.id;

      // 2. CRITICAL: Update the Store record's customDomain so middleware + data.ts pick it up
      await prisma.store.update({
        where: { id: store.id },
        data: { customDomain: domain.domainName },
      });

      // 3. If no other domain is primary yet, make this one primary
      const hasPrimary = await prisma.storeDomain.findFirst({
        where: { storeId: store.id, isPrimary: true, id: { not: id } },
        select: { id: true },
      });
      if (!hasPrimary) {
        updateData.isPrimary = true;
      }

      storeToRebuild = store.id;
      needsCachePurge = true;
      actionMessage = `${domain.domainName} is now linked to your store — rebuilding…`;
    } else if (body.linkToStore === false) {
      // Capture the store before unlinking so we can rebuild + clear its customDomain
      if (domain.storeId) {
        const store = await prisma.store.findUnique({
          where: { id: domain.storeId },
          select: { id: true, customDomain: true },
        });
        if (store?.customDomain === domain.domainName) {
          // Find a fallback domain for this store (other linked domains)
          const fallback = await prisma.storeDomain.findFirst({
            where: {
              storeId: store.id,
              id: { not: id },
              registrarStatus: { in: ["active", "registered", "ok"] },
            },
            select: { domainName: true },
            orderBy: { isPrimary: "desc" },
          });
          await prisma.store.update({
            where: { id: store.id },
            data: { customDomain: fallback?.domainName || null },
          });
        }
        storeToRebuild = domain.storeId;
      }

      updateData.storeId = null;
      updateData.isPrimary = false;
      needsCachePurge = true;
      actionMessage = "Store unlinked from domain — rebuilding…";
    }

    // Link to website
    let websiteToRebuild: string | null = null;
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
      websiteToRebuild = website.id;
      needsCachePurge = true;
      actionMessage = `${domain.domainName} is now serving your website — rebuilding…`;
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
      if (linkedWebsites[0]) websiteToRebuild = linkedWebsites[0].id;
      needsCachePurge = true;
      actionMessage = "Website unlinked from domain — rebuilding…";
    }

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

    // Regenerate nginx so the new custom-domain server block routes to the
    // correct upstream (or removes it on unlink). Fire-and-forget.
    if (needsCachePurge) {
      const { regenerateAndReload } = await import("@/lib/ssr-manager/nginx-config");
      regenerateAndReload().catch((e) =>
        console.error("[DomainSettings] Nginx reload failed:", e)
      );
    }

    // Mark the store as having pending changes (user will publish when ready)
    if (storeToRebuild) {
      const { markStoreAsPending } = await import("@/lib/store-builder/pending-changes");
      markStoreAsPending(storeToRebuild).catch(() => {});
    }
    if (websiteToRebuild) {
      // Website rebuild — fire the internal rebuild endpoint
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/websites/${websiteToRebuild}/rebuild`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" },
      }).catch((e) => console.error("[DomainSettings] Website rebuild failed:", e));
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
      data: { domain: updated, rebuildTriggered: !!(storeToRebuild || websiteToRebuild) },
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
