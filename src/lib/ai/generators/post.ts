/**
 * Post Generator
 * Handles social media post generation
 */

import { ai } from "../client";
import { buildPostPrompt, SYSTEM_PROMPTS } from "../prompts";
import { getUserPreferredLanguage, languageDirective } from "../user-language";
import type { PostGenerationRequest, PostGenerationResult } from "../types";

export async function generatePost(request: PostGenerationRequest): Promise<PostGenerationResult> {
  const prompt = buildPostPrompt({
    topic: request.topic,
    platforms: request.platforms,
    settings: request.settings,
    brandContext: request.brandContext,
  });

  // Per feedback-ai-respects-user-language: every AI text generator
  // injects the user's preferred language directive into the system
  // prompt. This is the only language-aware change here — the prompt
  // builder + temperature settings stay identical.
  const language = await getUserPreferredLanguage(request.userId);
  const systemPrompt = `${languageDirective(language)}\n\n${SYSTEM_PROMPTS.contentCreator}`;

  const content = await ai.generate(prompt, {
    maxTokens: 1024,
    temperature: 0.8,
    systemPrompt,
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
