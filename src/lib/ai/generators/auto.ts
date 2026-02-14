/**
 * Auto Generator
 * Handles automatic content generation using templates + brand identity
 */

import { ai } from "../client";
import { buildAutoGenerationPrompt, SYSTEM_PROMPTS } from "../prompts";
import type { AutoGenerationRequest, IdeaItem } from "../types";

export type AutoGenerationResult = {
  content?: string;
  hashtags?: string[];
  ideas?: IdeaItem[];
};

export async function generateAuto(request: AutoGenerationRequest): Promise<AutoGenerationResult> {
  const prompt = buildAutoGenerationPrompt({
    templateCategory: request.templateCategory,
    templatePrompt: request.templatePrompt,
    platforms: request.platforms,
    settings: request.settings,
    brandContext: request.brandContext,
  });

  const response = await ai.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.8,
    systemPrompt: SYSTEM_PROMPTS.contentCreator,
  });

  // Parse response based on category
  switch (request.templateCategory) {
    case "hashtags":
      return parseHashtagsResponse(response);
    case "ideas":
      return parseIdeasResponse(response);
    default:
      return { content: response.trim() };
  }
}

// Parse hashtags from response
function parseHashtagsResponse(response: string): AutoGenerationResult {
  const hashtagMatches = response.match(/#\w+/g) || [];
  return { hashtags: [...new Set(hashtagMatches)] };
}

// Parse ideas from response
function parseIdeasResponse(response: string): AutoGenerationResult {
  const ideas: IdeaItem[] = [];
  const blocks = response.split("---").filter(Boolean);

  for (const block of blocks) {
    const titleMatch = block.match(/TITLE:\s*(.+)/i);
    const descMatch = block.match(/DESCRIPTION:\s*(.+)/is);
    const pillarMatch = block.match(/PILLAR:\s*(\w+)/i);

    if (titleMatch && descMatch) {
      ideas.push({
        title: titleMatch[1].trim(),
        description: descMatch[1].trim().replace(/\n/g, " ").substring(0, 200),
        pillar: pillarMatch ? pillarMatch[1].toLowerCase() : "educational",
      });
    }
  }

  // Fallback if parsing fails
  if (ideas.length === 0 && response.trim()) {
    const lines = response.split("\n").filter(l => l.trim());
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      ideas.push({
        title: lines[i].substring(0, 50),
        description: lines[i],
        pillar: "educational",
      });
    }
  }

  return { ideas: ideas.slice(0, 5) };
}

// Get token estimates for tracking
export function getAutoTokenEstimates(prompt: string, content: string) {
  return {
    inputTokens: ai.estimateTokens(prompt),
    outputTokens: ai.estimateTokens(content),
  };
}
