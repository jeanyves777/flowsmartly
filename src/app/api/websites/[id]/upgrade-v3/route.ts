import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { upgradeToV3, buildSiteV3, deploySiteV3, getSiteDir } from "@/lib/website/site-builder";
import { existsSync } from "fs";

/**
 * POST /api/websites/[id]/upgrade-v3
 *
 * Upgrades a legacy V2 static-export site to a V3 self-contained SSR app.
 * - Converts config files to V3 (SSR, no basePath)
 * - Adds API proxy, analytics, theme templates
 * - Rebuilds and deploys as independent PM2 process
 * - Free — no credits charged (infrastructure upgrade only)
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatorVersion: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (website.generatorVersion === "v3") {
      return NextResponse.json({ error: "Site is already on V3 SSR." }, { status: 400 });
    }

    const siteDir = getSiteDir(id);
    if (!existsSync(siteDir)) {
      return NextResponse.json({ error: "Site directory not found — please regenerate the site first." }, { status: 400 });
    }

    // Set status to upgrading
    await prisma.website.update({
      where: { id },
      data: { buildStatus: "building" },
    });

    // Run upgrade in background
    (async () => {
      try {
        // Step 1: Convert config + template files to V3
        upgradeToV3(id, website.slug);

        // Step 2: Build as SSR
        const buildResult = await buildSiteV3(id);
        if (!buildResult.success) {
          console.error(`[UpgradeV3] Build failed for ${website.slug}:`, buildResult.error);
          return;
        }

        // Step 3: Deploy as PM2 process
        await deploySiteV3(id, website.slug);

        console.log(`[UpgradeV3] Successfully upgraded ${website.slug} to V3 SSR`);
      } catch (err) {
        console.error(`[UpgradeV3] Upgrade failed for ${website.slug}:`, err);
        await prisma.website.update({
          where: { id },
          data: { buildStatus: "error" },
        });
      }
    })().catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Upgrading to V3 SSR — this may take 2–3 minutes. Check back shortly.",
    });
  } catch (err) {
    console.error("POST upgrade-v3 error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
