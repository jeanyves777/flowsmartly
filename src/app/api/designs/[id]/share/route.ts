import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { canEditDesign, recordDesignActivity } from "@/lib/designs/access";

// GET /api/designs/:id/share - List all share links for a design
export async function GET(
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

    const hasAccess = await canEditDesign(id, session.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to view share links" } },
        { status: 403 }
      );
    }

    const shares = await prisma.designShare.findMany({
      where: { designId: id },
      select: {
        id: true,
        token: true,
        permission: true,
        label: true,
        expiresAt: true,
        maxUses: true,
        useCount: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: shares,
    });
  } catch (error) {
    console.error("List share links error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to list share links" } },
      { status: 500 }
    );
  }
}

// POST /api/designs/:id/share - Create a new share link
export async function POST(
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

    const hasAccess = await canEditDesign(id, session.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to create share links" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { permission, expiresAt, maxUses, label } = body;

    // Validate permission
    const validPermissions = ["VIEW", "EDIT", "COPY"];
    if (!permission || !validPermissions.includes(permission)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid permission. Must be VIEW, EDIT, or COPY" } },
        { status: 400 }
      );
    }

    // Validate maxUses if provided
    if (maxUses !== undefined && maxUses !== null) {
      if (!Number.isInteger(maxUses) || maxUses < 1) {
        return NextResponse.json(
          { success: false, error: { message: "maxUses must be a positive integer" } },
          { status: 400 }
        );
      }
    }

    // Validate expiresAt if provided
    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) {
        return NextResponse.json(
          { success: false, error: { message: "Invalid expiresAt date" } },
          { status: 400 }
        );
      }
      if (parsedExpiresAt <= new Date()) {
        return NextResponse.json(
          { success: false, error: { message: "expiresAt must be in the future" } },
          { status: 400 }
        );
      }
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString("hex");

    const share = await prisma.designShare.create({
      data: {
        designId: id,
        token,
        permission,
        createdBy: session.userId,
        label: label || null,
        expiresAt: parsedExpiresAt,
        maxUses: maxUses || null,
      },
      select: {
        id: true,
        token: true,
        permission: true,
        label: true,
        expiresAt: true,
        maxUses: true,
        useCount: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Record activity
    await recordDesignActivity(id, session.userId, "SHARED", {
      shareId: share.id,
      permission,
      label: label || null,
    });

    return NextResponse.json({
      success: true,
      data: share,
    });
  } catch (error) {
    console.error("Create share link error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create share link" } },
      { status: 500 }
    );
  }
}

// DELETE /api/designs/:id/share - Revoke a share link
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

    const hasAccess = await canEditDesign(id, session.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to revoke share links" } },
        { status: 403 }
      );
    }

    // Get shareId from body or query params
    let shareId: string | null = null;

    const { searchParams } = new URL(request.url);
    shareId = searchParams.get("shareId");

    if (!shareId) {
      try {
        const body = await request.json();
        shareId = body.shareId;
      } catch {
        // No body provided
      }
    }

    if (!shareId) {
      return NextResponse.json(
        { success: false, error: { message: "shareId is required" } },
        { status: 400 }
      );
    }

    // Verify the share link belongs to this design
    const share = await prisma.designShare.findFirst({
      where: { id: shareId, designId: id },
    });

    if (!share) {
      return NextResponse.json(
        { success: false, error: { message: "Share link not found" } },
        { status: 404 }
      );
    }

    // Soft delete - set isActive to false
    await prisma.designShare.update({
      where: { id: shareId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke share link error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to revoke share link" } },
      { status: 500 }
    );
  }
}
