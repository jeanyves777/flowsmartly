/**
 * AI Hub - Central Controller
 *
 * This is the main entry point for all AI operations in FlowSmartly.
 * It provides a unified interface for content generation, usage tracking,
 * and credit management.
 *
 * Architecture:
 * - hub.ts: Central controller (this file)
 * - client.ts: Low-level Anthropic API client
 * - types.ts: Shared type definitions
 * - prompts/: Prompt templates
 * - generators/: Individual generation modules
 */

import { prisma } from "@/lib/db/client";
import { ai } from "./client";
import {
  generatePost,
  generateCaption,
  generateHashtags,
  generateIdeas,
  generateBrand,
  generateAuto,
} from "./generators";
import type {
  PostGenerationRequest,
  PostGenerationResult,
  CaptionGenerationRequest,
  CaptionGenerationResult,
  HashtagGenerationRequest,
  HashtagGenerationResult,
  IdeasGenerationRequest,
  IdeasGenerationResult,
  BrandGenerationRequest,
  BrandGenerationResult,
  AutoGenerationRequest,
  BrandContext,
  Platform,
} from "./types";
import type { AutoGenerationResult } from "./generators/auto";
import {
  getDynamicCreditCost,
  DEFAULT_CREDIT_COSTS,
  AI_FEATURE_COST_MAP,
  type CreditCostKey
} from "@/lib/credits/costs";

// Map generation types to credit cost keys
const GENERATION_TYPE_TO_COST_KEY: Record<string, CreditCostKey> = {
  post: "AI_POST",
  caption: "AI_CAPTION",
  hashtag: "AI_HASHTAGS",
  ideas: "AI_IDEAS",
  brand: "AI_BRAND_KIT",
  auto: "AI_AUTO",
} as const;

type GenerationType = keyof typeof GENERATION_TYPE_TO_COST_KEY;

// Helper to get dynamic credit cost for a generation type
async function getGenerationCost(type: GenerationType): Promise<number> {
  const key = GENERATION_TYPE_TO_COST_KEY[type];
  return getDynamicCreditCost(key);
}

// Hub response wrapper
interface HubResponse<T> {
  success: boolean;
  data?: T & { creditsUsed: number; creditsRemaining: number };
  error?: { code: string; message: string };
}

/**
 * AI Hub Class
 * Singleton pattern for centralized AI management
 */
class AIHub {
  private static instance: AIHub;

  private constructor() {}

  static getInstance(): AIHub {
    if (!AIHub.instance) {
      AIHub.instance = new AIHub();
    }
    return AIHub.instance;
  }

  /**
   * Check if user has enough credits
   * @param userId - User ID
   * @param type - Generation type
   * @param sessionCredits - Optional credits from session (for admin users)
   */
  async checkCredits(
    userId: string,
    type: GenerationType,
    sessionCredits?: number
  ): Promise<{ hasCredits: boolean; credits: number; cost: number; freeRestricted?: boolean }> {
    // Get dynamic cost from database
    const cost = await getGenerationCost(type);

    // If session credits provided (e.g., admin users), use those
    if (sessionCredits !== undefined) {
      return {
        hasCredits: sessionCredits >= cost,
        credits: sessionCredits,
        cost,
      };
    }

    // Otherwise query database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiCredits: true, freeCredits: true },
    });

    const credits = user?.aiCredits ?? 0;
    const freeCredits = user?.freeCredits ?? 0;
    // AI features can only use purchased credits (not free signup bonus)
    const purchasedCredits = Math.max(0, credits - freeCredits);

    return {
      hasCredits: purchasedCredits >= cost,
      credits: purchasedCredits,
      cost,
      freeRestricted: freeCredits > 0 && credits >= cost && purchasedCredits < cost,
    };
  }

  /**
   * Deduct credits and track usage
   * @param sessionCredits - Optional session credits for admin users (skip db decrement)
   * @param adminId - Optional admin ID for tracking admin usage
   */
  private async trackUsage(
    userId: string,
    feature: string,
    inputTokens: number,
    outputTokens: number,
    creditsUsed: number,
    sessionCredits?: number,
    adminId?: string
  ): Promise<number> {
    // For admin users, track usage with adminId (no db credit decrement)
    if (adminId) {
      await prisma.aIUsage.create({
        data: {
          adminId,
          userId: null, // Admin users don't have a User record
          feature,
          inputTokens,
          outputTokens,
          model: "claude-sonnet-4-20250514",
        },
      });
      return (sessionCredits ?? 0) - creditsUsed;
    }

    // For regular users, decrement credits and track usage
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { aiCredits: { decrement: creditsUsed } },
        select: { aiCredits: true },
      }),
      prisma.aIUsage.create({
        data: {
          userId,
          feature,
          inputTokens,
          outputTokens,
          model: "claude-sonnet-4-20250514",
        },
      }),
    ]);

    return user.aiCredits;
  }

  /**
   * Get user's brand context
   */
  async getBrandContext(userId: string): Promise<BrandContext | null> {
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId, isDefault: true },
    });

    if (!brandKit) return null;

    return {
      name: brandKit.name,
      tagline: brandKit.tagline,
      description: brandKit.description,
      industry: brandKit.industry,
      niche: brandKit.niche,
      targetAudience: brandKit.targetAudience,
      audienceAge: brandKit.audienceAge,
      audienceLocation: brandKit.audienceLocation,
      voiceTone: brandKit.voiceTone,
      personality: JSON.parse(brandKit.personality) as string[],
      keywords: JSON.parse(brandKit.keywords) as string[],
      avoidWords: JSON.parse(brandKit.avoidWords) as string[],
      hashtags: JSON.parse(brandKit.hashtags) as string[],
      products: JSON.parse(brandKit.products) as string[],
      uniqueValue: brandKit.uniqueValue,
      email: brandKit.email,
      phone: brandKit.phone,
      website: brandKit.website,
      address: brandKit.address,
    };
  }

  /**
   * Generate a social media post
   */
  async generatePost(
    request: PostGenerationRequest & { sessionCredits?: number; adminId?: string }
  ): Promise<HubResponse<PostGenerationResult>> {
    const creditResult = await this.checkCredits(request.userId, "post", request.sessionCredits);
    const { hasCredits, cost } = creditResult;

    if (!hasCredits) {
      return {
        success: false,
        error: {
          code: creditResult.freeRestricted ? "FREE_CREDITS_RESTRICTED" : "INSUFFICIENT_CREDITS",
          message: creditResult.freeRestricted
            ? `Your free credits can only be used for email marketing. Purchase credits to use this feature (${cost} credits required).`
            : "Not enough AI credits",
        },
      };
    }

    try {
      const result = await generatePost(request);
      const creditsUsed = cost;
      const creditsRemaining = await this.trackUsage(
        request.userId,
        "post_generation",
        ai.estimateTokens(request.topic),
        ai.estimateTokens(result.content),
        creditsUsed,
        request.sessionCredits,
        request.adminId
      );

      return {
        success: true,
        data: { ...result, creditsUsed, creditsRemaining },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Post generation failed",
        },
      };
    }
  }

  /**
   * Generate a caption
   */
  async generateCaption(
    request: CaptionGenerationRequest & { sessionCredits?: number; adminId?: string }
  ): Promise<HubResponse<CaptionGenerationResult>> {
    const creditResult = await this.checkCredits(request.userId, "caption", request.sessionCredits);
    const { hasCredits, cost } = creditResult;

    if (!hasCredits) {
      return {
        success: false,
        error: {
          code: creditResult.freeRestricted ? "FREE_CREDITS_RESTRICTED" : "INSUFFICIENT_CREDITS",
          message: creditResult.freeRestricted
            ? `Your free credits can only be used for email marketing. Purchase credits to use this feature (${cost} credits required).`
            : "Not enough AI credits",
        },
      };
    }

    try {
      const result = await generateCaption(request);
      const creditsUsed = cost;
      const creditsRemaining = await this.trackUsage(
        request.userId,
        "caption_generation",
        ai.estimateTokens(request.mediaDescription),
        ai.estimateTokens(result.content),
        creditsUsed,
        request.sessionCredits,
        request.adminId
      );

      return {
        success: true,
        data: { ...result, creditsUsed, creditsRemaining },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Caption generation failed",
        },
      };
    }
  }

  /**
   * Generate hashtags
   */
  async generateHashtags(
    request: HashtagGenerationRequest & { sessionCredits?: number; adminId?: string }
  ): Promise<HubResponse<HashtagGenerationResult>> {
    const creditResult = await this.checkCredits(request.userId, "hashtag", request.sessionCredits);
    const { hasCredits, cost } = creditResult;

    if (!hasCredits) {
      return {
        success: false,
        error: {
          code: creditResult.freeRestricted ? "FREE_CREDITS_RESTRICTED" : "INSUFFICIENT_CREDITS",
          message: creditResult.freeRestricted
            ? `Your free credits can only be used for email marketing. Purchase credits to use this feature (${cost} credits required).`
            : "Not enough AI credits",
        },
      };
    }

    try {
      const result = await generateHashtags(request);
      const creditsUsed = cost;
      const creditsRemaining = await this.trackUsage(
        request.userId,
        "hashtag_generation",
        ai.estimateTokens(request.topic),
        ai.estimateTokens(result.hashtags.join(" ")),
        creditsUsed,
        request.sessionCredits,
        request.adminId
      );

      return {
        success: true,
        data: { ...result, creditsUsed, creditsRemaining },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Hashtag generation failed",
        },
      };
    }
  }

  /**
   * Generate content ideas
   */
  async generateIdeas(
    request: IdeasGenerationRequest & { sessionCredits?: number; adminId?: string }
  ): Promise<HubResponse<IdeasGenerationResult>> {
    const creditResult = await this.checkCredits(request.userId, "ideas", request.sessionCredits);
    const { hasCredits, cost } = creditResult;

    if (!hasCredits) {
      return {
        success: false,
        error: {
          code: creditResult.freeRestricted ? "FREE_CREDITS_RESTRICTED" : "INSUFFICIENT_CREDITS",
          message: creditResult.freeRestricted
            ? `Your free credits can only be used for email marketing. Purchase credits to use this feature (${cost} credits required).`
            : "Not enough AI credits",
        },
      };
    }

    try {
      const result = await generateIdeas(request);
      const creditsUsed = cost;
      const creditsRemaining = await this.trackUsage(
        request.userId,
        "ideas_generation",
        ai.estimateTokens(request.brand + request.industry),
        ai.estimateTokens(JSON.stringify(result.ideas)),
        creditsUsed,
        request.sessionCredits,
        request.adminId
      );

      return {
        success: true,
        data: { ...result, creditsUsed, creditsRemaining },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Ideas generation failed",
        },
      };
    }
  }

  /**
   * Generate brand identity from description
   */
  async generateBrand(
    request: BrandGenerationRequest & { sessionCredits?: number; adminId?: string }
  ): Promise<HubResponse<BrandGenerationResult>> {
    const creditResult = await this.checkCredits(request.userId, "brand", request.sessionCredits);
    const { hasCredits, cost } = creditResult;

    if (!hasCredits) {
      return {
        success: false,
        error: {
          code: creditResult.freeRestricted ? "FREE_CREDITS_RESTRICTED" : "INSUFFICIENT_CREDITS",
          message: creditResult.freeRestricted
            ? `Your free credits can only be used for email marketing. Purchase credits to use this feature (${cost} credits required).`
            : "Not enough AI credits",
        },
      };
    }

    try {
      const result = await generateBrand(request);
      const creditsUsed = cost;
      const creditsRemaining = await this.trackUsage(
        request.userId,
        "brand_generation",
        ai.estimateTokens(request.description),
        ai.estimateTokens(JSON.stringify(result)),
        creditsUsed,
        request.sessionCredits,
        request.adminId
      );

      return {
        success: true,
        data: { ...result, creditsUsed, creditsRemaining },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Brand generation failed",
        },
      };
    }
  }

  /**
   * Auto-generate content using template + brand identity
   */
  async generateAuto(
    request: AutoGenerationRequest & { sessionCredits?: number; adminId?: string }
  ): Promise<HubResponse<AutoGenerationResult>> {
    const creditResult = await this.checkCredits(request.userId, "auto", request.sessionCredits);
    const { hasCredits, cost } = creditResult;

    if (!hasCredits) {
      return {
        success: false,
        error: {
          code: creditResult.freeRestricted ? "FREE_CREDITS_RESTRICTED" : "INSUFFICIENT_CREDITS",
          message: creditResult.freeRestricted
            ? `Your free credits can only be used for email marketing. Purchase credits to use this feature (${cost} credits required).`
            : "Not enough AI credits",
        },
      };
    }

    try {
      const result = await generateAuto(request);
      const creditsUsed = cost;
      const outputContent = result.content || result.hashtags?.join(" ") || JSON.stringify(result.ideas);
      const creditsRemaining = await this.trackUsage(
        request.userId,
        `auto_${request.templateCategory}`,
        ai.estimateTokens(request.templatePrompt),
        ai.estimateTokens(outputContent),
        creditsUsed,
        request.sessionCredits,
        request.adminId
      );

      return {
        success: true,
        data: { ...result, creditsUsed, creditsRemaining },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Auto generation failed",
        },
      };
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(userId: string): Promise<{
    totalGenerations: number;
    creditsRemaining: number;
    creditsUsedThisMonth: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [user, totalGenerations, monthlyUsage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { aiCredits: true },
      }),
      prisma.aIUsage.count({
        where: { userId },
      }),
      prisma.aIUsage.count({
        where: {
          userId,
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    return {
      totalGenerations,
      creditsRemaining: user?.aiCredits ?? 0,
      creditsUsedThisMonth: monthlyUsage,
    };
  }
}

// Export singleton instance
export const aiHub = AIHub.getInstance();

// Export class for testing
export { AIHub };

// Re-export types for convenience
export type {
  PostGenerationRequest,
  PostGenerationResult,
  CaptionGenerationRequest,
  CaptionGenerationResult,
  HashtagGenerationRequest,
  HashtagGenerationResult,
  IdeasGenerationRequest,
  IdeasGenerationResult,
  BrandGenerationRequest,
  BrandGenerationResult,
  AutoGenerationRequest,
  BrandContext,
  Platform,
  GenerationSettings,
  ToneType,
  LengthType,
} from "./types";
