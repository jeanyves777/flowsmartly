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
- Do NOT include header or footer blocks — those are handled separately by the site navigation config
- Apply entrance animations sparingly (use "fade-in" or "slide-up" on 2-3 key sections, "none" for the rest)
- Choose colors that match the industry and style preference
- Use appropriate Google Fonts for the style (e.g. "Inter", "Poppins", "Playfair Display")
- Generate 3-5 blocks per page MAXIMUM — keep it concise, users add more in the editor
- Each block ID must be unique (use random 8-char alphanumeric strings like "a1b2c3d4")
- Match the content tone to the requested tone
- Keep ALL text short and punchy — no long paragraphs
- For style/animation objects, use empty {} if no overrides needed
- Output ONLY valid JSON — no trailing commas, no comments`;

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
    maxTokens: 16000,
    temperature: 0.7,
    model: "claude-sonnet-4-20250514",
  });

  console.log("[WebsiteAI] Response received, length:", response.length);

  // Parse the JSON response
  let parsed: AIGeneratedSite;
  try {
    let text = response.trim();
    // Strip markdown code fences
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "");
    }
    // Find JSON object boundaries if there's extra text
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      text = text.substring(jsonStart, jsonEnd + 1);
    }

    // Try to parse — if truncated, try to fix common issues
    try {
      parsed = JSON.parse(text);
    } catch (firstErr) {
      console.warn("[WebsiteAI] First parse failed, attempting JSON repair...");
      // Common fix: truncated response missing closing brackets
      // Count open/close braces and brackets
      let openBraces = 0, openBrackets = 0;
      let inString = false, escape = false;
      for (const ch of text) {
        if (escape) { escape = false; continue; }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") openBraces++;
        if (ch === "}") openBraces--;
        if (ch === "[") openBrackets++;
        if (ch === "]") openBrackets--;
      }
      // Add missing closers
      let repaired = text;
      for (let i = 0; i < openBrackets; i++) repaired += "]";
      for (let i = 0; i < openBraces; i++) repaired += "}";

      // Remove trailing comma before closer
      repaired = repaired.replace(/,\s*([\]}])/g, "$1");

      parsed = JSON.parse(repaired);
      console.log("[WebsiteAI] JSON repair succeeded");
    }
  } catch (err) {
    console.error("[WebsiteAI] Failed to parse AI response.");
    console.error("[WebsiteAI] First 500 chars:", response.substring(0, 500));
    console.error("[WebsiteAI] Last 200 chars:", response.substring(response.length - 200));
    console.error("[WebsiteAI] Response length:", response.length);
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
