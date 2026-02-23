import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const VALID_REASONS = [
  "spam",
  "harassment",
  "hate_speech",
  "nudity",
  "violence",
  "misinformation",
  "other",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { postId } = await params;
    const body = await request.json();
    const { reason, description } = body;

    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid report reason" } },
        { status: 400 }
      );
    }

    // Check post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, deletedAt: true },
    });

    if (!post || post.deletedAt) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    // Cannot report own post
    if (post.userId === session.user.id) {
      return NextResponse.json(
        { success: false, error: { message: "Cannot report your own post" } },
        { status: 400 }
      );
    }

    // Check for duplicate report from same user on same post
    const existingFlag = await prisma.contentFlag.findFirst({
      where: {
        reporterUserId: session.user.id,
        postId: postId,
        status: "pending",
      },
    });

    if (existingFlag) {
      return NextResponse.json(
        { success: false, error: { message: "You have already reported this post" } },
        { status: 409 }
      );
    }

    // Create content flag
    await prisma.contentFlag.create({
      data: {
        reporterUserId: session.user.id,
        contentType: "post",
        postId: postId,
        reason,
        description: description || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Report post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to submit report" } },
      { status: 500 }
    );
  }
}
