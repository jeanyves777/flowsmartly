import sharp from "sharp";
import { getPresignedUrl } from "@/lib/utils/s3-client";

/**
 * Fetch an image (data URI, S3-managed URL/key, or public http URL) into a
 * Buffer. S3-managed sources are presigned first so private objects resolve.
 * Shared by read_image and the agent loop's image-memory re-injection so the
 * presign logic lives in one place.
 */
export async function loadImageBuffer(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) {
    const b64 = src.replace(/^data:[^;]+;base64,/, "");
    if (!b64) throw new Error("Invalid image data URI");
    return Buffer.from(b64, "base64");
  }
  const storageUrl = process.env.NEXT_PUBLIC_STORAGE_URL || "";
  const looksManaged =
    src.includes(".amazonaws.com/") || (storageUrl !== "" && src.startsWith(storageUrl)) || !src.startsWith("http");
  const fetchUrl = looksManaged ? await getPresignedUrl(src) : src;
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Load an image URL and normalize it to a base64 JPEG suitable for Claude
 * vision (re-injection on a follow-up turn / after a reload). Never throws —
 * returns null on any failure so a missing/expired image can't break the
 * agent loop (see feedback-no-stuck-ai-chat).
 */
export async function loadImageAsVisionBase64(
  src: string,
): Promise<{ base64: string; mediaType: "image/jpeg" } | null> {
  try {
    const buffer = await loadImageBuffer(src);
    // 1568px is Anthropic's recommended max long edge for vision.
    const shrunk = await sharp(buffer)
      .rotate()
      .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { base64: shrunk.toString("base64"), mediaType: "image/jpeg" };
  } catch (e) {
    console.error("[flow-agent] loadImageAsVisionBase64 failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
