import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync, readdirSync, statSync } from "fs";
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

    const siteDir = website.generatedPath || getSiteDir(id);

    // Detect pages from the generated site
    const pages = detectPages(siteDir);

    // Try siteData from DB first — but if logo or heroImages are missing, re-parse
    if (website.siteData && website.siteData !== "{}") {
      try {
        const cached = JSON.parse(website.siteData);
        if (cached.logo && cached.heroImages?.length) {
          return NextResponse.json({ data: cached, pages });
        }
        // Missing logo or heroImages — fall through to re-parse from files
      } catch {}
    }

    // Parse data.ts from generated files
    const dataPath = join(siteDir, "src", "lib", "data.ts");

    try {
      const content = readFileSync(dataPath, "utf-8");

      // Extract companyInfo
      const companyMatch = content.match(/export const companyInfo\s*=\s*(\{[\s\S]*?\n\})/);

      const data: Record<string, any> = {};

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

      // Extract all arrays using robust method
      data.services = extractObjectArray(content, "services", ["id", "title", "shortDescription", "description", "icon", "image"]);
      data.testimonials = extractObjectArray(content, "testimonials", ["name", "role", "text"]);
      data.team = extractObjectArray(content, "team", ["name", "role", "bio", "image"]);
      if (!data.team?.length) data.team = extractObjectArray(content, "teamMembers", ["name", "role", "bio", "image"]);
      data.faq = extractObjectArray(content, "faqItems", ["question", "answer"]);
      if (!data.faq?.length) data.faq = extractObjectArray(content, "faqs", ["question", "answer"]);
      if (!data.faq?.length) data.faq = extractObjectArray(content, "faq", ["question", "answer"]);
      data.blogPosts = extractObjectArray(content, "blogPosts", ["id", "title", "excerpt", "content", "category", "date", "author", "image"]);
      data.galleryImages = extractObjectArray(content, "galleryImages", ["src", "alt", "category"]);

      // Extract hero images from data.ts
      const slidesMatch = content.match(/(?:slides|heroImages|heroSlides)\s*=\s*\[([\s\S]*?)\]/);
      if (slidesMatch) {
        const imgPaths = [...slidesMatch[1].matchAll(/src:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
        if (imgPaths.length > 0) data.heroImages = imgPaths;
      }

      // Also check Hero.tsx for slides (some sites define them in the component)
      if (!data.heroImages?.length) {
        try {
          const heroPath = join(siteDir, "src", "components", "Hero.tsx");
          const heroContent = readFileSync(heroPath, "utf-8");
          const heroSlidesMatch = heroContent.match(/(?:const\s+)?slides\s*=\s*\[([\s\S]*?)\];/);
          if (heroSlidesMatch) {
            const imgPaths = [...heroSlidesMatch[1].matchAll(/src:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
            if (imgPaths.length > 0) data.heroImages = imgPaths;
          }
        } catch { /* Hero.tsx may not exist */ }
      }

      // Extract logo — check data.ts first, then Logo.tsx for image-based logos
      const logoMatch = content.match(/logo:\s*['"]([^'"]+)['"]/);
      if (logoMatch) {
        data.logo = logoMatch[1];
      }
      if (!data.logo) {
        try {
          const logoPath = join(siteDir, "src", "components", "Logo.tsx");
          const logoContent = readFileSync(logoPath, "utf-8");
          // Check for image-based logo (img src or Image src)
          const logoImgMatch = logoContent.match(/(?:src=\{?['"]|src:\s*['"])([^'"]+\.(?:png|jpg|jpeg|webp|svg|gif))['"]/);
          if (logoImgMatch) {
            data.logo = logoImgMatch[1];
          }
          // If SVG-based logo (no image), mark as "svg" so editor knows it exists
          if (!data.logo && logoContent.includes("<svg")) {
            data.logo = "__svg__";
          }
        } catch { /* Logo.tsx may not exist */ }
      }

      // Save to DB for faster future loads
      await prisma.website.update({
        where: { id },
        data: { siteData: JSON.stringify(data) },
      });

      return NextResponse.json({ data, pages });
    } catch {
      return NextResponse.json({ data: null, pages });
    }
  } catch (err) {
    console.error("GET site-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function detectPages(siteDir: string): Array<{ slug: string; label: string }> {
  const appDir = join(siteDir, "src", "app");
  const pages: Array<{ slug: string; label: string }> = [];

  // Home page
  try {
    statSync(join(appDir, "page.tsx"));
    pages.push({ slug: "", label: "Home" });
  } catch {}

  // Sub-pages
  try {
    for (const entry of readdirSync(appDir)) {
      const full = join(appDir, entry);
      try {
        if (statSync(full).isDirectory() && !entry.startsWith("_") && !entry.startsWith(".")) {
          if (statSync(join(full, "page.tsx")).isFile()) {
            pages.push({ slug: entry, label: entry.charAt(0).toUpperCase() + entry.slice(1).replace(/-/g, " ") });
          }
        }
      } catch {}
    }
  } catch {}

  return pages;
}

/**
 * Robustly extract an array of objects from data.ts exports.
 * Finds `export const {name} = [...]` and extracts objects with the given fields.
 */
function extractObjectArray(content: string, exportName: string, fields: string[]): any[] {
  // Find the start of the export
  const startRegex = new RegExp(`export const ${exportName}\\s*=\\s*\\[`);
  const startMatch = startRegex.exec(content);
  if (!startMatch) return [];

  // Find the matching closing bracket by counting brackets
  let depth = 1;
  let i = startMatch.index + startMatch[0].length;
  while (i < content.length && depth > 0) {
    if (content[i] === "[") depth++;
    if (content[i] === "]") depth--;
    i++;
  }
  const arrayContent = content.substring(startMatch.index + startMatch[0].length, i - 1);

  // Split by `}, {` or `},\n  {` patterns (object boundaries)
  const blocks = arrayContent.split(/\}\s*,\s*\{/);

  return blocks.map((block) => {
    const obj: Record<string, any> = {};
    for (const field of fields) {
      const val = extractString(block, field);
      if (val) obj[field] = val;
    }
    // Also try to extract number fields (like rating)
    const ratingMatch = block.match(/rating:\s*(\d+)/);
    if (ratingMatch) obj.rating = parseInt(ratingMatch[1]);
    return obj;
  }).filter((obj) => Object.keys(obj).length > 0);
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
