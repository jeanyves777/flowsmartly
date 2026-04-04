/**
 * AI Website Generator — Claude generates full site structure from questionnaire
 */

import { ai } from "@/lib/ai/client";
import type {
  SiteQuestionnaire,
  AIGeneratedSite,
  WebsiteBlock,
  WebsiteTheme,
  WebsiteNavigation,
} from "@/types/website-builder";
import { DEFAULT_THEME } from "./theme-resolver";

const SYSTEM_PROMPT = `You are an expert website designer and copywriter. You generate complete website structures as JSON.

Your output must be a valid JSON object matching this schema:
{
  "name": "Site Name",
  "theme": {
    "colors": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "surface": "#hex", "text": "#hex", "textMuted": "#hex", "border": "#hex" },
    "fonts": { "heading": "Font Name", "body": "Font Name" },
    "borderRadius": 8,
    "spacing": "normal",
    "maxWidth": "lg",
    "headerStyle": "solid",
    "footerStyle": "columns",
    "buttonStyle": "rounded"
  },
  "navigation": {
    "header": { "logoText": "Brand", "logoPosition": "left", "items": [{"label": "Home", "href": "/"}], "sticky": true, "transparent": false, "style": "solid" },
    "footer": { "description": "...", "columns": [{"title": "Links", "links": [{"label": "About", "href": "/about"}]}], "copyright": "...", "socials": [{"platform": "twitter", "url": "#"}] }
  },
  "pages": [
    {
      "title": "Home",
      "slug": "",
      "description": "Homepage",
      "isHomePage": true,
      "blocks": [
        {
          "id": "unique-id",
          "type": "hero",
          "variant": "centered",
          "content": { /* type-specific content */ },
          "style": {},
          "animation": { "entrance": "fade-in", "scroll": "none", "hover": "none" },
          "responsive": {},
          "visibility": { "enabled": true },
          "sortOrder": 0
        }
      ]
    }
  ]
}

IMPORTANT RULES:
- Generate REAL, compelling content specific to the business (not placeholder/lorem ipsum)
- Use proper block types: hero, features, pricing, testimonials, gallery, contact, text, team, faq, stats, cta, header, footer, blog, portfolio, logo-cloud, video, divider, spacer, image
- Each page should start with a header block and end with a footer block
- Apply entrance animations sparingly (fade-in, slide-up for key sections)
- Choose colors that match the industry and style preference
- Use appropriate Google Fonts for the style
- Generate 3-8 blocks per page (not too many, not too few)
- Each block ID must be unique (use random 8-char alphanumeric strings)
- Match the content tone to the requested tone (professional, casual, friendly, luxury, playful)
- For pricing blocks, create realistic plans that match the business type
- For testimonials, create realistic (but fictional) reviews
- Keep text concise and impactful — web visitors skim`;

export async function generateWebsite(
  questionnaire: SiteQuestionnaire,
  brandKit?: { colors?: string; fonts?: string; logo?: string; name?: string; voiceTone?: string; industry?: string; targetAudience?: string } | null
): Promise<AIGeneratedSite> {
  const parts: string[] = [];

  parts.push(`Business: ${questionnaire.businessName}`);
  parts.push(`Industry: ${questionnaire.industry}`);
  parts.push(`Description: ${questionnaire.description}`);
  parts.push(`Target Audience: ${questionnaire.targetAudience}`);
  parts.push(`Goals: ${questionnaire.goals.join(", ")}`);
  parts.push(`Pages to create: ${questionnaire.pages.join(", ")}`);
  parts.push(`Style: ${questionnaire.stylePreference}`);
  parts.push(`Content Tone: ${questionnaire.contentTone}`);
  parts.push(`Features: ${questionnaire.features.join(", ")}`);

  if (questionnaire.existingContent) {
    parts.push(`\nExisting Content to incorporate:\n${questionnaire.existingContent}`);
  }

  if (brandKit) {
    parts.push(`\nBrand Kit:`);
    if (brandKit.name) parts.push(`- Brand Name: ${brandKit.name}`);
    if (brandKit.colors) {
      try {
        const colors = JSON.parse(brandKit.colors);
        parts.push(`- Brand Colors: Primary ${colors.primary || "auto"}, Secondary ${colors.secondary || "auto"}, Accent ${colors.accent || "auto"}`);
      } catch {}
    }
    if (brandKit.fonts) {
      try {
        const fonts = JSON.parse(brandKit.fonts);
        parts.push(`- Brand Fonts: Heading "${fonts.heading || "auto"}", Body "${fonts.body || "auto"}"`);
      } catch {}
    }
    if (brandKit.logo) parts.push(`- Logo URL: ${brandKit.logo}`);
    if (brandKit.voiceTone) parts.push(`- Brand Voice: ${brandKit.voiceTone}`);
    if (brandKit.industry) parts.push(`- Industry: ${brandKit.industry}`);
    if (brandKit.targetAudience) parts.push(`- Target Audience: ${brandKit.targetAudience}`);
  }

  const userPrompt = `Generate a complete website for this business:\n\n${parts.join("\n")}\n\nReturn ONLY the JSON object, no markdown code fences.`;

  const response = await ai.generate(userPrompt, {
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: 8000,
    temperature: 0.7,
    model: "claude-sonnet-4-20250514",
  });

  // Parse the JSON response
  let parsed: AIGeneratedSite;
  try {
    // Strip potential markdown code fences
    let text = response.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse AI response:", response.substring(0, 200));
    throw new Error("AI generation produced invalid JSON. Please try again.");
  }

  // Validate and sanitize
  if (!parsed.pages || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error("AI generation produced no pages.");
  }

  // Ensure theme has all required fields
  parsed.theme = {
    ...DEFAULT_THEME,
    ...parsed.theme,
    colors: { ...DEFAULT_THEME.colors, ...(parsed.theme?.colors || {}) },
    fonts: { ...DEFAULT_THEME.fonts, ...(parsed.theme?.fonts || {}) },
  };

  // Ensure all blocks have required fields
  for (const page of parsed.pages) {
    if (!page.blocks) page.blocks = [];
    page.blocks = page.blocks.map((block: WebsiteBlock, i: number) => ({
      id: block.id || Math.random().toString(36).substring(2, 10),
      type: block.type || "text",
      variant: block.variant || "default",
      content: block.content || {},
      style: block.style || {},
      animation: { entrance: "none", scroll: "none", hover: "none", ...(block.animation || {}) },
      responsive: block.responsive || {},
      visibility: { ...(block.visibility || {}), enabled: (block.visibility?.enabled !== false) },
      sortOrder: i,
    }));
  }

  return parsed;
}

/**
 * AI Block Refiner — refine a single block's content
 */
export async function refineBlock(
  block: WebsiteBlock,
  instruction: string,
  context?: { businessName?: string; industry?: string }
): Promise<Partial<typeof block.content>> {
  const prompt = `You are refining a website block. Here is the current block content:

Type: ${block.type}
Variant: ${block.variant}
Current content: ${JSON.stringify(block.content, null, 2)}

${context ? `Business: ${context.businessName || "Unknown"}, Industry: ${context.industry || "Unknown"}` : ""}

User instruction: ${instruction}

Return ONLY the updated content object as JSON (same structure as the current content, with improvements applied). No markdown fences.`;

  const response = await ai.generate(prompt, {
    maxTokens: 2000,
    temperature: 0.6,
    model: "claude-sonnet-4-20250514",
  });

  try {
    let text = response.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    return JSON.parse(text);
  } catch {
    throw new Error("AI refinement produced invalid JSON.");
  }
}
