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
 * Extract the S3 key from a full S3 URL or local /uploads/ path.
 * Handles both old local URLs and new S3 URLs for backwards compatibility.
 */
export function extractS3Key(url: string): string {
  // Strip query params first (presigned URLs have ?X-Amz-Algorithm=... etc.)
  const urlWithoutParams = url.split("?")[0];
  if (urlWithoutParams.startsWith(STORAGE_URL)) {
    return urlWithoutParams.slice(STORAGE_URL.length + 1);
  }
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
export async function getPresignedUrl(urlOrKey: string): Promise<string> {
  const key = extractS3Key(urlOrKey);
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRES });
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
