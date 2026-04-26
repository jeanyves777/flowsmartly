import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Text Overlay Agent — Claude vision pass that examines the SOURCE
 * design (where original text is cleanly rendered) and emits a list
 * of editable Fabric textbox specs that mirror each text region.
 *
 * Pairs with template-remix-agent.ts in /api/studio/templates/remix:
 *   - remix-agent (gpt-image-1) produces a TEXT-FREE flat composition
 *     (we deliberately ask it to render no text — gpt-image-1 garbles
 *     typography and bakes wording in non-editably)
 *   - this agent (Claude vision) reads the SOURCE design (which still
 *     has the original text in pixels) to pull positions, fonts, sizes,
 *     colors, alignment, etc., then emits editable Fabric textbox specs
 *     populated with the USER'S customText (or kept original if blank)
 *   - frontend stacks the textboxes on top of the gpt-image-1 image at
 *     scaled positions → visually polished AND fully editable
 *
 * Positions returned are in SOURCE coordinate space (the dimensions
 * Claude sees in the image). The caller must scale them into the output
 * canvas's coord space before adding them to Fabric.
 */

export interface EditableTextLayer {
  text: string;
  /** Top-left x/y in SOURCE pixels — caller scales to output canvas. */
  left: number;
  top: number;
  /** Width of the textbox in SOURCE pixels. Generous so text doesn't auto-wrap. */
  width: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fontStyle?: string;
  fill: string;
  textAlign: "left" | "center" | "right";
  charSpacing?: number;
  lineHeight?: number;
  angle?: number;
  opacity?: number;
}

export interface TextOverlayResult {
  layers: EditableTextLayer[];
  inputTokens: number;
  outputTokens: number;
}

export async function generateTextOverlay(opts: {
  /** Base64 PNG of the SOURCE design — Claude reads this for text styling. */
  sourceImageB64: string;
  /** Source image dimensions in pixels — coord space for textbox positions. */
  width: number;
  height: number;
  /** What text the USER wants. Each "block" (separated by blank lines)
   *  maps to one text region in priority order (headline → subhead →
   *  body → footer). Blank = mirror the original text from the source. */
  customText?: string;
}): Promise<TextOverlayResult> {
  const { sourceImageB64, width, height, customText = "" } = opts;

  const systemPrompt = `You are a text-extraction agent for an editable canvas system. Your job is to look at a flyer/poster source design and identify every text region, then emit a JSON array of Fabric.js textbox specs that mirror what the source has — so the user can edit each text element later in the canvas.

# OUTPUT CONTRACT

Return ONLY a JSON object of the form:
{
  "layers": [
    {
      "text": "<the text content for this region>",
      "left": <x in pixels from top-left>,
      "top": <y in pixels from top-left>,
      "width": <pixel width — set generously so the text doesn't auto-wrap unexpectedly>,
      "fontFamily": "<best-match Google Font name — e.g. 'Playfair Display', 'Inter', 'Great Vibes', 'Bebas Neue', 'Montserrat', 'Poppins', 'Anton'>",
      "fontSize": <pixel size>,
      "fontWeight": "<'normal' | 'bold' | '300'..'900' as appropriate>",
      "fontStyle": "<'normal' | 'italic'>",
      "fill": "<hex color, e.g. '#ffffff' or '#dcb25c'>",
      "textAlign": "<'left' | 'center' | 'right'>",
      "charSpacing": <optional, in 1/1000 em — try 50-200 for tracked uppercase headlines>,
      "lineHeight": <optional, default 1.16>,
      "angle": <optional rotation in degrees>,
      "opacity": <optional 0-1>
    }
  ]
}

NO PROSE. NO MARKDOWN FENCES. Just the JSON object.

# RULES

1. ONE textbox per logical text element. A multi-line block is one textbox if the lines share font/style; otherwise split.
2. The image you see is ${width}×${height} pixels — emit positions in that coord space (top-left origin).
3. 'left' / 'top' = TOP-LEFT corner of the textbox. If the original text is centered horizontally, set textAlign='center' AND set 'left' so the textbox is centered on the original text's center (left = textCenter - width/2).
4. Width should fit the text comfortably with ~10-30px of breathing room each side. Too narrow forces wrapping; too wide grabs clicks far from the text.
5. Pick the closest GOOGLE FONT. Common picks: Playfair Display (elegant serif), Great Vibes (script), Bebas Neue or Anton (big condensed display), Inter / Poppins / Montserrat (clean sans), DM Serif Display (modern serif), Pacifico or Caveat (handwritten). The user has all common Google Fonts loaded.
6. Color must be the visible color. For gradient-fill text (e.g. gold foil), pick the dominant mid-tone (e.g. '#dcb25c' for gold foil).
7. For 'rotated' text (tilted "Sale!" badges, vertical sidebar text, etc.), set 'angle' in degrees.
8. Skip purely decorative graphics (lines, ornaments, dots, icons). ONLY actual readable text.
9. If you cannot identify any text, return {"layers": []} — never invent text.`;

  const userText = customText.trim()
    ? `The user wants the following content in the design — distribute these lines across the source design's text regions in priority order (headline → subhead → body → footer). Match the source's typography exactly but use the user's text content:

${customText.trim()}

For text regions you can't map to user content, MIRROR the original text from the source character-for-character.`
    : "Mirror every text region from the source character-for-character (capitalization, punctuation, line breaks via \\n).";

  const response = (await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: sourceImageB64 },
          },
          { type: "text", text: userText },
        ],
      },
    ],
    thinking: { type: "adaptive" },
  } as unknown as Parameters<typeof anthropic.messages.create>[0])) as Anthropic.Message;

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";

  const parsed = parseLayersJson(raw);
  return {
    layers: parsed,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/** Strip optional code fences and parse the JSON Claude returned. */
function parseLayersJson(raw: string): EditableTextLayer[] {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    const obj = JSON.parse(candidate) as { layers?: unknown };
    if (!obj || !Array.isArray(obj.layers)) return [];
    return (obj.layers as Record<string, unknown>[])
      .map((l) => coerceLayer(l))
      .filter((l): l is EditableTextLayer => l !== null);
  } catch {
    return [];
  }
}

function coerceLayer(l: Record<string, unknown>): EditableTextLayer | null {
  const text = typeof l.text === "string" ? l.text : null;
  const left = typeof l.left === "number" ? l.left : null;
  const top = typeof l.top === "number" ? l.top : null;
  const width = typeof l.width === "number" ? l.width : null;
  const fontFamily = typeof l.fontFamily === "string" ? l.fontFamily : null;
  const fontSize = typeof l.fontSize === "number" ? l.fontSize : null;
  const fill = typeof l.fill === "string" ? l.fill : null;
  if (text === null || left === null || top === null || width === null || !fontFamily || fontSize === null || !fill) {
    return null;
  }
  const textAlign = (l.textAlign === "left" || l.textAlign === "center" || l.textAlign === "right")
    ? l.textAlign
    : "left";
  return {
    text,
    left,
    top,
    width,
    fontFamily,
    fontSize,
    fontWeight: typeof l.fontWeight === "string" || typeof l.fontWeight === "number" ? l.fontWeight : "normal",
    fontStyle: typeof l.fontStyle === "string" ? l.fontStyle : "normal",
    fill,
    textAlign,
    charSpacing: typeof l.charSpacing === "number" ? l.charSpacing : undefined,
    lineHeight: typeof l.lineHeight === "number" ? l.lineHeight : undefined,
    angle: typeof l.angle === "number" ? l.angle : undefined,
    opacity: typeof l.opacity === "number" ? l.opacity : undefined,
  };
}
