/**
 * Hashtag Generator
 * Handles hashtag generation for social media
 */

import { ai } from "../client";
import { buildHashtagPrompt, SYSTEM_PROMPTS } from "../prompts";
import { getUserPreferredLanguage, languageDirective } from "../user-language";
import type { HashtagGenerationRequest, HashtagGenerationResult } from "../types";

export async function generateHashtags(request: HashtagGenerationRequest): Promise<HashtagGenerationResult> {
  const prompt = buildHashtagPrompt({
    topic: request.topic,
    platforms: request.platforms,
    count: request.count,
    categories: request.categories,
    brandContext: request.brandContext,
  });

  // Per feedback-ai-respects-user-language: hashtags follow the user's
  // language too (#diadelpadre instead of #fathersday for Spanish users).
  const language = await getUserPreferredLanguage(request.userId);
  const systemPrompt = `${languageDirective(language)}\n\n${SYSTEM_PROMPTS.hashtagExpert}`;

  const content = await ai.generate(prompt, {
    maxTokens: 512,
    temperature: 0.7,
    systemPrompt,
  });

  // Parse hashtags from response
  const hashtagMatches = content.match(/#\w+/g) || [];

  // Remove duplicates and limit to requested count
  const uniqueHashtags = [...new Set(hashtagMatches)].slice(0, request.count);

  return {
    hashtags: uniqueHashtags,
    platforms: request.platforms,
  };
}

// Get token estimates for tracking
export function getHashtagTokenEstimates(prompt: string, content: string) {
  return {
    inputTokens: ai.estimateTokens(prompt),
    outputTokens: ai.estimateTokens(content),
  };
}
