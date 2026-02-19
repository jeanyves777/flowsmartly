import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/messages/unread-count — Total unread message count across all conversations
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Find all conversation IDs where the user is a participant (agent-client + group)
    const directConvos = await prisma.conversation.findMany({
      where: {
        OR: [
          { agentUserId: userId },
          { clientUserId: userId },
        ],
      },
      select: { id: true },
    });

    const groupParticipants = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    const conversationIds = [
      ...new Set([
        ...directConvos.map((c) => c.id),
        ...groupParticipants.map((p) => p.conversationId),
      ]),
    ];

    if (conversationIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { unreadCount: 0 },
      });
    }

    // Count all unread messages across those conversations
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        senderUserId: { not: userId },
        readAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    console.error("Unread count error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get unread count" } },
      { status: 500 }
    );
  }
}
