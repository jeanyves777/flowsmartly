import type { RecipeConfig } from "./media-policy";

/**
 * ART-DIRECTION RECIPE — the design-quality prompt layer appended to EVERY
 * provider's design prompt (xAI, Gemini, gpt-image) so they all aim at the same
 * bar: rich, PHOTOGRAPHIC, agency-grade PRINT-MARKETING flyers (the DESIGN_ESAMPLE
 * reference set — celebration cards with real composited people, food/product
 * promos, multi-zone service flyers), NOT flat minimal SaaS slides.
 *
 * Rewritten (July-2026) after the gpt-image bake-off: the earlier recipe chased
 * a "Stripe/Linear/Vercel/Notion" minimal aesthetic, which pushed xAI/Gemini to
 * clean-but-flat gradient+glassmorphism output. The real bar is expressive,
 * photographic, decorated design — so the recipe now demands a photoreal hero,
 * rich occasion-appropriate art direction, and art-directed typography.
 *
 * Levers (each Control-Hub toggleable via RecipeConfig):
 *   • fullBleed       — anti-card, edge-to-edge composition
 *   • premiumPolish   — the rich photographic agency-flyer art direction (the big one)
 *   • enforceExactCopy— exact words, zero misspelling/duplication/invention
 *   • singleLogo      — model draws NO brand mark; the real logo composites once
 */
export function buildArtDirection(opts: {
  recipe: RecipeConfig;
  hasLogo: boolean;
}): string {
  const { recipe, hasLogo } = opts;
  const parts: string[] = ["ART DIRECTION — hold every rule below:"];

  if (recipe.fullBleed) {
    // ROOT-CAUSE FIX (xAI probe): grok-imagine renders the design as a physical
    // object with a matte/shadow — a card floating on a second background — when
    // the prompt uses object words (flyer/poster/card) without explicit edge
    // negatives. Reframe the deliverable as the CANVAS ITSELF and hard-negative
    // the border/matte/vignette. (This is about the FRAME of the output — it does
    // NOT forbid photographic imagery INSIDE the design; see PHOTOREALISTIC HERO.)
    parts.push(
      "• FULL-BLEED — THE IMAGE ITSELF IS THE ARTWORK: you are painting directly onto the ENTIRE canvas, edge to edge. This is NOT a photograph of a printed flyer, poster, card, postcard, or sheet of paper, and NOT a design placed on top of any surface, wall, desk, mat, or secondary background. There is exactly ONE layer. The background reaches and TOUCHES all four edges — the corner pixels are part of the design. Absolutely NO border, NO frame, NO matte, NO passe-partout, NO vignette, NO rounded outer corners, NO inner card, NO drop shadow around the whole image, and NO darker surround of any kind.",
    );
  }
  if (recipe.premiumPolish) {
    parts.push(
      "• DESIGN LEVEL — a finished, print-ready MARKETING FLYER from a top creative agency: rich, layered and expressive, on the level of award-winning Behance/Dribbble print work and premium Canva Pro / Adobe Express templates. This is NOT a plain minimal SaaS slide, NOT a simple flat gradient with a few icons, and NOT a corporate stock look. Fill the whole canvas with a confident, dense-but-organized composition and real visual craft.",
    );
    parts.push(
      "• PHOTOREALISTIC HERO — when the subject is a real thing (a person, a family, a product, food, a place, a team), make it a REAL, professional, studio-lit PHOTOGRAPH as the visual centerpiece, cleanly integrated into the layout (crisply cut out, blended, or given a tasteful duotone / selective-color treatment) — tack-sharp, natural and true-to-life, with believable lighting and shadow. Do NOT substitute flat vector, cartoon or clip-art for the hero, and never leave the hero as a plain icon. Reserve crisp line/solid icons for small supporting feature bullets only.",
    );
    parts.push(
      "• RICH ART DIRECTION & DEPTH — real craft, matched to the occasion: for celebrations use balloons, confetti, gold foil, sparkle, ribbons and elegant flourishes; for promotions/services use textured or radial-sunburst backgrounds, foliage, badges/seals, brush strokes, hand-drawn doodles and labels, torn-paper dividers, price cards or a small photo strip where the content calls for it. Layer foreground / midground / background for depth; refined gradients and subtle glassmorphism panels are welcome. Every glow or shadow stays INSIDE the composition on its own element — never a border, matte or halo around the whole image.",
    );
    parts.push(
      "• EXPRESSIVE TYPOGRAPHY — art-directed type like a real designer, NOT one flat sans-serif line: pair a bold display/headline face with an elegant SCRIPT, high-contrast SERIF, or chunky rounded display for the emphasis words (names, occasions, key phrases). Give the headline clear DOMINANCE with a big size jump over the subhead, and keep EVERY line highly legible — never run thin script over a busy or low-contrast area; add a soft shadow/outline or a clean backing panel where it aids readability. Clear headline → subhead → body → footer scale, one tasteful accent color, immaculate kerning.",
    );
    parts.push(
      "• STRUCTURE — a clear hierarchy that fills the space: branded header (logo + name) → bold hero (headline + the photographic centerpiece) → supporting zone (a benefit/feature row, or Q&A / stats / price cards / a photo strip as fits the message) → strong CTA → a DESIGNED footer bar (a solid brand-color strip) carrying the real contact details in one evenly-spaced row with small line icons or thin dividers between items. Immaculate spacing on a strict grid; balanced and full, never empty or sparse.",
    );
  }
  if (recipe.enforceExactCopy) {
    parts.push(
      "• COPY ACCURACY: all text ultra-crisp, vector-sharp and PERFECTLY SPELLED. Render ONLY the actual marketing copy provided, EXACTLY — never misspell, duplicate, garble, truncate, or invent text. Kerned and grid-aligned. No lorem ipsum, no gibberish micro-text.",
    );
    parts.push(
      "• NO DESIGN-SPEC ANNOTATIONS: this is a finished piece, not a design mockup. Do NOT render any font names, hex color codes (e.g. #E0D1FF), pt/px sizes, color names, measurements, rulers, spec labels, or annotation callouts anywhere — only the real copy.",
    );
  }
  if (recipe.singleLogo) {
    parts.push(
      hasLogo
        ? "• LOGO — DRAW NONE, LEAVE THE TOP-LEFT CORNER EMPTY: do NOT render any logo, wordmark, emblem, icon mark, seal, crest, monogram, mascot, or brand-name lettering ANYWHERE. The user's REAL logo is added to the top-left corner afterward. So simply keep the top-left area (about the top 18% of the height and left 28% of the width) as PLAIN, CALM, UNCLUTTERED BACKGROUND — ordinary background only, exactly like the rest of the backdrop. Critically: do NOT draw a white box, rectangle, panel, frame, outline, or placeholder there, and do NOT write any label or words (never the words 'logo', 'reserved', 'zone', or 'brand') — it must look like normal empty background, not a marked-off area. Keep the eyebrow/tagline and headline out of that corner — start them to the right of or below it, never a line of text running across the top-left. Exactly one brand mark will exist — the real one added later."
        : "• ONE brand mark only: if a brand name is shown, render it a SINGLE time in the header as clean text — never repeat it, and never invent a logo symbol, emblem, seal, or monogram the brand did not provide.",
    );
  }
  parts.push(
    "• NO third-party / AI branding: never add xAI, Grok, OpenAI, Gemini, DALL·E or any tool logo, watermark, or 'AI-generated' badge. This is the user's design — only their brand elements.",
  );

  return parts.join("\n");
}
