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

    // Try siteData from DB first — re-parse if logo, heroImages, or navLinks are missing
    if (website.siteData && website.siteData !== "{}") {
      try {
        const cached = JSON.parse(website.siteData);
        if (cached.logo && cached.heroImages?.length && cached.navLinks?.length) {
          return NextResponse.json({ data: cached, pages });
        }
        // Missing key fields — fall through to re-parse from files
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
          ctaText: extractString(ci, "ctaText"),
          ctaUrl: extractString(ci, "ctaUrl"),
        };

        // Extract stats
        const statsBlock = ci.match(/stats:\s*\{([\s\S]*?)\}/);
        if (statsBlock) {
          const statPairs = [...statsBlock[1].matchAll(/(\w+):\s*(\d+)/g)];
          data.stats = statPairs.map(([, label, value]) => ({ label, value: parseInt(value) }));
        }
      }

      // Extract navigation links (handles both plain strings and siteUrl() calls)
      data.navLinks = extractLinkArray(content, "navLinks");
      // footerLinks may use spread ...navLinks — extract only the non-spread entries
      const rawFooterLinks = extractLinkArray(content, "footerLinks");
      const navHrefs = new Set((data.navLinks || []).map((l: any) => l.href));
      data.footerLinks = rawFooterLinks.filter((l: any) => !navHrefs.has(l.href));

      // Extract all arrays using robust method
      data.services = extractObjectArray(content, "services", ["id", "title", "shortDescription", "description", "icon", "image", "link"]);
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
        // Check Logo.tsx first, then Header.tsx for image-based logos
        for (const componentName of ["Logo.tsx", "Header.tsx"]) {
          if (data.logo && data.logo !== "__svg__") break;
          try {
            const componentPath = join(siteDir, "src", "components", componentName);
            const componentContent = readFileSync(componentPath, "utf-8");
            // Check for image-based logo (img src with alt="Logo")
            const logoImgMatch = componentContent.match(/(?:alt=["']Logo["'][^>]*src=["']|src=["'])([^'"]+\.(?:png|jpg|jpeg|webp|svg|gif))["']/);
            if (logoImgMatch) {
              data.logo = logoImgMatch[1];
            }
            // If SVG-based logo (no image), mark as "svg" so editor knows it exists
            if (!data.logo && componentContent.includes("<svg")) {
              data.logo = "__svg__";
            }
          } catch { /* Component may not exist */ }
        }
      }

      // Save to DB for faster future loads — merge with existing so extra fields
      // like aboutImage and pageImages aren't wiped by a re-parse
      const existingCached = website.siteData ? (() => { try { return JSON.parse(website.siteData); } catch { return {}; } })() : {};
      // Only override existing fields with freshly parsed values that are non-empty
      const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)));
      const mergedData = { ...existingCached, ...cleanData };
      await prisma.website.update({
        where: { id },
        data: { siteData: JSON.stringify(mergedData) },
      });

      return NextResponse.json({ data: mergedData, pages });
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
  // Try double-quoted first (handles apostrophes inside), then single-quoted
  const dblMatch = text.match(new RegExp(`${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m"));
  if (dblMatch) return dblMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const sglMatch = text.match(new RegExp(`${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, "m"));
  if (sglMatch) return sglMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  return "";
}

function extractArray(text: string, key: string): string[] {
  const match = text.match(new RegExp(`${key}:\\s*\\[([^\\]]*?)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/['"]([^'"]*)['"]/g)].map((m) => m[1]);
}

/**
 * Extract link arrays (navLinks, footerLinks) that may use siteUrl() or plain strings.
 * Handles both { href: ..., label: ... } and { label: ..., href: ... } field orders.
 */
function extractLinkArray(content: string, exportName: string): Array<{ href: string; label: string }> {
  const startRegex = new RegExp(`export const ${exportName}\\s*=\\s*\\[`);
  const startMatch = startRegex.exec(content);
  if (!startMatch) return [];

  // Find matching closing bracket
  let depth = 1;
  let i = startMatch.index + startMatch[0].length;
  while (i < content.length && depth > 0) {
    if (content[i] === "[") depth++;
    if (content[i] === "]") depth--;
    i++;
  }
  const arrayContent = content.substring(startMatch.index + startMatch[0].length, i - 1);

  // Split into individual object blocks (handles both }, { and },\n  { patterns)
  const links: Array<{ href: string; label: string }> = [];
  const objectBlocks = arrayContent.split(/\},?\s*\n?\s*\{/);
  for (const block of objectBlocks) {
    if (block.trim().startsWith("...")) continue; // skip spread entries like ...navLinks
    // Extract href — handles siteUrl('/path'), plain '/path', or "https://..." in any field order
    const hrefMatch = block.match(/href:\s*(?:siteUrl\(\s*['"]([^'"]*)['"]\s*\)|['"]([^'"]*)['"]\s*)/);
    const labelMatch = block.match(/label:\s*['"]([^'"]*)['"]/);
    if (hrefMatch && labelMatch) {
      const href = hrefMatch[1] !== undefined ? hrefMatch[1] : hrefMatch[2];
      links.push({ href, label: labelMatch[1] });
    }
  }
  return links;
}
