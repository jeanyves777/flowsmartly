import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { processFlag } from "@/lib/moderation/content-screener";

const VALID_REASONS = ["spam", "harassment", "hate_speech", "nudity", "violence", "misinformation", "other"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { commentId } = await params;
    const body = await request.json();
    const { reason, description } = body;

    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid report reason" } },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true },
    });
    if (!comment) {
      return NextResponse.json(
        { success: false, error: { message: "Comment not found" } },
        { status: 404 }
      );
    }

    if (comment.userId === session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Cannot report your own comment" } },
        { status: 400 }
      );
    }

    // Check duplicate
    const existing = await prisma.contentFlag.findFirst({
      where: { reporterUserId: session.userId, commentId, contentType: "comment" },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { message: "Already reported" } },
        { status: 409 }
      );
    }

    await prisma.contentFlag.create({
      data: {
        reporterUserId: session.userId,
        contentType: "comment",
        commentId,
        reason,
        description: description?.slice(0, 500) || null,
      },
    });

    await processFlag("comment", commentId);

    return NextResponse.json({
      success: true,
      data: { message: "Report submitted. Thank you for keeping our community safe." },
    });
  } catch (error) {
    console.error("Report comment error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to submit report" } },
      { status: 500 }
    );
  }
}
