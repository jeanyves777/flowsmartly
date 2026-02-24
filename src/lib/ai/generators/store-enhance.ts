/**
 * AI Store Enhance Generator
 * Takes a user prompt, current store context, and optional reference content
 * to generate targeted store improvements.
 */

import { ai } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";

export interface StoreEnhanceParams {
  prompt: string;
  scope: "theme" | "content" | "products" | "all";
  currentStore: {
    name: string;
    industry: string | null;
    theme: Record<string, unknown>;
    settings: Record<string, unknown>;
    productSummary?: string; // brief list of existing products
  };
  referenceContent?: string; // extracted text from reference URL
}

export interface StoreEnhanceResult {
  theme?: {
    colors?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string };
    fonts?: { heading?: string; body?: string };
  };
  content?: {
    tagline?: string;
    hero?: { headline: string; subheadline: string; ctaText?: string };
    about?: string;
    returnPolicy?: string;
    shippingPolicy?: string;
    termsOfService?: string;
    privacyPolicy?: string;
    faq?: Array<{ question: string; answer: string }>;
  };
  products?: Array<{
    name: string;
    description: string;
    shortDescription: string;
    category: string;
    priceCents: number;
    comparePriceCents?: number;
    tags: string[];
    variants?: Array<{ name: string; priceCents: number; options: Record<string, string> }>;
  }>;
}

export async function generateStoreEnhancement(
  params: StoreEnhanceParams
): Promise<StoreEnhanceResult | null> {
  const { prompt: userPrompt, scope, currentStore, referenceContent } = params;

  // Build context about current store state
  const themeData = currentStore.theme || {};
  const settingsData = currentStore.settings || {};
  const storeContent = (settingsData as Record<string, unknown>).storeContent as Record<string, unknown> | undefined;

  let currentContext = `CURRENT STORE STATE:
- Store Name: ${currentStore.name}
- Industry: ${currentStore.industry || "Not set"}
- Theme colors: ${JSON.stringify((themeData as Record<string, unknown>).colors || {})}
- Theme fonts: ${JSON.stringify((themeData as Record<string, unknown>).fonts || {})}`;

  if (storeContent) {
    currentContext += `
- Tagline: ${storeContent.tagline || "Not set"}
- About: ${(storeContent.about as string || "").slice(0, 200)}...`;
  }

  if (currentStore.productSummary) {
    currentContext += `\n- Existing products: ${currentStore.productSummary}`;
  }

  let refContext = "";
  if (referenceContent) {
    refContext = `\nREFERENCE CONTENT (from provided URL — use as inspiration):
${referenceContent.slice(0, 6000)}`;
  }

  // Build scope-specific instructions
  let scopeInstructions = "";
  let responseFormat = "";

  if (scope === "theme" || scope === "all") {
    scopeInstructions += `
THEME: Generate updated colors and/or fonts. All colors must be valid hex codes. Font names must be from Google Fonts.`;
    responseFormat += `
  "theme": {
    "colors": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "text": "#hex" },
    "fonts": { "heading": "Font Name", "body": "Font Name" }
  },`;
  }

  if (scope === "content" || scope === "all") {
    scopeInstructions += `
CONTENT: Generate updated store content. Only include fields that should change based on the user's request.`;
    responseFormat += `
  "content": {
    "tagline": "Updated tagline (max 80 chars)",
    "hero": { "headline": "Hero headline (max 60 chars)", "subheadline": "Supporting text (max 120 chars)", "ctaText": "CTA button text" },
    "about": "Updated about section (2-3 paragraphs)"
  },`;
  }

  if (scope === "products" || scope === "all") {
    scopeInstructions += `
PRODUCTS: Generate new products to add to the store. Each product needs name, description, shortDescription, category, priceCents (integer), tags. Optionally include comparePriceCents for sale items and variants with {name, priceCents, options}.`;
    responseFormat += `
  "products": [{ "name": "...", "description": "...", "shortDescription": "...", "category": "...", "priceCents": 2999, "tags": ["tag1"], "variants": [{ "name": "Size M", "priceCents": 2999, "options": { "size": "M" } }] }],`;
  }

  const fullPrompt = `You are enhancing an existing e-commerce store based on the user's specific request.

${currentContext}
${refContext}

USER REQUEST: "${userPrompt}"

SCOPE: ${scope === "all" ? "Theme + Content + Products" : scope.charAt(0).toUpperCase() + scope.slice(1)} only
${scopeInstructions}

Return a JSON object with ONLY the sections relevant to the scope:
{${responseFormat}
}

Requirements:
- Only change what the user asked for
- Keep changes consistent with the store's brand and industry
- Colors must be valid hex codes
- Prices in cents (integer)
- Be creative but professional`;

  const systemPrompt = `${SYSTEM_PROMPTS.ecommerceContent}

You are an expert store enhancement assistant. You make targeted, high-quality improvements based on specific user requests. You respect the existing brand identity while implementing the requested changes.`;

  const result = await ai.generateJSON<StoreEnhanceResult>(fullPrompt, {
    maxTokens: 4000,
    systemPrompt,
  });

  return result;
}
