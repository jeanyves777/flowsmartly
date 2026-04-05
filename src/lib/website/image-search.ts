/**
 * Image search and download for website generation.
 * Downloads images directly to the site's public/images/ directory.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PEXELS_API_URL = "https://api.pexels.com/v1/search";

interface PexelsPhoto {
  id: number;
  src: { large: string; medium: string };
  photographer: string;
  alt: string;
}

/**
 * Search Pexels for stock photos
 */
export async function searchPexels(query: string, count: number = 3): Promise<Array<{ url: string; alt: string }>> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn("[ImageSearch] PEXELS_API_KEY not set, skipping image search");
    return [];
  }

  try {
    const res = await fetch(`${PEXELS_API_URL}?query=${encodeURIComponent(query)}&per_page=${count}`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []).map((p: PexelsPhoto) => ({
      url: p.src.large,
      alt: p.alt || query,
    }));
  } catch {
    return [];
  }
}

/**
 * Download an image to a site's public/images/ directory
 * Returns the local path (e.g. "/images/hero/banner.jpg")
 */
export async function downloadImageToDir(
  imageUrl: string,
  siteDir: string,
  category: string,
  filename: string
): Promise<string> {
  const dir = join(siteDir, "public", "images", category);
  mkdirSync(dir, { recursive: true });

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = imageUrl.includes(".png") ? "png" : "jpg";
  const safeName = filename.replace(/[^a-zA-Z0-9-_]/g, "-");
  const filePath = join(dir, `${safeName}.${ext}`);

  writeFileSync(filePath, buffer);

  return `/images/${category}/${safeName}.${ext}`;
}
