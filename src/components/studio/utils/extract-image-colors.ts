"use client";

/**
 * Extract the dominant colors from an image using lightweight color
 * quantization. Renders the image at a small offscreen size, samples
 * every Nth pixel, buckets each into a coarse 5-bit-per-channel grid
 * (32^3 = 32K buckets), then returns the top-K bucket centroids ordered
 * by frequency.
 *
 * 5-bit precision is intentional — full 24-bit RGB has 16.7M buckets
 * which leads to 6 near-duplicate colors. Coarser bucketing gives more
 * visually distinct results that are useful as a designer palette.
 *
 * Pure client-side, no network. Returns up to `count` hex colors.
 */

const SAMPLE_DIM = 200; // resample image to this max dim before reading pixels
const STEP = 4;          // sample every 4th pixel — 16x speedup, no visible loss
const QUANT_BITS = 5;    // 5 bits per channel = 32 levels

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** True for near-white, near-black, and very low-saturation grays — usually
 *  not what designers want as a brand palette. Filtered out unless the only
 *  thing left is grays. */
function isLowInformationColor(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luma < 18) return true; // near black
  if (luma > 240) return true; // near white
  if (max - min < 12) return true; // near gray
  return false;
}

export async function extractImageColors(
  imageSrc: string,
  count = 6,
): Promise<string[]> {
  // Load image (use proxy for cross-origin URLs to avoid tainted canvas)
  let url = imageSrc;
  if (typeof window !== "undefined" && url.startsWith("http") && !url.startsWith(window.location.origin)) {
    url = `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = (e) => reject(e);
    i.src = url;
  });

  // Render to a small canvas to keep the pixel-walk cheap.
  const ratio = img.width / img.height;
  const w = ratio >= 1 ? SAMPLE_DIM : Math.round(SAMPLE_DIM * ratio);
  const h = ratio >= 1 ? Math.round(SAMPLE_DIM / ratio) : SAMPLE_DIM;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  let pixelData: Uint8ClampedArray;
  try {
    pixelData = ctx.getImageData(0, 0, w, h).data;
  } catch {
    // Tainted canvas — proxy didn't catch this URL. Fall back gracefully.
    return [];
  }

  // Quantize to 5 bits per channel and bucket
  const shift = 8 - QUANT_BITS;
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < pixelData.length; i += 4 * STEP) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    const a = pixelData[i + 3];
    if (a < 128) continue; // skip transparent pixels — they'd skew toward black
    const key = ((r >> shift) << (QUANT_BITS * 2)) | ((g >> shift) << QUANT_BITS) | (b >> shift);
    const existing = buckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  // Sort by frequency
  const sorted = Array.from(buckets.values()).sort((a, b) => b.n - a.n);

  // First pass: filter out low-info colors (near-black, near-white, grays)
  const interesting: string[] = [];
  const seen = new Set<string>();
  for (const bucket of sorted) {
    const r = bucket.r / bucket.n;
    const g = bucket.g / bucket.n;
    const b = bucket.b / bucket.n;
    if (isLowInformationColor(r, g, b)) continue;
    const hex = rgbToHex(r, g, b);
    if (!seen.has(hex)) {
      seen.add(hex);
      interesting.push(hex);
      if (interesting.length >= count) break;
    }
  }

  // If we filtered too aggressively (e.g. a B&W photo), back-fill with
  // grays so the user still gets `count` results.
  if (interesting.length < count) {
    for (const bucket of sorted) {
      const r = bucket.r / bucket.n;
      const g = bucket.g / bucket.n;
      const b = bucket.b / bucket.n;
      const hex = rgbToHex(r, g, b);
      if (!seen.has(hex)) {
        seen.add(hex);
        interesting.push(hex);
        if (interesting.length >= count) break;
      }
    }
  }

  return interesting;
}
