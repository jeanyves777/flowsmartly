import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkDesignAccess } from "@/lib/designs/access";

// GET /api/designs/share/:token - Resolve share token (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find the share link
    const share = await prisma.designShare.findUnique({
      where: { token },
      select: {
        id: true,
        designId: true,
        permission: true,
        isActive: true,
        expiresAt: true,
        maxUses: true,
        useCount: true,
        design: {
          select: {
            id: true,
            name: true,
            size: true,
            imageUrl: true,
            canvasData: true,
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid share link" } },
        { status: 404 }
      );
    }

    // Validate: active, not expired, under max uses
    if (!share.isActive) {
      return NextResponse.json(
        { success: false, error: { message: "This share link has been deactivated" } },
        { status: 410 }
      );
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: { message: "This share link has expired" } },
        { status: 410 }
      );
    }

    if (share.maxUses && share.useCount >= share.maxUses) {
      return NextResponse.json(
        { success: false, error: { message: "This share link has reached its usage limit" } },
        { status: 410 }
      );
    }

    // Increment use count
    await prisma.designShare.update({
      where: { id: share.id },
      data: { useCount: { increment: 1 } },
    });

    // Check if user is authenticated to determine their actual role
    let userRole: string | null = null;
    const session = await getSession();

    if (session) {
      const access = await checkDesignAccess(share.designId, session.userId);
      if (access.allowed && access.role) {
        userRole = access.role;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        design: {
          id: share.design.id,
          name: share.design.name,
          size: share.design.size,
          imageUrl: share.design.imageUrl,
          canvasData: share.design.canvasData,
        },
        permission: share.permission,
        shareId: share.id,
        ...(userRole ? { userRole } : {}),
      },
    });
  } catch (error) {
    console.error("Resolve share token error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to resolve share link" } },
      { status: 500 }
    );
  }
}
