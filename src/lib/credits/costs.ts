/**
 * Centralized Credit Cost Configuration
 *
 * Dynamic pricing from database with fallback to defaults.
 * Based on credit value: $0.01 per credit (100 credits = $1.00)
 *
 * Pricing tiers:
 * - Email (1 credit):      Email send (1 credit per email)
 * - Micro (5 credits):     Text-only AI tasks (post, caption, hashtags, ideas)
 * - Small (10-25 credits): Multi-step AI tasks (brand kit, logo concepts)
 * - Medium (50-125 credits): Image generation tasks (logo finalize, visual design)
 * - Large (150+ credits):  Premium generation (logo gen, cartoon video)
 * - Ad boosts:             User-driven budget (user decides how many credits to spend)
 */

import { prisma } from "@/lib/db/client";

/**
 * Credit-to-cents conversion rate.
 * 1 credit = $0.01 → 1 cent.
 * Used to convert user credit budgets into real-money campaign budgets.
 */
export const CREDIT_TO_CENTS = 1;

/**
 * Ad Revenue Split Configuration
 *
 * When a viewer watches a promoted post, the advertiser's CPV (cost per view)
 * is split between the platform and the viewer.
 *
 * VIEWER_SHARE_PERCENT: Percentage of CPV that goes to the viewer (70%)
 * PLATFORM_SHARE_PERCENT: Percentage kept by FlowSmartly as revenue (30%)
 *
 * Example: CPV = $0.10 → Viewer earns $0.07, Platform keeps $0.03
 */
export const VIEWER_SHARE_PERCENT = 70;
export const PLATFORM_SHARE_PERCENT = 30;

/**
 * Calculate the viewer and platform shares from a CPV amount in cents.
 * Uses floor for viewer (conservative) so platform always gets at least the remainder.
 * Minimum viewer earn is 1 cent if CPV >= 2 cents.
 */
export function calculateAdRevenueSplit(cpvCents: number): {
  viewerCents: number;
  platformCents: number;
} {
  if (cpvCents <= 0) return { viewerCents: 0, platformCents: 0 };
  // Minimum 1 cent for viewer when CPV >= 1 (prevents $0.00 earnings from Math.floor)
  const viewerCents = Math.max(1, Math.floor((cpvCents * VIEWER_SHARE_PERCENT) / 100));
  const platformCents = cpvCents - viewerCents;
  return { viewerCents, platformCents };
}

/**
 * Default credit costs (fallback when database is unavailable)
 */
export const DEFAULT_CREDIT_COSTS = {
  // --- Messaging (credits per message) ---
  EMAIL_SEND: 1,
  SMS_SEND: 5,   // SMS message send
  MMS_SEND: 10,  // MMS message send (with image)

  // --- AI Text Generation (Micro) ---
  AI_POST: 5,
  AI_CAPTION: 5,
  AI_HASHTAGS: 5,
  AI_IDEAS: 5,
  AI_AUTO: 5,
  AI_AUDIENCE: 5,
  AI_CAMPAIGN_NAME: 5,

  // --- AI Branding (Small) ---
  AI_BRAND_KIT: 10,

  // --- AI Image Generation (Medium/Large) ---
  AI_LOGO_CONCEPTS: 25, // Legacy: SVG concepts only
  AI_LOGO_FINALIZE: 50, // Legacy: single image finalize
  AI_LOGO_GENERATION: 150, // 3x gpt-image-1 transparent PNGs
  AI_VISUAL_DESIGN: 125,

  // --- AI Video Generation (Premium) ---
  AI_CARTOON_VIDEO: 300, // 6-8 scene images + TTS audio + video composition
  AI_CARTOON_CHARACTER_REGEN: 25, // Regenerate single character preview image

  // --- AI Landing Page (Medium) ---
  AI_LANDING_PAGE: 50, // Full landing page generation via Claude

  // --- AI Chat Assistant ---
  AI_CHAT_MESSAGE: 2, // FlowAI text chat message
  AI_CHAT_IMAGE: 125, // FlowAI image generation
  AI_CHAT_VIDEO: 200, // FlowAI video generation

  // --- AI Video Studio ---
  AI_VIDEO_STUDIO: 500, // Video generation per Veo API call (~$3-4 Google cost each)

  // --- AI Marketing Image ---
  AI_MARKETING_IMAGE: 50, // Single image for MMS/email campaigns (Flow AI or DALL-E 3 fallback)
} as const;

/**
 * Keep CREDIT_COSTS for backward compatibility (exports default values)
 * @deprecated Use getDynamicCreditCost() for dynamic pricing
 */
export const CREDIT_COSTS = DEFAULT_CREDIT_COSTS;

export type CreditCostKey = keyof typeof DEFAULT_CREDIT_COSTS;

/**
 * Human-readable labels for credit costs (used in UI/transaction descriptions)
 */
export const CREDIT_COST_LABELS: Record<CreditCostKey, string> = {
  EMAIL_SEND: "Email send",
  SMS_SEND: "SMS message send",
  MMS_SEND: "MMS message send",
  AI_POST: "AI post generation",
  AI_CAPTION: "AI caption generation",
  AI_HASHTAGS: "AI hashtag generation",
  AI_IDEAS: "AI idea generation",
  AI_AUTO: "AI auto-generate",
  AI_AUDIENCE: "AI audience targeting",
  AI_CAMPAIGN_NAME: "AI campaign name suggestion",
  AI_BRAND_KIT: "AI brand kit generation",
  AI_LOGO_CONCEPTS: "AI logo concepts (legacy)",
  AI_LOGO_FINALIZE: "AI logo finalization (legacy)",
  AI_LOGO_GENERATION: "AI logo generation (3 images)",
  AI_VISUAL_DESIGN: "AI visual design",
  AI_CARTOON_VIDEO: "AI cartoon video generation",
  AI_CARTOON_CHARACTER_REGEN: "AI character preview regeneration",
  AI_LANDING_PAGE: "AI landing page generation",
  AI_CHAT_MESSAGE: "FlowAI chat message",
  AI_CHAT_IMAGE: "FlowAI image generation",
  AI_CHAT_VIDEO: "FlowAI video generation",
  AI_VIDEO_STUDIO: "AI video studio generation",
  AI_MARKETING_IMAGE: "AI marketing image generation",
};

/**
 * Map from AIHub feature names to credit cost keys
 */
export const AI_FEATURE_COST_MAP: Record<string, CreditCostKey> = {
  post: "AI_POST",
  caption: "AI_CAPTION",
  hashtag: "AI_HASHTAGS",
  ideas: "AI_IDEAS",
  auto: "AI_AUTO",
  audience: "AI_AUDIENCE",
  campaign_name: "AI_CAMPAIGN_NAME",
  brand: "AI_BRAND_KIT",
};

// In-memory cache for dynamic pricing
let pricingCache: Map<string, number> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // Cache for 1 minute

/**
 * Load all pricing from database into cache
 */
async function loadPricingCache(): Promise<Map<string, number>> {
  const now = Date.now();

  // Return existing cache if still valid
  if (pricingCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return pricingCache;
  }

  try {
    // Check if prisma client is properly initialized
    if (!prisma || !prisma.creditPricing) {
      console.warn("Prisma client not initialized, using default pricing");
      return new Map();
    }

    const pricing = await prisma.creditPricing.findMany({
      where: { isActive: true },
      select: { key: true, credits: true },
    });

    // Build new cache
    const newCache = new Map<string, number>();
    for (const item of pricing) {
      newCache.set(item.key, item.credits);
    }

    pricingCache = newCache;
    cacheTimestamp = now;
    return newCache;
  } catch (error) {
    console.error("Failed to load pricing from database:", error);
    // Return empty cache on error - will fall back to defaults
    return new Map();
  }
}

/**
 * Clear the pricing cache (call after admin updates pricing)
 */
export function clearPricingCache(): void {
  pricingCache = null;
  cacheTimestamp = 0;
}

/**
 * Get dynamic credit cost from database with fallback to default
 * This is the preferred way to get credit costs in API routes
 */
export async function getDynamicCreditCost(key: CreditCostKey): Promise<number> {
  try {
    const cache = await loadPricingCache();
    const dynamicCost = cache.get(key);

    if (dynamicCost !== undefined) {
      return dynamicCost;
    }

    // Fall back to default if not found in database
    return DEFAULT_CREDIT_COSTS[key];
  } catch (error) {
    console.error(`Failed to get dynamic cost for ${key}:`, error);
    return DEFAULT_CREDIT_COSTS[key];
  }
}

/**
 * Get all dynamic credit costs as an object (useful for bulk operations)
 */
export async function getAllDynamicCreditCosts(): Promise<Record<CreditCostKey, number>> {
  try {
    const cache = await loadPricingCache();
    const result: Record<CreditCostKey, number> = { ...DEFAULT_CREDIT_COSTS };

    // Override with dynamic values where available
    for (const key of Object.keys(DEFAULT_CREDIT_COSTS) as CreditCostKey[]) {
      const dynamicCost = cache.get(key);
      if (dynamicCost !== undefined) {
        result[key] = dynamicCost;
      }
    }

    return result;
  } catch (error) {
    console.error("Failed to get all dynamic costs:", error);
    return { ...DEFAULT_CREDIT_COSTS };
  }
}

/**
 * Get the credit cost for a feature (synchronous, uses default values)
 * @deprecated Use getDynamicCreditCost() for dynamic pricing
 */
export function getCreditCost(key: CreditCostKey): number {
  return DEFAULT_CREDIT_COSTS[key];
}

/**
 * Get the credit cost label for a feature
 */
export function getCreditCostLabel(key: CreditCostKey): string {
  return CREDIT_COST_LABELS[key];
}

// ── Free Credit Restrictions ──────────────────────────────────────────────────

/**
 * Features that can use free signup credits.
 * All other features require purchased credits.
 */
const FREE_CREDIT_ELIGIBLE: CreditCostKey[] = [
  "EMAIL_SEND",
  "SMS_SEND",
  "MMS_SEND",
];

/**
 * Check if a feature can use free signup credits
 */
export function canUseFreeCredits(key: CreditCostKey): boolean {
  return FREE_CREDIT_ELIGIBLE.includes(key);
}

/**
 * Check if user has enough credits for a feature, accounting for free credit restrictions.
 *
 * Free signup credits (tracked by freeCredits field) can only be used for email/SMS marketing.
 * AI features require purchased credits (aiCredits - freeCredits).
 *
 * Returns null if OK, or { code, message, cost } if blocked.
 */
export async function checkCreditsForFeature(
  userId: string,
  costKey: CreditCostKey,
  isAdmin = false
): Promise<{ code: string; message: string; cost: number } | null> {
  if (isAdmin) return null;

  const creditCost = await getDynamicCreditCost(costKey);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiCredits: true, freeCredits: true },
  });

  if (!user) {
    return {
      code: "INSUFFICIENT_CREDITS",
      message: "User not found.",
      cost: creditCost,
    };
  }

  const isFreeEligible = canUseFreeCredits(costKey);
  const purchasedCredits = Math.max(0, user.aiCredits - (user.freeCredits || 0));

  if (isFreeEligible) {
    // Email/SMS: can use all credits (free + purchased)
    if (user.aiCredits < creditCost) {
      return {
        code: "INSUFFICIENT_CREDITS",
        message: `This requires ${creditCost} credits. You have ${user.aiCredits} credits remaining.`,
        cost: creditCost,
      };
    }
  } else {
    // AI features: can only use purchased credits
    if (purchasedCredits < creditCost) {
      if (user.freeCredits > 0 && user.aiCredits >= creditCost) {
        // Has enough total but they're free credits
        return {
          code: "FREE_CREDITS_RESTRICTED",
          message: `Your free credits can only be used for email marketing. Purchase credits to use this feature (${creditCost} credits required).`,
          cost: creditCost,
        };
      }
      return {
        code: "INSUFFICIENT_CREDITS",
        message: `This requires ${creditCost} credits. You have ${purchasedCredits} purchased credits remaining.`,
        cost: creditCost,
      };
    }
  }

  return null;
}
