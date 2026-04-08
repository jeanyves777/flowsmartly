import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { purgeZoneCache } from "@/lib/domains/cloudflare-client";
import { buildSite, deploySite } from "@/lib/website/site-builder";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SITES_OUTPUT =
  process.platform === "win32"
    ? "C:\\Users\\koffi\\Dev\\flowsmartly\\sites-output"
    : "/var/www/flowsmartly/sites-output";

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

      // Instant fix: strip basePath prefix from deployed HTML so site works immediately
      stripBasePathFromSite(website.slug);

      // Full rebuild in background: properly regenerates with basePath='' for all paths
      triggerWebsiteRebuild(website.id, website.slug);
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

      // Instant fix: restore basePath prefix so /sites/slug/ access works
      for (const ws of linkedWebsites) {
        addBasePathToSite(ws.slug);
        // Full rebuild in background
        triggerWebsiteRebuild(ws.id, ws.slug);
      }
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

/**
 * Strip /sites/{slug} prefix from all links in deployed HTML files.
 * Called when a custom domain is linked — links become /about instead of /sites/slug/about.
 * Instant, no rebuild needed, no credits used.
 */
function stripBasePathFromSite(slug: string) {
  try {
    const siteDir = join(SITES_OUTPUT, slug);
    const prefix = `/sites/${slug}`;
    const files = readdirSync(siteDir).filter((f) => f.endsWith(".html"));
    let fixed = 0;

    for (const file of files) {
      const fp = join(siteDir, file);
      let content = readFileSync(fp, "utf-8");
      const orig = content;

      // Strip prefix from href="/sites/slug/..." and href="/sites/slug"
      content = content.split(prefix + "/").join("/");
      // Handle href="/sites/slug" (without trailing slash) → href="/"
      content = content.split(prefix + '"').join('/"');

      if (content !== orig) {
        writeFileSync(fp, content);
        fixed++;
      }
    }

    console.log(`[DomainSettings] Stripped basePath from ${fixed} files for ${slug}`);
  } catch (err) {
    console.error(`[DomainSettings] Failed to strip basePath for ${slug}:`, err);
  }
}

/**
 * Fire-and-forget: full rebuild + deploy when domain is linked/unlinked.
 * This properly regenerates the site with the correct basePath, SITE_BASE,
 * image paths, and all internal links. Runs after the instant fix.
 */
function triggerWebsiteRebuild(websiteId: string, slug: string) {
  (async () => {
    console.log(`[DomainSettings] Full rebuild for ${slug} after domain change`);
    const result = await buildSite(websiteId);
    if (result.success) {
      await deploySite(websiteId, slug);
      console.log(`[DomainSettings] Rebuild + deploy succeeded for ${slug}`);
    } else {
      console.error(`[DomainSettings] Rebuild failed for ${slug}:`, result.error?.substring(0, 200));
    }
  })().catch((err) => console.error("[DomainSettings] Rebuild error:", err));
}

/**
 * Restore /sites/{slug} prefix to all bare links in deployed HTML files.
 * Called when a custom domain is unlinked — links become /sites/slug/about again.
 * Instant, no rebuild needed, no credits used.
 */
function addBasePathToSite(slug: string) {
  try {
    const siteDir = join(SITES_OUTPUT, slug);
    const prefix = `/sites/${slug}`;
    const files = readdirSync(siteDir).filter((f) => f.endsWith(".html"));
    let fixed = 0;

    for (const file of files) {
      const fp = join(siteDir, file);
      let content = readFileSync(fp, "utf-8");
      const orig = content;

      // Add prefix to bare href="/" → href="/sites/slug/"
      // But skip /_next/, /images/, http, mailto, tel, #
      content = content.replace(
        /href="\/(?!_next\/|images\/|sites\/|api\/|favicon|logo|icon|mailto|tel)([^"]*?)"/g,
        `href="${prefix}/$1"`
      );

      if (content !== orig) {
        writeFileSync(fp, content);
        fixed++;
      }
    }

    console.log(`[DomainSettings] Restored basePath in ${fixed} files for ${slug}`);
  } catch (err) {
    console.error(`[DomainSettings] Failed to restore basePath for ${slug}:`, err);
  }
}
