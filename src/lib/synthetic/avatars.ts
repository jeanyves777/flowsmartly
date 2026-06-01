import crypto from "crypto";
import sharp from "sharp";
import { uploadToS3 } from "@/lib/utils/s3-client";

/**
 * Avatar faces for synthetic personas are AI-generated images of people who do
 * not exist. Source: thispersondoesnotexist.com (free, no API key, no credits)
 * — each GET returns a fresh StyleGAN face. We hash + dedup, re-encode to WebP
 * via sharp, and upload to OUR OWN S3 so we never hot-link an external URL.
 */

const FACE_URL = "https://thispersondoesnotexist.com/";

async function fetchFaceBuffer(): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // never hang the loop
  try {
    const res = await fetch(FACE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FlowSmartly/1.0)" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);
    if (buf.length < 5000) return null; // guard against error pages
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a unique AI face, re-encode to a 512×512 WebP, upload to S3.
 * `seenHashes` lets the caller dedup across a batch (StyleGAN can repeat).
 * Returns the S3 URL + the content hash, or null on failure.
 */
export async function fetchUniqueAvatar(
  userId: string,
  seenHashes: Set<string>,
  maxTries = 4
): Promise<{ url: string; hash: string } | null> {
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const raw = await fetchFaceBuffer();
    if (!raw) {
      await sleep(400);
      continue;
    }
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    if (seenHashes.has(hash)) {
      await sleep(300);
      continue; // duplicate face — refetch
    }
    try {
      const webp = await sharp(raw)
        .resize(512, 512, { fit: "cover" })
        .webp({ quality: 88 })
        .toBuffer();
      const key = `synthetic/avatars/${userId}/${hash.slice(0, 16)}.webp`;
      const url = await uploadToS3(key, webp, "image/webp");
      seenHashes.add(hash);
      return { url, hash };
    } catch {
      await sleep(300);
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
