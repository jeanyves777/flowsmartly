import { OpenAIClient } from "./openai-client";
import sharp from "sharp";

/**
 * Template Remix Agent — gpt-image-1 edit-multi.
 *
 * VISUAL HALF of the personalize-and-remix pipeline. Owns the design
 * composition: preserves the source's layout / palette / decoration,
 * drops user-supplied photos into placeholder slots (or leaves the
 * placeholders looking exactly like the source if no photos), and
 * deliberately RENDERS NO TEXT — the editable text layer is generated
 * separately by template-text-overlay-agent and stacked on top by the
 * frontend. This split exists because gpt-image-1 produces blurry /
 * malformed text and burns the wording in non-editably; Claude's
 * Fabric textboxes give pixel-perfect type AND let the user edit it
 * later (fix typos, swap dates) without redoing the AI step.
 */

interface RemixOptions {
  /** Source design URL — relative ("/templates/...") or absolute https URL.
   *  Used as gpt-image-1's primary edit reference (controls composition). */
  sourceImageUrl: string;
  /** Optional user photos as data:image/* URLs. Up to 4. The model will
   *  drop them into the placeholder slots in order, removing backgrounds
   *  and matching the original framing style (circle/polaroid/rect).
   *  Empty array = leave placeholders looking exactly like the source. */
  userPhotosDataUrls?: string[];
  /** When provided, gpt-image-1 will swap the source's palette for the
   *  user's brand colors while preserving the design's structure. The
   *  caller (route) fetches the BrandKit; this agent just consumes the
   *  hex strings. */
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  /** Output size override. If omitted, the agent picks the gpt-image-1
   *  size whose aspect ratio is closest to the source's, minimizing
   *  letterboxing / stretching. */
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  /** Output quality — high preserves detail / decoration best. */
  quality?: "low" | "medium" | "high";
}

interface RemixResult {
  /** Base64 PNG (no data URI prefix). Caller uploads to S3. */
  b64: string;
  /** Source image as a Buffer — handed back so the caller doesn't have
   *  to refetch it for the parallel text-overlay step. */
  sourceBuffer: Buffer;
  /** Source dimensions in pixels — caller uses these to scale text-
   *  overlay positions (Claude works in source coord space) into the
   *  output canvas coord space. */
  sourceWidth: number;
  sourceHeight: number;
  /** Output dimensions in pixels — what the canvas will be sized to. */
  outputWidth: number;
  outputHeight: number;
  /** True if user supplied photos (used in usage logs). */
  usedUserPhotos: boolean;
}

/**
 * Fetch the source image as a Buffer. Handles both absolute https URLs
 * (S3, CDN) and relative project paths (Featured Templates).
 */
async function loadSourceBuffer(sourceImageUrl: string): Promise<Buffer> {
  let url = sourceImageUrl;
  if (url.startsWith("/")) {
    const base = process.env.NEXT_PUBLIC_APP_URL
      ?? process.env.NEXTAUTH_URL
      ?? "http://localhost:3000";
    url = base.replace(/\/$/, "") + url;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Source image fetch failed (${res.status}): ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Decode a data:image/<type>;base64,<b64> URL into { buffer, mime }. */
function decodeDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  return { buffer: Buffer.from(m[2], "base64"), mime: m[1] };
}

/**
 * Pick the gpt-image-1 size whose aspect ratio is closest to the source's.
 * Available sizes: 1:1, 3:2 (landscape), 2:3 (portrait). Picks whichever
 * minimizes letterbox/stretch on the rendered composition.
 */
function pickSizeForAspect(srcW: number, srcH: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const aspect = srcW / srcH;
  const candidates: Array<{ size: "1024x1024" | "1536x1024" | "1024x1536"; aspect: number }> = [
    { size: "1024x1024", aspect: 1 },
    { size: "1536x1024", aspect: 1.5 },
    { size: "1024x1536", aspect: 1 / 1.5 },
  ];
  let best = candidates[0];
  let bestDelta = Math.abs(Math.log(best.aspect / aspect));
  for (let i = 1; i < candidates.length; i++) {
    const d = Math.abs(Math.log(candidates[i].aspect / aspect));
    if (d < bestDelta) { best = candidates[i]; bestDelta = d; }
  }
  return best.size;
}

function parseSize(size: "1024x1024" | "1536x1024" | "1024x1536"): { w: number; h: number } {
  const [w, h] = size.split("x").map(Number);
  return { w, h };
}

function buildRemixPrompt(opts: {
  numPhotos: number;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
}): string {
  const { numPhotos, brandColors } = opts;
  const lines: string[] = [];

  // Frame the source as STYLE REFERENCE ONLY — not as a base to edit.
  // gpt-image-1 trained on edit tasks naturally tries to PRESERVE the
  // input pixels (which is why it leaks the original text and barely
  // changes the design). Telling it explicitly "this is a style ref,
  // GENERATE A NEW IMAGE inspired by it" gives it permission to produce
  // a fresh composition without trying to preserve every pixel.
  lines.push(
    "GENERATE A NEW IMAGE — do NOT edit the input. The FIRST image is a STYLE REFERENCE ONLY (showing the visual style we want to match). Your output is a brand-new image generated from scratch, inspired by that style.",
  );
  lines.push("");
  lines.push("Treat the reference like a designer's mood-board entry — look at it, absorb the style, then produce your own fresh composition that matches the same visual language. Do NOT trace or preserve the reference's pixels.");
  lines.push("");
  lines.push("STYLE TO MATCH (from the reference):");
  lines.push("- Layout philosophy / composition / proportions");
  if (brandColors && (brandColors.primary || brandColors.secondary || brandColors.accent)) {
    // Brand colors override the reference's palette — keep the same
    // gradient feel and color relationships, just remap the source's
    // hues to the user's brand. Preserves design while making it theirs.
    const palette: string[] = [];
    if (brandColors.primary)   palette.push(`PRIMARY ${brandColors.primary}`);
    if (brandColors.secondary) palette.push(`SECONDARY ${brandColors.secondary}`);
    if (brandColors.accent)    palette.push(`ACCENT ${brandColors.accent}`);
    lines.push(`- Color palette: REPLACE the reference's palette with the user's brand colors — ${palette.join(", ")}. Map the reference's dominant color → primary, secondary color → secondary, highlight/decoration → accent. Keep gradients and color relationships, just swap the hues.`);
  } else {
    lines.push("- Color palette (every color, gradient, and tone)");
  }
  lines.push("- Decorative language: flourishes, ornaments, sparkles, frames, borders, shadows");
  lines.push("- Background treatment: gradient / texture / atmospheric layering");
  lines.push("- Photo-placeholder positions and framing style (circular, polaroid tilt, rectangular, gold ring, drop shadow, etc.)");
  lines.push("");

  // CRITICAL — text is handled by a separate editable Fabric layer.
  // gpt-image-1 must produce a clean text-free composition so the
  // Claude overlay sits on a clean base. Where text was, the bg
  // should FLOW THROUGH naturally — not be replaced by a placeholder
  // rectangle/box (gpt-image-1's default failure mode).
  lines.push("CRITICAL — RENDER NO TEXT and NO TEXT-PLACEHOLDER BOXES:");
  lines.push("- DO NOT render any letters, words, characters, numbers, or readable typography in the output.");
  lines.push("- DO NOT draw gray rounded rectangles, white boxes, dashed frames, or any other 'placeholder' shape where the text was. The bg gradient/decoration should FLOW THROUGH that region naturally — as if the text was simply never there.");
  lines.push("- Editable text is added on top as a separate layer by Claude — your job is the visual composition only.");
  lines.push("- DO NOT include any LOGOS, WORDMARKS, BRAND ICONS, or organization names from the reference. Those are brand-specific to the original design and must NOT appear in the output. Treat them like text — leave that region blended into the bg.");
  lines.push("");

  if (numPhotos > 0) {
    lines.push(
      `PHOTO PLACEHOLDERS — drop the ${numPhotos} reference image${numPhotos > 1 ? "s" : ""} that follow the style-reference into the placeholders:`,
    );
    lines.push("- Cleanly remove each photo's existing background");
    lines.push("- Fit it into the next available photo placeholder in the new design");
    lines.push("- Match the style-reference's framing EXACTLY (circular crop, polaroid tilt, rectangular border, gold ring, drop shadow, etc.)");
    lines.push("- Match the style-reference's lighting / color tone for cohesion");
    lines.push("");
  } else {
    // CRITICAL — no photos provided. The reference's photo regions
    // should BLEND into the bg, not be replaced by gray fills/circles.
    lines.push("PHOTO PLACEHOLDERS — NO USER PHOTOS PROVIDED:");
    lines.push("- LEAVE THE PHOTO REGIONS BLENDED INTO THE BACKGROUND. The bg gradient and decoration should FLOW THROUGH those regions naturally — as if the photo placeholders were not there at all.");
    lines.push("- DO NOT draw gray circles, gray rounded rectangles, white shapes, dashed-border frames, solid color fills, or ANY new placeholder shape where photos would go. The output should NOT advertise that there are empty photo slots.");
    lines.push("- DO NOT invent specific people, faces, or stock photos.");
    lines.push("- The user will add their own photos later via the editor by clicking on the area where they want the photo.");
    lines.push("");
  }

  lines.push(
    "OUTPUT: a single polished flat image — a fresh new composition inspired by the style-reference, with NO TEXT and photo placeholders rendered per the rules above. No extra elements, no labels, no watermarks.",
  );
  return lines.join("\n");
}

export async function remixTemplate(opts: RemixOptions): Promise<RemixResult> {
  const {
    sourceImageUrl,
    userPhotosDataUrls = [],
    brandColors,
    size: sizeOverride,
    quality = "high",
  } = opts;

  // Fetch source and probe dimensions (sharp metadata is fast — no
  // pixel processing, just header read).
  const sourceBuf = await loadSourceBuffer(sourceImageUrl);
  const meta = await sharp(sourceBuf).metadata();
  const sourceWidth = meta.width || 1024;
  const sourceHeight = meta.height || 1024;

  // Pick output size by aspect match unless explicitly overridden.
  const size = sizeOverride ?? pickSizeForAspect(sourceWidth, sourceHeight);
  const { w: outputWidth, h: outputHeight } = parseSize(size);

  const cappedPhotos = userPhotosDataUrls.slice(0, 4);
  const userPhotoBuffers = cappedPhotos
    .map((url, i) => {
      const decoded = decodeDataUrl(url);
      if (!decoded) return null;
      const ext = decoded.mime.split("/")[1].replace("+xml", "").slice(0, 4);
      return {
        buffer: decoded.buffer,
        filename: `photo-${i + 1}.${ext === "jpeg" ? "jpg" : ext}`,
        type: decoded.mime,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const payload = [
    { buffer: sourceBuf, filename: "source.png", type: "image/png" },
    ...userPhotoBuffers,
  ];

  const prompt = buildRemixPrompt({
    numPhotos: userPhotoBuffers.length,
    brandColors,
  });

  const openai = OpenAIClient.getInstance();
  const b64 = await openai.editMultiImage(prompt, payload, { size, quality });

  if (!b64) {
    throw new Error("gpt-image-1 edit-multi returned no image data");
  }

  return {
    b64,
    sourceBuffer: sourceBuf,
    sourceWidth,
    sourceHeight,
    outputWidth,
    outputHeight,
    usedUserPhotos: userPhotoBuffers.length > 0,
  };
}
