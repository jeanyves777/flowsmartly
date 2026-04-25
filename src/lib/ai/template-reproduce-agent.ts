import { readFileSync } from "fs";
import { join } from "path";
import { OpenAIClient } from "./openai-client";

/**
 * Template Remix Agent — single-pass gpt-image-1 image-edit pipeline.
 *
 * Replaces the original multi-layer "vision + N parallel image gens +
 * Fabric primitives" approach which produced fragmented, badly-composed
 * output (the agent kept emitting overlapping rects, mis-positioned
 * text, and crops of regenerated photos that never recomposed cleanly).
 *
 * New pipeline:
 *   1. Read source template image bytes.
 *   2. Build ONE prompt with: user copy to substitute, brand colors to
 *      apply, and instructions to preserve composition / typography.
 *   3. Call openai.images.edit with [source, ...userReferenceImages].
 *      gpt-image-1 internally handles layout, text rendering, and
 *      photo substitution in a single rendering pass. One coherent
 *      output > a hundred Fabric primitives glued together.
 *   4. Return ONE base64 PNG.
 *
 * The frontend drops this PNG as a single full-canvas image. The user
 * adds their own text/elements on top if they want extra customization
 * — but the rendered image already has their copy + colors baked in.
 *
 * Cost: 1 image edit ($0.04-0.08) — way cheaper than the old approach
 * which spent $0.05 on Claude vision + 3-8 image gens at $0.02-0.05 each.
 */

export interface RemixOptions {
  /** User-supplied copy that should appear in the rendered design. */
  customText?: string;
  /** Optional BrandKit colors to apply. */
  brandColors?: { primary?: string; secondary?: string; accent?: string } | null;
  /** User-uploaded photos to substitute for the design's stock people/products. */
  referenceImages?: string[];
}

export interface RemixResult {
  /** Base64-encoded PNG, ready to drop on the canvas as a full background image. */
  imageBase64: string;
  /** Source template's natural dimensions — frontend matches canvas to these. */
  width: number;
  height: number;
}

export async function reproduceTemplate(
  imageUrl: string,
  options: RemixOptions = {},
): Promise<RemixResult> {
  const { customText, brandColors, referenceImages = [] } = options;

  console.log(`[TemplateRemix] start url=${imageUrl} text=${!!customText} brand=${!!brandColors} refs=${referenceImages.length}`);

  // Pull source bytes + figure out aspect for sizing the gpt-image-1 output.
  const source = await loadImageBuffer(imageUrl);
  const targetSize = pickClosestSize(source.width, source.height);

  // Decode any user reference images from data URLs.
  const refBuffers = referenceImages
    .map((dataUrl, i) => {
      const m = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (!m) return null;
      return {
        buffer: Buffer.from(m[2], "base64"),
        filename: `ref-${i}.${m[1] === "image/png" ? "png" : "jpg"}`,
        type: m[1],
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Build the edit prompt. Direct, opinionated, biased toward preserving
  // the source's composition and typography — gpt-image-1's text
  // rendering is reliable when you describe the layout precisely.
  const prompt = buildPrompt({ customText, brandColors, hasReferenceImages: refBuffers.length > 0 });
  console.log(`[TemplateRemix] prompt: ${prompt.slice(0, 200)}...`);

  const openai = OpenAIClient.getInstance();
  const allImages = [
    { buffer: source.buffer, filename: "template.png", type: source.mediaType },
    ...refBuffers,
  ];

  const b64 = await openai.editMultiImage(prompt, allImages, {
    size: targetSize,
    quality: "high",
  });
  if (!b64) throw new Error("Image edit returned no data");

  console.log(`[TemplateRemix] done — ${b64.length} chars of base64`);

  return {
    imageBase64: b64,
    width: source.width,
    height: source.height,
  };
}

// ─── helpers ───────────────────────────────────────────────────────────

function buildPrompt(opts: {
  customText?: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string } | null;
  hasReferenceImages: boolean;
}): string {
  const parts: string[] = [
    "Recreate the supplied template design (FIRST image attached) as a polished, professional, high-resolution flat design.",
    "Preserve the EXACT layout, composition, typography style, decorative elements, and overall aesthetic of the source.",
    "Do not add commentary, watermarks, signatures, or extra elements not in the source.",
  ];

  if (opts.customText && opts.customText.trim()) {
    parts.push(
      `Replace the source's text with the following copy. Map each line/phrase to the most appropriate slot in the design (headline → main display, names → name slot, dates → date block, etc.). Render text crisply with no garbled characters, using fonts that match the source's typography vibe:\n"""\n${opts.customText.trim().slice(0, 1500)}\n"""`,
    );
  } else {
    parts.push("Keep the source's text as-is — do not change wording.");
  }

  if (opts.brandColors && (opts.brandColors.primary || opts.brandColors.secondary || opts.brandColors.accent)) {
    const palette = [
      opts.brandColors.primary && `primary ${opts.brandColors.primary}`,
      opts.brandColors.secondary && `secondary ${opts.brandColors.secondary}`,
      opts.brandColors.accent && `accent ${opts.brandColors.accent}`,
    ]
      .filter(Boolean)
      .join(", ");
    parts.push(
      `Apply these brand colors throughout: ${palette}. Use primary for main display text and large fills, secondary for sub-headings and decorative shapes, accent for callouts/dividers/badges. Maintain strong text contrast.`,
    );
  }

  if (opts.hasReferenceImages) {
    parts.push(
      "The remaining attached images are user-supplied photos (people, products, scenes). Use them in the design INSTEAD of the original photography — match each user photo to the most natural slot in the layout. If a slot has no matching user photo, regenerate something complementary.",
    );
  } else {
    parts.push(
      "If the source contains photos of people or products, regenerate them in a similar style — keep race/age/gender/wardrobe of any people roughly consistent with the source.",
    );
  }

  parts.push("Output a single, clean, complete design — no surrounding white space, no thumbnails, no labels.");

  return parts.join("\n\n");
}

interface ImageBuffer {
  buffer: Buffer;
  width: number;
  height: number;
  mediaType: string;
}

async function loadImageBuffer(imageUrl: string): Promise<ImageBuffer> {
  let buf: Buffer;
  let mediaType: string;
  if (imageUrl.startsWith("/")) {
    const p = join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
    buf = readFileSync(p);
    mediaType = inferMediaType(imageUrl);
  } else {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch source image (${res.status}): ${imageUrl}`);
    buf = Buffer.from(await res.arrayBuffer());
    mediaType = res.headers.get("content-type") || inferMediaType(imageUrl);
  }
  // Get dimensions via sharp (already a dep) so we know the canvas aspect.
  // Fallback to 1080×1080 if metadata read fails.
  let width = 1080;
  let height = 1080;
  try {
    const sharp = (await import("sharp")).default;
    const md = await sharp(buf).metadata();
    if (md.width && md.height) {
      width = md.width;
      height = md.height;
    }
  } catch (err) {
    console.warn(`[TemplateRemix] sharp metadata failed, falling back to 1080×1080:`, err);
  }
  return { buffer: buf, width, height, mediaType };
}

function inferMediaType(url: string): string {
  if (/\.png(\?|$)/i.test(url)) return "image/png";
  if (/\.webp(\?|$)/i.test(url)) return "image/webp";
  return "image/jpeg";
}

// gpt-image-1 only supports a small set of sizes. Pick the one closest
// to the source's aspect — over-sampling and letting Fabric scale down
// gives a sharp result.
function pickClosestSize(w: number, h: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const ar = w / h;
  if (ar >= 1.25) return "1536x1024";
  if (ar <= 0.8) return "1024x1536";
  return "1024x1024";
}
