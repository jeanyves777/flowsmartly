import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

function getDeviceType(userAgent: string) {
  const value = userAgent.toLowerCase();
  if (/ipad|tablet/.test(value)) return "tablet";
  if (/mobile|android|iphone|ipod/.test(value)) return "mobile";
  return "desktop";
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * POST /api/posts/[postId]/view
 *
 * Lightweight view tracker for the mobile feed + reels. Records a PostView
 * row (unique per (postId, viewerUserId), so a single user is only counted
 * once) and increments Post.viewCount. The single-post GET endpoint does
 * the same thing on every fetch, but loading the entire post payload just
 * to register that the video started playing is wasteful — this is the
 * minimal version the feed / reels can fire-and-forget.
 *
 * Returns the new viewCount on success (or the existing one if the user
 * already has a view recorded -- unique violation is swallowed).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await params;
    const session = await getSession();

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: "PUBLISHED",
        deletedAt: null,
        moderationStatus: { not: "removed" },
      },
      select: { id: true, userId: true, campaignId: true, viewCount: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 },
      );
    }

    // Don't count the author's own views.
    if (session?.userId === post.userId) {
      return NextResponse.json({ success: true, data: { viewCount: post.viewCount } });
    }

    let viewCount = post.viewCount;
    try {
      const [, updatedPost] = await prisma.$transaction([
        prisma.postView.create({
          data: {
            postId,
            viewerUserId: session?.userId || null,
            campaignId: post.campaignId,
            viewDuration: 1,
            deviceType: getDeviceType(request.headers.get("user-agent") || ""),
          },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { viewCount: { increment: 1 } },
          select: { viewCount: true },
        }),
      ]);
      viewCount = updatedPost.viewCount;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Already counted for this user — return the existing count unchanged.
    }

    return NextResponse.json({ success: true, data: { viewCount } });
  } catch (error) {
    console.error("Track view error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to record view" } },
      { status: 500 },
    );
  }
}
