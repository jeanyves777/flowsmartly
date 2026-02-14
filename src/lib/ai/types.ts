/**
 * AI Hub Types
 * Central type definitions for all AI operations
 */

// Platform types
export type Platform = "instagram" | "twitter" | "linkedin" | "facebook" | "youtube" | "tiktok";

// Tone types
export type ToneType = "professional" | "casual" | "humorous" | "inspirational" | "educational" | "friendly" | "authoritative" | "playful";

// Length types
export type LengthType = "short" | "medium" | "long";

// Content category types
export type ContentCategory = "social-post" | "caption" | "hashtags" | "ideas" | "thread";

// Hashtag category types
export type HashtagCategory = "trending" | "niche" | "branded" | "community";

// Content pillar types
export type ContentPillar = "educational" | "entertaining" | "inspiring" | "promotional" | "behind-scenes" | "user-generated";

// Brand identity for context
export interface BrandContext {
  name: string;
  tagline?: string | null;
  description?: string | null;
  industry?: string | null;
  niche?: string | null;
  targetAudience?: string | null;
  audienceAge?: string | null;
  audienceLocation?: string | null;
  voiceTone?: string | null;
  personality: string[];
  keywords: string[];
  avoidWords: string[];
  hashtags: string[];
  products: string[];
  uniqueValue?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
}

// Generation settings
export interface GenerationSettings {
  tone: ToneType;
  length: LengthType;
  includeHashtags: boolean;
  includeEmojis: boolean;
  includeCTA: boolean;
}

// Platform constraints
export interface PlatformConstraints {
  maxLength: number;
  hashtagLimit: number;
  description: string;
}

// Base generation request
export interface BaseGenerationRequest {
  platforms: Platform[];
  userId: string;
}

// Post generation request
export interface PostGenerationRequest extends BaseGenerationRequest {
  topic: string;
  settings: GenerationSettings;
  brandContext?: BrandContext;
}

// Caption generation request
export interface CaptionGenerationRequest extends BaseGenerationRequest {
  mediaType: "image" | "video" | "carousel";
  mediaDescription: string;
  context?: string;
  settings: Omit<GenerationSettings, "includeCTA">;
  brandContext?: BrandContext;
}

// Hashtag generation request
export interface HashtagGenerationRequest extends BaseGenerationRequest {
  topic: string;
  count: number;
  categories: HashtagCategory[];
  brandContext?: BrandContext;
}

// Ideas generation request
export interface IdeasGenerationRequest extends BaseGenerationRequest {
  brand: string;
  industry: string;
  contentPillars: ContentPillar[];
  count: number;
  brandContext?: BrandContext;
}

// Brand generation request
export interface BrandGenerationRequest {
  description: string;
  userId: string;
}

// Auto-generation request (template + brand)
export interface AutoGenerationRequest extends BaseGenerationRequest {
  templateId: string;
  templateCategory: ContentCategory;
  templatePrompt: string;
  settings: GenerationSettings;
  brandContext: BrandContext;
}

// Generation results
export interface PostGenerationResult {
  content: string;
  platforms: Platform[];
}

export interface CaptionGenerationResult {
  content: string;
  platforms: Platform[];
}

export interface HashtagGenerationResult {
  hashtags: string[];
  platforms: Platform[];
}

export interface IdeaItem {
  title: string;
  description: string;
  pillar: string;
}

export interface IdeasGenerationResult {
  ideas: IdeaItem[];
  platforms: Platform[];
}

export interface BrandGenerationResult {
  name: string;
  tagline: string;
  description: string;
  industry: string;
  niche: string;
  targetAudience: string;
  audienceAge: string;
  audienceLocation: string;
  voiceTone: ToneType;
  personality: string[];
  keywords: string[];
  hashtags: string[];
  products: string[];
  uniqueValue: string;
}

// AI usage tracking
export interface AIUsageRecord {
  userId: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  creditsUsed: number;
}

// Length targets in characters
export const LENGTH_TARGETS: Record<LengthType, { min: number; max: number }> = {
  short: { min: 50, max: 100 },
  medium: { min: 150, max: 250 },
  long: { min: 300, max: 500 },
};

// Platform constraints
export const PLATFORM_CONSTRAINTS: Record<Platform, PlatformConstraints> = {
  instagram: {
    maxLength: 2200,
    hashtagLimit: 30,
    description: "Instagram - visual-first platform, great for storytelling",
  },
  twitter: {
    maxLength: 280,
    hashtagLimit: 5,
    description: "X (Twitter) - concise, punchy, conversation-starting",
  },
  linkedin: {
    maxLength: 3000,
    hashtagLimit: 5,
    description: "LinkedIn - professional, insightful, industry-focused",
  },
  facebook: {
    maxLength: 63206,
    hashtagLimit: 10,
    description: "Facebook - community-focused, engaging, shareable",
  },
  youtube: {
    maxLength: 5000,
    hashtagLimit: 15,
    description: "YouTube - descriptive, SEO-optimized content",
  },
  tiktok: {
    maxLength: 2200,
    hashtagLimit: 10,
    description: "TikTok - trendy, fun, Gen-Z focused",
  },
};
