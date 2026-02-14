import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/posts/[postId]/comment - Get comments for a post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20");
    const parentId = searchParams.get("parentId"); // For loading replies

    const comments = await prisma.comment.findMany({
      where: {
        postId,
        parentId: parentId || null,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    const hasMore = comments.length > limit;
    const commentsToReturn = hasMore ? comments.slice(0, -1) : comments;

    return NextResponse.json({
      success: true,
      data: {
        comments: commentsToReturn.map(comment => ({
          id: comment.id,
          content: comment.content,
          author: comment.user,
          likesCount: comment.likeCount,
          repliesCount: comment._count.replies,
          createdAt: comment.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? commentsToReturn[commentsToReturn.length - 1].id : null,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch comments" } },
      { status: 500 }
    );
  }
}

// POST /api/posts/[postId]/comment - Create a comment
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

    const body = await request.json();
    const { content, parentId } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Content is required" } },
        { status: 400 }
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

    // If replying to a comment, verify parent exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true },
      });

      if (!parentComment || parentComment.postId !== postId) {
        return NextResponse.json(
          { success: false, error: { message: "Parent comment not found" } },
          { status: 404 }
        );
      }
    }

    // Create comment and increment post comment count
    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          postId,
          userId: session.userId,
          parentId,
          content,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);

    // Create notification for post author (if not self)
    if (post.userId !== session.userId) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          type: "COMMENT",
          title: "New Comment",
          message: `${session.user.name} commented on your post`,
          data: JSON.stringify({ postId, commentId: comment.id, userId: session.userId }),
          actionUrl: `/post/${postId}`,
        },
      }).catch(() => {
        // Ignore notification errors
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        comment: {
          id: comment.id,
          content: comment.content,
          author: comment.user,
          likesCount: 0,
          repliesCount: 0,
          createdAt: comment.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create comment" } },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[postId]/comment - Delete a comment
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

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: { message: "Comment ID is required" } },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, postId: true },
    });

    if (!comment || comment.postId !== postId) {
      return NextResponse.json(
        { success: false, error: { message: "Comment not found" } },
        { status: 404 }
      );
    }

    if (comment.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to delete this comment" } },
        { status: 403 }
      );
    }

    // Soft delete and decrement count
    await prisma.$transaction([
      prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { message: "Comment deleted successfully" },
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete comment" } },
      { status: 500 }
    );
  }
}
