import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getPresignedUploadUrl, presignAllUrls } from "@/lib/utils/s3-client";
import { randomUUID } from "crypto";

const ALLOWED_TYPES: Record<string, number> = {
  // Images (10MB)
  "image/png": 10 * 1024 * 1024,
  "image/jpeg": 10 * 1024 * 1024,
  "image/jpg": 10 * 1024 * 1024,
  "image/webp": 10 * 1024 * 1024,
  "image/gif": 10 * 1024 * 1024,
  "image/svg+xml": 10 * 1024 * 1024,
  // Videos (100MB)
  "video/mp4": 100 * 1024 * 1024,
  "video/webm": 100 * 1024 * 1024,
  "video/quicktime": 100 * 1024 * 1024,
  // Audio (25MB)
  "audio/mpeg": 25 * 1024 * 1024,
  "audio/wav": 25 * 1024 * 1024,
  "audio/mp3": 25 * 1024 * 1024,
  "audio/ogg": 25 * 1024 * 1024,
  "audio/webm": 25 * 1024 * 1024,
};

function getFileType(mimeType: string): string {
  if (mimeType.startsWith("image/svg")) return "svg";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * POST /api/media/upload-url
 * Returns a presigned S3 PUT URL for direct browser-to-S3 uploads.
 * Also creates the MediaFile DB record so it appears in the library immediately.
 *
 * Body: { filename, contentType, size, folderId? }
 * Returns: { uploadUrl, file: { id, url, ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { filename: originalName, contentType, size, folderId } = await request.json();

    if (!originalName || !contentType) {
      return NextResponse.json(
        { success: false, error: { message: "filename and contentType are required" } },
        { status: 400 }
      );
    }

    const maxSize = ALLOWED_TYPES[contentType];
    if (!maxSize) {
      return NextResponse.json(
        { success: false, error: { message: `File type ${contentType} is not allowed` } },
        { status: 400 }
      );
    }

    if (size && size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      return NextResponse.json(
        { success: false, error: { message: `File too large. Maximum ${maxMB}MB for this type.` } },
        { status: 400 }
      );
    }

    // Verify folder belongs to user
    if (folderId) {
      const folder = await prisma.mediaFolder.findFirst({
        where: { id: folderId, userId: session.userId },
      });
      if (!folder) {
        return NextResponse.json(
          { success: false, error: { message: "Folder not found" } },
          { status: 404 }
        );
      }
    }

    // Generate S3 key
    const ext = originalName.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10) || "bin";
    const s3Filename = `${session.userId}-${randomUUID().substring(0, 8)}.${ext}`;
    const s3Key = `media/${s3Filename}`;

    // Get presigned upload URL
    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(s3Key, contentType);

    // Create MediaFile record
    const fileType = getFileType(contentType);
    const mediaFile = await prisma.mediaFile.create({
      data: {
        userId: session.userId,
        filename: s3Filename,
        originalName,
        url: publicUrl,
        type: fileType,
        mimeType: contentType,
        size: size || 0,
        folderId: folderId || null,
        tags: "[]",
        metadata: "{}",
      },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        uploadUrl,
        file: {
          id: mediaFile.id,
          filename: mediaFile.filename,
          originalName: mediaFile.originalName,
          url: mediaFile.url,
          type: mediaFile.type,
          mimeType: mediaFile.mimeType,
          size: mediaFile.size,
          folderId: mediaFile.folderId,
          metadata: {},
          createdAt: mediaFile.createdAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("[media/upload-url] Error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate upload URL" } },
      { status: 500 }
    );
  }
}
