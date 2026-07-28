/**
 * Voice Studio — PRESENTER IMAGE validation + framing for HeyGen Avatar IV.
 *
 * HeyGen cuts the head off when it gets a raw/oddly-cropped photo. The Training presenter has
 * NEVER had this because it always hands HeyGen the SAME shape: a 1280x720 (16:9) COVER crop
 * anchored to the TOP — a consistent upper-body headshot HeyGen frames cleanly. This centralises
 * that (so oncam + Training share one proven path) and adds validation so a broken/oddly-oriented
 * upload fails fast with a clear message instead of producing a mangled take. [[training-presenter-talking-video]]
 */
import sharp from "sharp";

export class PresenterImageError extends Error {}

/**
 * Validate a presenter photo and return a HeyGen-ready JPEG (1280x720, top-anchored cover, EXIF
 * honoured, alpha flattened). Throws PresenterImageError (user-facing) for an unusable image.
 */
export async function framePresenterForHeyGen(buffer: Buffer): Promise<Buffer> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer, { failOn: "none" }).metadata();
  } catch {
    throw new PresenterImageError("That presenter photo couldn't be read. Upload a clear JPG or PNG of your upper body.");
  }
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < 256 || h < 256) {
    throw new PresenterImageError("That presenter photo is too small. Use a larger, clear upper-body photo (at least 256px).");
  }
  try {
    return await sharp(buffer, { failOn: "none" })
      .rotate() // honour EXIF orientation so a phone photo isn't sideways
      .flatten({ background: "#0b1330" }) // drop any alpha so a transparent PNG isn't see-through
      .resize(1280, 720, { fit: "cover", position: "top" }) // consistent upper-body headshot — no cutoff
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch {
    throw new PresenterImageError("That presenter photo couldn't be processed. Try a different, clear upper-body photo.");
  }
}
