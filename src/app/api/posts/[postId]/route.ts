import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/posts/[postId] - Get a single post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const session = await getSession();

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            plan: true,
          },
        },
        comments: {
          where: { parentId: null, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
            replies: {
              where: { deletedAt: null },
              take: 3,
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
            },
            _count: {
              select: { replies: true },
            },
          },
        },
        _count: {
          select: { comments: true, likes: true },
        },
      },
    });

    if (!post || post.deletedAt) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    // Check if user liked/bookmarked
    let isLiked = false;
    let isBookmarked = false;

    if (session) {
      const [like, bookmark] = await Promise.all([
        prisma.like.findUnique({
          where: { postId_userId: { postId, userId: session.userId } },
        }),
        prisma.bookmark.findUnique({
          where: { postId_userId: { postId, userId: session.userId } },
        }),
      ]);
      isLiked = !!like;
      isBookmarked = !!bookmark;
    }

    // Increment view count
    await prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        post: {
          id: post.id,
          content: post.caption,
          mediaUrls: post.mediaUrl ? [post.mediaUrl] : [],
          mediaType: post.mediaType,
          hashtags: JSON.parse(post.hashtags || "[]"),
          author: {
            id: post.user.id,
            name: post.user.name,
            username: post.user.username,
            avatarUrl: post.user.avatarUrl,
            isVerified: post.user.plan !== "STARTER",
          },
          likesCount: post.likeCount,
          commentsCount: post._count.comments,
          sharesCount: post.shareCount,
          viewCount: post.viewCount + 1,
          isLiked,
          isBookmarked,
          createdAt: post.createdAt.toISOString(),
          comments: post.comments.map(comment => ({
            id: comment.id,
            content: comment.content,
            author: comment.user,
            likesCount: comment.likeCount,
            repliesCount: comment._count.replies,
            replies: comment.replies.map(reply => ({
              id: reply.id,
              content: reply.content,
              author: reply.user,
              createdAt: reply.createdAt.toISOString(),
            })),
            createdAt: comment.createdAt.toISOString(),
          })),
        },
      }),
    });
  } catch (error) {
    console.error("Get post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch post" } },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[postId] - Delete a post
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

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    if (post.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to delete this post" } },
        { status: 403 }
      );
    }

    // Soft delete
    await prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date(), status: "DELETED" },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Post deleted successfully" },
    });
  } catch (error) {
    console.error("Delete post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete post" } },
      { status: 500 }
    );
  }
}

// PATCH /api/posts/[postId] - Update a post
export async function PATCH(
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

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    if (post.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to edit this post" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content, mediaUrl, mediaType } = body;

    const extractedHashtags = content?.match(/#\w+/g) || [];
    const mentions = content?.match(/@\w+/g) || [];

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(content && { caption: content }),
        ...(mediaUrl !== undefined && { mediaUrl }),
        ...(mediaType !== undefined && { mediaType }),
        ...(content && {
          hashtags: JSON.stringify(extractedHashtags),
          mentions: JSON.stringify(mentions),
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            plan: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        post: {
          id: updatedPost.id,
          content: updatedPost.caption,
          mediaUrls: updatedPost.mediaUrl ? [updatedPost.mediaUrl] : [],
          updatedAt: updatedPost.updatedAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Update post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update post" } },
      { status: 500 }
    );
  }
}
