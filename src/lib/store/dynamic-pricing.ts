/**
 * AI-Powered Dynamic Pricing Engine
 * Uses Claude AI to analyze market data, competitor prices, demand signals,
 * and cost structures to recommend and apply optimal pricing strategies.
 */

import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts/index";
import { getCompetitorPrices, getPriceHistory } from "./competitor-pricing";
import type { PricingRule } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingSuggestion {
  suggestedPriceCents: number;
  reasoning: string;
  confidence: "high" | "medium" | "low";
  factors: {
    factor: string;
    impact: "positive" | "negative" | "neutral";
    detail: string;
  }[];
  competitorAnalysis?: string;
  marginInfo?: {
    costCents: number;
    marginPercent: number;
    profitCents: number;
  };
}

export interface PricingRuleConfig {
  marginPercent?: number;
  offsetCents?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  roundTo?: number;
}

export type PricingStrategy =
  | "beat_lowest"
  | "match_average"
  | "premium"
  | "demand"
  | "margin_target";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Round price to the nearest dollar then add `roundTo` cents.
 * Example: roundTo = 99 turns $12.47 into $12.99
 */
function applyRounding(priceCents: number, roundTo?: number): number {
  if (!roundTo) return priceCents;
  const dollars = Math.round(priceCents / 100);
  return dollars * 100 + roundTo;
}

/**
 * Clamp a price between optional min and max boundaries.
 */
function applyConstraints(
  priceCents: number,
  config: PricingRuleConfig
): number {
  let price = priceCents;
  if (config.minPriceCents != null) {
    price = Math.max(price, config.minPriceCents);
  }
  if (config.maxPriceCents != null) {
    price = Math.min(price, config.maxPriceCents);
  }
  price = applyRounding(price, config.roundTo);
  return Math.round(price);
}

// ---------------------------------------------------------------------------
// AI Pricing Suggestion
// ---------------------------------------------------------------------------

/**
 * Ask Claude to analyse a product and suggest an optimal price.
 */
export async function getAIPricingSuggestion(
  productId: string
): Promise<PricingSuggestion | null> {
  // Fetch product
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      category: true,
      priceCents: true,
      costCents: true,
      viewCount: true,
      orderCount: true,
    },
  });

  if (!product) return null;

  // Fetch competitor prices
  const competitors = await getCompetitorPrices(productId);

  // Fetch recent price history (last 30 days)
  const history = await getPriceHistory(productId, 30);

  // Fetch pricing rule if one exists
  const rule = await prisma.pricingRule.findUnique({
    where: { productId },
  });

  // Build competitor list for prompt
  const competitorLines =
    competitors.length > 0
      ? competitors
          .map(
            (c) =>
              `- ${c.competitorName}: $${(c.priceCents / 100).toFixed(2)} (${c.inStock ? "In Stock" : "Out of Stock"})`
          )
          .join("\n")
      : "No competitor data available.";

  // Build price history list for prompt
  const historyLines =
    history.length > 0
      ? history
          .map(
            (h) =>
              `- ${new Date(h.createdAt).toLocaleDateString()}: $${(h.priceCents / 100).toFixed(2)} (${h.source})`
          )
          .join("\n")
      : "No price history available.";

  const costDisplay =
    product.costCents != null
      ? `$${(product.costCents / 100).toFixed(2)}`
      : "Unknown";

  const prompt = `Analyze this product and suggest an optimal price.

PRODUCT:
- Name: ${product.name}
- Category: ${product.category || "uncategorized"}
- Current Price: $${(product.priceCents / 100).toFixed(2)}
- Cost Price: ${costDisplay}
- Views (all time): ${product.viewCount}
- Orders (all time): ${product.orderCount}

COMPETITOR PRICES:
${competitorLines}

PRICING STRATEGY: ${rule?.strategy || "No specific strategy set"}

PRICE HISTORY (last 30 days):
${historyLines}

Return JSON with: suggestedPriceCents (integer), reasoning (2-3 sentences), confidence (high/medium/low), factors array, competitorAnalysis, marginInfo (if costCents known).`;

  const result = await ai.generateJSON<PricingSuggestion>(prompt, {
    systemPrompt: SYSTEM_PROMPTS.pricingStrategist,
    maxTokens: 1024,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Pricing Rule CRUD
// ---------------------------------------------------------------------------

/**
 * Create or update a pricing rule for a product.
 */
export async function savePricingRule(
  productId: string,
  strategy: PricingStrategy,
  config: PricingRuleConfig
): Promise<PricingRule> {
  return prisma.pricingRule.upsert({
    where: { productId },
    create: {
      productId,
      strategy,
      config: JSON.stringify(config),
    },
    update: {
      strategy,
      config: JSON.stringify(config),
    },
  });
}

/**
 * Retrieve a pricing rule with its parsed JSON config.
 */
export async function getPricingRule(
  productId: string
): Promise<(PricingRule & { parsedConfig: PricingRuleConfig }) | null> {
  const rule = await prisma.pricingRule.findUnique({
    where: { productId },
  });

  if (!rule) return null;

  let parsedConfig: PricingRuleConfig = {};
  try {
    parsedConfig = JSON.parse(rule.config) as PricingRuleConfig;
  } catch {
    // Invalid JSON stored, treat as empty config
  }

  return { ...rule, parsedConfig };
}

// ---------------------------------------------------------------------------
// Bulk Rule Application
// ---------------------------------------------------------------------------

/**
 * Apply all active pricing rules for a given store.
 * Returns the number of successfully applied rules and any errors.
 */
export async function applyPricingRules(
  storeId: string
): Promise<{ applied: number; errors: string[] }> {
  // Find all active pricing rules for products in this store
  const rules = await prisma.pricingRule.findMany({
    where: {
      isActive: true,
      product: { storeId },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          priceCents: true,
          costCents: true,
        },
      },
    },
  });

  let applied = 0;
  const errors: string[] = [];

  for (const rule of rules) {
    try {
      let config: PricingRuleConfig = {};
      try {
        config = JSON.parse(rule.config) as PricingRuleConfig;
      } catch {
        // Invalid JSON, use defaults
      }

      const product = rule.product;
      const competitors = await getCompetitorPrices(product.id);
      const competitorPrices = competitors.map((c) => c.priceCents);

      let newPriceCents: number | null = null;
      let source = "competitor_match";

      switch (rule.strategy as PricingStrategy) {
        case "beat_lowest": {
          if (competitorPrices.length === 0) {
            errors.push(
              `${product.name}: No competitor prices to beat`
            );
            continue;
          }
          const lowest = Math.min(...competitorPrices);
          const offset = config.offsetCents ?? 100;
          newPriceCents = lowest - offset;
          break;
        }

        case "match_average": {
          if (competitorPrices.length === 0) {
            errors.push(
              `${product.name}: No competitor prices to match`
            );
            continue;
          }
          const sum = competitorPrices.reduce((a, b) => a + b, 0);
          newPriceCents = Math.round(sum / competitorPrices.length);
          break;
        }

        case "premium": {
          if (competitorPrices.length === 0) {
            errors.push(
              `${product.name}: No competitor prices for premium positioning`
            );
            continue;
          }
          const highest = Math.max(...competitorPrices);
          const premiumOffset = config.offsetCents ?? 200;
          newPriceCents = highest + premiumOffset;
          break;
        }

        case "demand": {
          // Placeholder for future ML-based demand pricing
          // For now, keep the current price unchanged
          newPriceCents = product.priceCents;
          source = "ai_suggestion";
          break;
        }

        case "margin_target": {
          if (product.costCents == null) {
            errors.push(
              `${product.name}: Cost price unknown, cannot apply margin target`
            );
            continue;
          }
          const marginPercent = config.marginPercent ?? 30;
          newPriceCents = Math.round(
            product.costCents * (1 + marginPercent / 100)
          );
          break;
        }

        default:
          errors.push(
            `${product.name}: Unknown strategy "${rule.strategy}"`
          );
          continue;
      }

      if (newPriceCents == null || newPriceCents <= 0) {
        errors.push(
          `${product.name}: Computed price is invalid (${newPriceCents})`
        );
        continue;
      }

      // Apply constraints and rounding
      newPriceCents = applyConstraints(newPriceCents, config);

      // Skip if price did not change
      if (newPriceCents === product.priceCents) {
        continue;
      }

      // Update the product price and record history
      await prisma.$transaction([
        prisma.product.update({
          where: { id: product.id },
          data: { priceCents: newPriceCents },
        }),
        prisma.priceHistory.create({
          data: {
            productId: product.id,
            priceCents: newPriceCents,
            source,
            reason: `Auto-applied "${rule.strategy}" rule`,
          },
        }),
        prisma.pricingRule.update({
          where: { id: rule.id },
          data: { lastApplied: new Date() },
        }),
      ]);

      applied++;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      errors.push(`${rule.product.name}: ${message}`);
    }
  }

  return { applied, errors };
}
