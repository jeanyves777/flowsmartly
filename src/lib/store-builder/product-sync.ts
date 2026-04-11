/**
 * Product Sync Watchdog — auto-triggers store rebuild when products change.
 *
 * For V3 stores (SSR), product data lives in the DB and is served via API proxy,
 * so no file sync is needed. This module handles the case where stores cache
 * product data in products.ts on disk and need a rebuild after changes.
 *
 * This is fire-and-forget — product CRUD returns immediately, rebuild happens async.
 */

import { prisma } from "@/lib/db/client";

/**
 * Call this after any product create/update/delete.
 * Syncs products to products.ts and triggers a V3 rebuild if needed.
 */
export async function triggerStoreRebuildIfV2(storeId: string): Promise<void> {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { generatorVersion: true, slug: true, generatedPath: true, buildStatus: true },
    });

    if (!store || !store.generatedPath) return;

    // Don't stack rebuilds
    if (store.buildStatus === "building") {
      console.log(`[ProductSync] Store ${storeId} already building, skipping`);
      return;
    }

    console.log(`[ProductSync] Product changed in store ${storeId} — syncing and rebuilding`);

    // Sync products from DB to products.ts
    await syncProductsToFile(storeId, store.generatedPath);

    const { buildStoreV3, deployStoreV3 } = await import("./store-site-builder");

    const buildResult = await buildStoreV3(storeId);
    if (buildResult.success) {
      await deployStoreV3(storeId, store.slug);
      console.log(`[ProductSync] Store ${storeId} rebuilt and deployed`);
    } else {
      console.error(`[ProductSync] Rebuild failed for ${storeId}:`, buildResult.error?.substring(0, 200));
    }
  } catch (err: any) {
    console.error(`[ProductSync] Error:`, err.message);
  }
}

/**
 * Sync products from DB to the store's products.ts file.
 */
async function syncProductsToFile(storeId: string, storeDir: string): Promise<void> {
  const { readFileSync, writeFileSync, existsSync } = await import("fs");
  const { join } = await import("path");

  const productsPath = join(storeDir, "src", "lib", "products.ts");
  if (!existsSync(productsPath)) return;

  const products = await prisma.product.findMany({
    where: { storeId, status: { not: "ARCHIVED" } },
    include: { productCategory: true },
    orderBy: { createdAt: "asc" },
  });

  // Read the current products.ts to preserve the types and helper functions
  const content = readFileSync(productsPath, "utf-8");

  // Find the products array and replace it
  const productsArrayStr = products.map((p) => {
    let images: Array<{ url: string; alt: string }> = [];
    try {
      const parsed = JSON.parse(p.images || "[]");
      images = parsed.map((img: any) => ({
        url: typeof img === "string" ? img : img.url || "",
        alt: typeof img === "string" ? p.name : img.alt || p.name,
      }));
    } catch {}

    let tags: string[] = [];
    try { tags = JSON.parse(p.tags || "[]"); } catch {}

    return `  {
    id: "${p.id}",
    slug: "${p.slug}",
    name: "${escapeStr(p.name)}",
    shortDescription: "${escapeStr(p.shortDescription || "")}",
    description: "${escapeStr(p.description || "")}",
    priceCents: ${p.priceCents},
    ${p.comparePriceCents ? `comparePriceCents: ${p.comparePriceCents},` : ""}
    categoryId: "${p.categoryId || ""}",
    tags: ${JSON.stringify(tags)},
    images: ${JSON.stringify(images)},
    variants: [],
    labels: [],
    featured: false,
    inStock: true,
  }`;
  }).join(",\n");

  // Replace the products array in the file
  const newContent = content.replace(
    /export const products[^=]*=\s*\[[\s\S]*?\];/,
    `export const products: Product[] = [\n${productsArrayStr},\n];`
  );

  if (newContent !== content) {
    writeFileSync(productsPath, newContent, "utf-8");
    console.log(`[ProductSync] Synced ${products.length} products to products.ts`);
  }
}

function escapeStr(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
