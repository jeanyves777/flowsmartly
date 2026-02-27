import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkDesignAccess } from "@/lib/designs/access";

// GET /api/designs/:id/activity - Paginated activity log
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

    // Check access (owner or collaborator)
    const access = await checkDesignAccess(id, session.userId);
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: { message: "Design not found" } },
        { status: 404 }
      );
    }

    const { searchParams } = request.nextUrl;
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
    const cursor = searchParams.get("cursor") || undefined;

    const activities = await prisma.designActivity.findMany({
      where: { designId: id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = activities.length > limit;
    if (hasMore) activities.pop();

    const nextCursor = hasMore ? activities[activities.length - 1]?.id : undefined;

    return NextResponse.json({
      success: true,
      data: {
        activities: activities.map((a) => ({
          id: a.id,
          action: a.action,
          details: JSON.parse(a.details),
          createdAt: a.createdAt.toISOString(),
          user: a.user,
        })),
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("Get design activity error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch activity log" } },
      { status: 500 }
    );
  }
}
