import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// POST /api/landing-pages/[id]/publish - Toggle publish/unpublish
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

    // Find and verify ownership
    const existingPage = await prisma.landingPage.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingPage) {
      return NextResponse.json(
        { success: false, error: { message: "Landing page not found" } },
        { status: 404 }
      );
    }

    // Toggle publish status
    const isPublishing = existingPage.status === "DRAFT";

    const updatedPage = await prisma.landingPage.update({
      where: { id },
      data: {
        status: isPublishing ? "PUBLISHED" : "DRAFT",
        publishedAt: isPublishing ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        page: {
          ...updatedPage,
          settings: JSON.parse(updatedPage.settings),
        },
      },
    });
  } catch (error) {
    console.error("Publish landing page error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update publish status" } },
      { status: 500 }
    );
  }
}
