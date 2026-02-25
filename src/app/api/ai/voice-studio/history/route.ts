import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/ai/voice-studio/history — Paginated generation history
 *
 * Returns completed voice generations for the authenticated user with
 * cursor-based pagination. Includes associated voice profile info.
 *
 * Query params:
 *   - limit: number of results (default 20, max 50)
 *   - cursor: ID of last item from previous page
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20"),
      50
    );
    const cursor = searchParams.get("cursor");

    const generations = await prisma.voiceGeneration.findMany({
      where: { userId: session.userId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        voiceProfile: {
          select: { name: true, type: true },
        },
      },
    });

    const hasMore = generations.length > limit;
    if (hasMore) generations.pop();

    return NextResponse.json({
      success: true,
      data: {
        generations,
        hasMore,
        nextCursor:
          hasMore && generations.length > 0
            ? generations[generations.length - 1].id
            : null,
      },
    });
  } catch (error) {
    console.error("[VoiceStudio] History error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load history" },
      { status: 500 }
    );
  }
}
