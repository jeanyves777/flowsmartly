import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { OpenAIClient } from "./openai-client";

/**
 * Claude vision rejects images >5 MB. PNGs from gpt-image-1 routinely
 * land at 5-7 MB. Recompress to JPEG q85 (almost always under 1 MB)
 * and downscale the longest edge to 2048 px which is plenty for vision
 * to read fine typography. Returns the original buffer untouched when
 * already small enough — keeps PNG transparency intact in that case.
 */
async function shrinkForVision(
  buf: Buffer,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }> {
  const VISION_MAX_BYTES = 4_800_000; // small headroom under Claude's 5MB cap
  if (buf.length <= VISION_MAX_BYTES) {
    return { base64: buf.toString("base64"), mediaType };
  }
  try {
    const meta = await sharp(buf).metadata();
    const longest = Math.max(meta.width || 0, meta.height || 0);
    const target = Math.min(2048, longest);
    const resized = await sharp(buf)
      .resize(longest > target ? target : undefined, longest > target ? target : undefined, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    console.log(`[TemplateReproduce] vision-shrink ${buf.length}→${resized.length} bytes (jpeg q85)`);
    return { base64: resized.toString("base64"), mediaType: "image/jpeg" };
  } catch (err) {
    // Last-resort: aggressive downscale to keep the request alive.
    console.warn("[TemplateReproduce] shrink failed, falling back to crude jpeg q70:", err);
    const fallback = await sharp(buf).resize(1536, 1536, { fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
    return { base64: fallback.toString("base64"), mediaType: "image/jpeg" };
  }
}

/**
 * Template Reproduce Agent — refined v3.
 *
 * Architecture (per user feedback after trying v2 single-pass image-edit):
 *  1. Claude vision (single pass) reads the source design and emits a
 *     structured Fabric.js spec with EVERY text / shape / decorative
 *     accent as an editable layer + a description for the background.
 *  2. ONE OpenAI gpt-image-1 call generates JUST the background — when
 *     the source has a photographic / decorative bg. Solid + gradient
 *     bgs skip OpenAI entirely.
 *  3. Image slots in the source (where people / products were shown)
 *     become EMPTY editable placeholders — dashed-border boxes that say
 *     "Drop your photo here". User fills them via Uploads / drag-drop /
 *     the bg-removal tool. If the user uploaded reference photos in the
 *     Recreate dialog, those map to placeholders by index.
 *
 * Why this shape:
 *  - User said v1 (Claude composes everything + N image gens) was the
 *    right idea but the per-photo regeneration produced fragmented
 *    composites that didn't match the source's people. v2 (single
 *    image-edit pass) was even worse — gpt-image-1 invented bizarre
 *    combinations of attached references.
 *  - This v3 combines what worked: Claude's strong structural
 *    understanding + just one image gen for the part it does well
 *    (backgrounds). Photos of specific people are deferred to the user
 *    who knows what they look like.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ReproduceOptions {
  /** User-supplied copy that should replace the source's text. */
  customText?: string;
  /** BrandKit colors — applied to text/accents/bg via the Claude prompt. */
  brandColors?: { primary?: string; secondary?: string; accent?: string } | null;
  /** BrandKit fonts — auto-applied to display + body text after Claude
   *  emits the spec, so the rendered design is always on-brand even if
   *  Claude picks something else. */
  brandFonts?: { heading?: string; body?: string } | null;
  /** User-uploaded photos as data URLs. When provided, they fill image
   *  placeholders by index instead of leaving them empty. */
  referenceImages?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricObject = Record<string, any>;

export interface ReproduceResult {
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    objects: FabricObject[];
  };
  imagesGenerated: number;
  usage: { inputTokens: number; outputTokens: number };
}

interface SpecLayer {
  type: "textbox" | "rect" | "circle" | "image_placeholder";
  /** Slot label so the user knows what to drop here, e.g. "Headshot of celebrant". */
  slot?: string;
  /** Top-left x in canvas pixels. */
  left: number;
  top: number;
  width: number;
  height: number;
  // textbox
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  fill?: string;
  charSpacing?: number;
  lineHeight?: number;
  // shape
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  ry?: number;
  opacity?: number;
  angle?: number;
  // image_placeholder appearance — keeps the rendered canvas matching
  // the source's framing/accents around the slot
  borderColor?: string;
  borderWidth?: number;
}

interface ReproduceSpec {
  width: number;
  height: number;
  background: {
    type: "color" | "gradient" | "image_prompt";
    color?: string;
    gradient?: { angle: number; stops: Array<{ offset: number; color: string }> };
    /** A description of the background to send to gpt-image-1.
     *  Should describe just the BG — not people/products. */
    prompt?: string;
  };
  layers: SpecLayer[];
}

const SYSTEM_PROMPT = `You are a senior graphic designer reverse-engineering a flat marketing/event flyer image into an EDITABLE Fabric.js canvas. You produce print-quality, professionally typeset designs — not lazy reconstructions.

Your job: emit a JSON spec that, when rendered, looks AS GOOD OR BETTER than the input — with EVERY text block as an editable Textbox, EVERY shape as a Fabric Rect/Circle, and PHOTO SLOTS (where people or products appear) as EMPTY DASHED-BORDER PLACEHOLDERS the user will fill themselves. NEVER attempt to recreate specific people via image generation — leave their slot empty so the user drops their own photo.

# DESIGN QUALITY BAR — non-negotiable
- TYPOGRAPHIC HIERARCHY: the headline must be at least 2× the size of supporting copy. The CTA / button text sits between the two. Body / contact lines are the smallest. If the source is uneven, FIX IT — you are improving the design, not photocopying it.
- TYPE PAIRINGS: use one display font for the headline + one supporting font for body. Curated pairings: (Playfair Display + Lato), (Bebas Neue + Open Sans), (Cinzel + Cormorant Garamond), (Anton + Montserrat), (Great Vibes + Quicksand), (Merriweather + Inter). Never mix three display faces.
- COLOR DISCIPLINE: max 3 colors total — one dominant, one accent, one neutral for body text. If the source is muddy or has 5+ colors, simplify. If brand colors are supplied, USE THEM as the dominant + accent.
- ALIGNMENT GRID: every text block should align to either the canvas centerline or a consistent left/right margin (~5-8% inset from edges). Don't drift.
- CONTRAST: every word must pass WCAG AA against its background. If text sits on a busy area, drop a soft-color rect behind it for legibility.
- DECORATIVE ACCENT: if the source design has zero decoration, ADD ONE subtle accent — a 4-8px brand-color rule under the headline, or a thin horizontal divider above contact lines, or a small circle/badge behind a date. Tasteful, not loud.
- WHITESPACE: text must NEVER touch canvas edges. Maintain ≥4% inset on all sides.

OUTPUT FORMAT — your FINAL answer must be ONLY a JSON object, no prose, no markdown fences:
{
  "width": <int — match source aspect; 1080 square, 1080x1350 portrait, etc>,
  "height": <int>,
  "background": {
    "type": "color" | "gradient" | "image_prompt",
    "color": "#hex"                                                    // when type == "color"
    "gradient": { "angle": 135, "stops": [{ "offset": 0, "color": "#hex" }, ...] }   // when type == "gradient"
    "prompt": "Wide cinematic photo of ..."                            // when type == "image_prompt" — describe ONLY the background scene/texture (NO people, NO products)
  },
  "layers": [
    // TEXT — every visible word, no matter how small:
    {
      "type": "textbox",
      "text": "Happy Birthday",
      "left": 60, "top": 800, "width": 960, "height": 120,
      "fontSize": 96, "fontFamily": "Playfair Display", "fontWeight": "bold",
      "fontStyle": "italic", "textAlign": "center",
      "fill": "#fcf6ba", "charSpacing": 0, "lineHeight": 1.0
    },
    // SHAPES — accent bars, ribbons, frames, dividers, circles:
    {
      "type": "rect",
      "left": 80, "top": 950, "width": 920, "height": 4,
      "fill": "#d4af37", "rx": 2, "ry": 2
    },
    { "type": "circle", "left": 400, "top": 200, "width": 280, "height": 280, "fill": "transparent", "stroke": "#d4af37", "strokeWidth": 4 },
    // PHOTO SLOTS — where people/products were in the source. EMPTY frame
    // for the user to fill. Match the source's frame styling (rounded?
    // border color? size?). The "slot" string tells the user what goes here:
    {
      "type": "image_placeholder",
      "slot": "Photo of celebrant",
      "left": 420, "top": 220, "width": 240, "height": 240,
      "borderColor": "#d4af37", "borderWidth": 3, "rx": 16
    }
  ]
}

ANALYSIS RULES — be EXHAUSTIVE; the editor must look like the source:
- Read EVERY text block — small subtitles, dates, scripture refs, footer, contact lines. Each is its own textbox layer with the exact wording from the image.
- Sample text colors precisely (the actual rendered hex, not what you'd "expect").
- Pick fonts from: Playfair Display, Lato, Bebas Neue, Open Sans, Montserrat, Merriweather, Great Vibes, Cinzel, Pacifico, Quicksand, Allura, Cormorant Garamond, Anton, Roboto, Inter.
- Coordinates are in CANVAS pixels (your chosen width × height). Scale per source aspect.
- COLOR PANELS / SPLIT BACKGROUNDS — many designs use a left/right or top/bottom split (e.g. green on the left half, cream on the right). When you see this, emit a "rect" layer for the secondary panel with the correct fill, position, size — DO NOT just pick "color" for the whole bg or you lose the split.
- DECORATIVE ACCENTS — gold dividers, sun-rays, ribbon banners, accent rules under headlines, divider dots, small badges, frame borders. Emit each as its own rect/circle/line layer with the right fill, stroke, position. Don't drop them; they are what makes the design feel agency-grade vs. amateur.
- BACKGROUND field:
  * Flat color → use type "color" (only when the WHOLE canvas is one color; if there's a panel split, use "color" for the dominant zone and emit a rect for the other zone).
  * Smooth gradient → use type "gradient"
  * Photographic background → use "image_prompt" with NO people/products in the description
  * If the source background is mostly cropped photos of people, treat the background as a soft solid color and emit those people as PLACEHOLDERS instead.
- PHOTO SLOTS — wherever a person/product photo appears, emit an image_placeholder with the exact position, size, and frame styling (rounded corners? border?). NEVER use image_prompt for people/products. If the source doesn't show a photo zone, do not invent one.
- Layer ORDER: BACK to FRONT (background goes via the "background" field, then layers[] from bottom-most to top-most: panel rects → decorative shapes → text → photo placeholders on top).
- A flyer with a panel split, decorative sun-rays, gold dividers, photo, headline, subhead, contact lines, brand mark, and footer should produce ~12-18 layers. If you're emitting fewer than 8 layers for a rich-looking design, you missed elements. Look again.

Return ONLY the JSON object.`;

export async function reproduceTemplate(
  imageUrl: string,
  options: ReproduceOptions = {},
): Promise<ReproduceResult> {
  const { customText, brandColors, brandFonts, referenceImages = [] } = options;

  console.log(`[TemplateReproduce] start url=${imageUrl} text=${!!customText} brand=${!!brandColors} refs=${referenceImages.length}`);

  // Source bytes for Claude vision.
  const { base64, mediaType } = await loadImageBytes(imageUrl);
  console.log(`[TemplateReproduce] source ${base64.length} bytes ${mediaType}`);

  // Build personalization addendum.
  const personalizationLines: string[] = [];
  if (customText && customText.trim()) {
    personalizationLines.push(
      `IMPORTANT — REPLACE THE TEXT.
The user supplied this copy. Map each line to the most appropriate textbox slot in the design (headline → main display, names → name slots, dates → date blocks). Trim or split as needed. Keep all layout, fonts, and styling from the source — only the words change. If user copy is shorter than the source, drop or empty the surplus textboxes.

USER COPY:
"""
${customText.trim().slice(0, 1500)}
"""`,
    );
  }
  if (brandColors && (brandColors.primary || brandColors.secondary || brandColors.accent)) {
    const palette = [
      brandColors.primary && `primary ${brandColors.primary}`,
      brandColors.secondary && `secondary ${brandColors.secondary}`,
      brandColors.accent && `accent ${brandColors.accent}`,
    ].filter(Boolean).join(", ");
    personalizationLines.push(
      `BRAND COLORS — apply throughout: ${palette}. Use primary for main display text, secondary for sub-headlines and shape fills, accent for strokes and small badges. Maintain text contrast.`,
    );
  }
  if (referenceImages.length > 0) {
    personalizationLines.push(
      `USER UPLOADED ${referenceImages.length} PHOTO(S) — they will fill the image_placeholder slots automatically (in source order). Just emit the image_placeholder layers as usual. The frontend matches each user photo to the matching placeholder by index.`,
    );
  }
  const personalizationBlock =
    personalizationLines.length > 0 ? `\n\n${personalizationLines.join("\n\n")}\n` : "";

  // ─── Step 1: vision pass ─────────────────────────────────────────────
  const response = (await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text: `Analyze this template image and return the JSON spec described in the system prompt. Be exhaustive with text layers.${personalizationBlock}`,
          },
        ],
      },
    ],
  } as unknown as Parameters<typeof anthropic.messages.create>[0])) as Anthropic.Message;

  const textBlock = response.content.find((b: Anthropic.ContentBlock) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Reproduce agent returned no parseable JSON");

  let spec: ReproduceSpec;
  try {
    spec = JSON.parse(jsonMatch[0]) as ReproduceSpec;
  } catch (err) {
    throw new Error(`Reproduce agent JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  spec.width = clampInt(spec.width, 400, 4096, 1080);
  spec.height = clampInt(spec.height, 400, 4096, 1080);
  spec.layers = Array.isArray(spec.layers) ? spec.layers : [];
  console.log(`[TemplateReproduce] vision ok — ${spec.layers.length} layers, bg=${spec.background?.type}`);

  // ─── Step 2: generate the BACKGROUND only (one OpenAI call max) ──────
  let bgImageBase64: string | null = null;
  if (spec.background.type === "image_prompt" && spec.background.prompt) {
    try {
      const openai = OpenAIClient.getInstance();
      const aspect = pickClosestSize(spec.width, spec.height);
      bgImageBase64 = await openai.generateImage(spec.background.prompt, {
        size: aspect,
        quality: "high",
        transparent: false,
      });
      console.log(`[TemplateReproduce] bg generated — ${bgImageBase64?.length || 0} chars`);
    } catch (err) {
      console.warn(`[TemplateReproduce] bg generation failed, falling back to neutral:`, err);
    }
  }

  // ─── Step 3: assemble Fabric canvas JSON ─────────────────────────────
  const objects: FabricObject[] = [];
  let backgroundColor = "#ffffff";

  if (spec.background.type === "color" && spec.background.color) {
    backgroundColor = spec.background.color;
  } else if (spec.background.type === "gradient" && spec.background.gradient) {
    objects.push({
      type: "rect",
      left: 0, top: 0,
      originX: "left", originY: "top",
      width: spec.width, height: spec.height,
      selectable: false, evented: false,
      fill: {
        type: "linear",
        coords: gradientCoords(spec.background.gradient.angle, spec.width, spec.height),
        colorStops: spec.background.gradient.stops,
      },
    });
  } else if (bgImageBase64) {
    objects.push({
      type: "image",
      left: 0, top: 0,
      originX: "left", originY: "top",
      width: spec.width, height: spec.height,
      scaleX: 1, scaleY: 1,
      selectable: false, evented: false,
      src: `data:image/png;base64,${bgImageBase64}`,
    });
  }

  // Compute the "display threshold" used to swap brand-heading vs body
  // font. Anything sized in the top 40% of the textbox sizes counts as
  // display. Falls back to a fixed cutoff when there are too few text
  // layers to compute meaningfully.
  const textboxSizes = spec.layers
    .filter((l) => l.type === "textbox" && typeof l.fontSize === "number")
    .map((l) => l.fontSize as number)
    .sort((a, b) => b - a);
  const displayThreshold = textboxSizes.length >= 3
    ? textboxSizes[Math.floor(textboxSizes.length * 0.4)]
    : 48;

  // Walk layers (back-to-front), counting placeholders so we can map
  // user-uploaded reference images by index.
  let placeholderIndex = 0;
  for (const l of spec.layers) {
    if (l.type === "textbox") {
      // Brand fonts: swap heading font for display-sized text and body
      // font for everything else. Falls back to Claude's pick when no
      // brand fonts are supplied.
      const sz = l.fontSize ?? 32;
      const isDisplay = sz >= displayThreshold;
      const fontFamily =
        (isDisplay ? brandFonts?.heading : brandFonts?.body) ||
        l.fontFamily ||
        "Inter";
      objects.push({
        type: "textbox",
        text: l.text || "",
        left: l.left, top: l.top, width: l.width,
        originX: "left", originY: "top",
        fontSize: sz,
        fontFamily,
        fontWeight: l.fontWeight || (isDisplay ? "bold" : "normal"),
        fontStyle: l.fontStyle || "normal",
        textAlign: l.textAlign || "left",
        fill: l.fill || "#000000",
        charSpacing: l.charSpacing ?? 0,
        lineHeight: l.lineHeight ?? 1.16,
        editable: true,
      });
    } else if (l.type === "rect") {
      objects.push({
        type: "rect",
        left: l.left, top: l.top, width: l.width, height: l.height,
        originX: "left", originY: "top",
        fill: l.fill || "#cccccc",
        stroke: l.stroke,
        strokeWidth: l.strokeWidth,
        rx: l.rx, ry: l.ry,
        opacity: l.opacity ?? 1,
        angle: l.angle ?? 0,
      });
    } else if (l.type === "circle") {
      const radius = Math.min(l.width, l.height) / 2;
      objects.push({
        type: "circle",
        left: l.left, top: l.top, radius,
        originX: "left", originY: "top",
        fill: l.fill || "#cccccc",
        stroke: l.stroke,
        strokeWidth: l.strokeWidth,
        opacity: l.opacity ?? 1,
      });
    } else if (l.type === "image_placeholder") {
      const userImg = referenceImages[placeholderIndex];
      placeholderIndex++;
      if (userImg) {
        // The user uploaded a photo for this slot — drop it directly.
        objects.push({
          type: "image",
          left: l.left, top: l.top,
          originX: "left", originY: "top",
          width: l.width, height: l.height,
          scaleX: 1, scaleY: 1,
          src: userImg,
        });
      } else {
        // Empty placeholder: a soft-tinted dashed-border rect with a
        // hint text overlay telling the user what to drop here.
        const slotLabel = l.slot || "Drop your photo here";
        objects.push({
          type: "rect",
          left: l.left, top: l.top, width: l.width, height: l.height,
          originX: "left", originY: "top",
          fill: "rgba(99, 102, 241, 0.06)", // soft indigo tint
          stroke: l.borderColor || "#94a3b8",
          strokeWidth: l.borderWidth || 2,
          strokeDashArray: [8, 6],
          rx: l.rx ?? 8,
          ry: l.ry ?? 8,
        });
        // Center text inside the placeholder so the user knows it's a slot.
        objects.push({
          type: "textbox",
          text: `📷 ${slotLabel}`,
          left: l.left + 8,
          top: l.top + Math.max(8, l.height / 2 - 12),
          width: Math.max(40, l.width - 16),
          originX: "left", originY: "top",
          fontSize: Math.min(20, Math.max(12, l.width / 18)),
          fontFamily: "Inter",
          fontWeight: "500",
          textAlign: "center",
          fill: "#64748b",
          editable: false,
        });
      }
    }
  }

  return {
    canvas: { width: spec.width, height: spec.height, backgroundColor, objects },
    imagesGenerated: bgImageBase64 ? 1 : 0,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}

// ─── helpers ───────────────────────────────────────────────────────────

async function loadImageBytes(imageUrl: string): Promise<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }> {
  let buf: Buffer;
  let mediaType: "image/jpeg" | "image/png" | "image/webp";
  if (imageUrl.startsWith("/")) {
    const p = join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
    buf = readFileSync(p);
    mediaType = inferMediaType(imageUrl);
  } else {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch source image (${res.status}): ${imageUrl}`);
    buf = Buffer.from(await res.arrayBuffer());
    mediaType = (res.headers.get("content-type") as "image/jpeg" | "image/png" | "image/webp") || inferMediaType(imageUrl);
  }
  // Always pass through the shrink helper so we never bust Claude's
  // 5 MB image cap (gpt-image-1 PNGs routinely land at 5-7 MB).
  return shrinkForVision(buf, mediaType);
}

function inferMediaType(url: string): "image/jpeg" | "image/png" | "image/webp" {
  if (/\.png(\?|$)/i.test(url)) return "image/png";
  if (/\.webp(\?|$)/i.test(url)) return "image/webp";
  return "image/jpeg";
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function pickClosestSize(w: number, h: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const ar = w / h;
  if (ar >= 1.25) return "1536x1024";
  if (ar <= 0.8) return "1024x1536";
  return "1024x1024";
}

function gradientCoords(angle: number, w: number, h: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  const cx = w / 2, cy = h / 2;
  const r = Math.max(w, h);
  return {
    x1: cx - (Math.cos(rad) * r) / 2,
    y1: cy - (Math.sin(rad) * r) / 2,
    x2: cx + (Math.cos(rad) * r) / 2,
    y2: cy + (Math.sin(rad) * r) / 2,
  };
}
