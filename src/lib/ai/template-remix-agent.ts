import { OpenAIClient } from "./openai-client";

/**
 * Template Remix Agent — gpt-image-1 edit-multi.
 *
 * Takes a finished design (Featured / AI / Premium template) as the
 * PRIMARY composition reference, plus optional user-supplied photos as
 * AUXILIARY references, and produces a flat PNG that:
 *   - Preserves the source design's layout, palette, typography,
 *     decorative elements, and photo-placeholder positions exactly.
 *   - Replaces the placeholder text with the user's custom text.
 *   - Drops the user's photos into the photo placeholders, removing
 *     their backgrounds and matching the original framing style.
 *
 * Output is FLAT (single image) — the same role as "Use as Background"
 * but personalized. For fully-editable Fabric layers, use the heavier
 * template-reproduce-agent (Claude vision + Fabric JSON).
 */

interface RemixOptions {
  /** Source design URL — relative ("/templates/...") or absolute https URL.
   *  Used as gpt-image-1's primary edit reference (controls composition). */
  sourceImageUrl: string;
  /** User's custom text (headline, name, dates, etc.) — overlaid in the
   *  same hierarchy as the original design. Empty = keep original text. */
  customText?: string;
  /** Optional user photos as data:image/* URLs. Up to 4. The model will
   *  drop them into the placeholder slots in order, removing backgrounds
   *  and matching the original framing style (circle/polaroid/rect). */
  userPhotosDataUrls?: string[];
  /** Output size — defaults to a portrait flyer that matches our most
   *  common Featured Template shape. */
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  /** Output quality — high yields better text rendering and detail
   *  preservation. Premium feature, premium quality. */
  quality?: "low" | "medium" | "high";
}

interface RemixResult {
  /** Base64 PNG (no data URI prefix). Caller uploads to S3. */
  b64: string;
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
    // Relative path — resolve against the local app origin so the route
    // works the same in dev and prod.
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

function buildRemixPrompt(opts: { customText: string; numPhotos: number }): string {
  const { customText, numPhotos } = opts;
  const lines: string[] = [];
  lines.push(
    "REMIX TASK — preserve this exact design and personalize it. The FIRST image is the source design (composition reference). DO NOT redesign anything.",
  );
  lines.push("");
  lines.push("MUST PRESERVE EXACTLY from the source:");
  lines.push("- Overall layout, composition, and proportions");
  lines.push("- Color palette (every color, gradient, and tone)");
  lines.push("- Typography: same fonts, sizes, weights, letter-spacing, and text positions");
  lines.push("- Decorative elements: flourishes, ornaments, sparkles, frames, borders, shadows");
  lines.push("- Background style: the same gradient / texture / atmospheric layering");
  lines.push("- Photo-placeholder positions and framing style (circular, polaroid tilt, rectangular, etc.)");
  lines.push("");

  if (customText.trim()) {
    lines.push("REPLACE THE TEXT with the user's content below. Match the same hierarchy, fonts, and positioning as the original — just swap the words. Distribute the lines across the original text positions:");
    lines.push("");
    lines.push(customText.trim());
    lines.push("");
  } else {
    lines.push("Keep the original text content from the source design (do not alter wording).");
    lines.push("");
  }

  if (numPhotos > 0) {
    lines.push(
      `REPLACE THE PHOTO PLACEHOLDERS with the ${numPhotos} reference image${numPhotos > 1 ? "s" : ""} that follow the source. For each:`,
    );
    lines.push("- Cleanly remove the reference's existing background");
    lines.push("- Fit it into the next available photo placeholder in the source design");
    lines.push("- Match the source's framing style EXACTLY (circular crop, polaroid tilt, rectangular border, gold ring, drop shadow, etc.)");
    lines.push("- Match the source's lighting / color tone for cohesion");
    lines.push("");
  } else {
    // Empty-slot path. The user explicitly skipped photo upload — they
    // will drop photos into the slots themselves in the canvas editor
    // after this flat image lands. CRITICAL: don't invent faces.
    lines.push("KEEP THE PHOTO PLACEHOLDERS EMPTY. Render each photo region as a clean, visually-clear empty slot (matching the source's framing — circular ring / polaroid frame / rectangle), filled with a soft neutral tone (light gray or muted complementary color). DO NOT invent specific people, faces, or stock photos. The user will drop their own photos into these slots in the editor.");
    lines.push("");
  }

  lines.push(
    "OUTPUT: a single polished flat image at the source's exact layout and aesthetic, with only the text and photo regions personalized. No extra elements, no labels, no watermarks.",
  );
  return lines.join("\n");
}

export async function remixTemplate(opts: RemixOptions): Promise<RemixResult> {
  const {
    sourceImageUrl,
    customText = "",
    userPhotosDataUrls = [],
    size = "1024x1536",
    quality = "high",
  } = opts;

  // Build the multi-image payload: source first (primary composition),
  // user photos after (auxiliary refs). Cap at 4 user photos so the
  // total payload stays inside gpt-image-1's edit-multi limit (5 imgs).
  const sourceBuf = await loadSourceBuffer(sourceImageUrl);
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
    customText,
    numPhotos: userPhotoBuffers.length,
  });

  const openai = OpenAIClient.getInstance();
  const b64 = await openai.editMultiImage(prompt, payload, { size, quality });

  if (!b64) {
    throw new Error("gpt-image-1 edit-multi returned no image data");
  }

  return { b64, usedUserPhotos: userPhotoBuffers.length > 0 };
}
