import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/content-library - List user's generated content
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "post", "caption", "hashtags", "ideas", "auto_*"
    const search = searchParams.get("search");
    const favorite = searchParams.get("favorite");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    // Build where clause
    const where: Record<string, unknown> = {
      userId: session.userId,
    };

    if (type) {
      if (type === "auto") {
        where.type = { startsWith: "auto_" };
      } else {
        where.type = type;
      }
    }

    if (search) {
      where.OR = [
        { content: { contains: search } },
        { prompt: { contains: search } },
      ];
    }

    if (favorite === "true") {
      where.isFavorite = true;
    }

    const items = await prisma.generatedContent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;

    // Get counts by type
    const typeCounts = await prisma.generatedContent.groupBy({
      by: ["type"],
      where: { userId: session.userId },
      _count: true,
    });

    const totalCount = await prisma.generatedContent.count({
      where: { userId: session.userId },
    });

    return NextResponse.json({
      success: true,
      data: {
        items: results,
        hasMore,
        nextCursor: hasMore ? results[results.length - 1].id : null,
        totalCount,
        typeCounts: typeCounts.reduce(
          (acc, item) => ({ ...acc, [item.type]: item._count }),
          {} as Record<string, number>
        ),
      },
    });
  } catch (error) {
    console.error("Content library error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch content library" } },
      { status: 500 }
    );
  }
}

// PATCH /api/content-library - Update content (favorite, used)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, isFavorite, isUsed } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Content ID is required" } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.generatedContent.findFirst({
      where: { id, userId: session.userId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Content not found" } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (typeof isFavorite === "boolean") updateData.isFavorite = isFavorite;
    if (typeof isUsed === "boolean") updateData.isUsed = isUsed;

    const updated = await prisma.generatedContent.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Content library update error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update content" } },
      { status: 500 }
    );
  }
}

// DELETE /api/content-library - Delete content
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Content ID is required" } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.generatedContent.findFirst({
      where: { id, userId: session.userId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Content not found" } },
        { status: 404 }
      );
    }

    await prisma.generatedContent.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Content library delete error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete content" } },
      { status: 500 }
    );
  }
}
