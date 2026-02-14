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

    // Record the share
    const share = await prisma.share.create({
      data: {
        postId,
        platform: platform || "unknown",
      },
    });

    // Increment the share count on the post
    await prisma.post.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true, data: share });
  } catch (error) {
    console.error("[Share] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record share" },
      { status: 500 }
    );
  }
}
