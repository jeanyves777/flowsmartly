/**
 * Store Content Generator
 * Generates store content (about, policies, FAQ, hero copy) from brand context
 */

import { ai } from "../client";
import { buildStoreContentPrompt, SYSTEM_PROMPTS } from "../prompts";
import type { BrandContext } from "../types";

export interface StoreContentRequest {
  contentTypes: string[]; // "tagline" | "about" | "hero" | "return_policy" | "shipping_policy" | "faq"
  storeName?: string;
  industry?: string;
  brandContext?: BrandContext;
}

export interface StoreContentResult {
  tagline?: string;
  about?: string;
  hero?: { headline: string; subheadline: string };
  returnPolicy?: string;
  shippingPolicy?: string;
  termsOfService?: string;
  privacyPolicy?: string;
  faq?: Array<{ question: string; answer: string }>;
}

export async function generateStoreContent(request: StoreContentRequest): Promise<StoreContentResult | null> {
  const prompt = buildStoreContentPrompt({
    contentTypes: request.contentTypes,
    storeName: request.storeName,
    industry: request.industry,
    brandContext: request.brandContext,
  });

  const result = await ai.generateJSON<StoreContentResult>(prompt, {
    maxTokens: 3000,
    systemPrompt: SYSTEM_PROMPTS.ecommerceContent,
  });

  return result;
}
