import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getStoreDir } from "@/lib/store-builder/store-site-builder";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// POST /api/ecommerce/store/[id]/update-data — Save editor changes to data.ts/products.ts
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatorVersion: true, generatedPath: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (store.generatorVersion !== "v2") {
      return NextResponse.json({ error: "Only V2 stores support data updates" }, { status: 400 });
    }

    const storeDir = store.generatedPath || getStoreDir(id);
    const dataPath = join(storeDir, "src", "lib", "data.ts");
    if (!existsSync(dataPath)) {
      return NextResponse.json({ error: "Store data files not found" }, { status: 404 });
    }

    const body = await request.json();
    const { storeInfo, heroConfig, navLinks, footerLinks, faq, products } = body;

    let data = readFileSync(dataPath, "utf-8");

    // Update storeInfo fields
    if (storeInfo) {
      const stringFields = ["name", "tagline", "description", "about", "mission", "address", "ctaText", "ctaUrl"];
      for (const field of stringFields) {
        if (storeInfo[field] !== undefined) {
          data = replaceField(data, field, storeInfo[field]);
        }
      }

      // Update phone/email arrays
      if (storeInfo.phones) {
        const phonesStr = storeInfo.phones.map((p: string) => `"${escapeStr(p)}"`).join(", ");
        data = data.replace(/phones:\s*\[.*?\]/s, `phones: [${phonesStr}]`);
      }
      if (storeInfo.emails) {
        const emailsStr = storeInfo.emails.map((e: string) => `"${escapeStr(e)}"`).join(", ");
        data = data.replace(/emails:\s*\[.*?\]/s, `emails: [${emailsStr}]`);
      }
    }

    // Update heroConfig
    if (heroConfig) {
      for (const field of ["headline", "subheadline"]) {
        if (heroConfig[field] !== undefined) {
          // Replace within heroConfig block
          const heroBlock = data.match(/heroConfig\s*=\s*\{([\s\S]*?)\};/);
          if (heroBlock) {
            const updated = replaceField(heroBlock[1], field, heroConfig[field]);
            data = data.replace(heroBlock[1], updated);
          }
        }
      }
    }

    // Update navLinks
    if (navLinks && Array.isArray(navLinks)) {
      const navStr = navLinks
        .map((l: { href: string; label: string }) => {
          const href = l.href.startsWith("/") ? `storeUrl("${escapeStr(l.href)}")` : `"${escapeStr(l.href)}"`;
          return `  { href: ${href}, label: "${escapeStr(l.label)}" }`;
        })
        .join(",\n");
      data = data.replace(
        /export const navLinks\s*=\s*\[[\s\S]*?\];/,
        `export const navLinks = [\n${navStr},\n];`
      );
    }

    // Update footerLinks
    if (footerLinks && Array.isArray(footerLinks)) {
      const footerStr = footerLinks
        .map((l: { href: string; label: string }) => {
          const href = l.href.startsWith("/") ? `storeUrl("${escapeStr(l.href)}")` : `"${escapeStr(l.href)}"`;
          return `  { href: ${href}, label: "${escapeStr(l.label)}" }`;
        })
        .join(",\n");
      data = data.replace(
        /export const footerLinks\s*=\s*\[[\s\S]*?\];/,
        `export const footerLinks = [\n  ...navLinks,\n${footerStr},\n];`
      );
    }

    // Update FAQ
    if (faq && Array.isArray(faq)) {
      const faqStr = faq
        .map((item: { question: string; answer: string }) =>
          `  {\n    question: "${escapeStr(item.question)}",\n    answer: "${escapeStr(item.answer)}",\n  }`
        )
        .join(",\n");
      data = data.replace(
        /export const faq\s*=\s*\[[\s\S]*?\];/,
        `export const faq = [\n${faqStr},\n];`
      );
    }

    writeFileSync(dataPath, data, "utf-8");

    // Update products.ts if products provided
    if (products && Array.isArray(products)) {
      const productsPath = join(storeDir, "src", "lib", "products.ts");
      if (existsSync(productsPath)) {
        updateProductsFile(productsPath, products);
      }
    }

    // Clear cached site data
    await prisma.store.update({
      where: { id },
      data: { siteData: "{}" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/ecommerce/store/[id]/update-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeStr(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Replace a field value in TypeScript source.
 * Uses double-quoted output to avoid apostrophe issues.
 */
function replaceField(source: string, field: string, value: string): string {
  const escaped = escapeStr(value);
  // Match field: 'value' or field: "value"
  const regex = new RegExp(
    `(${field}:\\s*)(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")`
  );
  return source.replace(regex, `$1"${escaped}"`);
}

/**
 * Update specific product fields in products.ts.
 * Only updates name, description, shortDescription, priceCents for existing products.
 */
function updateProductsFile(
  productsPath: string,
  products: Array<{
    id?: string;
    slug?: string;
    name?: string;
    description?: string;
    shortDescription?: string;
    priceCents?: number;
  }>
): void {
  let content = readFileSync(productsPath, "utf-8");

  for (const product of products) {
    if (!product.slug && !product.id) continue;

    // Find the product block by slug or id
    const identifier = product.slug
      ? `slug:\\s*["']${product.slug}["']`
      : `id:\\s*["']${product.id}["']`;

    const productBlock = content.match(new RegExp(`\\{[\\s\\S]*?${identifier}[\\s\\S]*?\\}`, "m"));
    if (!productBlock) continue;

    let block = productBlock[0];
    const originalBlock = block;

    if (product.name !== undefined) {
      block = replaceField(block, "name", product.name);
    }
    if (product.description !== undefined) {
      block = replaceField(block, "description", product.description);
    }
    if (product.shortDescription !== undefined) {
      block = replaceField(block, "shortDescription", product.shortDescription);
    }
    if (product.priceCents !== undefined) {
      block = block.replace(
        /priceCents:\s*\d+/,
        `priceCents: ${product.priceCents}`
      );
    }

    if (block !== originalBlock) {
      content = content.replace(originalBlock, block);
    }
  }

  writeFileSync(productsPath, content, "utf-8");
}
