import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import {
  checkDesignAccess,
  checkShareTokenAccess,
  canEditDesign,
  recordDesignActivity,
} from "@/lib/designs/access";

// GET /api/designs/:id - Fetch a single design
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get("share");

    // Check share token access (no session required)
    let shareAccess: Awaited<ReturnType<typeof checkShareTokenAccess>> = null;
    if (shareToken) {
      shareAccess = await checkShareTokenAccess(shareToken);
      if (shareAccess && shareAccess.designId !== id) {
        shareAccess = null; // Token doesn't match this design
      }
    }

    // Check authenticated user access
    const session = await getSession();
    let userAccess: Awaited<ReturnType<typeof checkDesignAccess>> | null = null;
    if (session) {
      userAccess = await checkDesignAccess(id, session.userId);
    }

    // Must have at least one valid access path
    const hasAccess =
      (userAccess && userAccess.allowed) || (shareAccess && shareAccess.valid);
    if (!hasAccess) {
      if (!session) {
        return NextResponse.json(
          { success: false, error: { message: "Unauthorized" } },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { success: false, error: { message: "Design not found" } },
        { status: 404 }
      );
    }

    // Increment share token use count
    if (shareAccess) {
      await prisma.designShare.update({
        where: { id: shareAccess.shareId },
        data: { useCount: { increment: 1 } },
      });
    }

    // Record view activity (fire-and-forget)
    if (session) {
      recordDesignActivity(id, session.userId, "VIEWED").catch(() => {});
    }

    const design = await prisma.design.findUnique({ where: { id } });

    if (!design) {
      return NextResponse.json(
        { success: false, error: { message: "Design not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        design: {
          id: design.id,
          prompt: design.prompt,
          category: design.category,
          size: design.size,
          style: design.style,
          imageUrl: design.imageUrl,
          name: design.name,
          canvasData: design.canvasData,
          status: design.status,
          metadata: design.metadata || "{}",
          createdAt: design.createdAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Get design error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch design" } },
      { status: 500 }
    );
  }
}

// PUT /api/designs/:id - Update a design
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Only owner or EDITOR collaborators can update
    const allowed = await canEditDesign(id, session.userId);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { message: "Design not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, canvasData, imageUrl, category, size, style, prompt } = body;

    const updated = await prisma.design.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(canvasData !== undefined && { canvasData }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(category !== undefined && { category }),
        ...(size !== undefined && { size }),
        ...(style !== undefined && { style }),
        ...(prompt !== undefined && { prompt }),
        status: "COMPLETED",
      },
    });

    // Record edit activity (fire-and-forget)
    recordDesignActivity(id, session.userId, "EDITED").catch(() => {});

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        design: {
          id: updated.id,
          prompt: updated.prompt,
          category: updated.category,
          size: updated.size,
          style: updated.style,
          imageUrl: updated.imageUrl,
          name: updated.name,
          canvasData: updated.canvasData,
          status: updated.status,
          metadata: updated.metadata || "{}",
          createdAt: updated.createdAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Update design error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update design" } },
      { status: 500 }
    );
  }
}

// DELETE /api/designs/:id - Delete a design (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Only the owner can delete a design
    const access = await checkDesignAccess(id, session.userId);
    if (!access.allowed || access.role !== "OWNER") {
      return NextResponse.json(
        { success: false, error: { message: "Design not found" } },
        { status: 404 }
      );
    }

    await prisma.design.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete design error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete design" } },
      { status: 500 }
    );
  }
}
