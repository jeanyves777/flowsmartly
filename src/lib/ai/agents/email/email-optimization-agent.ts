/**
 * EmailOptimizationAgent — suggests subject line variants, send time, and content improvements.
 */

import { ai } from "@/lib/ai/client";
import type { EmailSection } from "@/lib/marketing/email-renderer";
import type { EmailOptimizationResult } from "./types";
import type { BrandContext } from "@/lib/ai/types";

const SYSTEM_PROMPT = `You are an email marketing optimization expert. You analyze email content and provide actionable improvements.

OUTPUT FORMAT: Return valid JSON only, no markdown:
{
  "subjectVariants": ["variant1", "variant2", "variant3", "variant4", "variant5"],
  "suggestedSendTime": "Tuesday 10:00 AM",
  "contentSuggestions": [
    "Specific suggestion 1",
    "Specific suggestion 2",
    "Specific suggestion 3"
  ]
}

Subject line rules:
- Max 60 characters each
- Test different approaches: urgency, curiosity, benefit, personalization, question
- Avoid spam triggers

Send time rules:
- Suggest day and time based on industry and audience
- Format: "Day HH:MM AM/PM timezone"

Content suggestions:
- Be specific about which section to improve and how
- Focus on clarity, engagement, CTA strength, personalization, and deliverability`;

export async function optimizeEmail(
  subject: string,
  sections: EmailSection[],
  brandContext?: BrandContext | null
): Promise<EmailOptimizationResult> {
  const sectionsSummary = sections
    .map((s) => `[${s.type}] ${s.content?.slice(0, 100)}${s.content?.length > 100 ? "..." : ""}`)
    .join("\n");

  let brandBlock = "";
  if (brandContext) {
    brandBlock = `\nBrand: ${brandContext.name}${brandContext.industry ? `, Industry: ${brandContext.industry}` : ""}${brandContext.targetAudience ? `, Audience: ${brandContext.targetAudience}` : ""}`;
  }

  const userPrompt = `Optimize this email:
Subject: ${subject}
${brandBlock}

Sections:
${sectionsSummary}

Return only valid JSON with subjectVariants, suggestedSendTime, and contentSuggestions.`;

  const response = await ai.generate(userPrompt, {
    maxTokens: 1000,
    temperature: 0.7,
    systemPrompt: SYSTEM_PROMPT,
  });

  try {
    let clean = response.trim();
    if (clean.startsWith("```json")) clean = clean.slice(7);
    if (clean.startsWith("```")) clean = clean.slice(3);
    if (clean.endsWith("```")) clean = clean.slice(0, -3);
    return JSON.parse(clean.trim());
  } catch {
    return {
      subjectVariants: [subject],
      contentSuggestions: ["Could not parse optimization suggestions. Try again."],
    };
  }
}
