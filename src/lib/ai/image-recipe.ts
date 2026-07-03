import type { RecipeConfig } from "./media-policy";

/**
 * ART-DIRECTION RECIPE — the single source of truth for the design-quality
 * prompt layer that lifts EVERY provider (xAI, Gemini, gpt-image) to the
 * agency-grade, gpt-image-example bar. Proven in the July-2026 bake-off: the
 * jump from "plain/basic, card-on-a-background" to full-bleed, richly-designed,
 * correctly-spelled output came from three levers, each gated by a recipe flag
 * the Control Hub can toggle:
 *   • fullBleed       — anti-card, edge-to-edge composition
 *   • premiumPolish   — Stripe/Linear-grade depth, glassmorphism, 2K sharpness
 *   • enforceExactCopy— exact words, zero misspelling/duplication/invention
 *   • singleLogo      — model draws NO brand mark; the real logo composites once
 *
 * This is appended to the pipeline's design prompt so it applies uniformly.
 */
export function buildArtDirection(opts: {
  recipe: RecipeConfig;
  hasLogo: boolean;
  premiumTier?: boolean;
}): string {
  const { recipe, hasLogo } = opts;
  const parts: string[] = ["ART DIRECTION — hold every rule below:"];

  if (recipe.fullBleed) {
    // ROOT-CAUSE FIX (July-2026 xAI probe): grok-imagine renders the design as a
    // physical object with a matte/shadow — a card floating on a second
    // background — when the prompt (a) uses object words like flyer/poster/card
    // or "ambient shadow", and (b) lacks explicit edge negatives. The winning
    // recipe reframes the deliverable as the CANVAS ITSELF and hard-negatives the
    // border/matte/vignette while asserting the background touches all four edges.
    parts.push(
      "• FULL-BLEED — THE IMAGE ITSELF IS THE ARTWORK: you are painting directly onto the ENTIRE canvas, edge to edge. This is NOT a photograph of a printed flyer, poster, card, postcard, or sheet of paper, and NOT a design placed on top of any surface, wall, desk, mat, or secondary background. There is exactly ONE layer. The background color/gradient reaches and TOUCHES all four edges — the corner pixels are part of the design. Absolutely NO border, NO frame, NO matte, NO passe-partout, NO vignette, NO rounded outer corners, NO inner card, NO drop shadow around the whole image, and NO darker surround of any kind.",
    );
  }
  if (recipe.premiumPolish) {
    parts.push(
      "• PREMIUM FINISH (match the polish of Stripe, Linear, Vercel and Notion marketing): award-winning senior art-director quality. Depth comes from WITHIN the composition — refined gradients, tasteful geometric accents and thin connective lines, subtle glassmorphism panels with 1px light strokes and gentle inner glow, realistic high-fidelity device/product mockups with legible micro-UI where called for. Any glow or shadow stays INSIDE the layout on individual elements — never as a border, matte, halo, or surround around the whole image. Immaculate spacing on a strict grid, rich-but-restrained color, poster-grade sharpness. Rich multi-section hierarchy: header → hero → feature/benefit row → CTA → footer.",
    );
  }
  if (recipe.enforceExactCopy) {
    parts.push(
      "• TYPOGRAPHY & COPY: ultra-crisp, vector-sharp, PERFECTLY SPELLED. Render the provided words EXACTLY — never misspell, duplicate, garble, truncate, or invent text. Kerned and grid-aligned with a clear headline → subhead → body → footer scale. Premium sans-serif. No lorem ipsum, no gibberish micro-text.",
    );
  }
  if (recipe.singleLogo) {
    parts.push(
      hasLogo
        ? "• LOGO — DRAW NONE: do NOT render any logo, wordmark, emblem, icon mark, seal, crest, monogram, mascot, or brand-name lettering ANYWHERE. The user's REAL logo is composited on afterward exactly once, so keep the top-left header area clean, calm, and uncluttered (no placeholder box, frame, label, or watermark). Exactly one brand mark will exist — the real one added later."
        : "• ONE brand mark only: if a brand name is shown, render it a SINGLE time in the header as clean text — never repeat it, and never invent a logo symbol, emblem, seal, or monogram the brand did not provide.",
    );
  }
  parts.push(
    "• NO third-party / AI branding: never add xAI, Grok, OpenAI, Gemini, DALL·E or any tool logo, watermark, or 'AI-generated' badge. This is the user's design — only their brand elements.",
  );

  return parts.join("\n");
}
