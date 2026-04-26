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

function buildRemixPrompt(opts: { numPhotos: number }): string {
  const { numPhotos } = opts;
  const lines: string[] = [];
  lines.push(
    "REMIX TASK — preserve this exact design composition. The FIRST image is the source design (composition reference). DO NOT redesign anything.",
  );
  lines.push("");
  lines.push("MUST PRESERVE EXACTLY from the source:");
  lines.push("- Overall layout, composition, and proportions");
  lines.push("- Color palette (every color, gradient, and tone)");
  lines.push("- Decorative elements: flourishes, ornaments, sparkles, frames, borders, shadows");
  lines.push("- Background style: the same gradient / texture / atmospheric layering");
  lines.push("- Photo-placeholder positions and framing style (circular, polaroid tilt, rectangular, gold ring, drop shadow, etc.)");
  lines.push("");

  // CRITICAL — text is handled by a separate editable Fabric layer.
  // gpt-image-1 must produce a clean text-free composition so the
  // overlay sits on a clean base.
  lines.push("CRITICAL — RENDER NO TEXT:");
  lines.push("- DO NOT render any letters, words, characters, numbers, or readable typography in the output.");
  lines.push("- Where text appears in the source, leave that region COMPLETELY EMPTY/BLANK — preserve the surrounding decoration and color, but no text glyphs.");
  lines.push("- Editable text will be added on top as a separate layer — your job is the visual composition only.");
  lines.push("- Treat any logos / wordmarks / icons in the source as decoration (keep them rendered).");
  lines.push("");

  if (numPhotos > 0) {
    lines.push(
      `PHOTO PLACEHOLDERS — drop the ${numPhotos} reference image${numPhotos > 1 ? "s" : ""} that follow the source into the placeholders:`,
    );
    lines.push("- Cleanly remove each reference photo's existing background");
    lines.push("- Fit it into the next available photo placeholder in the source design");
    lines.push("- Match the source's framing style EXACTLY (circular crop, polaroid tilt, rectangular border, gold ring, drop shadow, etc.)");
    lines.push("- Match the source's lighting / color tone for cohesion");
    lines.push("");
  } else {
    // CRITICAL — no photos provided. Don't add gray fills or new shapes.
    // Keep the placeholders looking IDENTICAL to the source so the user
    // can drop their own photos into them naturally in the canvas editor.
    lines.push("PHOTO PLACEHOLDERS — NO USER PHOTOS PROVIDED:");
    lines.push("- KEEP THE PLACEHOLDERS LOOKING IDENTICAL to the source — same fill, same framing, same decoration around them.");
    lines.push("- DO NOT add gray circles, solid color fills, dashed borders, or any new shapes/styling that wasn't in the source.");
    lines.push("- DO NOT invent specific people, faces, or stock photos.");
    lines.push("- The user will drop their own photos into the placeholders later in the editor — leave them naturally exactly as the source has them.");
    lines.push("");
  }

  lines.push(
    "OUTPUT: a single polished flat image matching the source's exact layout and aesthetic, with NO TEXT, and photo placeholders treated per the rules above. No extra elements, no labels, no watermarks.",
  );
  return lines.join("\n");
}

export async function remixTemplate(opts: RemixOptions): Promise<RemixResult> {
  const {
    sourceImageUrl,
    userPhotosDataUrls = [],
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

  const prompt = buildRemixPrompt({ numPhotos: userPhotoBuffers.length });

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
