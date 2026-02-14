/**
 * Brand Generator
 * Handles AI-powered brand identity generation
 */

import { ai } from "../client";
import { buildBrandGenerationPrompt, SYSTEM_PROMPTS } from "../prompts";
import type { BrandGenerationRequest, BrandGenerationResult, ToneType } from "../types";

export async function generateBrand(request: BrandGenerationRequest): Promise<BrandGenerationResult> {
  const prompt = buildBrandGenerationPrompt(request.description);

  const response = await ai.generate(prompt, {
    maxTokens: 1500,
    temperature: 0.7,
    systemPrompt: SYSTEM_PROMPTS.brandStrategist,
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
  };
}

// Get token estimates for tracking
export function getBrandTokenEstimates(prompt: string, content: string) {
  return {
    inputTokens: ai.estimateTokens(prompt),
    outputTokens: ai.estimateTokens(content),
  };
}
