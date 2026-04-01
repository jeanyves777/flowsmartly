/**
 * EmailTemplateAgent — designs full email template layouts.
 * Returns structured sections + metadata for saving as a reusable template.
 */

import { ai } from "@/lib/ai/client";
import { generateSectionId } from "@/lib/marketing/email-renderer";
import type { EmailAgentInput, EmailTemplateResult } from "./types";
import type { EmailSection } from "@/lib/marketing/email-renderer";

const SYSTEM_PROMPT = `You are an expert email template designer. You create professional, reusable email template structures that can be customized for different campaigns.

Your templates should be well-structured with clear sections that make sense for the requested type of email. Think about layout, visual hierarchy, and user experience.

OUTPUT FORMAT: Return valid JSON only, no markdown:
{
  "name": "Template Name",
  "description": "One-line description of this template",
  "category": "promotional|lifecycle|birthday|holiday|content|transactional|custom",
  "subject": "Default subject line",
  "preheader": "Default preheader text",
  "sections": [
    { "type": "heading", "content": "..." },
    { "type": "text", "content": "..." },
    { "type": "button", "content": "...", "href": "https://..." },
    ...
  ]
}

Section types available: heading, text, button, highlight, image, divider, coupon, hero.
- Use "heading" for titles (set "level": "h2" for subtitles)
- Use "text" for paragraphs — include {{firstName}} for personalization
- Use "button" for CTAs with "href"
- Use "highlight" for callout boxes
- Use "image" for placeholders (set "imageUrl" to "" and "imageAlt" to descriptive text)
- Use "hero" for a top banner image (set "overlayText" for text on image)
- Use "divider" for visual breaks
- Use "coupon" with "couponCode" for discount codes

Create 5-10 sections for a professional-looking email. Include placeholder content that's easy to customize.`;

export async function designEmailTemplate(input: EmailAgentInput): Promise<EmailTemplateResult> {
  const brandContext = input.brandContext;
  let brandBlock = "";
  if (brandContext) {
    const parts: string[] = [`Brand: ${brandContext.name}`];
    if (brandContext.voiceTone) parts.push(`Voice: ${brandContext.voiceTone}`);
    if (brandContext.industry) parts.push(`Industry: ${brandContext.industry}`);
    if (brandContext.targetAudience) parts.push(`Audience: ${brandContext.targetAudience}`);
    brandBlock = `\nBrand context: ${parts.join(", ")}`;
  }

  const userPrompt = `Design an email template for: ${input.prompt}${brandBlock}${input.category ? `\nCategory: ${input.category}` : ""}${input.tone ? `\nTone: ${input.tone}` : ""}

Return only valid JSON.`;

  const response = await ai.generate(userPrompt, {
    maxTokens: 2500,
    temperature: 0.7,
    systemPrompt: SYSTEM_PROMPT,
  });

  let parsed: EmailTemplateResult;
  try {
    let clean = response.trim();
    if (clean.startsWith("```json")) clean = clean.slice(7);
    if (clean.startsWith("```")) clean = clean.slice(3);
    if (clean.endsWith("```")) clean = clean.slice(0, -3);
    parsed = JSON.parse(clean.trim());
  } catch {
    parsed = {
      name: "Custom Template",
      description: "AI-generated email template",
      category: input.category || "custom",
      subject: "Your Subject Here",
      preheader: "",
      sections: [
        { id: generateSectionId(), type: "heading", content: "Your Email" },
        { id: generateSectionId(), type: "text", content: response },
        { id: generateSectionId(), type: "button", content: "Learn More", href: "https://" },
      ],
    };
  }

  // Ensure all sections have IDs
  const sections: EmailSection[] = (parsed.sections || []).map((s) => ({
    ...s,
    id: s.id || generateSectionId(),
  }));

  return {
    name: parsed.name || "Custom Template",
    description: parsed.description || "AI-generated email template",
    category: parsed.category || input.category || "custom",
    subject: parsed.subject || "Your Subject Here",
    preheader: parsed.preheader || "",
    sections,
  };
}
