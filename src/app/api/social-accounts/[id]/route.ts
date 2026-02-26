import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// DELETE /api/social-accounts/[id] - Disconnect a social account
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

    // Find the account and verify ownership
    const account = await prisma.socialAccount.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: { message: "Account not found" } },
        { status: 404 }
      );
    }

    // Soft-delete: mark as inactive
    await prisma.socialAccount.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: `${account.platform} account disconnected`,
    });
  } catch (error) {
    console.error("Disconnect social account error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to disconnect account" } },
      { status: 500 }
    );
  }
}
