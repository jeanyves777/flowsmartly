import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { uploadToS3 } from "./s3-client";

/**
 * Save content to S3. Handles base64 data URIs and raw text.
 * Returns the full S3 URL.
 */
export async function saveToFile(
  content: string,
  subDir: string,
  filename: string
): Promise<string> {
  const buffer = contentToBuffer(content);
  const contentType = guessContentType(content, filename);
  const key = `${subDir}/${filename}`;
  return uploadToS3(key, buffer, contentType);
}

/**
 * Save content to local disk only (for FFmpeg pipeline).
 * Returns the local URL path: /uploads/{subDir}/{filename}
 */
export async function saveToFileLocal(
  content: string,
  subDir: string,
  filename: string
): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", subDir);
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, filename);
  const buffer = contentToBuffer(content);
  await writeFile(filePath, buffer);

  return `/uploads/${subDir}/${filename}`;
}

/**
 * Convert content string (base64 data URI or raw text) to a Buffer.
 */
function contentToBuffer(content: string): Buffer {
  const dataUriPrefix = "data:";
  const base64Marker = ";base64,";

  if (content.startsWith(dataUriPrefix)) {
    const base64Index = content.indexOf(base64Marker);
    if (base64Index !== -1) {
      const base64Data = content.substring(base64Index + base64Marker.length);
      return Buffer.from(base64Data, "base64");
    }
  }
  return Buffer.from(content, "utf-8");
}

/**
 * Guess content type from data URI or filename extension.
 */
function guessContentType(content: string, filename: string): string {
  // Try to extract from data URI
  if (content.startsWith("data:")) {
    const semiIdx = content.indexOf(";");
    if (semiIdx !== -1) {
      return content.substring(5, semiIdx); // e.g. "image/png"
    }
  }
  // Fall back to extension
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    pdf: "application/pdf",
  };
  return map[ext || ""] || "application/octet-stream";
}

/**
 * Save a design image to S3.
 */
export async function saveDesignImage(
  imageDataUri: string,
  designId: string,
  format: "png" | "svg"
): Promise<string> {
  const filename = `${designId}.${format}`;
  return saveToFile(imageDataUri, "designs", filename);
}

/**
 * Save raw SVG content to S3.
 */
export async function saveDesignSvg(
  svgContent: string,
  designId: string
): Promise<string> {
  const filename = `${designId}.svg`;
  const buffer = Buffer.from(svgContent, "utf-8");
  return uploadToS3(`designs/${filename}`, buffer, "image/svg+xml");
}

/**
 * Save a logo image to S3.
 */
export async function saveLogoImage(
  imageDataUri: string,
  logoId: string,
  format: "png" | "svg"
): Promise<string> {
  const filename = `${logoId}.${format}`;
  return saveToFile(imageDataUri, "logos", filename);
}
