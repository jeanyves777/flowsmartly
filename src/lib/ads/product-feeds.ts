/**
 * Product Feed Generator
 * Generates product feeds for Google Shopping (XML), Facebook Catalog (JSON), and TikTok (CSV).
 */

import { prisma } from "@/lib/db/client";

interface FeedProduct {
  id: string;
  name: string;
  description: string;
  link: string;
  imageUrl: string;
  price: string;
  salePrice?: string;
  availability: string;
  condition: string;
  brand: string;
  category: string;
  sku: string;
}

async function getStoreProducts(storeId: string): Promise<FeedProduct[]> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { slug: true, name: true, currency: true },
  });
  if (!store) return [];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  const storeUrl = `${baseUrl}/store/${store.slug}`;

  const products = await prisma.product.findMany({
    where: { storeId, status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      name: true,
      shortDescription: true,
      description: true,
      priceCents: true,
      comparePriceCents: true,
      images: true,
      trackInventory: true,
      quantity: true,
      productCategory: { select: { name: true } },
    },
  });

  const currency = store.currency || "USD";

  return products.map((p) => {
    let imageUrl = "";
    try {
      const imgs = JSON.parse(p.images as string || "[]");
      imageUrl = imgs[0]?.url || "";
    } catch {}

    const price = `${(p.priceCents / 100).toFixed(2)} ${currency}`;
    const salePrice = p.comparePriceCents && p.comparePriceCents > p.priceCents
      ? `${(p.priceCents / 100).toFixed(2)} ${currency}`
      : undefined;
    const displayPrice = p.comparePriceCents && p.comparePriceCents > p.priceCents
      ? `${(p.comparePriceCents / 100).toFixed(2)} ${currency}`
      : price;

    const availability = p.trackInventory
      ? (p.quantity > 0 ? "in_stock" : "out_of_stock")
      : "in_stock";

    return {
      id: p.id,
      name: p.name,
      description: p.shortDescription || p.description || p.name,
      link: `${storeUrl}/products/${p.id}`,
      imageUrl,
      price: displayPrice,
      salePrice,
      availability,
      condition: "new",
      brand: store.name,
      category: p.productCategory?.name || "General",
      sku: p.id,
    };
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate Google Shopping XML feed (RSS 2.0 with g: namespace)
 */
export async function generateGoogleShoppingFeed(storeId: string): Promise<string> {
  const products = await getStoreProducts(storeId);
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true, slug: true },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(store?.name || "Store")}</title>
    <link>${baseUrl}/store/${store?.slug || ""}</link>
    <description>Product feed for ${escapeXml(store?.name || "Store")}</description>
`;

  for (const p of products) {
    xml += `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(p.description.slice(0, 5000))}</g:description>
      <g:link>${escapeXml(p.link)}</g:link>
      <g:image_link>${escapeXml(p.imageUrl)}</g:image_link>
      <g:price>${escapeXml(p.price)}</g:price>
${p.salePrice ? `      <g:sale_price>${escapeXml(p.salePrice)}</g:sale_price>\n` : ""}      <g:availability>${p.availability}</g:availability>
      <g:condition>${p.condition}</g:condition>
      <g:brand>${escapeXml(p.brand)}</g:brand>
      <g:product_type>${escapeXml(p.category)}</g:product_type>
      <g:mpn>${escapeXml(p.sku)}</g:mpn>
    </item>
`;
  }

  xml += `  </channel>
</rss>`;

  return xml;
}

/**
 * Generate Facebook Catalog JSON feed
 */
export async function generateFacebookCatalog(storeId: string): Promise<string> {
  const products = await getStoreProducts(storeId);

  const catalog = products.map((p) => ({
    id: p.id,
    title: p.name,
    description: p.description.slice(0, 5000),
    availability: p.availability === "in_stock" ? "in stock" : "out of stock",
    condition: p.condition,
    price: p.price,
    sale_price: p.salePrice || undefined,
    link: p.link,
    image_link: p.imageUrl,
    brand: p.brand,
    product_type: p.category,
  }));

  return JSON.stringify(catalog, null, 2);
}

/**
 * Generate TikTok product feed CSV
 */
export async function generateTikTokFeed(storeId: string): Promise<string> {
  const products = await getStoreProducts(storeId);

  const headers = [
    "sku_id", "title", "description", "availability", "condition",
    "price", "sale_price", "link", "image_link", "brand", "product_type",
  ];

  function escapeCsv(val: string): string {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  const rows = products.map((p) => [
    p.sku,
    p.name,
    p.description.slice(0, 1000),
    p.availability === "in_stock" ? "IN_STOCK" : "OUT_OF_STOCK",
    "NEW",
    p.price,
    p.salePrice || "",
    p.link,
    p.imageUrl,
    p.brand,
    p.category,
  ].map(escapeCsv).join(","));

  return [headers.join(","), ...rows].join("\n");
}
