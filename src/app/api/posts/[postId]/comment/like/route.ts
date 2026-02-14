import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/posts/[postId]/comment/like - Like a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    await params; // validate route param
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { commentId } = body;

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: { message: "Comment ID is required" } },
        { status: 400 }
      );
    }

    // Check if comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, likeCount: true },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: { message: "Comment not found" } },
        { status: 404 }
      );
    }

    // Check if already liked
    const existingLike = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId: session.userId } },
    });

    if (existingLike) {
      return NextResponse.json(
        { success: false, error: { message: "Already liked" } },
        { status: 409 }
      );
    }

    // Create like and increment count
    await prisma.$transaction([
      prisma.commentLike.create({
        data: { commentId, userId: session.userId },
      }),
      prisma.comment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { likesCount: comment.likeCount + 1 },
    });
  } catch (error) {
    console.error("Like comment error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to like comment" } },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[postId]/comment/like - Unlike a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    await params;
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
      select: { id: true, likeCount: true },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: { message: "Comment not found" } },
        { status: 404 }
      );
    }

    // Check if like exists
    const existingLike = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId: session.userId } },
    });

    if (!existingLike) {
      return NextResponse.json(
        { success: false, error: { message: "Not liked" } },
        { status: 404 }
      );
    }

    // Delete like and decrement count
    await prisma.$transaction([
      prisma.commentLike.delete({
        where: { id: existingLike.id },
      }),
      prisma.comment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { likesCount: Math.max(0, comment.likeCount - 1) },
    });
  } catch (error) {
    console.error("Unlike comment error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to unlike comment" } },
      { status: 500 }
    );
  }
}
