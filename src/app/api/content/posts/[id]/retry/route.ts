import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { publishToSocialPlatforms } from "@/lib/social/publisher";

/**
 * POST /api/content/posts/[id]/retry
 * Retry publishing to specific failed platforms
 * Body: { platforms: ["facebook", "instagram"] }
 */
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

    const { id: postId } = await params;
    const body = await request.json();
    const { platforms } = body;

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "platforms array is required" } },
        { status: 400 }
      );
    }

    // Verify post belongs to user
    const post = await prisma.post.findFirst({
      where: { id: postId, userId: session.userId },
      select: { id: true, status: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    // Retry publishing to specified platforms
    const results = await publishToSocialPlatforms(postId, session.userId, platforms);

    return NextResponse.json({
      success: true,
      data: { publishResults: results },
    });
  } catch (error) {
    console.error("Retry publish error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to retry publishing" } },
      { status: 500 }
    );
  }
}
