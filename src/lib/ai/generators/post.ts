/**
 * Post Generator
 * Handles social media post generation
 */

import { ai } from "../client";
import { buildPostPrompt, SYSTEM_PROMPTS } from "../prompts";
import type { PostGenerationRequest, PostGenerationResult } from "../types";

export async function generatePost(request: PostGenerationRequest): Promise<PostGenerationResult> {
  const prompt = buildPostPrompt({
    topic: request.topic,
    platforms: request.platforms,
    settings: request.settings,
    brandContext: request.brandContext,
  });

  const content = await ai.generate(prompt, {
    maxTokens: 1024,
    temperature: 0.8,
    systemPrompt: SYSTEM_PROMPTS.contentCreator,
  });

  return {
    content: content.trim(),
    platforms: request.platforms,
  };
}

// Get token estimates for tracking
export function getPostTokenEstimates(prompt: string, content: string) {
  return {
    inputTokens: ai.estimateTokens(prompt),
    outputTokens: ai.estimateTokens(content),
  };
}
