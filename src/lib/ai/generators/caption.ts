/**
 * Caption Generator
 * Handles caption generation for images/videos
 */

import { ai } from "../client";
import { buildCaptionPrompt, SYSTEM_PROMPTS } from "../prompts";
import { getUserPreferredLanguage, languageDirective } from "../user-language";
import type { CaptionGenerationRequest, CaptionGenerationResult } from "../types";

export async function generateCaption(request: CaptionGenerationRequest): Promise<CaptionGenerationResult> {
  const prompt = buildCaptionPrompt({
    mediaType: request.mediaType,
    mediaDescription: request.mediaDescription,
    context: request.context,
    platforms: request.platforms,
    settings: request.settings,
    brandContext: request.brandContext,
  });

  // Per feedback-ai-respects-user-language: prepend the language clause
  // to every text generator's system prompt.
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
export function getCaptionTokenEstimates(prompt: string, content: string) {
  return {
    inputTokens: ai.estimateTokens(prompt),
    outputTokens: ai.estimateTokens(content),
  };
}
