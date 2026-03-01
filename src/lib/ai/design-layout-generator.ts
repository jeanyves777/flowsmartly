/**
 * AI Design Layout Generator
 *
 * Uses Claude text AI to generate structured canvas layouts as JSON.
 * The output is a set of individual elements (text, shapes, dividers,
 * image placeholders) positioned with percentage-based coordinates,
 * which the client converts to Fabric.js objects.
 */

import { ai } from "@/lib/ai/client";
import { POPULAR_FONTS } from "@/components/studio/utils/font-loader";
import type { AIDesignLayout, AITextElement, AIShapeElement, AIDividerElement, AIImagePlaceholder } from "./design-layout-types";

export interface LayoutGeneratorParams {
  prompt: string;
  category: string;
  width: number;
  height: number;
  style?: string;
  textMode?: "exact" | "creative";
  heroType?: "people" | "product" | "text-only";
  ctaText?: string | null;
  brandName?: string | null;
  brandColors?: Record<string, string> | null;
  brandFonts?: { heading?: string; body?: string } | null;
  contactInfo?: {
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
  } | null;
  socialHandles?: Record<string, string> | null;
  showBrandName?: boolean;
  showSocialIcons?: boolean;
  /** Whether an image AI will generate the hero image */
  generateHeroImage?: boolean;
  /** Whether an image AI will generate the background */
  generateBackground?: boolean;
}

const FONT_LIST = POPULAR_FONTS.join(", ");

const STYLE_HINTS: Record<string, string> = {
  modern: "Clean lines, bold sans-serif typography, vibrant accent colors, generous whitespace. Think Stripe or Apple marketing.",
  minimalist: "Maximum whitespace, subtle palette, thin weights, understated elegance. Let content breathe.",
  photorealistic: "Dark or muted backgrounds, high-contrast text, dramatic color pops. Suitable for overlaying on photos.",
  vintage: "Warm tones (cream, brown, rust), serif typefaces, decorative borders or ornaments. Classic feel.",
  illustration: "Bright, saturated palette, playful fonts, rounded shapes. Fun and energetic.",
  abstract: "Bold geometric shapes, unexpected color combos, overlapping forms. Artistic and eye-catching.",
  flat: "Solid fills, no gradients or shadows, bright primary colors, geometric icons. Clean flat design.",
  "3d": "Rich gradients, subtle shadows, depth layers. Elements feel lifted off the page.",
  watercolor: "Soft pastel palette, organic shapes, gentle gradients. Dreamy and artistic.",
  neon: "Dark background (#0a0a0a), electric neon accents (cyan, magenta, green), glow effects via shadows.",
};

function buildSystemPrompt(): string {
  return `You are an award-winning graphic designer creating COMPLETE, publication-ready marketing designs as JSON. Your output must be a FINISHED design — not a wireframe or placeholder. Every text element must contain real, compelling copy. The result should look as polished as a Canva Pro template or a professionally designed social media ad.

OUTPUT FORMAT — return a single JSON object:

interface AIDesignLayout {
  background: {
    type: "solid" | "gradient";
    color?: string;                   // hex, e.g. "#1e293b"
    gradient?: {
      type: "linear" | "radial";
      colorStops: Array<{ offset: number; color: string }>;  // offset 0-1
      angle?: number;                // degrees, 0=top-to-bottom, 90=left-to-right
    };
  };
  elements: AILayoutElement[];        // bottom-to-top z-order (shapes first, then text on top)
}

type AILayoutElement = AITextElement | AIShapeElement | AIDividerElement | AIImagePlaceholder;

// x, y = top-left corner as PERCENTAGE of canvas (0-100)
// width, height = PERCENTAGE of canvas width/height

AITextElement: {
  type: "text"; id: string;
  x: number; y: number; width: number; height?: number;
  text: string;                // REAL text content, never "Headline" or "Your text here"
  role: "headline" | "subheadline" | "body" | "cta" | "caption" | "label" | "contact";
  fontSize: number;            // absolute pixels for 1080px-wide canvas
  fontWeight?: string;         // "bold", "800", "900", "normal", "300"
  fontFamily?: string;         // MUST be from ALLOWED FONTS list
  fontStyle?: string;          // "italic" or "normal"
  fill: string;                // text color hex
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;         // e.g. 1.2
  charSpacing?: number;        // Fabric.js charSpacing (0-500), use 50-200 for headings
  shadow?: string;             // CSS-style, e.g. "2px 2px 4px rgba(0,0,0,0.3)"
  backgroundColor?: string;    // for inline CTA button background
  opacity?: number;
  angle?: number;
}

AIShapeElement: {
  type: "shape"; id: string;
  x: number; y: number; width: number; height: number;
  shape: "rect" | "circle" | "line";
  fill?: string; stroke?: string; strokeWidth?: number;
  rx?: number; ry?: number;
  radius?: number;             // for circles (% of canvas width)
  opacity?: number;
}

AIDividerElement: {
  type: "divider"; id: string;
  x: number; y: number; width: number;
  stroke?: string; strokeWidth?: number;
  dashArray?: number[];
  opacity?: number;
}

AIImagePlaceholder: {
  type: "image"; id: string;
  x: number; y: number; width: number; height: number;
  imageRole: "hero" | "decoration" | "icon" | "logo-placeholder" | "background";
  imagePrompt?: string;
  transparent?: boolean;
  opacity?: number;
}

ALLOWED FONTS: ${FONT_LIST}

═══════════════════════════════════════════
CRITICAL RULES — YOU MUST FOLLOW ALL OF THESE
═══════════════════════════════════════════

TEXT CONTENT (MOST IMPORTANT):
• NEVER use placeholder text like "Headline", "Your Text", "Body Text", "Subtitle", "Company Name".
• ALWAYS write real, compelling marketing copy based on the design request.
• Headlines: Bold, punchy, 2-6 words that grab attention. Use power words.
• Subheadlines: Supporting sentence that expands on the headline. 5-15 words.
• Body text: 1-2 short sentences with a benefit or key detail. Keep concise.
• ALL text you generate must be specific to the topic/product/service described.

TYPOGRAPHY & FONT PAIRING:
• Use at LEAST 2 different fonts — one for headings, one for body/subheadlines.
• Great pairings: Playfair Display + Inter, Bebas Neue + DM Sans, Montserrat + Lora, Anton + Poppins, Oswald + Quicksand.
• Headlines: 56-96px, fontWeight "bold" or "800" or "900", add charSpacing 50-200 for uppercase text.
• Subheadlines: 24-36px, fontWeight "normal" or "300", can use italic for elegance.
• Body: 16-22px, readable font like Inter, DM Sans, or Poppins.
• Contact/social: 13-16px, subtle but readable.
• Use text shadows on light text over dark/busy backgrounds for readability.

LAYOUT & POSITIONING:
• Leave generous margins: text should start at x >= 5% and not exceed x + width <= 95%.
• Vertical spacing between text blocks: at least 3-5% gap.
• Place elements in a clear visual flow: top → brand/logo, middle → headline + subtitle + body, bottom → contact/social.
• Center-align headings for impact; left-align body text for readability.
• Elements array must be in bottom-to-top z-order: background shapes FIRST, then text ON TOP.

CTA BUTTONS (ONLY when explicitly requested in the user prompt):
• Do NOT add any CTA button unless the user prompt explicitly says "CTA BUTTON: Build a complete button".
• If NO CTA is requested, do NOT create any element with role "cta" and do NOT create any button shapes.
• When CTA IS requested: build as TWO elements — a shape (rect with rx: 25, ry: 25) as button background, then a text element ON TOP with matching position and centered alignment.
• The shape should be ~3% wider and ~2% taller than the text for padding.
• CTA text: fontWeight "bold", fontSize 20-28px, white or contrasting fill.

CONTACT INFO (ONLY when provided in user prompt):
• Only add contact info elements if the user prompt explicitly lists contact details.
• Each piece (email, phone, website, address) = SEPARATE text element with role "contact".
• Position: y between 88-94%, spaced horizontally across the bottom.
• For multiple items in a row: first item x: 5%, second x: 30%, third x: 55%, fourth x: 75% (adjust based on count).
• fontSize: 13-15px, muted color (e.g. rgba of main text at 60-70% opacity).

SOCIAL HANDLES (ONLY when provided in user prompt):
• Only add social handle elements if the user prompt explicitly lists handles.
• Each handle = SEPARATE text element with role "contact".
• Format: "IG: @handle", "FB: @handle", "X: @handle", "TT: @handle" etc.
• Position: y between 92-96%, spaced horizontally. Same x-spacing logic as contact info.
• fontSize: 13-14px, same muted color as contact info.

DECORATIVE ELEMENTS:
• Add 1-3 accent shapes for visual interest: thin accent lines, background contrast panels, decorative circles.
• Use semi-transparent overlays (opacity 0.1-0.3) to create depth.
• For dark backgrounds: add a subtle gradient overlay shape behind text for readability.

BACKGROUNDS:
• Use beautiful gradients — 2-3 color stops for depth.
• Dark gradients for professional/modern: #0f172a → #1e3a5f, #1a1a2e → #16213e → #0f3460.
• Warm gradients for lifestyle: #ff6b6b → #ffa07a, #f093fb → #f5576c.
• Light gradients for clean/minimal: #f8fafc → #e2e8f0, #fdfbfb → #ebedee.

FONT SIZE REFERENCE (for 1080px canvas width):
• Main headline: 60-96px
• Subheadline: 26-38px
• Body: 17-22px
• CTA button: 20-28px
• Contact/social: 13-16px
• Brand name: 18-28px
• Labels/captions: 12-16px

IMAGE PROMPT GUIDELINES:
• For hero images (people/products): describe ONLY the subject — pose, clothing, expression, lighting, camera angle. ALWAYS end with: "Isolated subject on a plain white background. No background scene, no text, no decorations."
• For backgrounds: describe scene, atmosphere, colors, mood. ALWAYS end with: "No text or words in the image."
• Hero example: "Professional young woman in navy blazer, confident smile, arms crossed, soft studio lighting, waist-up portrait. Isolated subject on a plain white background. No background scene, no text, no decorations."
• Background example: "Modern city skyline at sunset, warm golden tones, bokeh lights, cinematic atmosphere. No text or words in the image."

ELEMENT IDs: Use "el-1", "el-2", etc. sequentially.`;
}

function buildUserPrompt(params: LayoutGeneratorParams): string {
  const {
    prompt, category, width, height, style,
    textMode, heroType, ctaText,
    brandName, brandColors, brandFonts,
    contactInfo, socialHandles,
    showBrandName, showSocialIcons,
  } = params;

  const ratio = width / height;
  let formatDesc: string;
  if (ratio > 1.7) formatDesc = `wide horizontal banner (${width}x${height}, ~${ratio.toFixed(1)}:1)`;
  else if (ratio > 1.2) formatDesc = `landscape rectangle (${width}x${height})`;
  else if (ratio > 0.85) formatDesc = `square (${width}x${height})`;
  else if (ratio > 0.6) formatDesc = `portrait rectangle (${width}x${height})`;
  else formatDesc = `tall vertical format (${width}x${height})`;

  const styleHint = STYLE_HINTS[style || "modern"] || STYLE_HINTS.modern;

  let userPrompt = `Design a COMPLETE, publication-ready ${category.replace(/_/g, " ")} for a ${formatDesc} canvas.

STYLE: ${style || "modern"} — ${styleHint}

TOPIC/BRIEF: ${prompt}

IMPORTANT: Generate ALL text content yourself based on the topic above. Write real, specific marketing copy — a powerful headline, a supporting subtitle, and body text. Do NOT leave any text as placeholder or generic.`;

  // Text mode
  if (textMode === "exact") {
    userPrompt += `\n\nTEXT MODE: Use the user's exact text as-is for the headline. Do not rephrase it. But still generate a supporting subtitle and body text that complement it.`;
  } else {
    userPrompt += `\n\nTEXT MODE: Write creative, compelling copy:
- HEADLINE: Punchy, attention-grabbing (2-6 words). Use power words that create urgency or excitement.
- SUBTITLE: Supporting message that adds context (5-15 words). Different font weight/style than headline.
- BODY: 1-2 short benefit-driven sentences (optional but recommended for designs with enough space).
All text must be specific to the topic "${prompt}" — never generic.`;
  }

  // Hero type
  if (heroType === "people") {
    if (params.generateHeroImage) {
      userPrompt += `\n\nHERO IMAGE (PERSON): You MUST include an image placeholder element with imageRole: "hero" on the right side (x: 45-55%, y: 5-15%, width: 45-55%, height: 65-85%).
Write a DETAILED imagePrompt describing ONLY the person: their pose, clothing, expression, lighting, camera angle. Do NOT describe any background in the imagePrompt — the person will be isolated. Example: "Professional young woman in navy blazer, warm smile, arms crossed, soft studio lighting, waist-up portrait."
Set transparent: true. Position ALL text elements on the LEFT side (x: 5-42%).`;
    } else {
      userPrompt += `\n\nHERO (PERSON): Include an image placeholder (imageRole: "hero") on the right side (x: 50%, y: 10%, width: 45%, height: 70%) for a person photo. Position text on the left side (x: 5-45%).`;
    }
  } else if (heroType === "product") {
    if (params.generateHeroImage) {
      userPrompt += `\n\nHERO IMAGE (PRODUCT): You MUST include an image placeholder element with imageRole: "hero" (x: 25-35%, y: 10-20%, width: 40-50%, height: 50-70%).
Write a DETAILED imagePrompt describing ONLY the product: its appearance, angle, lighting, materials. Do NOT describe any background — the product will be isolated. Example: "Sleek wireless headphones, matte black, floating at 3/4 angle, studio lighting, product photography."
Set transparent: true. Position text around it.`;
    } else {
      userPrompt += `\n\nHERO (PRODUCT): Include an image placeholder (imageRole: "hero") for a product shot (~40% width). Position text around it.`;
    }
  } else {
    userPrompt += `\n\nLAYOUT: Typography-focused design — no hero image. Make the headline the visual centerpiece. Use large, bold typography, decorative shapes, and accent elements to create visual impact. Use at least 2 different font families for contrast.`;
  }

  // CTA
  if (ctaText) {
    userPrompt += `\n\nCTA BUTTON: Build a complete button using this exact text: "${ctaText}"
- Create a shape element (rect, rx: 25, ry: 25) as the button background with a bold accent color.
- Create a text element ON TOP with the CTA text, centered, white or contrasting color.
- Position both at the same x/y. Make the shape ~3% wider and ~2% taller than the text for padding.
- Place the button in a prominent position (center-bottom area, y: 70-85%).`;
  } else {
    userPrompt += `\n\n⚠️ NO CTA: The user did NOT provide any call-to-action text. You MUST NOT add any CTA button, CTA shape, or any element with role "cta". Do not invent a CTA. Simply skip the CTA entirely.`;
  }

  // Brand
  if (brandName && showBrandName) {
    userPrompt += `\n\nBRAND NAME: Display "${brandName}" as a text element (role: "label"). Position it near the top of the design, close to the logo placeholder. Use a clean font (18-24px), subtle but visible.`;
  }

  if (brandColors) {
    const parts: string[] = [];
    if (brandColors.primary) parts.push(`primary: ${brandColors.primary}`);
    if (brandColors.secondary) parts.push(`secondary: ${brandColors.secondary}`);
    if (brandColors.accent) parts.push(`accent: ${brandColors.accent}`);
    if (parts.length > 0) {
      userPrompt += `\n\nBRAND COLORS: ${parts.join(", ")}. Use these throughout: background gradient, headline color, CTA button, accent shapes. Build a cohesive color scheme around these.`;
    }
  }

  if (brandFonts) {
    if (brandFonts.heading) userPrompt += `\nPREFERRED HEADING FONT: ${brandFonts.heading} (use if it's in the allowed list, otherwise pick the closest match)`;
    if (brandFonts.body) userPrompt += `\nPREFERRED BODY FONT: ${brandFonts.body}`;
  }

  // Contact info
  const contactParts: string[] = [];
  if (contactInfo?.email) contactParts.push(`email: ${contactInfo.email}`);
  if (contactInfo?.phone) contactParts.push(`phone: ${contactInfo.phone}`);
  if (contactInfo?.website) contactParts.push(`website: ${contactInfo.website}`);
  if (contactInfo?.address) contactParts.push(`address: ${contactInfo.address}`);
  if (contactParts.length > 0) {
    userPrompt += `\n\nCONTACT INFO — create SEPARATE text elements for each (role: "contact", fontSize: 13-15px, near bottom y > 87%):
${contactParts.map(c => `• ${c}`).join("\n")}
Use the EXACT values above. Position them in a clean row or column at the bottom. Use a subtle color that doesn't compete with the headline.`;
  }

  // Social handles
  if (showSocialIcons && socialHandles && Object.keys(socialHandles).length > 0) {
    const handles = Object.entries(socialHandles)
      .map(([platform, handle]) => `${platform}: @${handle}`);
    userPrompt += `\n\nSOCIAL HANDLES — create SEPARATE text elements for each (role: "contact", fontSize: 13-15px):
${handles.map(h => `• ${h}`).join("\n")}
Position them in a row near the bottom alongside contact info. Use the EXACT handles above.`;
  }

  // AI Background
  if (params.generateBackground) {
    userPrompt += `\n\nAI BACKGROUND: An AI image will be generated for the background. In the layout JSON:
1. Set background to { type: "solid", color: "<dark fallback color>" } (e.g. "#1a1a2e").
2. Include an image element with imageRole: "background" at (x: 0, y: 0, width: 100, height: 100) with a detailed imagePrompt describing the ideal background scene. End the prompt with "No text or words in the image."
3. Add a semi-transparent dark overlay shape (rect, opacity: 0.4-0.6) over the background to ensure text readability.
4. Use white or light-colored text over the dark overlay.`;
  }

  // Logo placeholder
  userPrompt += `\n\nLOGO: Include a logo-placeholder image element (imageRole: "logo-placeholder") in the top-left area (~5% x, ~3% y, ~12% width, ~8% height).`;

  // Final reminder
  userPrompt += `\n\nREMINDER: Every text element must contain REAL copy specific to "${prompt}". Use beautiful, varied fonts. Make this look like a professionally designed ${category.replace(/_/g, " ")} ready for publication.`;

  return userPrompt;
}

/**
 * Post-process and sanitize the AI-generated layout.
 * Clamps values, validates fonts, fills missing defaults.
 */
function sanitizeLayout(layout: AIDesignLayout, options?: { stripCTA?: boolean }): AIDesignLayout {
  // Validate background
  if (!layout.background) {
    layout.background = { type: "solid", color: "#ffffff" };
  }
  if (layout.background.type === "solid" && !layout.background.color) {
    layout.background.color = "#ffffff";
  }
  if (layout.background.type === "gradient" && !layout.background.gradient) {
    layout.background = { type: "solid", color: "#ffffff" };
  }

  // Validate elements
  if (!Array.isArray(layout.elements)) {
    layout.elements = [];
  }

  // Strip CTA elements if no CTA was requested (safety net — Claude sometimes adds them anyway)
  if (options?.stripCTA) {
    const beforeCount = layout.elements.length;
    layout.elements = layout.elements.filter((el) => {
      if (el.type === "text" && (el as AITextElement).role === "cta") return false;
      return true;
    });
    // Also remove CTA button background shapes (rects that appear right before where CTAs were)
    // Heuristic: rounded rects that were paired with CTA text
    if (layout.elements.length < beforeCount) {
      console.log(`[DesignLayout] Stripped ${beforeCount - layout.elements.length} CTA element(s) (no CTA was requested)`);
    }
  }

  const fontSet = new Set(POPULAR_FONTS.map((f) => f.toLowerCase()));
  let idCounter = 1;

  layout.elements = layout.elements
    .filter((el) => el && typeof el === "object" && el.type)
    .map((el) => {
      // Ensure ID
      if (!el.id) el.id = `el-${idCounter++}`;
      else idCounter++;

      // Clamp position (0-100)
      el.x = clamp(el.x ?? 0, 0, 100);
      el.y = clamp(el.y ?? 0, 0, 100);
      el.width = clamp(el.width ?? 20, 1, 100);
      if (el.height !== undefined) el.height = clamp(el.height, 1, 100);

      // Clamp opacity
      if (el.opacity !== undefined) el.opacity = clamp(el.opacity, 0, 1);

      // Type-specific validation
      switch (el.type) {
        case "text": {
          const t = el as AITextElement;
          t.fontSize = clamp(t.fontSize ?? 24, 8, 200);
          t.fill = t.fill || "#000000";
          t.text = t.text || "Text";
          if (!t.role) t.role = "body";
          // Validate font
          if (t.fontFamily && !fontSet.has(t.fontFamily.toLowerCase())) {
            t.fontFamily = "Inter";
          }
          if (!t.fontFamily) t.fontFamily = "Inter";
          if (t.charSpacing !== undefined) t.charSpacing = clamp(t.charSpacing, 0, 1000);
          if (t.lineHeight !== undefined) t.lineHeight = clamp(t.lineHeight, 0.5, 3);
          break;
        }
        case "shape": {
          const s = el as AIShapeElement;
          if (!["rect", "circle", "line"].includes(s.shape)) s.shape = "rect";
          if (s.rx !== undefined) s.rx = clamp(s.rx, 0, 100);
          if (s.ry !== undefined) s.ry = clamp(s.ry, 0, 100);
          if (s.strokeWidth !== undefined) s.strokeWidth = clamp(s.strokeWidth, 0, 20);
          break;
        }
        case "divider": {
          const d = el as AIDividerElement;
          if (d.strokeWidth !== undefined) d.strokeWidth = clamp(d.strokeWidth, 0.5, 10);
          if (!d.stroke) d.stroke = "#cccccc";
          break;
        }
        case "image": {
          const img = el as AIImagePlaceholder;
          if (!["hero", "decoration", "icon", "logo-placeholder", "background"].includes(img.imageRole)) {
            img.imageRole = "decoration";
          }
          break;
        }
      }

      return el;
    });

  return layout;
}

function clamp(val: number, min: number, max: number): number {
  if (typeof val !== "number" || isNaN(val)) return min;
  return Math.min(Math.max(val, min), max);
}

/**
 * Generate a structured design layout using Claude.
 */
export async function generateDesignLayout(
  params: LayoutGeneratorParams
): Promise<AIDesignLayout> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(params);

  console.log("[DesignLayout] Generating layout via Claude...");
  console.log("[DesignLayout] Prompt length:", userPrompt.length, "chars");

  const layout = await ai.generateJSON<AIDesignLayout>(userPrompt, {
    systemPrompt,
    maxTokens: 6000,
    temperature: 0.7,
  });

  if (!layout) {
    throw new Error("AI failed to generate a valid design layout. Please try again.");
  }

  const sanitized = sanitizeLayout(layout, { stripCTA: !params.ctaText });
  console.log("[DesignLayout] Generated layout with", sanitized.elements.length, "elements");

  return sanitized;
}
