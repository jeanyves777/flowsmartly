import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { deleteFromS3, extractS3Key } from "@/lib/utils/s3-client";

const MAX_BATCH_SIZE = 50;

// PUT /api/media/bulk - Bulk move files to a folder
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { fileIds, folderId } = await request.json();

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ success: false, error: { message: "fileIds is required" } }, { status: 400 });
    }
    if (fileIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ success: false, error: { message: `Maximum ${MAX_BATCH_SIZE} files per request` } }, { status: 400 });
    }

    // Verify folder ownership if moving to a folder
    if (folderId) {
      const folder = await prisma.mediaFolder.findFirst({
        where: { id: folderId, userId: session.userId },
      });
      if (!folder) {
        return NextResponse.json({ success: false, error: { message: "Folder not found" } }, { status: 404 });
      }
    }

    const result = await prisma.mediaFile.updateMany({
      where: { id: { in: fileIds }, userId: session.userId },
      data: { folderId: folderId || null },
    });

    return NextResponse.json({
      success: true,
      data: { updated: result.count },
    });
  } catch (error) {
    console.error("Bulk move error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to move files" } }, { status: 500 });
  }
}

// DELETE /api/media/bulk - Bulk delete files
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { fileIds } = await request.json();

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ success: false, error: { message: "fileIds is required" } }, { status: 400 });
    }
    if (fileIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ success: false, error: { message: `Maximum ${MAX_BATCH_SIZE} files per request` } }, { status: 400 });
    }

    // Fetch files to get S3 keys
    const files = await prisma.mediaFile.findMany({
      where: { id: { in: fileIds }, userId: session.userId },
      select: { id: true, url: true, metadata: true },
    });

    // Delete from S3
    for (const file of files) {
      try {
        const key = extractS3Key(file.url);
        await deleteFromS3(key);
        // Also delete video thumbnail if present
        const meta = JSON.parse(file.metadata);
        if (meta?.thumbnailUrl) {
          const thumbKey = extractS3Key(meta.thumbnailUrl);
          await deleteFromS3(thumbKey);
        }
      } catch {
        // Continue even if S3 delete fails
      }
    }

    // Delete from database
    const result = await prisma.mediaFile.deleteMany({
      where: { id: { in: files.map((f) => f.id) } },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: result.count },
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete files" } }, { status: 500 });
  }
}
