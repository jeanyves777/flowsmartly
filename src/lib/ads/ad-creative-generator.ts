/**
 * AI Ad Creative Generator
 * Generates platform-specific ad copy variants for product promotion.
 * Uses Claude/OpenAI to create headlines, descriptions, and CTAs optimized for each platform.
 */

import OpenAI from "openai";
import { prisma } from "@/lib/db/client";

const openai = new OpenAI();

interface PlatformConstraints {
  maxHeadline: number;
  maxDescription: number;
  style: string;
}

const PLATFORM_CONSTRAINTS: Record<string, PlatformConstraints> = {
  google: {
    maxHeadline: 30,
    maxDescription: 90,
    style: "Search-intent focused. Direct, benefit-driven. Include price or offer if relevant.",
  },
  facebook: {
    maxHeadline: 40,
    maxDescription: 125,
    style: "Engagement-focused. Emotional, story-driven. Use social proof language.",
  },
  tiktok: {
    maxHeadline: 40,
    maxDescription: 100,
    style: "Casual, trendy, Gen-Z friendly. Use action verbs. Short punchy sentences.",
  },
  flowsmartly: {
    maxHeadline: 50,
    maxDescription: 200,
    style: "CTA-driven. Clear value proposition. Professional but approachable.",
  },
};

export interface GeneratedCreative {
  platform: string;
  headline: string;
  description: string;
  ctaText: string;
  score?: number;
}

/**
 * Generate platform-specific ad creatives for a product.
 */
export async function generateAdCreatives(
  productId: string,
  platforms: string[] = ["google", "facebook", "tiktok", "flowsmartly"]
): Promise<GeneratedCreative[]> {
  // Fetch product info
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      shortDescription: true,
      description: true,
      priceCents: true,
      comparePriceCents: true,
      images: true,
      store: {
        select: { name: true, description: true },
      },
      productCategory: {
        select: { name: true },
      },
    },
  });

  if (!product) throw new Error("Product not found");

  const price = (product.priceCents / 100).toFixed(2);
  const comparePrice = product.comparePriceCents
    ? (product.comparePriceCents / 100).toFixed(2)
    : null;

  const platformInstructions = platforms
    .map((p) => {
      const c = PLATFORM_CONSTRAINTS[p];
      if (!c) return null;
      return `
## ${p.toUpperCase()}
- Headline: max ${c.maxHeadline} characters
- Description: max ${c.maxDescription} characters
- Style: ${c.style}
Generate 1 variant.`;
    })
    .filter(Boolean)
    .join("\n");

  const prompt = `Generate ad copy variants for the following product.

PRODUCT:
- Name: ${product.name}
- Price: $${price}${comparePrice ? ` (was $${comparePrice})` : ""}
- Category: ${product.productCategory?.name || "General"}
- Description: ${product.shortDescription || product.description || "N/A"}
- Store: ${product.store?.name || "Online Store"}

REQUIREMENTS:
${platformInstructions}

For each platform, also suggest an appropriate CTA button text (e.g., "Shop Now", "Get Deal", "Order Now", "Learn More").

Respond in JSON format:
{
  "variants": [
    {
      "platform": "google",
      "headline": "...",
      "description": "...",
      "ctaText": "..."
    }
  ]
}

IMPORTANT: Strictly respect the character limits for each platform. Be creative and compelling.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert digital advertising copywriter. Generate compelling, platform-optimized ad copy. Always respond with valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");

  const parsed = JSON.parse(content);
  const variants: GeneratedCreative[] = (parsed.variants || []).map(
    (v: { platform: string; headline: string; description: string; ctaText: string }) => ({
      platform: v.platform,
      headline: v.headline,
      description: v.description,
      ctaText: v.ctaText || "Shop Now",
    })
  );

  // Save variants to database
  for (const variant of variants) {
    await prisma.adCreativeVariant.create({
      data: {
        productId,
        platform: variant.platform,
        headline: variant.headline,
        description: variant.description,
        ctaText: variant.ctaText,
      },
    });
  }

  return variants;
}

/**
 * Get existing ad creative variants for a product.
 */
export async function getAdCreatives(productId: string) {
  return prisma.adCreativeVariant.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });
}
