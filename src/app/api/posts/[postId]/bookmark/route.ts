import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/posts/[postId]/bookmark - Bookmark a post
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
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    // Check if already bookmarked
    const existingBookmark = await prisma.bookmark.findUnique({
      where: { postId_userId: { postId, userId: session.userId } },
    });

    if (existingBookmark) {
      return NextResponse.json(
        { success: false, error: { message: "Already bookmarked" } },
        { status: 400 }
      );
    }

    await prisma.bookmark.create({
      data: {
        postId,
        userId: session.userId,
      },
    });

    return NextResponse.json({
      success: true,
      data: { bookmarked: true },
    });
  } catch (error) {
    console.error("Bookmark post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to bookmark post" } },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[postId]/bookmark - Remove bookmark
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

    const existingBookmark = await prisma.bookmark.findUnique({
      where: { postId_userId: { postId, userId: session.userId } },
    });

    if (!existingBookmark) {
      return NextResponse.json(
        { success: false, error: { message: "Not bookmarked" } },
        { status: 400 }
      );
    }

    await prisma.bookmark.delete({
      where: { postId_userId: { postId, userId: session.userId } },
    });

    return NextResponse.json({
      success: true,
      data: { bookmarked: false },
    });
  } catch (error) {
    console.error("Remove bookmark error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to remove bookmark" } },
      { status: 500 }
    );
  }
}
