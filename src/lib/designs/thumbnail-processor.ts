import crypto from "crypto";
import sharp from "sharp";
import { uploadToS3 } from "@/lib/utils/s3-client";

const DATA_URL_RE = /^data:([^;]+);base64,(.+)$/;
const MAX_DIM = 1200;
const WEBP_QUALITY = 92;

/**
 * Re-encodes a client-submitted design thumbnail into an optimized WebP
 * and uploads it to S3. The key is content-addressed (sha256 of the input
 * buffer) so identical thumbnails deduplicate automatically and repeated
 * saves of an unchanged canvas don't create orphaned S3 objects.
 *
 * Strategy: the client sends a lossless full-res PNG so every pixel of
 * text survives. The server resizes to display-reasonable dimensions and
 * encodes as WebP at quality 92 — crisp for both photographic content
 * and rendered text, while keeping the stored URL small enough for
 * Next.js Image to optimize per-viewport.
 *
 * Falls through unchanged if the input is already a URL (not a data URL)
 * or malformed. Callers should wrap in .catch(() => originalInput) so a
 * transient S3 failure never loses the design.
 */
export async function processDesignThumbnail(
  input: string,
  userId: string
): Promise<string> {
  if (!input || !input.startsWith("data:")) return input;

  const match = input.match(DATA_URL_RE);
  if (!match) return input;

  const inputBuffer = Buffer.from(match[2], "base64");
  if (inputBuffer.byteLength === 0) return input;

  const hash = crypto
    .createHash("sha256")
    .update(inputBuffer)
    .digest("hex")
    .slice(0, 16);

  const optimized = await sharp(inputBuffer)
    .rotate()
    .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toBuffer();

  const key = `designs/${userId}/${hash}.webp`;
  return uploadToS3(key, optimized, "image/webp");
}
