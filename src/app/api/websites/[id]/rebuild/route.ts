import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildSite, deploySite, getSiteDir, buildSiteV3, deploySiteV3 } from "@/lib/website/site-builder";

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
      select: { id: true, slug: true, generatedPath: true, brandKitId: true, siteData: true, generatorVersion: true },
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

          // Use siteData (editor values) first, fallback to brandKit
          const siteData = website.siteData ? JSON.parse(website.siteData) : {};
          const company = siteData.company || {};

          // Update company name — editor value takes priority
          const name = company.name || brandKit.name;
          if (name) replaceField("name", name);

          // Update tagline — editor value takes priority
          const tagline = company.tagline || brandKit.tagline;
          if (tagline) replaceField("tagline", tagline);

          // Update phone numbers
          const phones = company.phones || (brandKit.phone ? [brandKit.phone] : null);
          if (phones?.length) {
            const items = phones.map((v: string) => `"${v.replace(/"/g, '\\"')}"`).join(", ");
            dataContent = dataContent.replace(/phones:\s*\[.*?\]/s, `phones: [${items}]`);
          }

          // Update emails
          const emails = company.emails || (brandKit.email ? [brandKit.email] : null);
          if (emails?.length) {
            const items = emails.map((v: string) => `"${v.replace(/"/g, '\\"')}"`).join(", ");
            dataContent = dataContent.replace(/emails:\s*\[.*?\]/s, `emails: [${items}]`);
          }

          // Update address
          const address = company.address || brandKit.address;
          if (address) {
            const city = company.city || brandKit.city;
            const state = company.state || brandKit.state;
            const country = company.country || brandKit.country;
            const fullAddress = [address, city, state, country].filter(Boolean).join(", ");
            replaceField("address", fullAddress);
          }

          // Update other fields from editor
          if (company.shortName) replaceField("shortName", company.shortName);
          if (company.description) replaceField("description", company.description);
          if (company.about) replaceField("about", company.about);
          if (company.mission) replaceField("mission", company.mission);
          if (company.ctaText) replaceField("ctaText", company.ctaText);
          if (company.ctaUrl) replaceField("ctaUrl", company.ctaUrl);

          writeFileSync(dataPath, dataContent);
          console.log(`[Rebuild] Updated data.ts from brand kit for ${website.slug}`);
        } catch (err) {
          console.log(`[Rebuild] Could not update data.ts:`, err);
        }

        // Logo is handled by update-data route (localizes + updates Header.tsx)
        // Rebuild only syncs text fields from brand kit, not images/components
      }
    }

    // Build and deploy in background using correct builder for the site version
    const isV3 = website.generatorVersion === "v3";
    (async () => {
      if (isV3) {
        const buildResult = await buildSiteV3(id);
        if (buildResult.success) await deploySiteV3(id, website.slug);
      } else {
        const buildResult = await buildSite(id);
        if (buildResult.success) {
          await deploySite(id, website.slug);
          // Update page count from output
          const outputDir = process.platform === "win32"
            ? join(siteDir, "..", "..", "sites-output", website.slug)
            : `/var/www/flowsmartly/sites-output/${website.slug}`;
          try {
            const { readdirSync } = await import("fs");
            const htmlFiles = readdirSync(outputDir).filter(
              (f: string) => f.endsWith(".html") && f !== "404.html" && f !== "_error.html"
            );
            await prisma.website.update({
              where: { id },
              data: { pageCount: htmlFiles.length },
            });
          } catch {}
        }
      }
    })().catch((err) => console.error("[Rebuild] Failed:", err));

    return NextResponse.json({ success: true, message: "Syncing data and rebuilding..." });
  } catch (err) {
    console.error("POST rebuild error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
