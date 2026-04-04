/**
 * AI-powered listing description generator for ListSmartly.
 * Uses Claude AI to create optimized business descriptions per directory.
 */

import { ai } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";

interface DescriptionInput {
  businessName: string;
  industry?: string;
  description?: string;
  services?: string;
  directoryName: string;
  maxLength?: number;
}

/**
 * Generate an optimized listing description for a specific directory.
 * Returns the AI-generated description string.
 */
export async function generateListingDescription(input: DescriptionInput): Promise<string> {
  const maxLength = input.maxLength || 500;

  const prompt = `Generate an optimized business listing description for "${input.businessName}" on ${input.directoryName}.

Business Industry: ${input.industry || "General"}
Current Description: ${input.description || "None provided"}
Services/Keywords: ${input.services || "Not specified"}
Maximum Length: ${maxLength} characters

Requirements:
- Keyword-rich for local SEO
- Natural, professional tone
- Include a clear call-to-action
- Stay within the character limit
- Optimized for the specific directory platform

Return JSON: { "description": "..." }`;

  const result = await ai.generateJSON<{ description: string }>(prompt, {
    systemPrompt: SYSTEM_PROMPTS.listingOptimizer,
    maxTokens: 512,
  });

  const description = result?.description || input.description || "";

  // Enforce max length
  if (description.length > maxLength) {
    return description.substring(0, maxLength - 3) + "...";
  }

  return description;
}

/**
 * Generate descriptions for multiple listings in bulk.
 * Returns a map of listingId -> description.
 */
export async function generateBulkDescriptions(
  listings: Array<{
    id: string;
    directoryName: string;
    currentDescription?: string;
  }>,
  profile: {
    businessName: string;
    industry?: string;
    description?: string;
  }
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const listing of listings) {
    try {
      const description = await generateListingDescription({
        businessName: profile.businessName,
        industry: profile.industry || undefined,
        description: profile.description || listing.currentDescription || undefined,
        directoryName: listing.directoryName,
      });
      results.set(listing.id, description);
    } catch (error) {
      console.error(`[ListSmartly] Failed to generate description for listing ${listing.id}:`, error);
      // Skip failed listings, don't block the batch
    }
  }

  return results;
}
