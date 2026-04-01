/**
 * EmailContentAgent — generates email copy as structured sections.
 * Respects brand voice, tone, personality, and visual identity.
 */

import { ai } from "@/lib/ai/client";
import { generateSectionId } from "@/lib/marketing/email-renderer";
import type { EmailAgentInput, EmailContentResult } from "./types";
import type { EmailSection } from "@/lib/marketing/email-renderer";

function buildSystemPrompt(input: EmailAgentInput): string {
  const brand = input.brandContext;
  let brandBlock = "";

  if (brand) {
    const parts: string[] = [`Brand: ${brand.name}`];
    if (brand.tagline) parts.push(`Tagline: ${brand.tagline}`);
    if (brand.voiceTone) parts.push(`Voice tone: ${brand.voiceTone}`);
    if (brand.personality?.length) parts.push(`Personality: ${brand.personality.join(", ")}`);
    if (brand.industry) parts.push(`Industry: ${brand.industry}`);
    if (brand.targetAudience) parts.push(`Target audience: ${brand.targetAudience}`);
    if (brand.keywords?.length) parts.push(`Keywords to use: ${brand.keywords.join(", ")}`);
    if (brand.avoidWords?.length) parts.push(`Words to avoid: ${brand.avoidWords.join(", ")}`);
    if (brand.products?.length) parts.push(`Products/services: ${brand.products.join(", ")}`);
    if (brand.uniqueValue) parts.push(`Unique value: ${brand.uniqueValue}`);
    brandBlock = `\n\nBRAND CONTEXT:\n${parts.join("\n")}`;
  }

  return `You are an expert email marketing copywriter. You write compelling, on-brand emails that drive action while avoiding spam triggers.${brandBlock}

RULES:
- Write authentic, human-sounding copy — no generic filler
- Subject line: max 60 characters, compelling, no ALL CAPS or excessive punctuation
- Preheader: max 100 characters, complements the subject
- Content must match the brand's voice tone${brand?.voiceTone ? ` (${brand.voiceTone})` : ""}
- Include a clear call-to-action
- Use merge tags like {{firstName}} for personalization
- Avoid spam words: free, guaranteed, act now, limited time, etc.

OUTPUT FORMAT: Return valid JSON only, no markdown. Structure:
{
  "subject": "Subject line",
  "preheader": "Preheader text",
  "sections": [
    { "type": "heading", "content": "..." },
    { "type": "text", "content": "..." },
    { "type": "button", "content": "Button Text", "href": "https://..." },
    ...
  ]
}

Section types you can use: heading, text, button, highlight, image, divider, coupon.
- "heading": title text (use for main email headline)
- "text": paragraph content (use {{firstName}} etc.)
- "button": CTA with "content" (button text) and "href" (URL)
- "highlight": important callout/quote
- "divider": visual separator
- "coupon": set "couponCode" for a discount code`;
}

export async function generateEmailContent(input: EmailAgentInput): Promise<EmailContentResult> {
  const tone = input.tone || (input.brandContext?.voiceTone as string) || "professional";
  const userPrompt = `Generate an email${input.category ? ` (category: ${input.category})` : ""} with tone: ${tone}.

User request: ${input.prompt}

Return only valid JSON with subject, preheader, and sections array.`;

  const response = await ai.generate(userPrompt, {
    maxTokens: 2000,
    temperature: 0.7,
    systemPrompt: buildSystemPrompt(input),
  });

  // Parse JSON response
  let parsed: { subject: string; preheader: string; sections: EmailSection[] };
  try {
    let clean = response.trim();
    if (clean.startsWith("```json")) clean = clean.slice(7);
    if (clean.startsWith("```")) clean = clean.slice(3);
    if (clean.endsWith("```")) clean = clean.slice(0, -3);
    parsed = JSON.parse(clean.trim());
  } catch {
    // Fallback: treat entire response as text content
    parsed = {
      subject: "Your Email",
      preheader: "",
      sections: [
        { id: generateSectionId(), type: "heading", content: "Your Email" },
        { id: generateSectionId(), type: "text", content: response },
      ],
    };
  }

  // Ensure all sections have IDs
  const sections = (parsed.sections || []).map((s) => ({
    ...s,
    id: s.id || generateSectionId(),
  }));

  return {
    subject: parsed.subject || "Your Email",
    preheader: parsed.preheader || "",
    sections,
  };
}
