import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { uploadToS3, presignAllUrls } from "@/lib/utils/s3-client";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function getFileType(mimeType: string): string {
  if (mimeType.startsWith("image/svg")) return "svg";
  if (mimeType.startsWith("image/")) return "image";
  return "document";
}

// POST /api/upload - Upload a file (logo, etc.) + create MediaFile record
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null; // "logo", "avatar", etc.

    if (!file) {
      return NextResponse.json(
        { success: false, error: { message: "No file provided" } },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid file type. Allowed: PNG, JPEG, WebP, SVG" } },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: { message: "File too large. Maximum size is 5MB" } },
        { status: 400 }
      );
    }

    // Determine S3 key prefix based on type
    const subDir = type === "logo" ? "logos" : "general";
    const ext = file.name.split(".").pop() || "png";
    const sanitizedExt = ext.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10);
    const filename = `${session.userId}-${randomUUID().substring(0, 8)}.${sanitizedExt}`;

    // Upload to S3
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const url = await uploadToS3(`${subDir}/${filename}`, buffer, file.type);

    // Create MediaFile record in library
    const mediaFile = await prisma.mediaFile.create({
      data: {
        userId: session.userId,
        filename,
        originalName: file.name,
        url,
        type: getFileType(file.type),
        mimeType: file.type,
        size: file.size,
        tags: JSON.stringify(type ? [type] : []),
      },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        url,
        filename,
        size: file.size,
        type: file.type,
        mediaFileId: mediaFile.id,
      }),
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to upload file" } },
      { status: 500 }
    );
  }
}
