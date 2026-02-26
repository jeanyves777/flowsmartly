import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/designs/:id - Fetch a single design
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

    const design = await prisma.design.findFirst({
      where: { id, userId: session.userId },
    });

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
