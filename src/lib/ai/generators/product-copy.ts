/**
 * Product Copy Generator
 * Generates SEO-optimized product copy from product name + brand context
 */

import { ai } from "../client";
import { buildProductCopyPrompt, SYSTEM_PROMPTS } from "../prompts";
import type { BrandContext } from "../types";

export interface ProductCopyRequest {
  productName: string;
  category?: string;
  keywords?: string[];
  existingDescription?: string;
  brandContext?: BrandContext;
}

export interface ProductCopyResult {
  title: string;
  description: string;
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
  bulletPoints: string[];
  adCopy: string;
}

export async function generateProductCopy(request: ProductCopyRequest): Promise<ProductCopyResult | null> {
  const prompt = buildProductCopyPrompt({
    productName: request.productName,
    category: request.category,
    keywords: request.keywords,
    existingDescription: request.existingDescription,
    brandContext: request.brandContext,
  });

  const result = await ai.generateJSON<ProductCopyResult>(prompt, {
    maxTokens: 2048,
    systemPrompt: SYSTEM_PROMPTS.ecommerceWriter,
  });

  return result;
}
