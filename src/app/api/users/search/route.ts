import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/users/search?q=searchTerm - Search users for @mention autocomplete
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
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 1) {
      return NextResponse.json({
        success: true,
        data: { users: [] },
      });
    }

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { username: { contains: query } },
          { name: { contains: query } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
      },
      take: 8,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    console.error("User search error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to search users" } },
      { status: 500 }
    );
  }
}
