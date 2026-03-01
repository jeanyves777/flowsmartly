import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { uploadToS3, presignAllUrls } from "@/lib/utils/s3-client";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { randomUUID } from "crypto";
import { readFile, writeFile, unlink, mkdir, stat } from "fs/promises";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import sharp from "sharp";

// Allow large uploads (100MB for videos)
export const maxDuration = 120; // 2 min timeout for large uploads + processing

const ALLOWED_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml",
  "image/gif", "video/mp4", "video/webm", "video/quicktime", "application/pdf",
  "audio/mpeg", "audio/wav", "audio/mp3", "audio/ogg", "audio/webm",
];
const MAX_FILE_SIZE_IMAGE = 50 * 1024 * 1024; // 50MB for images/docs (optimized on upload)
const MAX_FILE_SIZE_VIDEO = 500 * 1024 * 1024; // 500MB for videos (will be compressed)
const MAX_FILE_SIZE_AUDIO = 25 * 1024 * 1024; // 25MB for audio

function getFileType(mimeType: string): string {
  if (mimeType.startsWith("image/svg")) return "svg";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

// GET /api/media - List user's media files
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");
    const limit = parseInt(searchParams.get("limit") || "50");
    const cursor = searchParams.get("cursor");
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : null;

    const where: Record<string, unknown> = { userId: session.userId };

    if (folderId === "root") {
      where.folderId = null;
    } else if (folderId) {
      where.folderId = folderId;
    }

    if (type) {
      // Support comma-separated types (e.g. "image,svg" or "video")
      const types = type.split(",").map((t) => t.trim()).filter(Boolean);
      if (types.length === 1) {
        where.type = types[0];
      } else if (types.length > 1) {
        where.type = { in: types };
      }
    }
    if (search) {
      where.originalName = { contains: search };
    }

    // Page-based pagination (used by MediaLibraryPicker)
    if (page) {
      const skip = (page - 1) * limit;
      const [files, count] = await Promise.all([
        prisma.mediaFile.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
          include: { folder: { select: { id: true, name: true } } },
        }),
        prisma.mediaFile.count({ where }),
      ]);

      let filtered = files;
      if (tag) {
        filtered = files.filter((f) => {
          const tags: string[] = JSON.parse(f.tags);
          return tags.includes(tag);
        });
      }

      return NextResponse.json({
        success: true,
        data: await presignAllUrls({
          files: filtered.map((f) => ({
            id: f.id,
            filename: f.filename,
            originalName: f.originalName,
            url: f.url,
            type: f.type,
            mimeType: f.mimeType,
            size: f.size,
            width: f.width,
            height: f.height,
            folderId: f.folderId,
            folder: f.folder,
            tags: JSON.parse(f.tags),
            metadata: JSON.parse(f.metadata),
            createdAt: f.createdAt.toISOString(),
          })),
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        }),
      });
    }

    // Cursor-based pagination (used by media library page)
    const files = await prisma.mediaFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        folder: { select: { id: true, name: true } },
      },
    });

    const hasMore = files.length > limit;
    const result = hasMore ? files.slice(0, limit) : files;

    // Filter by tag on application level (JSON stored)
    let filtered = result;
    if (tag) {
      filtered = result.filter((f) => {
        const tags: string[] = JSON.parse(f.tags);
        return tags.includes(tag);
      });
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        files: filtered.map((f) => ({
          id: f.id,
          filename: f.filename,
          originalName: f.originalName,
          url: f.url,
          type: f.type,
          mimeType: f.mimeType,
          size: f.size,
          width: f.width,
          height: f.height,
          folderId: f.folderId,
          folder: f.folder,
          tags: JSON.parse(f.tags),
          metadata: JSON.parse(f.metadata),
          createdAt: f.createdAt.toISOString(),
        })),
        hasMore,
        nextCursor: hasMore ? result[result.length - 1]?.id : null,
      }),
    });
  } catch (error) {
    console.error("Get media error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch media" } }, { status: 500 });
  }
}

/**
 * Optimize images: resize large images, convert to WebP, strip metadata.
 * Like YouTube/Facebook — stores optimized version, faster loading everywhere.
 */
async function optimizeImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  try {
    // Skip SVGs and GIFs (animated)
    if (mimeType === "image/svg+xml" || mimeType === "image/gif") {
      const ext = mimeType === "image/gif" ? "gif" : "svg";
      return { buffer, mimeType, ext };
    }

    const img = sharp(buffer);
    const meta = await img.metadata();

    // Cap at 4096px on longest side (plenty for web)
    const maxDim = 4096;
    const needsResize = (meta.width && meta.width > maxDim) || (meta.height && meta.height > maxDim);

    let pipeline = img;
    if (needsResize) {
      pipeline = pipeline.resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
    }

    // Convert to WebP (typically 30-50% smaller than JPEG/PNG)
    const optimized = await pipeline
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    // Only use WebP if it's actually smaller
    if (optimized.length < buffer.length) {
      return { buffer: optimized, mimeType: "image/webp", ext: "webp" };
    }

    // Fallback: just strip metadata from original format
    const stripped = await sharp(buffer)
      .rotate() // auto-rotate based on EXIF
      .toBuffer();

    return {
      buffer: stripped.length < buffer.length ? stripped : buffer,
      mimeType,
      ext: mimeType.includes("png") ? "png" : "jpg",
    };
  } catch (err) {
    console.error("Image optimization failed, using original:", err);
    return { buffer, mimeType, ext: mimeType.includes("png") ? "png" : "jpg" };
  }
}

/**
 * Compress video with FFmpeg: re-encode to H.264 MP4, cap resolution at 1080p,
 * use CRF 23 for good quality/size balance. Like YouTube processing.
 * Returns compressed buffer and new size, or original if compression fails/isn't beneficial.
 */
async function compressVideo(
  buffer: Buffer,
  inputExt: string
): Promise<{ buffer: Buffer; compressed: boolean; originalSize: number; newSize: number }> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    return { buffer, compressed: false, originalSize: buffer.length, newSize: buffer.length };
  }

  // Skip small videos (under 5MB) — not worth the processing time
  if (buffer.length < 5 * 1024 * 1024) {
    return { buffer, compressed: false, originalSize: buffer.length, newSize: buffer.length };
  }

  const tmpDir = path.join(os.tmpdir(), "flowsmartly-compress");
  await mkdir(tmpDir, { recursive: true });

  const id = randomUUID().substring(0, 8);
  const inputPath = path.join(tmpDir, `input-${id}.${inputExt}`);
  const outputPath = path.join(tmpDir, `output-${id}.mp4`);

  try {
    await writeFile(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath, [
        "-y", "-i", inputPath,
        // Video: H.264, cap at 1080p, CRF 23 (good quality)
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-vf", "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
        "-pix_fmt", "yuv420p",
        // Audio: AAC 128k
        "-c:a", "aac",
        "-b:a", "128k",
        // Fast start for web streaming (moov atom at beginning)
        "-movflags", "+faststart",
        outputPath,
      ], { windowsHide: true });

      let stderr = "";
      proc.stderr?.on("data", (d) => { stderr += d.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg compression failed (code ${code}): ${stderr.slice(-200)}`));
      });
    });

    const compressedBuffer = await readFile(outputPath);
    const stats = await stat(outputPath);

    // Only use compressed version if it's actually smaller
    if (stats.size < buffer.length * 0.95) {
      console.log(`[media] Video compressed: ${(buffer.length / 1024 / 1024).toFixed(1)}MB → ${(stats.size / 1024 / 1024).toFixed(1)}MB (${Math.round((1 - stats.size / buffer.length) * 100)}% reduction)`);
      return { buffer: compressedBuffer, compressed: true, originalSize: buffer.length, newSize: stats.size };
    }

    return { buffer, compressed: false, originalSize: buffer.length, newSize: buffer.length };
  } catch (err) {
    console.error("Video compression failed, using original:", err);
    return { buffer, compressed: false, originalSize: buffer.length, newSize: buffer.length };
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Extract first frame from video as a JPEG thumbnail using FFmpeg.
 * Returns the thumbnail as a Buffer, or null if FFmpeg is unavailable.
 */
async function generateVideoThumbnail(videoBuffer: Buffer, videoExt: string): Promise<Buffer | null> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) return null;

  const tmpDir = path.join(os.tmpdir(), "flowsmartly-thumbs");
  await mkdir(tmpDir, { recursive: true });

  const id = randomUUID().substring(0, 8);
  const inputPath = path.join(tmpDir, `input-${id}.${videoExt}`);
  const outputPath = path.join(tmpDir, `thumb-${id}.jpg`);

  try {
    await writeFile(inputPath, videoBuffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath, [
        "-y", "-i", inputPath,
        "-vframes", "1", "-vf", "scale=640:-1",
        "-q:v", "2", outputPath,
      ], { windowsHide: true });

      proc.on("error", reject);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
    });

    return await readFile(outputPath);
  } catch (err) {
    console.error("Video thumbnail generation failed:", err);
    return null;
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

// POST /api/media - Upload file and create media record
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;
    const tagsRaw = formData.get("tags") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: { message: "No file provided" } }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid file type. Allowed: images, videos, audio, PDF" } },
        { status: 400 }
      );
    }

    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    const maxSize = isVideo ? MAX_FILE_SIZE_VIDEO : isAudio ? MAX_FILE_SIZE_AUDIO : MAX_FILE_SIZE_IMAGE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: { message: `File too large. Maximum size is ${isVideo ? "500MB" : isAudio ? "25MB" : "50MB"}` } },
        { status: 400 }
      );
    }

    // Verify folder belongs to user if specified
    if (folderId) {
      const folder = await prisma.mediaFolder.findFirst({
        where: { id: folderId, userId: session.userId },
      });
      if (!folder) {
        return NextResponse.json({ success: false, error: { message: "Folder not found" } }, { status: 404 });
      }
    }

    // Process and upload
    const fileType = getFileType(file.type);
    const ext = file.name.split(".").pop() || "bin";
    const sanitizedExt = ext.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10);
    const baseId = `${session.userId}-${randomUUID().substring(0, 8)}`;

    const bytes = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(bytes);
    let uploadMimeType = file.type;
    let uploadExt = sanitizedExt;
    const tags = tagsRaw ? JSON.parse(tagsRaw) : [];
    const metadata: Record<string, unknown> = {};

    // ── Image optimization (WebP conversion + resize) ──
    const isImage = file.type.startsWith("image/");
    if (isImage) {
      const optimized = await optimizeImage(buffer, file.type);
      if (optimized.buffer.length < buffer.length) {
        metadata.originalSize = buffer.length;
        metadata.optimized = true;
      }
      buffer = optimized.buffer;
      uploadMimeType = optimized.mimeType;
      uploadExt = optimized.ext;
    }

    // ── Video compression (H.264 + 1080p cap + faststart) ──
    if (fileType === "video") {
      const compressed = await compressVideo(buffer, sanitizedExt || "mp4");
      if (compressed.compressed) {
        buffer = compressed.buffer;
        uploadMimeType = "video/mp4";
        uploadExt = "mp4";
        metadata.originalSize = compressed.originalSize;
        metadata.compressedSize = compressed.newSize;
        metadata.compressionRatio = Math.round((1 - compressed.newSize / compressed.originalSize) * 100);
      }
    }

    const filename = `${baseId}.${uploadExt}`;

    // Upload (optimized) file to S3
    const url = await uploadToS3(`media/${filename}`, buffer, uploadMimeType);

    // Generate thumbnail for video files
    if (fileType === "video") {
      const videoExt = uploadExt || "mp4";
      const thumbBuffer = await generateVideoThumbnail(buffer, videoExt);
      if (thumbBuffer) {
        const thumbKey = `media/thumbs/${baseId}.jpg`;
        const thumbUrl = await uploadToS3(thumbKey, thumbBuffer, "image/jpeg");
        metadata.thumbnailUrl = thumbUrl;
      }
    }

    // Create media file record
    const mediaFile = await prisma.mediaFile.create({
      data: {
        userId: session.userId,
        filename,
        originalName: file.name,
        url,
        type: fileType,
        mimeType: uploadMimeType,
        size: buffer.length,
        folderId: folderId || null,
        tags: JSON.stringify(tags),
        metadata: JSON.stringify(metadata),
      },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        file: {
          id: mediaFile.id,
          filename: mediaFile.filename,
          originalName: mediaFile.originalName,
          url: mediaFile.url,
          type: mediaFile.type,
          mimeType: mediaFile.mimeType,
          size: mediaFile.size,
          folderId: mediaFile.folderId,
          tags,
          metadata,
          createdAt: mediaFile.createdAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Upload media error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to upload media" } }, { status: 500 });
  }
}
