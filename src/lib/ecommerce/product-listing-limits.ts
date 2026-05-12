import { prisma } from "@/lib/db/client";

export const FLOWSHOP_BASE_PRODUCT_LISTING_LIMIT = 20;
export const FLOWSHOP_PRODUCT_LISTING_UNLOCK_SIZE = 5;
export const FLOWSHOP_PRODUCT_LISTING_UNLOCK_COST = 50;

export type ProductListingStore = {
  id: string;
  settings: string | null;
};

export type ProductListingCapacity = {
  limit: number;
  used: number;
  remaining: number;
  requested: number;
  allowed: boolean;
  unlockCost: number;
  unlockSize: number;
};

export function parseStoreSettings(settings?: string | null): Record<string, unknown> {
  if (!settings) return {};
  try {
    const parsed = JSON.parse(settings);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function stringifyStoreSettings(settings: Record<string, unknown>): string {
  return JSON.stringify(settings);
}

export function getProductListingLimit(settings?: string | null): number {
  const parsed = parseStoreSettings(settings);
  const value = parsed.productListingLimit;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(FLOWSHOP_BASE_PRODUCT_LISTING_LIMIT, Math.floor(value));
  }
  return FLOWSHOP_BASE_PRODUCT_LISTING_LIMIT;
}

export function withProductListingLimit(settings: string | null | undefined, limit: number): string {
  return stringifyStoreSettings({
    ...parseStoreSettings(settings),
    productListingLimit: Math.max(FLOWSHOP_BASE_PRODUCT_LISTING_LIMIT, Math.floor(limit)),
  });
}

export async function getProductListingCapacity(
  store: ProductListingStore,
  requested = 1
): Promise<ProductListingCapacity> {
  const limit = getProductListingLimit(store.settings);
  const used = await prisma.product.count({
    where: { storeId: store.id, deletedAt: null },
  });
  const remaining = Math.max(0, limit - used);

  return {
    limit,
    used,
    remaining,
    requested,
    allowed: requested <= remaining,
    unlockCost: FLOWSHOP_PRODUCT_LISTING_UNLOCK_COST,
    unlockSize: FLOWSHOP_PRODUCT_LISTING_UNLOCK_SIZE,
  };
}

export function productListingLimitError(capacity: ProductListingCapacity): {
  code: string;
  message: string;
  details: ProductListingCapacity;
} {
  return {
    code: "PRODUCT_LISTING_LIMIT_REACHED",
    message: `Your free FlowShop includes ${capacity.limit} product listings. Unlock ${capacity.unlockSize} more listings for ${capacity.unlockCost} credits.`,
    details: capacity,
  };
}
