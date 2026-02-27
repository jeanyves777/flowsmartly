import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const MAX_BATCH_SIZE = 50;

// POST /api/designs/bulk - Bulk operations on designs
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await request.json();
    const { action, designIds, folderId } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: { message: "Action is required" } }, { status: 400 });
    }

    if (!Array.isArray(designIds) || designIds.length === 0) {
      return NextResponse.json({ success: false, error: { message: "designIds is required" } }, { status: 400 });
    }

    if (designIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ success: false, error: { message: `Maximum ${MAX_BATCH_SIZE} designs per request` } }, { status: 400 });
    }

    if (action === "delete") {
      const result = await prisma.design.deleteMany({
        where: { id: { in: designIds }, userId: session.userId },
      });

      return NextResponse.json({
        success: true,
        data: { deleted: result.count },
      });
    }

    if (action === "move") {
      // Verify folder ownership if moving to a folder
      if (folderId) {
        const folder = await prisma.designFolder.findFirst({
          where: { id: folderId, userId: session.userId },
        });
        if (!folder) {
          return NextResponse.json({ success: false, error: { message: "Folder not found" } }, { status: 404 });
        }
      }

      const result = await prisma.design.updateMany({
        where: { id: { in: designIds }, userId: session.userId },
        data: { folderId: folderId || null },
      });

      return NextResponse.json({
        success: true,
        data: { updated: result.count },
      });
    }

    return NextResponse.json({ success: false, error: { message: "Invalid action" } }, { status: 400 });
  } catch (error) {
    console.error("Bulk design operation error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to perform bulk operation" } }, { status: 500 });
  }
}
