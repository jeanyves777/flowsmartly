/**
 * Competitor Price Tracking & Price History
 * Manages competitor price records, price change history, and price position analysis.
 */

import { prisma } from "@/lib/db/client";

interface CompetitorPriceInput {
  productId: string;
  competitorName: string;
  competitorUrl?: string;
  priceCents: number;
  currency?: string;
  inStock?: boolean;
}

type PricePosition =
  | "lowest"
  | "below_average"
  | "average"
  | "above_average"
  | "highest";

interface PriceAnalysis {
  lowestCompetitorPrice: number;
  highestCompetitorPrice: number;
  averageCompetitorPrice: number;
  myPrice: number;
  position: PricePosition;
  priceAdvantagePercent: number; // negative = cheaper than avg
  competitorCount: number;
}

/**
 * Add a competitor price record for a product.
 * Validates that the product belongs to the given store.
 */
export async function addCompetitorPrice(
  storeId: string,
  input: CompetitorPriceInput
) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, storeId },
  });

  if (!product) {
    throw new Error("Product not found or does not belong to this store");
  }

  return prisma.competitorPrice.create({
    data: {
      productId: input.productId,
      competitorName: input.competitorName,
      competitorUrl: input.competitorUrl,
      priceCents: input.priceCents,
      currency: input.currency ?? "USD",
      inStock: input.inStock ?? true,
    },
  });
}

/**
 * Update an existing competitor price record.
 * Verifies ownership through the product's storeId.
 */
export async function updateCompetitorPrice(
  id: string,
  storeId: string,
  data: Partial<CompetitorPriceInput>
) {
  const existing = await prisma.competitorPrice.findUnique({
    where: { id },
    include: { product: { select: { storeId: true } } },
  });

  if (!existing || existing.product.storeId !== storeId) {
    throw new Error("Competitor price not found or access denied");
  }

  return prisma.competitorPrice.update({
    where: { id },
    data: {
      ...(data.competitorName !== undefined && {
        competitorName: data.competitorName,
      }),
      ...(data.competitorUrl !== undefined && {
        competitorUrl: data.competitorUrl,
      }),
      ...(data.priceCents !== undefined && { priceCents: data.priceCents }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.inStock !== undefined && { inStock: data.inStock }),
      lastChecked: new Date(),
    },
  });
}

/**
 * Delete a competitor price record.
 * Verifies ownership through the product's storeId.
 */
export async function deleteCompetitorPrice(id: string, storeId: string) {
  const existing = await prisma.competitorPrice.findUnique({
    where: { id },
    include: { product: { select: { storeId: true } } },
  });

  if (!existing || existing.product.storeId !== storeId) {
    throw new Error("Competitor price not found or access denied");
  }

  return prisma.competitorPrice.delete({ where: { id } });
}

/**
 * Get all competitor prices for a product, ordered by price ascending.
 */
export async function getCompetitorPrices(productId: string) {
  return prisma.competitorPrice.findMany({
    where: { productId },
    orderBy: { priceCents: "asc" },
  });
}

/**
 * Record a price change in the price history.
 */
export async function recordPriceChange(
  productId: string,
  priceCents: number,
  source: string,
  reason?: string
) {
  return prisma.priceHistory.create({
    data: {
      productId,
      priceCents,
      source,
      reason,
    },
  });
}

/**
 * Get price history for a product within the last N days.
 * Defaults to the last 90 days, ordered chronologically.
 */
export async function getPriceHistory(productId: string, days = 90) {
  const since = new Date(Date.now() - days * 86400000);

  return prisma.priceHistory.findMany({
    where: {
      productId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Analyze the product's price position relative to competitors.
 * Returns null if no competitor prices exist.
 */
export async function analyzePricePosition(
  productId: string
): Promise<PriceAnalysis | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { priceCents: true },
  });

  if (!product) {
    return null;
  }

  const competitors = await prisma.competitorPrice.findMany({
    where: { productId },
    select: { priceCents: true },
  });

  if (competitors.length === 0) {
    return null;
  }

  const prices = competitors.map((c) => c.priceCents);
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const myPrice = product.priceCents;

  let position: PricePosition;
  if (myPrice < lowest) {
    position = "lowest";
  } else if (myPrice <= avg * 0.95) {
    position = "below_average";
  } else if (myPrice <= avg * 1.05) {
    position = "average";
  } else if (myPrice < highest) {
    position = "above_average";
  } else {
    position = "highest";
  }

  const priceAdvantagePercent = ((myPrice - avg) / avg) * 100;

  return {
    lowestCompetitorPrice: lowest,
    highestCompetitorPrice: highest,
    averageCompetitorPrice: avg,
    myPrice,
    position,
    priceAdvantagePercent,
    competitorCount: competitors.length,
  };
}
