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
  return `You are an expert graphic designer who creates structured design layouts as JSON.

OUTPUT FORMAT:
Return a single JSON object matching this TypeScript schema:

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
  elements: AILayoutElement[];        // bottom-to-top z-order
}

type AILayoutElement = AITextElement | AIShapeElement | AIDividerElement | AIImagePlaceholder;

// --- Position & size are PERCENTAGES of canvas (0-100) ---
// x, y = top-left corner as % of canvas width/height
// width = % of canvas width
// height = % of canvas height (optional for text, required for shapes/images)

AITextElement: {
  type: "text"; id: string;
  x: number; y: number; width: number; height?: number;
  text: string;
  role: "headline" | "subheadline" | "body" | "cta" | "caption" | "label" | "contact";
  fontSize: number;          // absolute pixels for a 1080px-wide canvas
  fontWeight?: string;       // "bold", "800", "normal"
  fontFamily?: string;       // must be from the ALLOWED FONTS list
  fontStyle?: string;        // "italic" or "normal"
  fill: string;              // text color hex
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;       // e.g. 1.2
  charSpacing?: number;      // Fabric.js charSpacing (0-500)
  shadow?: string;           // CSS-style, e.g. "2px 2px 4px rgba(0,0,0,0.3)"
  backgroundColor?: string;  // for CTA buttons
  opacity?: number;
  angle?: number;
}

AIShapeElement: {
  type: "shape"; id: string;
  x: number; y: number; width: number; height: number;
  shape: "rect" | "circle" | "line";
  fill?: string; stroke?: string; strokeWidth?: number;
  rx?: number; ry?: number;     // border radius for rects
  radius?: number;              // for circles (% of canvas width)
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
  imagePrompt?: string;          // detailed prompt for AI image generation
  transparent?: boolean;
  opacity?: number;
}

IMAGE PROMPT GUIDELINES (for imagePrompt field):
- Write detailed, descriptive prompts suitable for AI image generation (Midjourney-style).
- For hero images: describe the subject, pose, lighting, setting, camera angle, and style.
- For backgrounds: describe the scene, atmosphere, colors, and mood. Always add "No text or words in the image."
- Example hero: "Professional young woman in navy blazer, confident smile, arms crossed, studio lighting, white background, waist-up portrait"
- Example background: "Modern city skyline at sunset, warm golden tones, bokeh lights, cinematic atmosphere. No text or words in the image."

ALLOWED FONTS (use ONLY these): ${FONT_LIST}

DESIGN RULES:
1. Create visually stunning, professional layouts that look like they were made by a senior designer.
2. Use strong typographic hierarchy: headlines large and bold, subtitles smaller and lighter, body smaller still.
3. Text elements should have generous spacing between them — never stack tightly.
4. CTA buttons: use a shape (rect with rx/ry) BEHIND a text element. The rect is the button bg, the text sits on top.
5. For logo placement: include ONE element with type "image" and imageRole "logo-placeholder" (top-left or top-center).
6. Use decorative shapes sparingly — accent lines, background rects for contrast, subtle dividers.
7. All text must be fully visible within the canvas (x + width <= 100, y within bounds).
8. Backgrounds: use gradients for visual interest. Match the style requested.
9. Keep elements count reasonable (6-15 elements). Quality over quantity.
10. Ensure high contrast between text and background for readability.
11. fontSize is in absolute pixels for a 1080px-wide canvas. Headlines: 48-96px, Subheadlines: 24-40px, Body: 16-22px, CTA: 18-28px, Contact: 14-18px.
12. Generate unique element IDs like "el-1", "el-2", etc.`;
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

  let userPrompt = `Create a ${category.replace(/_/g, " ")} design layout for a ${formatDesc} canvas.

STYLE: ${style || "modern"} — ${styleHint}

DESIGN REQUEST: ${prompt}`;

  // Text mode
  if (textMode === "exact") {
    userPrompt += `\n\nTEXT MODE: Use the user's exact text as-is for the headline. Do not rephrase or rewrite it.`;
  } else {
    userPrompt += `\n\nTEXT MODE: Generate compelling ad copy based on the description. Create a punchy headline (2-6 words), a supporting subtitle, and appropriate body text.`;
  }

  // Hero type
  if (heroType === "people") {
    if (params.generateHeroImage) {
      userPrompt += `\n\nHERO IMAGE: Include an image placeholder (imageRole: "hero") on the right side (~50-60% width, ~70-90% height) for a person photo. Write a detailed imagePrompt describing the person (pose, clothing, expression, lighting). Set transparent: true. Leave text on the left side. The image WILL be AI-generated, so make the prompt detailed and specific.`;
    } else {
      userPrompt += `\n\nHERO: Include an image placeholder (imageRole: "hero") on the right side (~50-60% width) for a person photo. Leave text on the left.`;
    }
  } else if (heroType === "product") {
    if (params.generateHeroImage) {
      userPrompt += `\n\nHERO IMAGE: Include an image placeholder (imageRole: "hero") for a product shot (~40-50% width, ~50-70% height). Write a detailed imagePrompt describing the product (appearance, angle, lighting, setting). Set transparent: true. Position text around it. The image WILL be AI-generated.`;
    } else {
      userPrompt += `\n\nHERO: Include an image placeholder (imageRole: "hero") for a product shot. Position text around it.`;
    }
  } else {
    userPrompt += `\n\nHERO: Typography-focused — no hero image placeholder. Use bold text, shapes, and decorative elements as the visual focus.`;
  }

  // CTA
  if (ctaText) {
    userPrompt += `\n\nCTA BUTTON: Use this exact text: "${ctaText}"`;
  } else {
    userPrompt += `\n\nCTA BUTTON: The user did NOT provide a call-to-action. Do NOT add any CTA button element to the layout.`;
  }

  // Brand
  if (brandName && showBrandName) {
    userPrompt += `\n\nBRAND NAME: Display "${brandName}" in a tasteful position (top area or near the logo placeholder).`;
  }

  if (brandColors) {
    const parts: string[] = [];
    if (brandColors.primary) parts.push(`primary: ${brandColors.primary}`);
    if (brandColors.secondary) parts.push(`secondary: ${brandColors.secondary}`);
    if (brandColors.accent) parts.push(`accent: ${brandColors.accent}`);
    if (parts.length > 0) {
      userPrompt += `\n\nBRAND COLORS: ${parts.join(", ")}. Use these as the primary palette for backgrounds, text, CTA buttons, and accents.`;
    }
  }

  if (brandFonts) {
    if (brandFonts.heading) userPrompt += `\nPREFERRED HEADING FONT: ${brandFonts.heading} (use if it's in the allowed list, otherwise pick a similar one)`;
    if (brandFonts.body) userPrompt += `\nPREFERRED BODY FONT: ${brandFonts.body}`;
  }

  // Contact info
  const contactParts: string[] = [];
  if (contactInfo?.email) contactParts.push(`Email: ${contactInfo.email}`);
  if (contactInfo?.phone) contactParts.push(`Phone: ${contactInfo.phone}`);
  if (contactInfo?.website) contactParts.push(`Website: ${contactInfo.website}`);
  if (contactInfo?.address) contactParts.push(`Address: ${contactInfo.address}`);
  if (contactParts.length > 0) {
    userPrompt += `\n\nCONTACT INFO (include as small text near bottom):\n${contactParts.join("\n")}`;
  }

  // Social handles
  if (showSocialIcons && socialHandles && Object.keys(socialHandles).length > 0) {
    const handlesList = Object.entries(socialHandles)
      .map(([platform, handle]) => `${platform}: @${handle}`)
      .join(", ");
    userPrompt += `\n\nSOCIAL HANDLES (include as small text near bottom): ${handlesList}`;
  }

  // AI Background
  if (params.generateBackground) {
    userPrompt += `\n\nAI BACKGROUND: An AI-generated background image will be used. Use a simple solid background in the layout JSON (type: "solid", dark or neutral color that provides good contrast). Also include an image element with imageRole: "background" at position (0, 0, 100, 100) with a detailed imagePrompt describing the ideal background scene for this design. The background image will be placed behind all other elements. Add "No text or words in the image." at the end of the imagePrompt.`;
  }

  // Logo placeholder
  userPrompt += `\n\nLOGO: Include a logo-placeholder image element in the top-left area (~5% x, ~3% y, ~12% width, ~8% height).`;

  return userPrompt;
}

/**
 * Post-process and sanitize the AI-generated layout.
 * Clamps values, validates fonts, fills missing defaults.
 */
function sanitizeLayout(layout: AIDesignLayout): AIDesignLayout {
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
    maxTokens: 4096,
    temperature: 0.5,
  });

  if (!layout) {
    throw new Error("AI failed to generate a valid design layout. Please try again.");
  }

  const sanitized = sanitizeLayout(layout);
  console.log("[DesignLayout] Generated layout with", sanitized.elements.length, "elements");

  return sanitized;
}
