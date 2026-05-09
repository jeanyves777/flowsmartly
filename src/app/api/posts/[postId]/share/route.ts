import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await params;
    const { platform } = await request.json();

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: "PUBLISHED",
        deletedAt: null,
        moderationStatus: { not: "removed" },
      },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    const [share, updatedPost] = await prisma.$transaction([
      prisma.share.create({
        data: {
          postId,
          platform: platform || "unknown",
        },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { shareCount: { increment: 1 } },
        select: { shareCount: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...share,
        shareCount: updatedPost.shareCount,
      },
    });
  } catch (error) {
    console.error("[Share] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record share" },
      { status: 500 }
    );
  }
}
