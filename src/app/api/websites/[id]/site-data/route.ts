import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync } from "fs";
import { join } from "path";
import { getSiteDir } from "@/lib/website/site-builder";

/**
 * GET /api/websites/[id]/site-data
 * Reads the generated data.ts and extracts structured data for the editor.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, generatedPath: true, siteData: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Try siteData from DB first
    if (website.siteData && website.siteData !== "{}") {
      try {
        return NextResponse.json({ data: JSON.parse(website.siteData) });
      } catch {}
    }

    // Parse data.ts from generated files
    const siteDir = website.generatedPath || getSiteDir(id);
    const dataPath = join(siteDir, "src", "lib", "data.ts");

    try {
      const content = readFileSync(dataPath, "utf-8");

      // Extract companyInfo
      const companyMatch = content.match(/export const companyInfo\s*=\s*(\{[\s\S]*?\n\})/);
      const servicesMatch = content.match(/export const services\s*=\s*(\[[\s\S]*?\n\])/);
      const testimonialsMatch = content.match(/export const testimonials\s*=\s*(\[[\s\S]*?\n\])/);

      // Simple extraction — parse the stats from companyInfo
      const data: Record<string, unknown> = {};

      if (companyMatch) {
        // Extract key fields from companyInfo using regex
        const ci = companyMatch[1];
        data.company = {
          name: extractString(ci, "name"),
          shortName: extractString(ci, "shortName"),
          tagline: extractString(ci, "tagline"),
          description: extractString(ci, "description"),
          about: extractString(ci, "about"),
          mission: extractString(ci, "mission"),
          address: extractString(ci, "address"),
          city: extractString(ci, "city"),
          state: extractString(ci, "state"),
          country: extractString(ci, "country"),
          phones: extractArray(ci, "phones"),
          emails: extractArray(ci, "emails"),
          website: extractString(ci, "website"),
        };

        // Extract stats
        const statsBlock = ci.match(/stats:\s*\{([\s\S]*?)\}/);
        if (statsBlock) {
          const statPairs = [...statsBlock[1].matchAll(/(\w+):\s*(\d+)/g)];
          data.stats = statPairs.map(([, label, value]) => ({ label, value: parseInt(value) }));
        }
      }

      if (servicesMatch) {
        try {
          // Quick & dirty: eval-safe extraction of service objects
          const svcText = servicesMatch[1];
          const services: Array<Record<string, string>> = [];
          const svcBlocks = svcText.split(/\},\s*\{/);
          for (const block of svcBlocks) {
            services.push({
              id: extractString(block, "id"),
              title: extractString(block, "title"),
              shortDescription: extractString(block, "shortDescription"),
              description: extractString(block, "description"),
              icon: extractString(block, "icon"),
            });
          }
          data.services = services.filter((s) => s.title);
        } catch {}
      }

      if (testimonialsMatch) {
        try {
          const tText = testimonialsMatch[1];
          const testimonials: Array<Record<string, string | number>> = [];
          const tBlocks = tText.split(/\},\s*\{/);
          for (const block of tBlocks) {
            testimonials.push({
              name: extractString(block, "name"),
              role: extractString(block, "role"),
              text: extractString(block, "text"),
              rating: parseInt(extractString(block, "rating") || "5") || 5,
            });
          }
          data.testimonials = testimonials.filter((t) => t.name);
        } catch {}
      }

      // Save to DB for faster future loads
      await prisma.website.update({
        where: { id },
        data: { siteData: JSON.stringify(data) },
      });

      return NextResponse.json({ data });
    } catch {
      return NextResponse.json({ data: null });
    }
  } catch (err) {
    console.error("GET site-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function extractString(text: string, key: string): string {
  const match = text.match(new RegExp(`${key}:\\s*['"]([\\s\\S]*?)(?:(?<!\\\\)['"])`, "m"));
  return match ? match[1].replace(/\\'/g, "'").replace(/\\"/g, '"') : "";
}

function extractArray(text: string, key: string): string[] {
  const match = text.match(new RegExp(`${key}:\\s*\\[([^\\]]*?)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/['"]([^'"]*)['"]/g)].map((m) => m[1]);
}
