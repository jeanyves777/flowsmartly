import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getStoreDir } from "@/lib/store-builder/store-site-builder";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

// GET /api/ecommerce/store/[id]/site-data — Parse data.ts + products.ts for the editor
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatorVersion: true, generatedPath: true, siteData: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Return cached data if available
    if (store.siteData && store.siteData !== "{}") {
      try {
        return NextResponse.json(JSON.parse(store.siteData));
      } catch {}
    }

    const storeDir = store.generatedPath || getStoreDir(id);
    const dataPath = join(storeDir, "src", "lib", "data.ts");
    const productsPath = join(storeDir, "src", "lib", "products.ts");

    if (!existsSync(dataPath)) {
      return NextResponse.json({ error: "Store data files not found" }, { status: 404 });
    }

    const dataContent = readFileSync(dataPath, "utf-8");
    const productsContent = existsSync(productsPath) ? readFileSync(productsPath, "utf-8") : "";

    // Parse structured data from data.ts
    const result: Record<string, unknown> = {};

    // Extract storeInfo fields
    result.storeInfo = {
      name: extractString(dataContent, "name"),
      tagline: extractString(dataContent, "tagline"),
      description: extractString(dataContent, "description"),
      about: extractString(dataContent, "about"),
      mission: extractString(dataContent, "mission"),
      currency: extractString(dataContent, "currency"),
      region: extractString(dataContent, "region"),
      logoUrl: extractString(dataContent, "logoUrl"),
      bannerUrl: extractString(dataContent, "bannerUrl"),
      address: extractString(dataContent, "address"),
      ctaText: extractString(dataContent, "ctaText"),
      ctaUrl: extractString(dataContent, "ctaUrl"),
    };

    // Extract hero config
    result.heroConfig = {
      headline: extractString(dataContent, "headline"),
      subheadline: extractString(dataContent, "subheadline"),
      ctaText: extractNestedString(dataContent, "heroConfig", "ctaText"),
      ctaUrl: extractNestedString(dataContent, "heroConfig", "ctaUrl"),
    };

    // Extract nav links
    result.navLinks = extractLinkArray(dataContent, "navLinks");
    result.footerLinks = extractLinkArray(dataContent, "footerLinks");

    // Extract categories
    result.categories = extractObjectArray(dataContent, "categories", ["id", "name", "slug", "description", "image"]);

    // Extract FAQ
    result.faq = extractObjectArray(dataContent, "faq", ["question", "answer"]);

    // Extract products from products.ts
    if (productsContent) {
      result.products = extractObjectArray(productsContent, "products", [
        "id", "slug", "name", "shortDescription", "description",
        "priceCents", "comparePriceCents", "categoryId", "featured",
      ]);
    }

    // Detect available pages from src/app/ directory
    const appDir = join(storeDir, "src", "app");
    const pages: Array<{ slug: string; label: string }> = [];
    if (existsSync(appDir)) {
      const scanPages = (dir: string, prefix: string = "") => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (entry.name.startsWith("[") || entry.name.startsWith("_")) continue;
          const slug = prefix ? `${prefix}/${entry.name}` : entry.name;
          const pagePath = join(dir, entry.name, "page.tsx");
          if (existsSync(pagePath)) {
            const label = entry.name
              .replace(/-/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
            pages.push({ slug, label });
          }
        }
      };
      scanPages(appDir);
      // Add root page
      if (existsSync(join(appDir, "page.tsx"))) {
        pages.unshift({ slug: "", label: "Home" });
      }
    }
    result.pages = pages;

    // Cache the parsed data
    await prisma.store.update({
      where: { id },
      data: { siteData: JSON.stringify(result) },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/ecommerce/store/[id]/site-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

/**
 * Extract a string field value from TypeScript source.
 * Handles both 'single' and "double" quoted strings, including apostrophes.
 */
function extractString(source: string, field: string): string {
  // Try double-quoted first
  const doubleMatch = source.match(new RegExp(`${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (doubleMatch) return doubleMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  // Try single-quoted
  const singleMatch = source.match(new RegExp(`${field}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (singleMatch) return singleMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');

  // Try storeUrl() call
  const storeUrlMatch = source.match(new RegExp(`${field}:\\s*storeUrl\\((['"])(.*?)\\1\\)`));
  if (storeUrlMatch) return storeUrlMatch[2];

  return "";
}

function extractNestedString(source: string, parent: string, field: string): string {
  // Find the parent object block
  const parentMatch = source.match(new RegExp(`${parent}\\s*=\\s*\\{([\\s\\S]*?)\\};`));
  if (!parentMatch) return "";
  return extractString(parentMatch[1], field);
}

/**
 * Extract link arrays (navLinks, footerLinks) that may use storeUrl() calls.
 */
function extractLinkArray(source: string, arrayName: string): Array<{ href: string; label: string }> {
  const links: Array<{ href: string; label: string }> = [];

  // Find the array content
  const arrayMatch = source.match(new RegExp(`${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!arrayMatch) return links;

  const content = arrayMatch[1];
  // Split by }, { boundaries
  const items = content.split(/\},?\s*\{/);

  for (const item of items) {
    // Extract href (handles storeUrl('/path'), '/path', 'https://...')
    let href = "";
    const storeUrlHref = item.match(/href:\s*storeUrl\(['"]([^'"]*)['"]\)/);
    if (storeUrlHref) {
      href = storeUrlHref[1];
    } else {
      const plainHref = item.match(/href:\s*['"]([^'"]*)['"]/);
      if (plainHref) href = plainHref[1];
    }

    const label = extractString(item, "label");

    if (href || label) {
      links.push({ href, label });
    }
  }

  return links;
}

/**
 * Extract an array of objects with specified fields.
 */
function extractObjectArray(source: string, arrayName: string, fields: string[]): Record<string, string>[] {
  const result: Record<string, string>[] = [];

  const arrayMatch = source.match(new RegExp(`${arrayName}[^=]*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!arrayMatch) return result;

  const content = arrayMatch[1];
  // Split by }, { boundaries (accounting for nested objects)
  const items = content.split(/\},\s*\{/);

  for (const item of items) {
    const obj: Record<string, string> = {};
    for (const field of fields) {
      const val = extractString(item, field);
      if (val) obj[field] = val;

      // Also try numeric fields
      if (!val) {
        const numMatch = item.match(new RegExp(`${field}:\\s*(\\d+)`));
        if (numMatch) obj[field] = numMatch[1];
      }

      // Also try boolean fields
      if (!val) {
        const boolMatch = item.match(new RegExp(`${field}:\\s*(true|false)`));
        if (boolMatch) obj[field] = boolMatch[1];
      }
    }
    if (Object.keys(obj).length > 0) {
      result.push(obj);
    }
  }

  return result;
}
