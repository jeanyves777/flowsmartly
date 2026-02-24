/**
 * AI Store Blueprint Generator
 * Generates a complete store blueprint (template, content, categories, products)
 * from minimal business context using Claude AI.
 */

import { ai } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { STORE_TEMPLATES_FULL } from "@/lib/constants/store-templates";

// ── Types ──

export interface AIStoreBlueprint {
  templateId: string;
  content: {
    tagline: string;
    hero: { headline: string; subheadline: string; ctaText: string };
    about: { title: string; body: string };
    returnPolicy: string;
    shippingPolicy: string;
    termsOfService: string;
    privacyPolicy: string;
    faq: Array<{ question: string; answer: string }>;
  };
  seo: { title: string; description: string };
  categories: Array<{ name: string; description: string; sortOrder: number }>;
  products: Array<{
    name: string;
    description: string;
    shortDescription: string;
    category: string;
    priceCents: number;
    comparePriceCents?: number;
    seoTitle: string;
    seoDescription: string;
    tags: string[];
    variants?: Array<{
      name: string;
      priceCents: number;
      options: Record<string, string>;
    }>;
  }>;
}

export interface StoreBlueprintParams {
  storeName: string;
  industry: string;
  niche?: string;
  targetAudience?: string;
  region?: string;
  currency?: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  brandFonts?: { heading?: string; body?: string };
  brandLogo?: string;
}

// ── Generator ──

/**
 * Generate a complete store blueprint from business context.
 * AI picks the best template, generates content, categories, and 6-10 products.
 */
export async function generateStoreBlueprint(
  params: StoreBlueprintParams
): Promise<AIStoreBlueprint | null> {
  const { storeName, industry, niche, targetAudience, region, currency, brandColors, brandFonts } = params;

  // Build template listing for AI to choose from
  const templateListing = STORE_TEMPLATES_FULL.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
  }));

  // Brand context for AI
  const hasBrand = brandColors?.primary || brandFonts?.heading;
  const brandContext = hasBrand
    ? `\nBRAND IDENTITY (respect these when choosing template):
- Brand Colors: ${brandColors?.primary ? `Primary: ${brandColors.primary}` : ""}${brandColors?.secondary ? `, Secondary: ${brandColors.secondary}` : ""}${brandColors?.accent ? `, Accent: ${brandColors.accent}` : ""}
${brandFonts?.heading ? `- Brand Fonts: Heading: ${brandFonts.heading}${brandFonts?.body ? `, Body: ${brandFonts.body}` : ""}` : ""}
Pick a template whose style complements these brand colors. The store should feel cohesive with the brand identity.`
    : "";

  const currencyCode = currency || "USD";
  const regionName = region || "north_america";

  const prompt = `Generate a complete store blueprint for the following business:

STORE DETAILS:
- Store Name: ${storeName}
- Industry: ${industry}
${niche ? `- Niche: ${niche}` : ""}
${targetAudience ? `- Target Audience: ${targetAudience}` : ""}
- Region: ${regionName}
- Currency: ${currencyCode}
${brandContext}

AVAILABLE TEMPLATES (pick the best match for this store):
${JSON.stringify(templateListing, null, 2)}

INSTRUCTIONS:
1. Pick the best-fitting templateId from the templates above based on the store's industry and niche.
2. Generate compelling store content:
   - A catchy tagline (max 80 chars)
   - Hero section: headline (max 60 chars, bold), subheadline (max 120 chars), ctaText (e.g. "Shop Now")
   - About section: title and body (2-3 paragraphs, tell the brand story)
   - Return policy (professional, customer-friendly, include timeframe and conditions)
   - Shipping policy (cover methods, timeframes, costs — appropriate for ${regionName})
   - Terms of Service (comprehensive: acceptance of terms, user accounts, payment terms, intellectual property, limitation of liability, governing law. 400-600 words)
   - Privacy Policy (data collection, use, sharing, cookies, security measures, customer rights, data retention. 400-600 words)
   - FAQ: 5-8 frequently asked questions relevant to this type of store
3. SEO: Generate a store SEO title (max 60 chars) and meta description (max 155 chars).
4. Generate 2-4 product categories with names, descriptions, and sortOrder.
5. Generate 6-10 products:
   - Each product must have: name, description (2-3 paragraphs), shortDescription (max 160 chars), category (must match one of your categories), priceCents (integer, in ${currencyCode}), seoTitle, seoDescription, tags (3-5 tags)
   - Optionally include comparePriceCents for products on "sale"
   - Optionally include 2-3 variants for products that naturally have variants (e.g. sizes, colors)
   - Prices should be realistic for the ${currencyCode} currency and ${regionName} region
   - For USD: typical products $10-$200 range. For XOF: 1000-50000 range. For EUR: 10-200 range. Adjust for the currency.
   - Products should be diverse across the categories you created
6. All policies and content should be appropriate for the ${regionName} region.

Return a JSON object with this exact structure:
{
  "templateId": "one of the template IDs",
  "content": {
    "tagline": "...",
    "hero": { "headline": "...", "subheadline": "...", "ctaText": "..." },
    "about": { "title": "...", "body": "..." },
    "returnPolicy": "...",
    "shippingPolicy": "...",
    "termsOfService": "...",
    "privacyPolicy": "...",
    "faq": [{ "question": "...", "answer": "..." }]
  },
  "seo": { "title": "...", "description": "..." },
  "categories": [{ "name": "...", "description": "...", "sortOrder": 0 }],
  "products": [{
    "name": "...",
    "description": "...",
    "shortDescription": "...",
    "category": "Category Name (must match a category above)",
    "priceCents": 2999,
    "comparePriceCents": 3999,
    "seoTitle": "...",
    "seoDescription": "...",
    "tags": ["tag1", "tag2"],
    "variants": [{ "name": "Size M", "priceCents": 2999, "options": { "size": "M" } }]
  }]
}`;

  const systemPrompt = `${SYSTEM_PROMPTS.ecommerceContent}

You are also an expert store architect. You select the perfect visual template for any business and generate realistic, market-ready product catalogs with region-appropriate pricing and policies. Your store blueprints are comprehensive and ready to launch.`;

  const result = await ai.generateJSON<AIStoreBlueprint>(prompt, {
    maxTokens: 8000,
    systemPrompt,
  });

  return result;
}
