import crypto from "crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db/client";
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
  maxTries = 2
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

/**
 * Trickle AI faces onto synthetic personas that don't have one yet. Self-
 * throttling (`delayMs` between fetches) so the free face source isn't hammered.
 * Safe to run repeatedly — it only touches personas with a null avatar. Designed
 * to run fire-and-forget in the background after `createPersonas()`.
 */
export async function backfillAvatars(
  max = 1000,
  delayMs = 2500
): Promise<{ filled: number; attempted: number }> {
  const targets = await prisma.user.findMany({
    where: { isSynthetic: true, avatarUrl: null, deletedAt: null },
    select: { id: true },
    take: max,
  });

  const seenHashes = new Set<string>();
  let filled = 0;
  let consecutiveFailures = 0;

  for (const u of targets) {
    const avatar = await fetchUniqueAvatar(u.id, seenHashes);
    if (avatar) {
      await prisma.user
        .update({ where: { id: u.id }, data: { avatarUrl: avatar.url } })
        .catch(() => {});
      filled++;
      consecutiveFailures = 0;
      await sleep(delayMs);
    } else {
      // Source is throttling — back off progressively, then keep trying.
      consecutiveFailures++;
      await sleep(Math.min(30000, delayMs * (1 + consecutiveFailures)));
    }
  }

  return { filled, attempted: targets.length };
}
