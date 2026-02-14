import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { deleteFromS3, extractS3Key, presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/media/[id] - Get single file details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await params;

    const file = await prisma.mediaFile.findFirst({
      where: { id, userId: session.userId },
      include: { folder: { select: { id: true, name: true } } },
    });

    if (!file) {
      return NextResponse.json({ success: false, error: { message: "File not found" } }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        file: {
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          url: file.url,
          type: file.type,
          mimeType: file.mimeType,
          size: file.size,
          width: file.width,
          height: file.height,
          folderId: file.folderId,
          folder: file.folder,
          tags: JSON.parse(file.tags),
          metadata: JSON.parse(file.metadata),
          createdAt: file.createdAt.toISOString(),
          updatedAt: file.updatedAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Get media file error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch file" } }, { status: 500 });
  }
}

// PUT /api/media/[id] - Update file (tags, name, folder)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { originalName, tags, folderId } = body;

    const file = await prisma.mediaFile.findFirst({
      where: { id, userId: session.userId },
    });

    if (!file) {
      return NextResponse.json({ success: false, error: { message: "File not found" } }, { status: 404 });
    }

    // Verify folder if changing
    if (folderId !== undefined && folderId !== null) {
      const folder = await prisma.mediaFolder.findFirst({
        where: { id: folderId, userId: session.userId },
      });
      if (!folder) {
        return NextResponse.json({ success: false, error: { message: "Folder not found" } }, { status: 404 });
      }
    }

    const updated = await prisma.mediaFile.update({
      where: { id },
      data: {
        ...(originalName !== undefined ? { originalName } : {}),
        ...(tags !== undefined ? { tags: JSON.stringify(tags) } : {}),
        ...(folderId !== undefined ? { folderId: folderId || null } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        file: {
          id: updated.id,
          originalName: updated.originalName,
          tags: JSON.parse(updated.tags),
          folderId: updated.folderId,
        },
      },
    });
  } catch (error) {
    console.error("Update media file error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update file" } }, { status: 500 });
  }
}

// DELETE /api/media/[id] - Delete file from disk and database
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await params;

    const file = await prisma.mediaFile.findFirst({
      where: { id, userId: session.userId },
    });

    if (!file) {
      return NextResponse.json({ success: false, error: { message: "File not found" } }, { status: 404 });
    }

    // Delete from S3
    try {
      const key = extractS3Key(file.url);
      await deleteFromS3(key);
    } catch {
      // Object may already be deleted, continue with DB cleanup
    }

    // Delete from database
    await prisma.mediaFile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete media file error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete file" } }, { status: 500 });
  }
}
