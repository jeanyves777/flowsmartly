/**
 * Brand Generator
 * Handles AI-powered brand identity generation
 */

import { ai } from "../client";
import { buildBrandGenerationPrompt, SYSTEM_PROMPTS } from "../prompts";
import { isSupportedLanguage, DEFAULT_LANGUAGE } from "../user-language";
import type { BrandGenerationRequest, BrandGenerationResult, ToneType } from "../types";

export async function generateBrand(request: BrandGenerationRequest): Promise<BrandGenerationResult> {
  const prompt = buildBrandGenerationPrompt(request.description);

  // Per feedback-ai-respects-user-language: the brand-kit generator is
  // SPECIAL — it doesn't read an existing preference (the user has none
  // yet), it DETECTS one from the description and produces the brand in
  // that language. The detected tag is saved as preferredLanguage by
  // the API route so every future generation stays in that language.
  const languageInstruction = `
LANGUAGE INSTRUCTION (CRITICAL):
1. Detect the primary language of the input business description below.
2. Produce EVERY field of the brand kit (name, tagline, description, industry, niche, targetAudience, audienceAge, audienceLocation, personality items, keywords, hashtags, products, uniqueValue) IN THAT LANGUAGE.
3. Include a top-level field "detectedLanguage" with the BCP-47 tag — one of: en, fr, es, pt, pt-BR, de, it, nl, pl, ru, tr, ar, he, zh, zh-TW, ja, ko, hi, bn, id, vi, th. Default "en" if uncertain.
4. voiceTone stays in English (it's an enum: professional / casual / playful / inspirational / educational / friendly / authoritative).
`;

  const systemPrompt = `${SYSTEM_PROMPTS.brandStrategist}\n\n${languageInstruction}`;

  const response = await ai.generate(prompt, {
    maxTokens: 1500,
    temperature: 0.7,
    systemPrompt,
  });

  // Parse the AI response
  const brandData = parseJSONResponse(response);

  if (!brandData) {
    throw new Error("Failed to parse AI response");
  }

  // Ensure proper formatting
  return formatBrandResult(brandData);
}

// Parse JSON from AI response
function parseJSONResponse(response: string): Record<string, unknown> | null {
  try {
    // Clean the response - remove any markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith("```json")) {
      cleanResponse = cleanResponse.slice(7);
    }
    if (cleanResponse.startsWith("```")) {
      cleanResponse = cleanResponse.slice(3);
    }
    if (cleanResponse.endsWith("```")) {
      cleanResponse = cleanResponse.slice(0, -3);
    }
    return JSON.parse(cleanResponse.trim());
  } catch {
    console.error("Failed to parse AI response:", response);
    return null;
  }
}

// Format brand result with proper types
function formatBrandResult(data: Record<string, unknown>): BrandGenerationResult {
  const rawLang = typeof data.detectedLanguage === "string" ? data.detectedLanguage.trim() : "";
  const detectedLanguage = isSupportedLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;
  return {
    name: String(data.name || ""),
    tagline: String(data.tagline || ""),
    description: String(data.description || ""),
    industry: String(data.industry || ""),
    niche: String(data.niche || ""),
    targetAudience: String(data.targetAudience || ""),
    audienceAge: String(data.audienceAge || ""),
    audienceLocation: String(data.audienceLocation || ""),
    voiceTone: (data.voiceTone as ToneType) || "professional",
    personality: Array.isArray(data.personality) ? data.personality.map(String) : [],
    keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
    hashtags: Array.isArray(data.hashtags)
      ? data.hashtags.map((h: unknown) => {
          const str = String(h);
          return str.startsWith("#") ? str : `#${str}`;
        })
      : [],
    products: Array.isArray(data.products) ? data.products.map(String) : [],
    uniqueValue: String(data.uniqueValue || ""),
    detectedLanguage,
  };
}

// Get token estimates for tracking
export function getBrandTokenEstimates(prompt: string, content: string) {
  return {
    inputTokens: ai.estimateTokens(prompt),
    outputTokens: ai.estimateTokens(content),
  };
}
