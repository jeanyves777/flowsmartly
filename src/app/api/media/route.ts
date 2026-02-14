import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { uploadToS3, presignAllUrls } from "@/lib/utils/s3-client";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { randomUUID } from "crypto";
import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { spawn } from "child_process";
import path from "path";
import os from "os";

const ALLOWED_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml",
  "image/gif", "video/mp4", "video/webm", "video/quicktime", "application/pdf",
];
const MAX_FILE_SIZE_IMAGE = 10 * 1024 * 1024; // 10MB for images/docs
const MAX_FILE_SIZE_VIDEO = 100 * 1024 * 1024; // 100MB for videos

function getFileType(mimeType: string): string {
  if (mimeType.startsWith("image/svg")) return "svg";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
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
        { success: false, error: { message: "Invalid file type. Allowed: images, videos, PDF" } },
        { status: 400 }
      );
    }

    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? MAX_FILE_SIZE_VIDEO : MAX_FILE_SIZE_IMAGE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: { message: `File too large. Maximum size is ${isVideo ? "100MB" : "10MB"}` } },
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

    // Upload to S3
    const fileType = getFileType(file.type);
    const ext = file.name.split(".").pop() || "bin";
    const sanitizedExt = ext.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10);
    const filename = `${session.userId}-${randomUUID().substring(0, 8)}.${sanitizedExt}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const url = await uploadToS3(`media/${filename}`, buffer, file.type);
    const tags = tagsRaw ? JSON.parse(tagsRaw) : [];

    // Generate thumbnail for video files
    const metadata: Record<string, unknown> = {};
    if (fileType === "video") {
      const videoExt = sanitizedExt || "mp4";
      const thumbBuffer = await generateVideoThumbnail(buffer, videoExt);
      if (thumbBuffer) {
        const thumbKey = `media/thumbs/${filename.replace(/\.[^.]+$/, "")}.jpg`;
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
        mimeType: file.type,
        size: file.size,
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
