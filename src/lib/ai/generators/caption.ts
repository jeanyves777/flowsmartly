/**
 * Caption Generator
 * Handles caption generation for images/videos
 */

import { ai } from "../client";
import { buildCaptionPrompt, SYSTEM_PROMPTS } from "../prompts";
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
export function getCaptionTokenEstimates(prompt: string, content: string) {
  return {
    inputTokens: ai.estimateTokens(prompt),
    outputTokens: ai.estimateTokens(content),
  };
}
