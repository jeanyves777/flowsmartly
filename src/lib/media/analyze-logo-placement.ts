import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const VISION_MODEL = process.env.FLOWCREATIVE_VISION_MODEL || "claude-haiku-4-5";
const VISION_MAX_BYTES = 4_800_000; // Claude vision input cap (~5 MB)

const primaryAnthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
const backupAnthropic = process.env.ANTHROPIC_BACKUP_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_BACKUP_API_KEY })
  : null;

// Bottom corners are intentionally excluded — user feedback: logo always
// at top. Bottom areas usually carry the contact pills / hashtags /
// caption-style text strip the AI renders, so putting the logo down
// there fights for space and often overlaps.
export type LogoCorner = "top-left" | "top-right";

export interface LogoPlacement {
  corner: LogoCorner;
  /** x as 0-1 fraction of image width (top-left of logo bounding box). */
  x: number;
  /** y as 0-1 fraction of image height (top-left of logo bounding box). */
  y: number;
  sizePercent: number;
  /** "vision" if Claude picked it, "fallback" if vision unavailable / failed. */
  source: "vision" | "fallback";
  reason?: string;
}

// Logo kept SMALL (15% of width) so it tucks into a corner without dominating
// or covering the headline. top-right x leaves a ~15% logo flush near the right
// edge with a small margin.
const CORNER_TO_PLACEMENT: Record<LogoCorner, { x: number; y: number; sizePercent: number }> = {
  "top-left": { x: 0.04, y: 0.035, sizePercent: 13 },
  "top-right": { x: 0.84, y: 0.035, sizePercent: 13 },
};

async function shrinkForVision(buffer: Buffer): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  let working = buffer;
  let attempt = 0;
  const targets = [1600, 1200, 900, 700];
  while (working.length > VISION_MAX_BYTES && attempt < targets.length) {
    working = await sharp(buffer)
      .resize(targets[attempt], targets[attempt], { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    attempt += 1;
  }
  if (working === buffer) {
    // First-pass downscale even when under cap, to keep latency low.
    working = await sharp(buffer)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  }
  return { base64: working.toString("base64"), mediaType: "image/jpeg" };
}

// Convention: brand logos sit in the TOP-LEFT. Default there unless the left
// corner is genuinely occupied (vision decides).
const FALLBACK: LogoPlacement = {
  corner: "top-left",
  ...CORNER_TO_PLACEMENT["top-left"],
  source: "fallback",
};

/**
 * Ask a vision model where it's safe to drop a small brand-logo overlay on
 * the generated image. Returns one of four corners (top-left, top-right,
 * bottom-left, bottom-right) plus 0-1 x/y fractions ready for
 * compositeBrandLogoOnImageBuffer.
 *
 * Replaces the previous random-corner picker, which gambled and frequently
 * landed the logo on top of body text or subject faces. Falls back to
 * top-right when Claude is unavailable or the response can't be parsed.
 */
export async function analyzeLogoPlacement(
  imageBuffer: Buffer,
): Promise<LogoPlacement> {
  const clients = [primaryAnthropic, backupAnthropic].filter(Boolean) as Anthropic[];
  if (clients.length === 0) return FALLBACK;

  let shrunk: { base64: string; mediaType: "image/jpeg" };
  try {
    shrunk = await shrinkForVision(imageBuffer);
  } catch (err) {
    console.warn("[analyze-logo-placement] shrink failed:", err);
    return FALLBACK;
  }

  const prompt = `Pick the TOP corner to drop a SMALL brand logo (about 15% of the image width, positioned 3-5% from the chosen edges).

CONVENTION: brand logos belong in the TOP-LEFT. Strongly PREFER top-left. Only choose top-right if the top-left corner is genuinely occupied — i.e. the small logo there would overlap a headline, other text, a face, or the main subject. When in doubt, or if both corners are equally clear, choose top-left.

The logo MUST NOT overlap with ANY of the following in the chosen corner area:
- ANY text, anywhere, of any kind (headline, body copy, captions, contact info, brand names, wordmarks, decorative typography, callouts, labels, numbers, dates, hex codes, watermarks)
- Faces, eyes, or any human / character feature
- The primary visual subject of the scene
- High-detail decorative elements (intricate patterns, complex icons)

Choose ONLY between top-left and top-right — bottom corners are reserved for other elements and are not options.

Return strict JSON ONLY (no preamble, no markdown): {"corner": "top-left" | "top-right", "reason": "short one-line explanation describing what's in that corner"}.`;

  for (const client of clients) {
    try {
      const response = await client.messages.create({
        model: VISION_MODEL as Parameters<typeof client.messages.create>[0]["model"],
        max_tokens: 150,
        system:
          "You are a brand designer. Pick the safest corner for a small logo overlay. Return strict JSON only.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: shrunk.mediaType, data: shrunk.base64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });

      const text = response.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("\n")
        .trim();

      // Try to extract JSON even if model wrapped it.
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as { corner?: string; reason?: string };
      const corner = parsed.corner as LogoCorner | undefined;
      if (corner && corner in CORNER_TO_PLACEMENT) {
        return {
          corner,
          ...CORNER_TO_PLACEMENT[corner],
          source: "vision",
          reason: parsed.reason,
        };
      }
    } catch (err) {
      console.warn(
        "[analyze-logo-placement] vision call failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return FALLBACK;
}
