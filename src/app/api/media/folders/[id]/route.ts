import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// PUT /api/media/folders/[id] - Rename folder
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
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: { message: "Folder name is required" } }, { status: 400 });
    }

    const folder = await prisma.mediaFolder.findFirst({
      where: { id, userId: session.userId },
    });

    if (!folder) {
      return NextResponse.json({ success: false, error: { message: "Folder not found" } }, { status: 404 });
    }

    const updated = await prisma.mediaFolder.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      data: { folder: { id: updated.id, name: updated.name } },
    });
  } catch (error) {
    console.error("Rename folder error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to rename folder" } }, { status: 500 });
  }
}

// DELETE /api/media/folders/[id] - Delete folder (move files to root)
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

    const folder = await prisma.mediaFolder.findFirst({
      where: { id, userId: session.userId },
    });

    if (!folder) {
      return NextResponse.json({ success: false, error: { message: "Folder not found" } }, { status: 404 });
    }

    // Move all files to root (set folderId to null)
    await prisma.mediaFile.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });

    // Move child folders to parent (or root)
    await prisma.mediaFolder.updateMany({
      where: { parentId: id },
      data: { parentId: folder.parentId },
    });

    // Delete the folder
    await prisma.mediaFolder.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete folder error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete folder" } }, { status: 500 });
  }
}
