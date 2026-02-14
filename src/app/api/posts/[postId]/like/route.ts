import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/posts/[postId]/like - Like a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId: session.userId } },
    });

    if (existingLike) {
      return NextResponse.json(
        { success: false, error: { message: "Already liked" } },
        { status: 400 }
      );
    }

    // Create like and increment count in transaction
    await prisma.$transaction([
      prisma.like.create({
        data: {
          postId,
          userId: session.userId,
        },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);

    // Create notification for post author (if not self)
    if (post.userId !== session.userId) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          type: "LIKE",
          title: "New Like",
          message: `${session.user.name} liked your post`,
          data: JSON.stringify({ postId, userId: session.userId }),
          actionUrl: `/post/${postId}`,
        },
      }).catch(() => {
        // Ignore notification errors
      });
    }

    return NextResponse.json({
      success: true,
      data: { liked: true },
    });
  } catch (error) {
    console.error("Like post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to like post" } },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[postId]/like - Unlike a post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Check if like exists
    const existingLike = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId: session.userId } },
    });

    if (!existingLike) {
      return NextResponse.json(
        { success: false, error: { message: "Not liked" } },
        { status: 400 }
      );
    }

    // Delete like and decrement count in transaction
    await prisma.$transaction([
      prisma.like.delete({
        where: { postId_userId: { postId, userId: session.userId } },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { liked: false },
    });
  } catch (error) {
    console.error("Unlike post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to unlike post" } },
      { status: 500 }
    );
  }
}
