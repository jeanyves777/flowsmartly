/**
 * Shared database queries used by both the store agent and product sync.
 * Prevents duplicated query logic (DRY).
 */

import { prisma } from "@/lib/db/client";

/**
 * Fetch active shipping methods for a store, sorted by sortOrder.
 */
export async function fetchStoreShippingMethods(storeId: string) {
  return prisma.storeShippingMethod.findMany({
    where: { storeId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, description: true, priceCents: true, estimatedDays: true, isActive: true },
  });
}

/**
 * Fetch store shipping config (thresholds).
 */
export async function fetchStoreShippingConfig(storeId: string) {
  const record = await prisma.store.findUnique({
    where: { id: storeId },
    select: { freeShippingThresholdCents: true, flatRateShippingCents: true },
  });
  return {
    freeShippingThresholdCents: record?.freeShippingThresholdCents ?? 5000,
    flatRateShippingCents: record?.flatRateShippingCents ?? 599,
  };
}
