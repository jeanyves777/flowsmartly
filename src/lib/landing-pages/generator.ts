import { ai } from "@/lib/ai/client";
import { PAGE_TYPE_TEMPLATES } from "./templates";

export interface LandingPageOptions {
  prompt: string;
  pageType: string;
  brandName?: string;
  colors?: { primary?: string; secondary?: string; accent?: string };
  tone?: string;
  audience?: string;
  ctaText?: string;
  keywords?: string;
  imageUrl?: string;
  videoUrl?: string;
  logoUrl?: string;
  ctaUrl?: string;
  formFields?: { name: string; label: string; type: string; required: boolean }[];
  brandDescription?: string;
  templatePrompt?: string;
}

export interface GeneratedPage {
  html: string;
  title: string;
  description: string;
}

export async function generateLandingPage(options: LandingPageOptions): Promise<GeneratedPage> {
  const template = PAGE_TYPE_TEMPLATES[options.pageType] || PAGE_TYPE_TEMPLATES["product"];

  // Build the user prompt
  const parts: string[] = [
    `Create a landing page for: ${options.prompt}`,
    `Page type: ${options.pageType}`,
    `Required sections: ${template.sections.join(", ")}`,
  ];

  if (options.brandName) parts.push(`Brand/Business name: ${options.brandName}`);
  if (options.colors?.primary) parts.push(`Primary color: ${options.colors.primary}`);
  if (options.colors?.secondary) parts.push(`Secondary color: ${options.colors.secondary}`);
  if (options.colors?.accent) parts.push(`Accent color: ${options.colors.accent}`);
  if (options.tone) parts.push(`Tone: ${options.tone}`);
  if (options.audience) parts.push(`Target audience: ${options.audience}`);
  if (options.ctaText) parts.push(`Main CTA text: ${options.ctaText}`);
  if (options.keywords) parts.push(`SEO keywords: ${options.keywords}`);
  if (options.imageUrl) parts.push(`Use this hero image URL: ${options.imageUrl}`);
  if (options.videoUrl) parts.push(`Embed this video URL: ${options.videoUrl}`);
  if (options.logoUrl) parts.push(`Use this logo image in the header/navbar: ${options.logoUrl}`);
  if (options.ctaUrl) parts.push(`All CTA buttons should link to: ${options.ctaUrl}`);
  if (options.brandDescription) parts.push(`Brand description: ${options.brandDescription}`);
  if (options.formFields && options.formFields.length > 0) {
    const fieldLines = options.formFields.map(
      (f) => `- ${f.label} (name="${f.name}", type="${f.type}"${f.required ? ", required" : ""})`
    );
    parts.push(
      `Generate a form with id="lead-form" containing these fields:\n${fieldLines.join("\n")}\nEach input must have a proper name attribute. The form must have id="lead-form" and a submit button.`
    );
  }

  const templatePrompt = options.templatePrompt || template.promptEnhancement;
  const isInteractive = templatePrompt.includes("canvas") || templatePrompt.includes("IntersectionObserver") || templatePrompt.includes("requestAnimationFrame") || templatePrompt.includes("mousemove");

  parts.push(templatePrompt);

  const interactiveJsRules = isInteractive
    ? `
3. Inline JavaScript is ENCOURAGED for this interactive template. Use a single <script> tag at the end of <body>. Implement:
   - Canvas animations (particle systems, constellation effects) using requestAnimationFrame
   - Mouse-tracking effects (3D tilt, parallax, spotlight follow) using mousemove event listeners
   - Scroll-triggered animations using IntersectionObserver (reveal on scroll, counter animations, progress bars)
   - SVG animations (morphing paths, stroke drawing effects, animated blobs)
   - CSS animations (floating elements, gradient shifts, typing effects, glow pulses)
   Write clean, performant JS. No external libraries — pure vanilla JavaScript only.
4. NO <script> tags with external src. No frameworks or libraries. All JS must be inline.`
    : `
3. NO external JavaScript files. Minimal inline JS only for interactions (mobile menu toggle, smooth scroll)
4. NO <script> tags with external src. No frameworks or libraries`;

  const systemPrompt = `You are an expert web designer and developer. Generate a complete, self-contained HTML landing page.

CRITICAL RULES:
1. Return ONLY the HTML code starting with <!DOCTYPE html> - no markdown, no explanation, no code fences
2. All CSS must be in a single <style> tag in the <head> - NO external stylesheets${interactiveJsRules}
5. Include <meta name="viewport" content="width=device-width, initial-scale=1.0"> in the <head>
6. Use modern CSS: flexbox, grid, gradients, transitions, box-shadows
7. Use professional typography with system fonts: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
8. Use https://placehold.co/ for any placeholder images (e.g., https://placehold.co/600x400/EEE/999?text=Product)
9. Include a <title> tag and <meta name="description"> in the head
10. Make ALL text elements have data-editable="true" attribute for inline editing
11. Make ALL sections have data-section="section-name" attribute
12. Use smooth transitions and subtle hover effects for a polished feel
13. Include a professional color scheme using the provided colors, or pick a great default
14. Add proper spacing, padding, and visual hierarchy
15. Include a "Built with FlowSmartly" small badge/link in the footer
16. The top navbar/header must ONLY contain the brand logo (if provided) on the left and a single CTA button on the right. Do NOT add navigation links like "Features", "Pricing", "About", "Contact", etc. — this is a single landing page, not a multi-page website. No hamburger menu either. Keep the header minimal: logo + CTA button only.
17. If a logo URL is provided, place it in the header as an <img> with max-height: 48px
18. If a CTA URL is provided, all call-to-action buttons and links must have href set to that URL with target="_blank"
19. If form fields are specified, generate a styled form with id="lead-form" containing exactly those fields with proper name attributes, labels, and a submit button styled to match the page design
20. Include comprehensive SEO: <meta name="robots" content="index, follow">, Open Graph tags (og:title, og:description, og:type, og:image), Twitter Card tags (twitter:card, twitter:title, twitter:description), and canonical URL placeholder

MOBILE-FIRST DESIGN (CRITICAL — most visitors are on phones):
Write all base CSS styles for mobile (320-480px width) FIRST, then use min-width media queries to enhance for larger screens.
Specific mobile requirements:
M1. All text must be readable without zooming. Body text: min 16px. Headlines: use clamp() (e.g., clamp(28px, 6vw, 56px)). Never use fixed large font sizes without clamp.
M2. All buttons and tappable elements must be at least 44px tall with adequate padding (min padding: 14px 24px). Buttons must be full-width (width: 100%) on mobile, side-by-side only on desktop.
M3. Multi-column grids MUST collapse to a single column on mobile. Use: grid-template-columns: 1fr for mobile base, then min-width media queries for multi-column. Never use fixed column counts without a responsive fallback.
M4. All images must use max-width: 100% and height: auto. Never set fixed pixel widths on images.
M5. Horizontal padding on sections: use padding: 24px 16px on mobile (not 5% — 5% of 360px is only 18px which is too tight). Increase to padding: 60px 5% on desktop via media query.
M6. Forms must be full-width on mobile. Inputs must be 100% width with min-height 48px and font-size 16px (prevents iOS zoom on focus).
M7. Hero sections: on mobile, stack elements vertically, reduce min-height to 80vh or auto, ensure text is centered and fits without horizontal scroll.
M8. Side-by-side / split layouts MUST stack vertically on mobile (flex-direction: column). Image goes above or below text, never beside it on small screens.
M9. Stats/metrics grids: use 2 columns on mobile (grid-template-columns: repeat(2, 1fr)), not 4. Switch to 4 columns at min-width: 768px.
M10. No horizontal overflow. Never use fixed widths wider than 100vw. Test: no element should cause horizontal scrolling. Use overflow-x: hidden on body as a safety net, but fix the root cause.
M11. Spacing between sections: use 48px on mobile, 80-100px on desktop.
M12. Card grids: single column on mobile, 2 columns on tablet (min-width: 640px), 3 on desktop (min-width: 1024px).
M13. Footer: stack all elements vertically on mobile with centered text.
M14. Videos/iframes: use aspect-ratio: 16/9 with width: 100% and height: auto.`;

  const response = await ai.generate(parts.join("\n"), {
    maxTokens: 16000,
    temperature: 0.7,
    systemPrompt,
  });

  // Extract HTML - Claude might wrap it in code fences
  let html = response.trim();
  const htmlMatch = html.match(/```html?\s*\n?([\s\S]*?)```/);
  if (htmlMatch) {
    html = htmlMatch[1].trim();
  }

  // If it doesn't start with <!DOCTYPE, try to find it
  if (!html.startsWith("<!DOCTYPE") && !html.startsWith("<html")) {
    const docStart = html.indexOf("<!DOCTYPE");
    if (docStart !== -1) {
      html = html.substring(docStart);
    }
  }

  // Extract title and description from the generated HTML
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const descMatch = html.match(/<meta\s+name="description"\s+content="(.*?)"/i);

  const title = titleMatch?.[1] || options.brandName || "Landing Page";
  const description = descMatch?.[1] || options.prompt.substring(0, 160);

  return { html, title, description };
}
