import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readFile } from "fs/promises";
import path from "path";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET || "flowsmartly-media";
const STORAGE_URL =
  process.env.NEXT_PUBLIC_STORAGE_URL ||
  `https://${BUCKET}.s3.${process.env.AWS_REGION || "us-east-2"}.amazonaws.com`;

/**
 * Upload a Buffer to S3 and return the public URL.
 */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${STORAGE_URL}/${key}`;
}

/**
 * Delete an object from S3 by its key.
 */
export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

/**
 * Read a local file and upload it to S3.
 * Used by the cartoon pipeline which needs local files for FFmpeg
 * but wants S3 URLs for user-facing output.
 */
export async function uploadLocalFileToS3(
  localPath: string,
  key: string
): Promise<string> {
  const buffer = await readFile(localPath);
  const contentType = getContentType(localPath);
  return uploadToS3(key, buffer, contentType);
}

/**
 * Convert an S3 URL or local /uploads/ path to a local filesystem path.
 * During the cartoon pipeline, files exist both locally and on S3.
 * FFmpeg needs local paths, so this resolves any URL format to the local copy.
 */
export function resolveToLocalPath(urlOrPath: string): string {
  // S3 URL → local path
  if (urlOrPath.startsWith(STORAGE_URL)) {
    const key = urlOrPath.slice(STORAGE_URL.length + 1); // e.g. "cartoons/jobId-scene-1.png"
    return path.join(process.cwd(), "public", "uploads", key);
  }
  // Relative /uploads/ path → absolute local path
  if (urlOrPath.startsWith("/uploads/")) {
    return path.join(process.cwd(), "public", urlOrPath);
  }
  // Relative /characters/ path → absolute local path (character library assets)
  if (urlOrPath.startsWith("/characters/")) {
    return path.join(process.cwd(), "public", urlOrPath);
  }
  // Already an absolute path or something else
  return urlOrPath;
}

/**
 * Check if a string looks like a bare S3 key (not a full URL or path).
 * Matches patterns like "media/abc.png", "cartoons/xyz.mp4", "uploads/foo.jpg"
 */
function isS3Key(str: string): boolean {
  // Must not be a URL, path, or empty
  if (!str || str.startsWith("http") || str.startsWith("/") || str.startsWith("data:")) return false;
  // Must contain a slash (folder/file) and have a file extension
  return /^[a-zA-Z0-9_-]+\/.+\.[a-zA-Z0-9]+$/.test(str);
}

/**
 * Detect an AWS S3 URL for our bucket regardless of STORAGE_URL override.
 * STORAGE_URL may point at a CDN (e.g. https://cdn.flowsmartly.com) while
 * canvas JSON saved months ago still embeds virtual-host S3 URLs like
 * https://flowsmartly-media.s3.us-east-2.amazonaws.com/media/abc.png.
 * This lets presign / key-extraction recognize both.
 */
function isS3Url(url: string): boolean {
  if (!url) return false;
  const cleanUrl = url.split("?")[0];
  if (cleanUrl.startsWith(STORAGE_URL)) return true;
  // Virtual-host style: https://{bucket}.s3.{region}.amazonaws.com/{key}
  if (new RegExp(`^https://${BUCKET}\\.s3\\.[a-z0-9-]+\\.amazonaws\\.com/`).test(cleanUrl)) return true;
  // Path style: https://s3.{region}.amazonaws.com/{bucket}/{key}
  if (new RegExp(`^https://s3\\.[a-z0-9-]+\\.amazonaws\\.com/${BUCKET}/`).test(cleanUrl)) return true;
  return false;
}

/**
 * Extract the S3 key from a full S3 URL or local /uploads/ path.
 * Handles both old local URLs and new S3 URLs for backwards compatibility.
 */
export function extractS3Key(url: string): string {
  if (!url) return "";
  // Strip query params first (presigned URLs have ?X-Amz-Algorithm=... etc.)
  const urlWithoutParams = url.split("?")[0];
  if (urlWithoutParams.startsWith(STORAGE_URL)) {
    return urlWithoutParams.slice(STORAGE_URL.length + 1);
  }
  // Virtual-host S3 URL
  const vhMatch = urlWithoutParams.match(new RegExp(`^https://${BUCKET}\\.s3\\.[a-z0-9-]+\\.amazonaws\\.com/(.+)$`));
  if (vhMatch) return vhMatch[1];
  // Path-style S3 URL
  const psMatch = urlWithoutParams.match(new RegExp(`^https://s3\\.[a-z0-9-]+\\.amazonaws\\.com/${BUCKET}/(.+)$`));
  if (psMatch) return psMatch[1];
  if (urlWithoutParams.startsWith("/uploads/")) {
    return urlWithoutParams.slice("/uploads/".length); // "media/abc.png"
  }
  return urlWithoutParams;
}

/**
 * Get MIME content type from a filename extension.
 */
export function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    pdf: "application/pdf",
  };
  return map[ext || ""] || "application/octet-stream";
}

const PRESIGN_EXPIRES = 3600; // 1 hour
const PRESIGN_UPLOAD_EXPIRES = 600; // 10 minutes for uploads

/**
 * Generate a presigned PUT URL for direct browser-to-S3 uploads.
 * Returns the presigned URL and the final public URL after upload.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  maxSizeBytes?: number
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ...(maxSizeBytes ? { ContentLength: maxSizeBytes } : {}),
  });
  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGN_UPLOAD_EXPIRES,
  });
  return { uploadUrl, publicUrl: `${STORAGE_URL}/${key}`, key };
}

/**
 * Generate a presigned URL for reading an S3 object.
 * Accepts either a full S3 URL or a bare key.
 */
export async function getPresignedUrl(urlOrKey: string, expiresIn?: number): Promise<string> {
  const key = extractS3Key(urlOrKey);
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresIn || PRESIGN_EXPIRES });
}

/**
 * Sign all S3 URLs in an HTML string with long-lived presigned URLs (7 days).
 * Used for email sending where images must remain accessible.
 */
export async function presignHtmlImages(html: string): Promise<string> {
  const s3UrlPattern = new RegExp(`(${STORAGE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^"'\\s<>]+)`, 'g');
  const matches = html.match(s3UrlPattern);
  if (!matches) return html;

  const unique = [...new Set(matches)];
  const sevenDays = 7 * 24 * 3600; // Max presign for S3 is 7 days
  let result = html;
  for (const url of unique) {
    const signed = await getPresignedUrl(url, sevenDays);
    result = result.split(url).join(signed);
  }
  return result;
}

/**
 * Recursively walk any value and replace S3 URLs with presigned URLs.
 * Works on strings, arrays, plain objects, and nested combinations.
 */
export async function presignAllUrls<T>(data: T): Promise<T> {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    if (data.startsWith(STORAGE_URL)) {
      return (await getPresignedUrl(data)) as T;
    }
    // Also handle bare S3 keys (e.g. "media/abc.png") stored in mediaMeta
    if (isS3Key(data)) {
      return (await getPresignedUrl(data)) as T;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return (await Promise.all(data.map((item) => presignAllUrls(item)))) as T;
  }

  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = await presignAllUrls(value);
    }
    return result as T;
  }

  return data; // numbers, booleans, etc.
}

/**
 * Sanitize canvas JSON before storing to DB.
 * Strips /api/image-proxy?url=... wrappers and presign query params so only
 * bare S3 base URLs are stored. This allows presignCanvasJson to re-presign
 * them fresh on each load without relying on stored (expired) signatures.
 */
export function sanitizeCanvasJsonForStorage(canvasJson: string): string {
  if (!canvasJson) return canvasJson;
  try {
    const parsed = JSON.parse(canvasJson);
    _walkAndSanitize(parsed);
    return JSON.stringify(parsed);
  } catch {
    return canvasJson;
  }
}

// Matches both relative ("/api/image-proxy?url=…") AND absolute
// ("https://flowsmartly.com/api/image-proxy?url=…") proxy wrappers.
// Fabric serializes loaded image src as absolute, so old designs hit
// the absolute path; the previous startsWith("/api/image-proxy?url=")
// check missed those and the inner expired signature leaked through.
const PROXY_WRAPPER_RE = /^(?:https?:\/\/[^/]+)?\/api\/image-proxy\?url=(.+)$/i;

function _extractProxyInner(src: string): string | null {
  const m = PROXY_WRAPPER_RE.exec(src);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

function _sanitizeSrc(src: string): string {
  // Strip /api/image-proxy?url=<encoded> wrapper (relative OR absolute)
  const inner = _extractProxyInner(src);
  if (inner) {
    const base = inner.split("?")[0];
    // Only keep if it's actually an S3 URL we manage
    if (isS3Url(base) || isS3Key(base)) return base;
  }
  // Strip presign query params from bare S3 URLs
  if (isS3Url(src)) return src.split("?")[0];
  return src;
}

function _walkAndSanitize(obj: unknown): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) { (obj as unknown[]).forEach(_walkAndSanitize); return; }
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (typeof val === "string") {
      // canvasJSON is a nested JSON string — recurse into it
      if (key === "canvasJSON") {
        record[key] = sanitizeCanvasJsonForStorage(val);
      } else {
        record[key] = _sanitizeSrc(val);
      }
    } else if (typeof val === "object") {
      _walkAndSanitize(val);
    }
  }
}

/**
 * Re-presign all S3 URLs embedded inside a canvas JSON string.
 * Handles bare S3 URLs (after sanitize-on-save) AND legacy proxy-wrapped
 * encoded URLs (backward compat for designs saved before sanitization).
 * Returns proxy-wrapped fresh presigned URLs so the browser can load them CORS-free.
 */
export async function presignCanvasJson(canvasJson: string): Promise<string> {
  if (!canvasJson) return canvasJson;
  try {
    const parsed = JSON.parse(canvasJson);
    await _walkAndPresign(parsed);
    return JSON.stringify(parsed);
  } catch {
    return canvasJson;
  }
}

async function _presignSrc(src: string): Promise<string> {
  // Bare S3 URL — STORAGE_URL prefix OR virtual-host / path-style amazonaws.com
  if (isS3Url(src)) {
    const cleanUrl = src.split("?")[0];
    const signed = await getPresignedUrl(cleanUrl);
    return `/api/image-proxy?url=${encodeURIComponent(signed)}`;
  }
  // Legacy: /api/image-proxy?url=<encoded expired presigned url>.
  // Match BOTH relative ("/api/image-proxy?url=…") AND absolute
  // ("https://flowsmartly.com/api/image-proxy?url=…") forms — Fabric
  // serializes loaded image src as absolute, so older designs hit the
  // absolute path and were previously missed by this re-presign step.
  const inner = _extractProxyInner(src);
  if (inner) {
    const cleanUrl = inner.split("?")[0];
    if (isS3Url(cleanUrl) || isS3Key(cleanUrl)) {
      const signed = await getPresignedUrl(cleanUrl);
      return `/api/image-proxy?url=${encodeURIComponent(signed)}`;
    }
  }
  // Bare S3 key stored as a string (e.g. "media/abc.png")
  if (isS3Key(src)) {
    const signed = await getPresignedUrl(src);
    return `/api/image-proxy?url=${encodeURIComponent(signed)}`;
  }
  return src;
}

async function _walkAndPresign(obj: unknown): Promise<void> {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) await _walkAndPresign(item);
    return;
  }
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (typeof val === "string") {
      if (key === "canvasJSON") {
        // Nested JSON string — recursively presign
        record[key] = await presignCanvasJson(val);
      } else {
        record[key] = await _presignSrc(val);
      }
    } else if (typeof val === "object") {
      await _walkAndPresign(val);
    }
  }
}
