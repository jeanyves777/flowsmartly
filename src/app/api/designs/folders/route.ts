import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/designs/folders - List user's design folders
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    const where: Record<string, unknown> = { userId: session.userId };
    if (parentId) {
      where.parentId = parentId === "root" ? null : parentId;
    }

    const folders = await prisma.designFolder.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { designs: true, children: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        folders: folders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          designCount: f._count.designs,
          childCount: f._count.children,
          createdAt: f.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Get design folders error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch folders" } }, { status: 500 });
  }
}

// POST /api/designs/folders - Create design folder
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
      const parent = await prisma.designFolder.findFirst({
        where: { id: parentId, userId: session.userId },
      });
      if (!parent) {
        return NextResponse.json({ success: false, error: { message: "Parent folder not found" } }, { status: 404 });
      }
    }

    const folder = await prisma.designFolder.create({
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
          designCount: 0,
          childCount: 0,
          createdAt: folder.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Create design folder error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to create folder" } }, { status: 500 });
  }
}
