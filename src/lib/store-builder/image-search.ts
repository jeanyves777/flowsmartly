/**
 * Image search and download for store generation.
 * Extends the website builder's image search with product-specific features.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PEXELS_API_URL = "https://api.pexels.com/v1/search";

interface PexelsPhoto {
  id: number;
  src: { large: string; medium: string; original: string };
  photographer: string;
  alt: string;
}

/**
 * Search Pexels for product images.
 * Adds "product" context to queries for better results.
 */
export async function searchProductImages(
  query: string,
  count: number = 3
): Promise<Array<{ url: string; alt: string; photographer: string }>> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn("[StoreImageSearch] PEXELS_API_KEY not set, skipping image search");
    return [];
  }

  try {
    // Add "product" keyword for better product photography results
    const searchQuery = `${query} product`;
    const res = await fetch(
      `${PEXELS_API_URL}?query=${encodeURIComponent(searchQuery)}&per_page=${count}&orientation=square`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []).map((p: PexelsPhoto) => ({
      url: p.src.large,
      alt: p.alt || query,
      photographer: p.photographer,
    }));
  } catch {
    return [];
  }
}

/**
 * Search Pexels for general store images (hero, categories, about).
 */
export async function searchStoreImages(
  query: string,
  count: number = 3
): Promise<Array<{ url: string; alt: string }>> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `${PEXELS_API_URL}?query=${encodeURIComponent(query)}&per_page=${count}`,
      { headers: { Authorization: apiKey } }
    );
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
 * Download an image to a store's public/images/ directory.
 * Returns the local path (e.g. "/images/products/desk-lamp.jpg")
 */
export async function downloadImageToStoreDir(
  imageUrl: string,
  storeDir: string,
  category: string,
  filename: string
): Promise<string> {
  const dir = join(storeDir, "public", "images", category);
  mkdirSync(dir, { recursive: true });

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());

  // Determine extension from URL or content-type
  let ext = "jpg";
  if (imageUrl.includes(".png")) ext = "png";
  else if (imageUrl.includes(".webp")) ext = "webp";

  const safeName = filename.replace(/[^a-zA-Z0-9-_]/g, "-");
  const filePath = join(dir, `${safeName}.${ext}`);
  writeFileSync(filePath, buffer);

  return `/images/${category}/${safeName}.${ext}`;
}
