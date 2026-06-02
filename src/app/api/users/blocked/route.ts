import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/users/blocked?page=1&limit=50 — List users blocked by the current
// user. Drives the mobile Settings → Blocked Users screen. Paginated; default
// 50 per page, max 100.
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
    const pageRaw = parseInt(searchParams.get("page") || "1", 10);
    const limitRaw = parseInt(searchParams.get("limit") || "50", 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Math.min(
      100,
      Math.max(1, Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50)
    );
    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      prisma.userBlock.count({
        where: { blockerId: session.userId },
      }),
      prisma.userBlock.findMany({
        where: { blockerId: session.userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          blocked: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
              oauthAvatarUrl: true,
            },
          },
        },
      }),
    ]);

    const blocked = rows.map((row) => ({
      id: row.id,
      blockedId: row.blockedId,
      createdAt: row.createdAt.toISOString(),
      user: {
        id: row.blocked.id,
        name: row.blocked.name,
        username: row.blocked.username,
        avatarUrl: row.blocked.avatarUrl ?? row.blocked.oauthAvatarUrl,
      },
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      data: {
        blocked,
        pagination: { total, page, totalPages },
      },
    });
  } catch (error) {
    console.error("List blocked users error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to list blocked users" } },
      { status: 500 }
    );
  }
}
