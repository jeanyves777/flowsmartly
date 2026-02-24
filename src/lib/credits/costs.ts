/**
 * Centralized Credit Cost Configuration
 *
 * Dynamic pricing from database with fallback to defaults.
 * Based on credit value: $0.01 per credit (100 credits = $1.00)
 *
 * Pricing tiers — based on actual provider costs + ~30-50% margin:
 * - Email (1 credit):      Email send via Resend (~$0.001)
 * - Micro (2-5 credits):   Text-only AI tasks (GPT-4o-mini ~$0.01-0.03)
 * - Small (5-10 credits):  Multi-step AI tasks (brand kit, logo concepts)
 * - Medium (10-20 credits): Single image generation (OpenAI/xAI/Gemini ~$0.03-0.08)
 * - Large (30-80 credits): Multi-image or video generation
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
  EMAIL_SEND: 1,          // Resend: ~$0.001/email
  SMS_SEND: 3,            // Twilio: ~$0.0079/SMS
  MMS_SEND: 5,            // Twilio: ~$0.02/MMS

  // --- AI Text Generation (Micro) — GPT-4o-mini ~$0.01-0.03 ---
  AI_POST: 3,
  AI_CAPTION: 3,
  AI_HASHTAGS: 2,
  AI_IDEAS: 3,
  AI_AUTO: 3,
  AI_AUDIENCE: 3,
  AI_CAMPAIGN_NAME: 2,

  // --- AI Branding (Small) ---
  AI_BRAND_KIT: 8,        // Text generation + structured output

  // --- AI Image Generation — OpenAI/xAI/Gemini ~$0.03-0.08/image ---
  AI_LOGO_CONCEPTS: 10,   // Legacy: SVG concepts only
  AI_LOGO_FINALIZE: 15,   // Legacy: single image finalize
  AI_LOGO_GENERATION: 40, // 3x gpt-image-1 transparent PNGs (~$0.24 total)
  AI_VISUAL_DESIGN: 15,   // Single image gen (~$0.08 + margin)

  // --- AI Video Generation ---
  AI_CARTOON_VIDEO: 80,   // 6-8 scene images + TTS audio + FFmpeg (~$0.50 total)
  AI_CARTOON_CHARACTER_REGEN: 10, // Single image regen

  // --- AI Landing Page ---
  AI_LANDING_PAGE: 20,    // Claude text generation (~$0.10)

  // --- AI Chat Assistant ---
  AI_CHAT_MESSAGE: 2,     // GPT-4o-mini text (~$0.01)
  AI_CHAT_IMAGE: 15,      // Single image gen (~$0.08)
  AI_CHAT_VIDEO: 60,      // Veo 3 single clip (~$0.35)

  // --- AI Video Studio ---
  AI_VIDEO_STUDIO: 60,    // Veo 3 per 8s clip (~$0.35 Google cost)
  AI_VIDEO_SLIDESHOW: 25, // Slideshow: our FFmpeg + 6-8 xAI images + TTS (~$0.15 total)

  // --- AI Marketing Image ---
  AI_MARKETING_IMAGE: 12, // Single image for MMS/email campaigns (~$0.06)

  // --- AI Image Tools ---
  AI_BG_REMOVE: 1,        // Background removal (rembg, free server-side)

  // --- AI E-Commerce ---
  AI_PRODUCT_COPY: 5,     // Product copy generation (title, description, SEO, bullets)
  AI_PRODUCT_IMAGE: 15,   // Product lifestyle image gen or photo enhancement
  AI_STORE_CONTENT: 8,    // Store content generation (about, policies, FAQ, hero)
  AI_STORE_BUILD: 20,     // Full store generation (template + content + products)
  AI_STORE_ENHANCE: 10,   // AI-powered store enhancement from prompt
  AI_SITE_SCRAPE: 5,      // Scrape existing site for product/brand data
  AI_BULK_PRODUCTS: 3,    // Per product in bulk generation

  // --- AI Intelligence ---
  AI_DYNAMIC_PRICING: 3,  // AI pricing suggestion (Claude text generation)
  AI_SEO_OPTIMIZE: 3,     // AI SEO optimization per product (Claude text generation)
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
  AI_VIDEO_SLIDESHOW: "AI slideshow video generation",
  AI_MARKETING_IMAGE: "AI marketing image generation",
  AI_BG_REMOVE: "AI background removal",
  AI_PRODUCT_COPY: "AI product copy generation",
  AI_PRODUCT_IMAGE: "AI product image generation",
  AI_STORE_CONTENT: "AI store content generation",
  AI_STORE_BUILD: "AI store builder - full store generation",
  AI_STORE_ENHANCE: "AI store enhancement",
  AI_SITE_SCRAPE: "AI site analysis and scraping",
  AI_BULK_PRODUCTS: "AI bulk product generation",
  AI_DYNAMIC_PRICING: "AI dynamic pricing suggestion",
  AI_SEO_OPTIMIZE: "AI SEO optimization",
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
