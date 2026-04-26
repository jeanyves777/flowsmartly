import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Premium template designer — Claude generates a complete HTML+CSS
 * document for one design, which the caller renders via headless
 * Chromium (`src/lib/utils/html-renderer.ts`) into a PNG.
 *
 * Why this exists: gpt-image-1 produces blurry text and approximates
 * fonts. Real HTML+CSS + Google Fonts gives pixel-perfect typography,
 * authored CSS gradients with real easing, real shadows, gradient text
 * via background-clip, and ornamental flourishes built from divs/lines
 * instead of being "drawn" by a diffusion model.
 *
 * The pattern is inspired by the user's working Python+Playwright
 * reference (Bro George "Happy Birthday" Laikos flyer). That exemplar
 * is embedded verbatim in the system prompt as a few-shot so Claude
 * has a concrete target for production-grade polish.
 */

export interface HtmlDesignVariant {
  label: string;
  modifier: string;
}

/** Same 8-style spread as the gpt-image-1 discovery flow, rewritten for
 *  HTML+CSS so Claude knows what concrete CSS/typography choices to make
 *  for each aesthetic. Each modifier names the CSS techniques + the
 *  font pairings we expect for that look. */
export const HTML_STYLE_VARIANTS: HtmlDesignVariant[] = [
  {
    label: "Photo collage",
    modifier:
      "Polaroid-style composition. Two or three CSS-tilted photo PLACEHOLDER divs (transform: rotate, white border, drop-shadow), overlapping a soft pastel gradient background. Decorative ribbons drawn as SVG inline or rotated divs. Hand-lettered script headline (Caveat or Dancing Script) + bold sans-serif name (Poppins 800).",
  },
  {
    label: "Elegant gold-foil",
    modifier:
      "Premium luxury aesthetic. Deep emerald or navy radial gradient background (use the multi-stop radial pattern from the reference). Gold gradient typography via background-clip: text + linear-gradient(180deg, #fef0bb, #f5dca0, #dcb25c, #b08a3a, #8a6a28). Ornate decorative flourishes (gold lines + diamonds + scrollwork from CSS borders). Playfair Display + Great Vibes pairing.",
  },
  {
    label: "Bold display typography",
    modifier:
      "Massive editorial display. Headline takes 60-70% of the canvas in oversized sans-serif (Anton, Bebas Neue, or Archivo Black). Strong solid color blocks (use full bleed sections). Minimal decorative elements — typography IS the design. Clear three-tier hierarchy: huge headline, medium subhead, small detail line.",
  },
  {
    label: "Vibrant party",
    modifier:
      "Vibrant celebratory party flyer. Bright candy-colored gradient background (pink-to-orange or yellow-to-pink). 3D balloon shapes drawn as inline SVG or radial-gradient divs. Confetti scatter via repeating CSS radial gradients (like the bokeh sparkles in the reference). Curved bold script headline (Pacifico or Lobster) + uppercase bold name. Joyful, energetic.",
  },
  {
    label: "Modern minimalist",
    modifier:
      "Generous white/cream space (background: #faf7f2 or #fafafa). Single thin accent color (one gold rule, one thin border). Refined typography hierarchy with serif display (Cormorant or Playfair) + clean sans body (Inter). One small geometric accent or a single thin rule. Calm, sophisticated, gallery-like.",
  },
  {
    label: "Photographic full-bleed",
    modifier:
      "Cinematic full-bleed photographic background covering the entire canvas. Use a CSS radial-gradient mood scene (deep blue-to-black night sky, sunset orange-to-purple, etc.) with a dark gradient overlay across the lower third (linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.85) 100%)). Bright headline reversed-out white over the dark gradient. Movie-poster feel.",
  },
  {
    label: "Vintage retro",
    modifier:
      "Warm cream / kraft paper background (#f4ead4) with subtle texture via inset box-shadow or repeating-radial-gradient noise. Distressed serif and slab-serif typography (Playfair Display 900 + DM Serif Display). Decorative vintage ornaments (laurels via SVG inline, ribbons drawn with CSS borders + clip-path, deep red/burgundy fills). Editorial almanac vibe.",
  },
  {
    label: "Corporate clean",
    modifier:
      "Geometric grid layout. Two-tone palette anchored on a strong brand primary color (deep navy + accent yellow, or charcoal + electric blue). Sans-serif typography (Inter or Montserrat). Left-aligned column of stacked text levels (eyebrow / headline / subhead / CTA pill / small footer). Right half holds a rectangular photo PLACEHOLDER. Used for business / event / launch announcements.",
  },
];

/** Reference exemplar — the user's working Bro George flyer, redacted
 *  of Laikos-specific text and stripped of base64 image data. Embedded
 *  in the system prompt as a few-shot so Claude has a concrete target
 *  for the level of polish we expect. ~3KB of CSS. */
const REFERENCE_EXEMPLAR_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Great+Vibes&family=Poppins:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width: 1080px; height: 1350px; overflow: hidden; font-family: 'Playfair Display', serif; color: #fff; }
.stage {
  position: relative; width: 1080px; height: 1350px;
  background:
    radial-gradient(ellipse 70% 55% at 50% 38%,
      rgba(20, 220, 130, 0.45) 0%,
      rgba(8, 150, 80, 0.35) 25%,
      rgba(3, 70, 38, 0.85) 60%,
      rgba(1, 25, 14, 1) 100%),
    linear-gradient(180deg, #021a0e 0%, #052a17 50%, #010d07 100%);
  overflow: hidden;
}
.stage::before {
  content: ''; position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 16% 80% at 28% 35%, rgba(120, 255, 200, 0.28) 0%, transparent 60%),
    radial-gradient(ellipse 24% 90% at 50% 28%, rgba(180, 255, 220, 0.32) 0%, transparent 65%),
    radial-gradient(ellipse 16% 80% at 72% 35%, rgba(120, 255, 200, 0.28) 0%, transparent 60%);
  filter: blur(25px); z-index: 1;
}
.stage::after {
  content: ''; position: absolute; inset: 0;
  background-image:
    radial-gradient(circle 2px at 12% 18%, #fae5a5, transparent),
    radial-gradient(circle 1.5px at 88% 22%, #fae5a5, transparent),
    radial-gradient(circle 3px at 25% 45%, #fae5a580, transparent),
    radial-gradient(circle 1px at 75% 12%, #fff, transparent),
    radial-gradient(circle 2px at 92% 50%, #fae5a5cc, transparent),
    radial-gradient(circle 1.5px at 8% 38%, #fff, transparent);
  pointer-events: none;
}
.header { position: absolute; top: 38px; left: 48px; display: flex; align-items: center; gap: 14px; z-index: 10; }
.logo-slot { width: 58px; height: 58px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 2px dashed rgba(220, 178, 92, 0.6); display: flex; align-items: center; justify-content: center; font-size: 18px; }
.church-name { font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 19px; letter-spacing: 1.2px; color: #f5f0dc; }
.ministry { font-family: 'Poppins', sans-serif; font-weight: 300; font-size: 11px; letter-spacing: 2.5px; color: rgba(220, 178, 92, 0.9); margin-top: 2px; }
.subject-slot { position: absolute; top: 90px; left: 50%; transform: translateX(-50%); width: 920px; height: 900px; background: rgba(0,0,0,0.2); border: 3px dashed rgba(220, 178, 92, 0.5); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: rgba(245, 220, 160, 0.7); font-family: 'Poppins', sans-serif; font-size: 22px; z-index: 5; }
.fade { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 0%, transparent 50%, rgba(2, 35, 18, 0.65) 65%, rgba(0, 12, 6, 0.98) 100%); z-index: 8; pointer-events: none; }
.text-block { position: absolute; bottom: 50px; left: 0; right: 0; text-align: center; z-index: 20; }
.flourish { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 0 auto; width: 380px; }
.flourish-line { flex: 1; height: 1.5px; background: linear-gradient(90deg, transparent 0%, #dcb25c 30%, #f5dca0 50%, #dcb25c 70%, transparent 100%); }
.flourish-diamond { width: 10px; height: 10px; background: linear-gradient(135deg, #f5dca0, #dcb25c); transform: rotate(45deg); box-shadow: 0 0 8px rgba(245, 220, 160, 0.6); }
.happy { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 64px; letter-spacing: 6px; color: #fff; margin-top: 18px; text-shadow: 0 4px 18px rgba(0,0,0,0.85); }
.birthday { font-family: 'Playfair Display', serif; font-weight: 900; font-size: 96px; letter-spacing: 4px; color: #fff; line-height: 1.05; text-shadow: 0 6px 22px rgba(0,0,0,0.85); margin-top: -8px; }
.to-row { display: flex; align-items: center; justify-content: center; gap: 18px; margin: 14px 0 6px; }
.to-line { width: 90px; height: 1.5px; background: linear-gradient(90deg, transparent, #dcb25c, transparent); }
.to { font-family: 'Great Vibes', cursive; font-size: 58px; color: #f5dca0; }
.name { font-family: 'Playfair Display', serif; font-weight: 900; font-size: 92px; letter-spacing: 5px;
  background: linear-gradient(180deg, #fef0bb 0%, #f5dca0 25%, #dcb25c 55%, #b08a3a 85%, #8a6a28 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.7)); margin: 12px 0 22px; }
.wishes { font-family: 'Poppins', sans-serif; font-weight: 300; font-size: 16px; letter-spacing: 2.5px; color: rgba(245, 240, 220, 0.85); line-height: 1.6; margin-top: 8px; }
</style></head>
<body><div class="stage">
  <div class="subject-slot">📷 PORTRAIT PHOTO HERE (subject cut-out, transparent BG)</div>
  <div class="fade"></div>
  <div class="header">
    <div class="logo-slot">🎯</div>
    <div><div class="church-name">ORGANIZATION NAME</div><div class="ministry">SUBTITLE / TAGLINE</div></div>
  </div>
  <div class="text-block">
    <div class="flourish"><div class="flourish-line"></div><div class="flourish-diamond"></div><div class="flourish-line"></div></div>
    <div class="happy">HAPPY</div>
    <div class="birthday">BIRTHDAY</div>
    <div class="to-row"><div class="to-line"></div><div class="to">to</div><div class="to-line"></div></div>
    <div class="name">RECIPIENT NAME</div>
    <div class="flourish"><div class="flourish-line"></div><div class="flourish-diamond"></div><div class="flourish-line"></div></div>
    <div class="wishes">WISH MESSAGE LINE 1<br>WISH MESSAGE LINE 2</div>
  </div>
</div></body></html>`;

const SYSTEM_PROMPT = `You are a senior graphic designer who builds polished, print-ready flyer/poster/social-card designs as complete HTML+CSS documents. Your output is rendered to PNG by a headless Chromium browser, so you have access to the full power of CSS3 — no JavaScript, no external assets except Google Fonts.

# WHY HTML, NOT IMAGE-GEN

You are replacing a diffusion-model image generator (gpt-image-1) that produces blurry text and approximate fonts. Your advantage is pixel-perfect typography from real Google Fonts, real CSS radial gradients with proper easing, real text-shadows / drop-shadows, real \`background-clip: text\` for gradient text fills, and ornamental flourishes built from divs/borders/SVG instead of being hallucinated. USE that advantage on every design.

# REQUIRED DESIGN TECHNIQUES

Every design you produce MUST exhibit at least 5 of these polish patterns:

1. **Multi-stop radial-gradient backgrounds** with depth easing — never flat colors. Layer two or three radial-gradients at different positions with varying alpha to build atmospheric depth (see the reference exemplar's \`.stage\` background — that pattern is the gold standard).

2. **3-tier typography hierarchy** — pair a script/handwritten font (Great Vibes, Caveat, Pacifico, Dancing Script) for emotion, a display serif/sans (Playfair Display 900, Anton, Bebas Neue, Archivo Black) for the headline, and a clean sans (Poppins, Inter, Montserrat) for body/footer text. NEVER use only one font.

3. **Photo placeholders as styled divs** — \`<div class="photo-slot">\` with dashed gold/colored border, semi-transparent fill, centered emoji + label ("📷 PORTRAIT PHOTO HERE"). NEVER embed actual photos or invent specific faces. The user fills these slots later.

4. **Ornamental flourishes** — gold lines with linear-gradient fades, diamond shapes via \`transform: rotate(45deg)\`, scrollwork via partial circular borders. Used to bracket text dividers.

5. **Gradient text fills** via \`background-clip: text + -webkit-text-fill-color: transparent\` for premium gold or metallic effects on key names/headlines.

6. **Decorative scatter** — bokeh sparkles via repeating tiny \`radial-gradient(circle Npx at X% Y%, color, transparent)\` in a pseudo-element, snowfall, confetti dots, etc. Always low opacity, high count.

7. **Atmospheric layering** — at least one \`::before\` and/or \`::after\` pseudo-element for depth (light shafts, blur halos, gradient fades).

8. **Drop-shadows and text-shadows** with multi-layer stacking (\`text-shadow: 0 4px 18px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.9)\`) for premium feel.

# REFERENCE EXEMPLAR (study this — your output should match this level of polish)

\`\`\`html
${REFERENCE_EXEMPLAR_HTML}
\`\`\`

# OUTPUT CONTRACT

Return EXACTLY one complete HTML document. No prose, no commentary, no markdown fences. Start with \`<!DOCTYPE html>\` and end with \`</html>\`.

The document MUST:
- Set body to the EXACT viewport dimensions you'll be told. No padding, no overflow.
- \`@import\` at least 2 Google Fonts via \`<link href="https://fonts.googleapis.com/css2?...">\`.
- Use ONLY CSS for all visual effects (no \`<script>\`, no \`<canvas>\`, no \`<svg>\` is OK — inline SVG is fine).
- Reference NO external images. Photos are placeholder divs only.
- Be self-contained — render correctly when loaded as a single HTML file.

DO NOT wrap in code fences. DO NOT add explanations. ONE HTML document, raw.`;

export interface DesignTemplateAsHtmlOpts {
  query: string;
  styleLabel: string;
  width?: number;
  height?: number;
}

export interface DesignTemplateAsHtmlResult {
  html: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Generate one polished HTML+CSS design for a given query and style.
 * Returns the raw HTML string ready to be passed to renderHtmlToPng().
 */
export async function designTemplateAsHtml(
  opts: DesignTemplateAsHtmlOpts,
): Promise<DesignTemplateAsHtmlResult> {
  const { query, styleLabel, width = 1080, height = 1350 } = opts;

  const variant = HTML_STYLE_VARIANTS.find((v) => v.label === styleLabel);
  if (!variant) {
    throw new Error(`Unknown HTML style label: ${styleLabel}`);
  }

  const userPrompt = [
    `Topic: ${query}`,
    ``,
    `Viewport: ${width}px × ${height}px (this MUST be the body dimensions).`,
    ``,
    `Style direction: ${variant.label}`,
    `${variant.modifier}`,
    ``,
    `Generate the complete HTML document now. Output ONLY the HTML — no prose, no fences.`,
  ].join("\n");

  // Stream so we don't time out on long generations. ~3-8s typical for
  // a complete polished design with thinking enabled.
  // SDK 0.32 doesn't type cache_control on system array entries — cast
  // the params through unknown so we still get the 90% prompt-cache
  // discount on the second+ parallel call. Same pattern client.ts uses.
  const stream = anthropic.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
    thinking: { type: "adaptive" },
  } as unknown as Parameters<typeof anthropic.messages.stream>[0]);

  const finalMessage = await stream.finalMessage();
  const textBlock = finalMessage.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";

  const html = extractHtml(raw);
  if (!html) {
    throw new Error("Claude returned no HTML — got empty/non-HTML response");
  }

  return {
    html,
    inputTokens: finalMessage.usage.input_tokens,
    outputTokens: finalMessage.usage.output_tokens,
  };
}

/** Strip optional ```html fences if Claude added them despite the
 *  contract, then trim. Returns null if no \`<html\` is found. */
function extractHtml(text: string): string | null {
  const trimmed = text.trim();
  // Common fence patterns: ```html ... ``` or just ``` ... ```
  const fenced = /^```(?:html)?\s*\n([\s\S]*?)\n```\s*$/i.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  if (!/<html[\s>]/i.test(candidate)) return null;
  return candidate;
}
