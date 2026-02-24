/**
 * AI Prompt Templates
 * Centralized prompt management for consistent AI outputs
 */

import type { BrandContext, GenerationSettings, Platform, HashtagCategory, ContentPillar } from "../types";
import { PLATFORM_CONSTRAINTS, LENGTH_TARGETS } from "../types";

// System prompts
export const SYSTEM_PROMPTS = {
  contentCreator: `You are an expert social media content creator and marketing specialist.
You create engaging, platform-optimized content that drives engagement and conversions.
You understand each platform's unique culture, best practices, and algorithm preferences.
Always return ONLY the requested content, nothing else - no explanations, no quotation marks, no labels.`,

  brandStrategist: `You are a brand strategist and marketing expert.
Generate comprehensive, professional brand identities based on business descriptions.
Always return valid JSON with complete, actionable brand information.`,

  hashtagExpert: `You are a social media hashtag strategist.
You understand hashtag optimization for reach, engagement, and discoverability.
You balance trending hashtags with niche-specific ones for optimal results.`,

  contentPlanner: `You are a content strategist specializing in social media marketing.
You create diverse, engaging content ideas that align with brand values and audience interests.
You understand content pillars and how to balance different types of content.`,

  ecommerceWriter: `You are an expert e-commerce copywriter and product marketing specialist.
You write compelling, SEO-optimized product copy that drives conversions.
You understand search intent, benefit-driven writing, and persuasive product descriptions.
Always match the brand's voice and tone. Be specific, avoid fluff, and highlight unique selling points.
Return ONLY valid JSON as requested.`,

  ecommerceContent: `You are an expert e-commerce content strategist and brand copywriter.
You create professional store content including about pages, policies, FAQs, and marketing copy.
You write in the brand's voice while maintaining clarity and professionalism.
Content should build trust, reflect the brand identity, and be appropriate for an online store.
Return ONLY valid JSON as requested.`,

  pricingStrategist: `You are an expert e-commerce pricing strategist.
You analyze market data, competitor prices, demand signals, and cost structures to recommend optimal pricing.
You understand psychological pricing, competitive positioning, margin optimization, and demand elasticity.
Your recommendations are data-driven, practical, and include clear reasoning.
Return ONLY valid JSON as requested.`,

  seoOptimizer: `You are an expert e-commerce SEO specialist.
You write compelling, search-engine-optimized titles and meta descriptions that maximize click-through rates.
You understand keyword placement, search intent, and character limits for search engine results pages.
Return ONLY valid JSON as requested.`,
};

// Build brand context string
export function buildBrandContext(brand: BrandContext): string {
  let context = `BRAND IDENTITY:
Brand Name: ${brand.name}`;

  if (brand.tagline) context += `\nTagline: ${brand.tagline}`;
  if (brand.description) context += `\nBrand Description: ${brand.description}`;
  if (brand.industry) context += `\nIndustry: ${brand.industry}`;
  if (brand.niche) context += `\nNiche: ${brand.niche}`;
  if (brand.uniqueValue) context += `\nUnique Value Proposition: ${brand.uniqueValue}`;

  context += `\n\nTARGET AUDIENCE:`;
  if (brand.targetAudience) context += `\n- ${brand.targetAudience}`;
  if (brand.audienceAge) context += `\n- Age: ${brand.audienceAge}`;
  if (brand.audienceLocation) context += `\n- Location: ${brand.audienceLocation}`;

  context += `\n\nBRAND VOICE:`;
  if (brand.voiceTone) context += `\nTone: ${brand.voiceTone}`;
  if (brand.personality.length > 0) context += `\nPersonality: ${brand.personality.join(", ")}`;

  if (brand.keywords.length > 0) {
    context += `\n\nKEY TOPICS/KEYWORDS: ${brand.keywords.join(", ")}`;
  }

  if (brand.products.length > 0) {
    context += `\n\nPRODUCTS/SERVICES: ${brand.products.join(", ")}`;
  }

  if (brand.hashtags.length > 0) {
    context += `\n\nBRAND HASHTAGS: ${brand.hashtags.join(" ")}`;
  }

  if (brand.avoidWords.length > 0) {
    context += `\n\nWORDS/TOPICS TO AVOID: ${brand.avoidWords.join(", ")}`;
  }

  const contactParts = [];
  if (brand.email) contactParts.push(`Email: ${brand.email}`);
  if (brand.phone) contactParts.push(`Phone: ${brand.phone}`);
  if (brand.website) contactParts.push(`Website: ${brand.website}`);
  if (brand.address) contactParts.push(`Address: ${brand.address}`);

  if (contactParts.length > 0) {
    context += `\n\nCONTACT INFORMATION:\n${contactParts.join("\n")}`;
  }

  return context;
}

// Build platform descriptions
export function buildPlatformDescriptions(platforms: Platform[]): string {
  return platforms
    .map(p => PLATFORM_CONSTRAINTS[p]?.description || p)
    .join("; ");
}

// Post generation prompt
export function buildPostPrompt(params: {
  topic: string;
  platforms: Platform[];
  settings: GenerationSettings;
  brandContext?: BrandContext;
}): string {
  const { topic, platforms, settings, brandContext } = params;
  const platformDescriptions = buildPlatformDescriptions(platforms);
  const lengthTarget = LENGTH_TARGETS[settings.length];
  const primaryPlatform = platforms[0];
  const hashtagLimit = PLATFORM_CONSTRAINTS[primaryPlatform]?.hashtagLimit || 10;

  let prompt = "";

  if (brandContext) {
    prompt += `${buildBrandContext(brandContext)}\n\n`;
  }

  prompt += `Create a social media post optimized for: ${platforms.map(p => p.toUpperCase()).join(", ")}

About: ${topic}

Target Platforms: ${platformDescriptions}
Tone: ${settings.tone}
Target length: ${lengthTarget.min}-${lengthTarget.max} characters

Requirements:
- Write in a ${settings.tone} voice that works well across all selected platforms
- Make it engaging, authentic, and shareable
- Optimize for maximum engagement on ${platforms.length > 1 ? "all platforms" : platforms[0]}`;

  if (settings.includeCTA) {
    prompt += `\n- Include a compelling call-to-action`;
  }

  if (settings.includeHashtags) {
    prompt += `\n- Include relevant hashtags (max ${hashtagLimit}) at the end`;
  } else {
    prompt += `\n- Do NOT include any hashtags`;
  }

  if (settings.includeEmojis) {
    prompt += `\n- Use emojis strategically to enhance the message and add visual appeal`;
  } else {
    prompt += `\n- Do NOT use any emojis`;
  }

  prompt += `\n
Write ONLY the post content. No explanations, no quotation marks, no "Here's your post:" prefix.
Just the ready-to-publish content.`;

  return prompt;
}

// Caption generation prompt
export function buildCaptionPrompt(params: {
  mediaType: "image" | "video" | "carousel";
  mediaDescription: string;
  context?: string;
  platforms: Platform[];
  settings: Omit<GenerationSettings, "includeCTA">;
  brandContext?: BrandContext;
}): string {
  const { mediaType, mediaDescription, context, platforms, settings, brandContext } = params;
  const lengthTarget = LENGTH_TARGETS[settings.length];
  const primaryPlatform = platforms[0];
  const hashtagLimit = PLATFORM_CONSTRAINTS[primaryPlatform]?.hashtagLimit || 10;

  let prompt = "";

  if (brandContext) {
    prompt += `${buildBrandContext(brandContext)}\n\n`;
  }

  prompt += `Write a caption for a ${mediaType} on ${platforms.join(", ")}

Media Description: ${mediaDescription}`;

  if (context) {
    prompt += `\nAdditional Context: ${context}`;
  }

  prompt += `

Tone: ${settings.tone}
Target length: ${lengthTarget.min}-${lengthTarget.max} characters

Requirements:
- Write in a ${settings.tone} voice
- Make it engaging and relevant to the visual content
- Encourage interaction`;

  if (settings.includeHashtags) {
    prompt += `\n- Include relevant hashtags (max ${hashtagLimit})`;
  }

  if (settings.includeEmojis) {
    prompt += `\n- Use emojis to add visual appeal`;
  }

  prompt += `\n
Write ONLY the caption. No explanations or labels.`;

  return prompt;
}

// Hashtag generation prompt
export function buildHashtagPrompt(params: {
  topic: string;
  platforms: Platform[];
  count: number;
  categories: HashtagCategory[];
  brandContext?: BrandContext;
}): string {
  const { topic, platforms, count, categories, brandContext } = params;

  let prompt = "";

  if (brandContext) {
    prompt += `${buildBrandContext(brandContext)}\n\n`;
  }

  prompt += `Generate ${count} hashtags for ${platforms.join(", ")}

Topic/Niche: ${topic}
Categories to include: ${categories.join(", ")}

Requirements:
- Mix of high-reach trending hashtags and niche-specific ones
- Relevant to the topic and target audience
- Optimized for discoverability on ${platforms.join(" and ")}`;

  if (brandContext?.hashtags.length) {
    prompt += `\n- Include some brand hashtags: ${brandContext.hashtags.join(" ")}`;
  }

  prompt += `\n
Return ONLY the hashtags, each starting with #, separated by spaces.
Example: #hashtag1 #hashtag2 #hashtag3`;

  return prompt;
}

// Ideas generation prompt
export function buildIdeasPrompt(params: {
  brand: string;
  industry: string;
  platforms: Platform[];
  contentPillars: ContentPillar[];
  count: number;
  brandContext?: BrandContext;
}): string {
  const { brand, industry, platforms, contentPillars, count, brandContext } = params;

  let prompt = "";

  if (brandContext) {
    prompt += `${buildBrandContext(brandContext)}\n\n`;
  }

  prompt += `Generate ${count} content ideas for:

Brand: ${brand}
Industry: ${industry}
Platforms: ${platforms.join(", ")}
Content Pillars: ${contentPillars.join(", ")}

Requirements:
- Ideas should align with the brand's voice and values
- Mix different content pillars
- Suitable for ${platforms.join(" and ")}
- Engaging and shareable

Format each idea as:
TITLE: [Short catchy title]
DESCRIPTION: [2-3 sentences explaining the content]
PILLAR: [${contentPillars.join("/")}]

---`;

  return prompt;
}

// Brand generation prompt
export function buildBrandGenerationPrompt(description: string): string {
  return `Analyze this business description and generate a complete brand identity profile.

BUSINESS DESCRIPTION:
${description}

Generate a JSON response with the following structure. Be creative, specific, and helpful:

{
  "name": "Brand name (extract from description or suggest if not provided)",
  "tagline": "A catchy tagline that captures the brand essence (max 10 words)",
  "description": "A polished 2-3 sentence brand description",
  "industry": "One of: SaaS / Technology, E-commerce / Retail, Health & Wellness, Finance / Fintech, Education, Marketing / Agency, Food & Beverage, Fashion & Beauty, Travel & Hospitality, Real Estate, Entertainment / Media, Non-profit, Professional Services, Manufacturing, Other",
  "niche": "Specific niche within the industry",
  "targetAudience": "Detailed description of ideal customers (2-3 sentences)",
  "audienceAge": "Age range (e.g., '25-45 years old')",
  "audienceLocation": "Geographic focus",
  "voiceTone": "One of: professional, casual, playful, inspirational, educational, friendly, authoritative",
  "personality": ["Array of 3-5 traits from: Innovative, Trustworthy, Friendly, Bold, Creative, Reliable, Modern, Traditional, Luxury, Accessible, Eco-friendly, Tech-savvy, Community-focused, Expert, Authentic"],
  "keywords": ["Array of 5-8 relevant keywords for content"],
  "hashtags": ["Array of 5-8 brand hashtags with # prefix"],
  "products": ["Array of main products or services offered"],
  "uniqueValue": "What makes this brand unique (1-2 sentences)"
}

Return ONLY valid JSON, no markdown, no explanations.`;
}

// Auto-generation prompt (template + brand)
export function buildAutoGenerationPrompt(params: {
  templateCategory: string;
  templatePrompt: string;
  platforms: Platform[];
  settings: GenerationSettings;
  brandContext: BrandContext;
}): string {
  const { templateCategory, templatePrompt, platforms, settings, brandContext } = params;
  const lengthTarget = LENGTH_TARGETS[settings.length];
  const primaryPlatform = platforms[0];
  const hashtagLimit = PLATFORM_CONSTRAINTS[primaryPlatform]?.hashtagLimit || 10;

  let prompt = `${buildBrandContext(brandContext)}

TEMPLATE GUIDE (use as inspiration, adapt for the brand):
${templatePrompt}

TARGET PLATFORMS: ${buildPlatformDescriptions(platforms)}
TARGET LENGTH: ${lengthTarget.min}-${lengthTarget.max} characters

REQUIREMENTS:
- Create engaging content that perfectly represents this brand
- Use the brand's voice, tone (${settings.tone}), and personality throughout
- Address the target audience directly
- Incorporate relevant brand keywords naturally
- Make it platform-optimized for maximum engagement`;

  if (settings.includeCTA) {
    prompt += `\n- Include a compelling call-to-action`;
  }

  if (settings.includeHashtags) {
    prompt += `\n- Include relevant hashtags (max ${hashtagLimit}) - mix of brand hashtags and trending ones`;
  } else {
    prompt += `\n- Do NOT include hashtags`;
  }

  if (settings.includeEmojis) {
    prompt += `\n- Use emojis strategically to enhance the message`;
  } else {
    prompt += `\n- Do NOT use emojis`;
  }

  // Add category-specific instructions
  switch (templateCategory) {
    case "hashtags":
      prompt += `\n\nReturn ONLY hashtags, each starting with #, separated by spaces.`;
      break;
    case "ideas":
      prompt += `\n\nFormat each idea as:
TITLE: [Short catchy title]
DESCRIPTION: [2-3 sentences]
PILLAR: [educational/entertaining/inspiring/promotional]

---`;
      break;
    default:
      prompt += `\n\nWrite ONLY the ready-to-publish content. No explanations, no quotation marks, no labels.`;
  }

  return prompt;
}

// ── E-Commerce Prompts ──────────────────────────────────────────────────────

/**
 * Build prompt for AI product copy generation
 */
export function buildProductCopyPrompt(params: {
  productName: string;
  category?: string;
  keywords?: string[];
  existingDescription?: string;
  brandContext?: BrandContext;
}): string {
  const { productName, category, keywords, existingDescription, brandContext } = params;

  let prompt = "";

  if (brandContext) {
    prompt += `${buildBrandContext(brandContext)}\n\n`;
  }

  prompt += `Generate complete e-commerce product copy for the following product:

Product Name: ${productName}`;

  if (category) prompt += `\nCategory: ${category}`;
  if (keywords?.length) prompt += `\nKeywords: ${keywords.join(", ")}`;
  if (existingDescription) prompt += `\nExisting Description (improve upon this): ${existingDescription}`;

  prompt += `

Generate a JSON object with the following fields:
{
  "title": "Optimized product title (max 80 chars, include key selling point)",
  "description": "Rich product description (2-4 paragraphs, benefit-driven, engaging, include features and use cases)",
  "shortDescription": "Concise summary (max 160 chars, for catalog/previews)",
  "seoTitle": "SEO-optimized page title (max 60 chars, include primary keyword)",
  "seoDescription": "SEO meta description (max 155 chars, include call-to-action)",
  "bulletPoints": ["Array of 4-6 key selling points/features, each 1 sentence"],
  "adCopy": "Short ad copy for social media promotion (max 280 chars, compelling with CTA)"
}

Requirements:
- Write in the brand's voice and tone
- Be specific and benefit-driven, not generic
- Include relevant keywords naturally for SEO
- The description should tell a story and address customer pain points
- Bullet points should highlight unique features and benefits`;

  return prompt;
}

/**
 * Build prompt for AI store content generation
 */
export function buildStoreContentPrompt(params: {
  contentTypes: string[];
  storeName?: string;
  industry?: string;
  brandContext?: BrandContext;
}): string {
  const { contentTypes, storeName, industry, brandContext } = params;

  let prompt = "";

  if (brandContext) {
    prompt += `${buildBrandContext(brandContext)}\n\n`;
  }

  prompt += `Generate professional e-commerce store content for "${storeName || "the store"}".`;
  if (industry) prompt += ` Industry: ${industry}.`;

  prompt += `\n\nGenerate a JSON object with ONLY the requested content types: ${contentTypes.join(", ")}

{`;

  if (contentTypes.includes("tagline")) {
    prompt += `\n  "tagline": "Catchy store tagline (max 80 chars)",`;
  }
  if (contentTypes.includes("about")) {
    prompt += `\n  "about": "About Us page content (2-3 paragraphs, tell the brand story, mission, values)",`;
  }
  if (contentTypes.includes("hero")) {
    prompt += `\n  "hero": { "headline": "Hero section headline (max 60 chars, bold and compelling)", "subheadline": "Supporting text (max 120 chars)" },`;
  }
  if (contentTypes.includes("return_policy")) {
    prompt += `\n  "returnPolicy": "Return & Refund policy (professional, customer-friendly, cover timeframe, conditions, process)",`;
  }
  if (contentTypes.includes("shipping_policy")) {
    prompt += `\n  "shippingPolicy": "Shipping policy (cover methods, timeframes, costs, tracking, international if applicable)",`;
  }
  if (contentTypes.includes("terms_of_service")) {
    prompt += `\n  "termsOfService": "Terms of Service (comprehensive: acceptance of terms, user accounts, payment terms, intellectual property, limitation of liability, governing law. 400-600 words)",`;
  }
  if (contentTypes.includes("privacy_policy")) {
    prompt += `\n  "privacyPolicy": "Privacy Policy (data collection, use, sharing, cookies, security measures, customer rights, data retention, contact info. 400-600 words)",`;
  }
  if (contentTypes.includes("faq")) {
    prompt += `\n  "faq": [{"question": "Common question", "answer": "Helpful answer"}] (generate 5-8 relevant FAQs for this type of store),`;
  }

  prompt += `\n}

Requirements:
- Write in the brand's voice and tone
- Be professional, trustworthy, and customer-focused
- Policies should be clear and fair
- About section should connect emotionally with the target audience
- FAQs should address real customer concerns for this industry`;

  return prompt;
}
