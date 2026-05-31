import crypto from "crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db/client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { getNiche } from "./niches";

/**
 * Free, license-free image pool for synthetic POSTS. Filled ONCE per niche and
 * stored on OUR OWN S3, so when a bot publishes a post it just reads a row from
 * this pool — ZERO per-post API calls, ZERO credits, no paid image generation.
 *
 * Sources (no API key, no cost):
 *  - LoremFlickr  → Creative-Commons Flickr photos matching niche keywords.
 *  - Picsum       → generic free photographs (fallback when LoremFlickr 404s).
 */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchImage(niche: string, salt: number): Promise<Buffer | null> {
  const kw = getNiche(niche).mediaKeywords;
  const tags = [pick(kw), pick(kw)].join(",");
  const candidates = [
    `https://loremflickr.com/800/800/${encodeURIComponent(tags)}?lock=${salt}`,
    `https://picsum.photos/seed/${niche}${salt}/800/800`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; FlowSmartly/1.0)" },
        redirect: "follow",
        cache: "no-store",
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 3000) continue;
      return buf;
    } catch {
      // try next source
    }
  }
  return null;
}

/**
 * Seed up to `count` images into the pool for a niche. Idempotent-ish: skips
 * exact-duplicate images by content hash. Returns how many new assets were added.
 */
export async function seedMediaPool(niche: string, count: number): Promise<number> {
  let added = 0;
  for (let i = 0; i < count * 2 && added < count; i++) {
    const raw = await fetchImage(niche, Date.now() + i);
    if (!raw) continue;
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    const exists = await prisma.syntheticMediaAsset.findUnique({ where: { hash } });
    if (exists) continue;
    try {
      const webp = await sharp(raw)
        .resize(1080, 1080, { fit: "cover" })
        .webp({ quality: 82 })
        .toBuffer();
      const key = `synthetic/posts/${niche}/${hash.slice(0, 16)}.webp`;
      const url = await uploadToS3(key, webp, "image/webp");
      await prisma.syntheticMediaAsset.create({
        data: { niche, url, hash, source: "freepool" },
      });
      added++;
    } catch {
      // skip this image
    }
  }
  return added;
}

/** Pick a random pool image for a niche (least-used first for even spread). */
export async function pickMediaAsset(niche: string): Promise<string | null> {
  const candidates = await prisma.syntheticMediaAsset.findMany({
    where: { niche },
    orderBy: { usedCount: "asc" },
    take: 12,
  });
  if (candidates.length === 0) return null;
  const chosen = pick(candidates);
  await prisma.syntheticMediaAsset
    .update({ where: { id: chosen.id }, data: { usedCount: { increment: 1 } } })
    .catch(() => {});
  return chosen.url;
}

export async function mediaPoolCounts(): Promise<Record<string, number>> {
  const rows = await prisma.syntheticMediaAsset.groupBy({
    by: ["niche"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.niche] = r._count._all;
  return out;
}
