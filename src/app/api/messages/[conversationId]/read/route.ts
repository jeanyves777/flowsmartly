import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// PATCH /api/messages/[conversationId]/read — Mark messages as read
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { conversationId } = await params;
    const userId = session.userId;

    // Validate the user is a participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        agentUserId: true,
        clientUserId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { message: "Conversation not found" } },
        { status: 404 }
      );
    }

    if (
      conversation.agentUserId !== userId &&
      conversation.clientUserId !== userId
    ) {
      return NextResponse.json(
        { success: false, error: { message: "Not a participant in this conversation" } },
        { status: 403 }
      );
    }

    // Mark all unread messages from the other user as read
    const result = await prisma.message.updateMany({
      where: {
        conversationId,
        senderUserId: { not: userId },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { markedCount: result.count },
    });
  } catch (error) {
    console.error("Mark messages read error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to mark messages as read" } },
      { status: 500 }
    );
  }
}
