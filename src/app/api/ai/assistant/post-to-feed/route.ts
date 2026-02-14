import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, caption } = await req.json();

    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 });
    }

    // Find the message and verify ownership
    const message = await prisma.aIMessage.findFirst({
      where: { id: messageId },
      include: {
        conversation: { select: { userId: true } },
      },
    });

    if (!message || message.conversation.userId !== session.userId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (!message.mediaUrl || !message.mediaType) {
      return NextResponse.json({ error: "Message has no media to post" }, { status: 400 });
    }

    // Create the post
    const post = await prisma.post.create({
      data: {
        userId: session.userId,
        caption: caption || "Created with FlowAI",
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { postId: post.id },
    });
  } catch (error) {
    console.error("Post to feed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
