/**
 * Product promotion pipeline — bridges e-commerce products into the FlowSmartly ad system.
 * Promoted products become PRODUCT_LINK campaigns in the existing ad network.
 */

import { prisma } from "@/lib/db/client";

export interface PromoteDefaults {
  name: string;
  adType: "PRODUCT_LINK";
  headline: string;
  description: string;
  destinationUrl: string;
  mediaUrl: string | null;
  ctaText: string;
  adCategory: string;
  sourceProductId: string;
  sourceStoreId: string;
}

/**
 * Get pre-filled defaults for promoting a product as an ad campaign.
 */
export async function getPromoteDefaults(
  productId: string,
  userId: string
): Promise<PromoteDefaults | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, store: { userId } },
    select: {
      id: true,
      name: true,
      shortDescription: true,
      description: true,
      priceCents: true,
      images: true,
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!product) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  const storeUrl = `${baseUrl}/store/${product.store.slug}`;
  const productUrl = `${storeUrl}/products/${product.id}`;

  // Add UTM params for tracking
  const destinationUrl = `${productUrl}?utm_source=flowsmartly&utm_medium=ad&utm_campaign=${encodeURIComponent(product.name)}`;

  // Get first product image
  let mediaUrl: string | null = null;
  try {
    const images = JSON.parse(product.images as string || "[]");
    mediaUrl = images[0]?.url || null;
  } catch {}

  // Truncate description for ad
  const rawDesc = product.shortDescription || product.description || "";
  const description = rawDesc.length > 200 ? rawDesc.slice(0, 197) + "..." : rawDesc;

  const price = (product.priceCents / 100).toFixed(2);

  return {
    name: `Promote: ${product.name}`,
    adType: "PRODUCT_LINK",
    headline: product.name.length > 50 ? product.name.slice(0, 47) + "..." : product.name,
    description: description || `Shop ${product.name} for $${price} at ${product.store.name}`,
    destinationUrl,
    mediaUrl,
    ctaText: "Shop Now",
    adCategory: "E-commerce",
    sourceProductId: product.id,
    sourceStoreId: product.store.id,
  };
}

/**
 * Build the full ad campaign creation payload for a product promotion.
 * Compatible with the existing POST /api/ads logic.
 */
export function buildProductAdPayload(
  defaults: PromoteDefaults,
  options: {
    headline?: string;
    description?: string;
    ctaText?: string;
    budget: number; // in credits
    dailyBudget?: number; // in credits
    costPerView?: number; // in dollars
    startDate: string;
    endDate?: string;
    targeting?: Record<string, unknown>;
  }
) {
  return {
    name: defaults.name,
    adType: "PRODUCT_LINK" as const,
    headline: options.headline || defaults.headline,
    description: options.description || defaults.description,
    destinationUrl: defaults.destinationUrl,
    mediaUrl: defaults.mediaUrl,
    ctaText: options.ctaText || defaults.ctaText,
    adCategory: defaults.adCategory,
    budget: options.budget,
    dailyBudget: options.dailyBudget,
    costPerView: options.costPerView || 0.01,
    startDate: options.startDate,
    endDate: options.endDate,
    targeting: options.targeting || {},
    sourceProductId: defaults.sourceProductId,
    sourceStoreId: defaults.sourceStoreId,
  };
}
