import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildSite, deploySite, getSiteDir } from "@/lib/website/site-builder";

/**
 * POST /api/websites/[id]/rebuild
 *
 * Updates data.ts with latest brand kit info, then rebuilds and deploys.
 * Does NOT re-run the AI agent — just syncs data and rebuilds.
 * Free — no credits charged.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true, brandKitId: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const siteDir = website.generatedPath || getSiteDir(id);

    // Sync brand kit data into data.ts if brand kit exists
    if (website.brandKitId) {
      const brandKit = await prisma.brandKit.findUnique({ where: { id: website.brandKitId } });
      if (brandKit) {
        const dataPath = join(siteDir, "src", "lib", "data.ts");
        try {
          let dataContent = readFileSync(dataPath, "utf-8");

          // Helper: safely replace a string field in data.ts
          // Uses double quotes to avoid apostrophe escaping issues
          const replaceField = (field: string, value: string) => {
            // Match field: 'value' or field: "value" — capture up to end of string (handles quotes inside)
            const regex = new RegExp(`(${field}:\\s*)(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")`);
            const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            dataContent = dataContent.replace(regex, `$1"${escaped}"`);
          };

          // Update company name
          if (brandKit.name) replaceField("name", brandKit.name);

          // Update phone numbers
          if (brandKit.phone) {
            dataContent = dataContent.replace(
              /phones:\s*\[.*?\]/s,
              `phones: ["${brandKit.phone.replace(/"/g, '\\"')}"]`
            );
          }

          // Update emails
          if (brandKit.email) {
            dataContent = dataContent.replace(
              /emails:\s*\[.*?\]/s,
              `emails: ["${brandKit.email.replace(/"/g, '\\"')}"]`
            );
          }

          // Update address
          if (brandKit.address) {
            const fullAddress = [brandKit.address, brandKit.city, brandKit.state, brandKit.country].filter(Boolean).join(", ");
            replaceField("address", fullAddress);
          }

          // Update tagline
          if (brandKit.tagline) replaceField("tagline", brandKit.tagline);

          writeFileSync(dataPath, dataContent);
          console.log(`[Rebuild] Updated data.ts from brand kit for ${website.slug}`);
        } catch (err) {
          console.log(`[Rebuild] Could not update data.ts:`, err);
        }

        // Logo is handled by update-data route (localizes + updates Header.tsx)
        // Rebuild only syncs text fields from brand kit, not images/components
      }
    }

    // Build and deploy in background
    (async () => {
      const buildResult = await buildSite(id);
      if (buildResult.success) {
        await deploySite(id, website.slug);
      }
    })().catch((err) => console.error("[Rebuild] Failed:", err));

    return NextResponse.json({ success: true, message: "Syncing data and rebuilding..." });
  } catch (err) {
    console.error("POST rebuild error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
