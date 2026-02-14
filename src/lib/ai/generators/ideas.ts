/**
 * Ideas Generator
 * Handles content ideas generation
 */

import { ai } from "../client";
import { buildIdeasPrompt, SYSTEM_PROMPTS } from "../prompts";
import type { IdeasGenerationRequest, IdeasGenerationResult, IdeaItem } from "../types";

export async function generateIdeas(request: IdeasGenerationRequest): Promise<IdeasGenerationResult> {
  const prompt = buildIdeasPrompt({
    brand: request.brand,
    industry: request.industry,
    platforms: request.platforms,
    contentPillars: request.contentPillars,
    count: request.count,
    brandContext: request.brandContext,
  });

  const content = await ai.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.8,
    systemPrompt: SYSTEM_PROMPTS.contentPlanner,
  });

  // Parse ideas from response
  const ideas = parseIdeasResponse(content, request.count);

  return {
    ideas,
    platforms: request.platforms,
  };
}

// Parse ideas from AI response
function parseIdeasResponse(response: string, maxCount: number): IdeaItem[] {
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

  // If parsing failed, create basic ideas from the response
  if (ideas.length === 0 && response.trim()) {
    const lines = response.split("\n").filter(l => l.trim());
    for (let i = 0; i < Math.min(maxCount, lines.length); i++) {
      ideas.push({
        title: lines[i].substring(0, 50),
        description: lines[i],
        pillar: "educational",
      });
    }
  }

  return ideas.slice(0, maxCount);
}

// Get token estimates for tracking
export function getIdeasTokenEstimates(prompt: string, content: string) {
  return {
    inputTokens: ai.estimateTokens(prompt),
    outputTokens: ai.estimateTokens(content),
  };
}
