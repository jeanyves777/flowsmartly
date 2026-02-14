import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/media/folders - List user's folders
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const folders = await prisma.mediaFolder.findMany({
      where: { userId: session.userId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { files: true, children: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        folders: folders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          fileCount: f._count.files,
          childCount: f._count.children,
          createdAt: f.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Get folders error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch folders" } }, { status: 500 });
  }
}

// POST /api/media/folders - Create folder
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await request.json();
    const { name, parentId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: { message: "Folder name is required" } }, { status: 400 });
    }

    // Verify parent folder if specified
    if (parentId) {
      const parent = await prisma.mediaFolder.findFirst({
        where: { id: parentId, userId: session.userId },
      });
      if (!parent) {
        return NextResponse.json({ success: false, error: { message: "Parent folder not found" } }, { status: 404 });
      }
    }

    const folder = await prisma.mediaFolder.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        parentId: parentId || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        folder: {
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId,
          fileCount: 0,
          childCount: 0,
          createdAt: folder.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Create folder error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to create folder" } }, { status: 500 });
  }
}
