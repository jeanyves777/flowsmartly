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
      select: { generatorVersion: true, slug: true, generatedPath: true, buildStatus: true, flatRateShippingCents: true, freeShippingThresholdCents: true },
    });

    if (!store || !store.generatedPath) return;

    // Don't stack rebuilds
    if (store.buildStatus === "building") {
      console.log(`[ProductSync] Store ${storeId} already building, skipping`);
      return;
    }

    console.log(`[ProductSync] Product changed in store ${storeId} — syncing and rebuilding`);

    // Sync products, categories, and store settings from DB to store files
    await syncProductsToFile(storeId, store.generatedPath);
    await syncCategoriesToDataFile(storeId, store.generatedPath);
    await syncShippingToDataFile(storeId, store.generatedPath, store.freeShippingThresholdCents);
    await syncPaymentMethodsToDataFile(storeId, store.generatedPath);

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
    where: { storeId, status: "ACTIVE", deletedAt: null },
    include: { productCategory: true, variants: { where: { isActive: true } } },
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

    let labels: string[] = [];
    try { labels = JSON.parse(p.labels || "[]"); } catch {}

    // Sync variants from DB
    const variants = (p.variants || []).map((v: any) => {
      let options: Record<string, string> = {};
      try { options = JSON.parse(v.options || "{}"); } catch {}
      return {
        id: v.id,
        name: v.name,
        sku: v.sku || "",
        priceCents: v.priceCents,
        comparePriceCents: v.comparePriceCents || null,
        options,
        quantity: v.quantity,
        imageUrl: v.imageUrl || "",
      };
    });

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
    variants: ${JSON.stringify(variants)},
    labels: ${JSON.stringify(labels)},
    badges: ${JSON.stringify(labels)},
    featured: ${labels.includes("featured")},
    inStock: ${p.trackInventory ? p.quantity > 0 : true},
  }`;
  }).join(",\n");

  // Replace the products array in the file. Guard against the empty-store
  // case where productsArrayStr is "" — producing `[\n,\n]` which is invalid JS.
  const productsLiteral = productsArrayStr ? `[\n${productsArrayStr},\n]` : `[]`;
  const newContent = content.replace(
    /export const products[^=]*=\s*\[[\s\S]*?\];/,
    `export const products: Product[] = ${productsLiteral};`
  );

  if (newContent !== content) {
    writeFileSync(productsPath, newContent, "utf-8");
    console.log(`[ProductSync] Synced ${products.length} products to products.ts`);
  }
}

/**
 * Sync categories from DB to the store's data.ts file.
 * Replaces the `export const categories = [...]` array.
 */
async function syncCategoriesToDataFile(storeId: string, storeDir: string): Promise<void> {
  const { readFileSync, writeFileSync, existsSync } = await import("fs");
  const { join } = await import("path");

  const dataPath = join(storeDir, "src", "lib", "data.ts");
  if (!existsSync(dataPath)) return;

  const categories = await prisma.productCategory.findMany({
    where: { storeId },
    select: { id: true, name: true, slug: true, description: true, imageUrl: true },
    orderBy: { createdAt: "asc" },
  });

  const content = readFileSync(dataPath, "utf-8");

  // Build categories array
  const categoriesArrayStr = categories.map((c) => {
    return `  { id: "${c.id}", name: "${escapeStr(c.name)}", slug: "${c.slug}", description: "${escapeStr(c.description || "")}", image: "${escapeStr(c.imageUrl || "")}" }`;
  }).join(",\n");

  // Replace the categories array in the file. Guard empty case.
  const categoriesLiteral = categoriesArrayStr ? `[\n${categoriesArrayStr},\n]` : `[]`;
  const newContent = content.replace(
    /export const categories[^=]*=\s*\[[\s\S]*?\];/,
    `export const categories = ${categoriesLiteral};`
  );

  if (newContent !== content) {
    writeFileSync(dataPath, newContent, "utf-8");
    console.log(`[ProductSync] Synced ${categories.length} categories to data.ts`);
  }
}

/**
 * Sync shipping methods + config from DB to the store's data.ts.
 * Writes shippingMethods array and updates freeShippingThresholdCents.
 */
async function syncShippingToDataFile(storeId: string, storeDir: string, freeThresholdCents: number): Promise<void> {
  const { readFileSync, writeFileSync, existsSync } = await import("fs");
  const { join } = await import("path");

  const dataPath = join(storeDir, "src", "lib", "data.ts");
  if (!existsSync(dataPath)) return;

  let content = readFileSync(dataPath, "utf-8");

  // Update freeShippingThresholdCents
  if (content.includes("freeShippingThresholdCents:")) {
    content = content.replace(/freeShippingThresholdCents:\s*\d+/, `freeShippingThresholdCents: ${freeThresholdCents}`);
  }

  // Fetch shipping methods from DB (shared query — same as store-agent)
  const { fetchStoreShippingMethods } = await import("./shared-queries");
  const methods = await fetchStoreShippingMethods(storeId);

  const methodsStr = methods.map(m =>
    `  { id: "${m.id}", name: "${escapeStr(m.name)}", description: "${escapeStr(m.description || "")}", priceCents: ${m.priceCents}, estimatedDays: "${escapeStr(m.estimatedDays || "")}", isActive: true }`
  ).join(",\n");

  // Replace or add shippingMethods array. Guard empty case.
  const shippingLiteral = methodsStr ? `[\n${methodsStr},\n]` : `[]`;
  if (content.includes("export const shippingMethods")) {
    const replacement = `export const shippingMethods: ShippingMethod[] = ${shippingLiteral};`;
    content = content.replace(
      /export const shippingMethods[^=]*=\s*\[[\s\S]*?\];/,
      replacement
    );
  } else {
    content += `\n\nexport const shippingMethods: ShippingMethod[] = ${shippingLiteral};\n`;
  }

  writeFileSync(dataPath, content, "utf-8");
  console.log(`[ProductSync] Synced ${methods.length} shipping methods to data.ts`);
}

/**
 * Sync active payment methods from DB to store data.ts.
 */
async function syncPaymentMethodsToDataFile(storeId: string, storeDir: string): Promise<void> {
  const { readFileSync, writeFileSync, existsSync } = await import("fs");
  const { join } = await import("path");

  const dataPath = join(storeDir, "src", "lib", "data.ts");
  if (!existsSync(dataPath)) return;

  const methods = await prisma.storePaymentMethod.findMany({
    where: { storeId, isActive: true },
    select: { methodType: true, provider: true },
  });

  const LABELS: Record<string, { label: string; icon: string }> = {
    card: { label: "Credit / Debit Card", icon: "💳" },
    apple_pay: { label: "Apple Pay", icon: "🍎" },
    google_pay: { label: "Google Pay", icon: "📱" },
    cod: { label: "Cash on Delivery", icon: "💵" },
    mobile_money: { label: "Mobile Money", icon: "📲" },
    bank_transfer: { label: "Bank Transfer", icon: "🏦" },
  };

  const methodsStr = methods.map(m => {
    const info = LABELS[m.methodType] || { label: m.methodType, icon: "💳" };
    return `  { value: "${m.methodType}", label: "${info.label}", icon: "${info.icon}" }`;
  }).join(",\n");

  // Build the array literal — avoid the "[,]" invalid-JS bug when the store
  // has no payment methods. Empty-methods → "[]", populated → "[\n  {...},\n]".
  const arrayLiteral = methodsStr ? `[\n${methodsStr},\n]` : `[]`;

  let content = readFileSync(dataPath, "utf-8");

  // Regex tolerates optional TypeScript type annotation: `paymentMethods: Type[] =`
  if (content.includes("export const paymentMethods")) {
    content = content.replace(
      /export const paymentMethods[^=]*=\s*\[[\s\S]*?\];/,
      `export const paymentMethods = ${arrayLiteral};`
    );
  } else {
    content += `\n\nexport const paymentMethods = ${arrayLiteral};\n`;
  }

  writeFileSync(dataPath, content, "utf-8");
  console.log(`[ProductSync] Synced ${methods.length} payment methods to data.ts`);
}

function escapeStr(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
