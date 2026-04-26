import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Text Overlay Agent — Claude vision pass that converts the rendered
 * text in a flat design (e.g. a gpt-image-1 remix output) into a list
 * of editable Fabric textbox specs that can be added on top of the
 * locked background image.
 *
 * Why this exists: gpt-image-1 produces beautiful flat output, but the
 * text is BAKED IN — users can't tweak typos, change the date, or
 * rephrase a line without redoing the whole AI step. By having Claude
 * vision identify each text region in the rendered image and emit a
 * matching Fabric textbox (same font, size, color, position), the
 * canvas ends up with: locked image bg (with the text in pixels) +
 * editable textboxes overlapping each text region (same content). The
 * two are visually indistinguishable, but the textboxes are now
 * fully editable.
 *
 * Pairs with template-remix-agent.ts in the /api/studio/templates/remix
 * route. ~$0.05 per pass with adaptive thinking.
 */

export interface EditableTextLayer {
  /** Same text the AI baked into the image — caller adds this as a
   *  Fabric textbox so the user can edit it later. */
  text: string;
  /** Top-left x/y in canvas pixels (relative to the rendered image). */
  left: number;
  top: number;
  /** Width of the textbox; height auto-computed from font + lineHeight. */
  width: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fontStyle?: string;       // "normal" | "italic"
  fill: string;             // hex string
  textAlign: "left" | "center" | "right";
  charSpacing?: number;
  lineHeight?: number;
  /** Optional rotation in degrees, e.g. for tilted "Sale!" badges. */
  angle?: number;
  /** Opacity 0-1. */
  opacity?: number;
}

export interface TextOverlayResult {
  layers: EditableTextLayer[];
  inputTokens: number;
  outputTokens: number;
}

/**
 * Look at the rendered design and emit one Fabric textbox spec per
 * visible text region. The user's customText (if provided) is what was
 * baked into the image — Claude identifies WHERE that text landed and
 * mirrors its styling into editable layers.
 *
 * The image must be a base64 PNG (no data URI prefix). Output dimensions
 * tell Claude the coordinate space the textbox `left`/`top` should use.
 */
export async function generateTextOverlay(opts: {
  /** Base64 PNG of the gpt-image-1 remix output (no data URI prefix). */
  remixedImageB64: string;
  /** Width of the rendered image in pixels — coord space for textbox positions. */
  width: number;
  /** Height of the rendered image in pixels. */
  height: number;
  /** What text the AI baked in — Claude uses this as the source of truth
   *  for textbox content. Lines roughly correspond to one textbox each. */
  customText?: string;
}): Promise<TextOverlayResult> {
  const { remixedImageB64, width, height, customText = "" } = opts;

  const systemPrompt = `You are a text-extraction agent for an editable canvas system. Your job is to look at a rendered flyer/poster design and identify every text region, then emit a JSON array of Fabric.js textbox specs that mirror what is rendered — so the user can edit each text element later in the canvas.

# OUTPUT CONTRACT

Return ONLY a JSON object of the form:
{
  "layers": [
    {
      "text": "<the actual text content as rendered, character-perfect>",
      "left": <x in pixels from top-left>,
      "top": <y in pixels from top-left>,
      "width": <pixel width — set generously so the text doesn't auto-wrap unexpectedly>,
      "fontFamily": "<best-match Google Font name — e.g. 'Playfair Display', 'Inter', 'Great Vibes', 'Bebas Neue', 'Montserrat'>",
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

1. ONE textbox per logical text element. A multi-line block IS one textbox if the lines share font/style; otherwise split into separate textboxes.
2. The 'text' field MUST match what's rendered character-for-character (capitalization, punctuation, line breaks via \\n).
3. Positions are TOP-LEFT corner, in pixels of a ${width}×${height} canvas.
4. Width should fit the text comfortably with ~20px breathing room — too narrow forces unwanted wrapping, too wide makes the textbox grab clicks far from the text.
5. Pick the closest GOOGLE FONT match for each typeface (Playfair Display for elegant serifs, Great Vibes for script, Bebas Neue / Anton for big display, Inter / Montserrat / Poppins for clean sans, etc.). The user has all common Google Fonts loaded.
6. Color must be the visible color — for gradient-fill text, pick the dominant mid-tone.
7. If text is centered horizontally, set textAlign='center' AND set 'left' to the text's CENTER, then subtract width/2. (Or: set textAlign='left' with left = visual top-left of the text.)
8. Skip purely decorative graphics (lines, ornaments, icons). ONLY actual readable text.
9. If you cannot identify any text, return {"layers": []} — never invent text.`;

  const userText = customText.trim()
    ? `The following text was baked into this image — your textboxes should mirror it character-for-character (this is what the user wants to be able to edit later):\n\n${customText.trim()}`
    : "Identify every text region as it appears in the image and mirror it.";

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
            source: { type: "base64", media_type: "image/png", data: remixedImageB64 },
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
  // Strip ```json ... ``` if Claude added one despite the contract.
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
