import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/messages — List conversations for the current user
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

    // ── Lazy creation: create Conversation records for ACTIVE AgentClient relationships that lack one ──

    // 1. Check if user is an agent — find their agent profile
    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (agentProfile) {
      // Find ACTIVE agent-client relationships without a conversation (agent side)
      const agentClientsWithoutConvo = await prisma.agentClient.findMany({
        where: {
          agentProfileId: agentProfile.id,
          status: "ACTIVE",
          conversation: null,
        },
        include: {
          agentProfile: { select: { userId: true } },
        },
      });

      for (const ac of agentClientsWithoutConvo) {
        await prisma.conversation.create({
          data: {
            agentClientId: ac.id,
            agentUserId: ac.agentProfile.userId,
            clientUserId: ac.clientUserId,
          },
        });
      }
    }

    // 2. Check if user is a client in any ACTIVE relationships without a conversation
    const clientRelationshipsWithoutConvo = await prisma.agentClient.findMany({
      where: {
        clientUserId: userId,
        status: "ACTIVE",
        conversation: null,
      },
      include: {
        agentProfile: { select: { userId: true } },
      },
    });

    for (const ac of clientRelationshipsWithoutConvo) {
      await prisma.conversation.create({
        data: {
          agentClientId: ac.id,
          agentUserId: ac.agentProfile.userId,
          clientUserId: ac.clientUserId,
        },
      });
    }

    // ── Fetch all conversations where user is a participant ──

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { agentUserId: userId },
          { clientUserId: userId },
        ],
      },
      orderBy: { lastMessageAt: "desc" },
    });

    // Build response with unread counts and other participant info
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (convo) => {
        // Count unread messages (messages sent by the OTHER user that are unread)
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: convo.id,
            senderUserId: { not: userId },
            readAt: null,
          },
        });

        // Get the other participant's info
        const otherUserId =
          convo.agentUserId === userId
            ? convo.clientUserId
            : convo.agentUserId;

        const otherUser = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        });

        return {
          id: convo.id,
          agentClientId: convo.agentClientId,
          lastMessageAt: convo.lastMessageAt,
          lastMessageText: convo.lastMessageText,
          unreadCount,
          otherParticipant: otherUser
            ? {
                id: otherUser.id,
                name: otherUser.name,
                avatarUrl: otherUser.avatarUrl,
              }
            : null,
        };
      })
    );

    const data = await presignAllUrls(conversationsWithDetails);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("List conversations error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to list conversations" } },
      { status: 500 }
    );
  }
}
