/**
 * Pexels Image Search + S3 Download Service
 * Searches stock photos and saves them to user's media library.
 */

import { uploadToS3 } from "@/lib/utils/s3-client";
import { prisma } from "@/lib/db/client";

const PEXELS_API_URL = "https://api.pexels.com/v1/search";

interface PexelsPhoto {
  id: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  width: number;
  height: number;
}

interface PexelsSearchResult {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
}

export interface ImageSearchResult {
  id: number;
  url: string;
  thumbnailUrl: string;
  downloadUrl: string;
  photographer: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * Search Pexels for stock photos
 */
export async function searchPexels(
  query: string,
  count: number = 6,
  orientation?: "landscape" | "portrait" | "square"
): Promise<ImageSearchResult[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn("[ImageSearch] PEXELS_API_KEY not set");
    return [];
  }

  const params = new URLSearchParams({
    query,
    per_page: String(Math.min(count, 15)),
    ...(orientation && { orientation }),
  });

  try {
    const res = await fetch(`${PEXELS_API_URL}?${params}`, {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      console.error("[ImageSearch] Pexels API error:", res.status, await res.text());
      return [];
    }

    const data: PexelsSearchResult = await res.json();

    return data.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      thumbnailUrl: photo.src.medium,
      downloadUrl: photo.src.large,
      photographer: photo.photographer,
      alt: photo.alt || query,
      width: photo.width,
      height: photo.height,
    }));
  } catch (err) {
    console.error("[ImageSearch] Search failed:", err);
    return [];
  }
}

/**
 * Download an image from URL and save to user's S3 media library
 */
export async function downloadToMediaLibrary(
  imageUrl: string,
  userId: string,
  filename?: string,
  alt?: string
): Promise<string | null> {
  try {
    // Download image
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.error("[ImageSearch] Download failed:", res.status);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpeg";
    const safeName = (filename || `stock-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, "-");
    const key = `media/${userId}/website-images/${safeName}-${Date.now()}.${ext}`;

    // Upload to S3
    const s3Url = await uploadToS3(key, buffer, contentType);

    // Get or create "Website Images" folder
    let folder = await prisma.mediaFolder.findFirst({
      where: { userId, name: "Website Images", parentId: null },
    });
    if (!folder) {
      folder = await prisma.mediaFolder.create({
        data: { userId, name: "Website Images" },
      });
    }

    // Create MediaFile record so it appears in user's media library
    await prisma.mediaFile.create({
      data: {
        userId,
        folderId: folder.id,
        filename: `${safeName}.${ext}`,
        originalName: `${safeName}.${ext}`,
        mimeType: contentType,
        size: buffer.length,
        url: s3Url,
        type: "image",
        width: 0,
        height: 0,
      },
    });

    return s3Url;
  } catch (err) {
    console.error("[ImageSearch] Download to media library failed:", err);
    return null;
  }
}

/**
 * Search and download multiple images in parallel (for AI generation)
 * Returns a map of query -> S3 URL
 */
export async function searchAndDownloadBatch(
  queries: Array<{ query: string; count?: number; orientation?: "landscape" | "portrait" }>,
  userId: string
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  const concurrency = 3;

  // Process in batches
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async ({ query, count = 1, orientation }) => {
        const photos = await searchPexels(query, count, orientation);
        const urls: string[] = [];

        for (const photo of photos.slice(0, count)) {
          const url = await downloadToMediaLibrary(
            photo.downloadUrl,
            userId,
            query.replace(/\s+/g, "-").toLowerCase(),
            photo.alt
          );
          if (url) urls.push(url);
        }

        results.set(query, urls);
      })
    );
  }

  return results;
}
