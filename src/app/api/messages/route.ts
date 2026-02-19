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

    // 1. Agent-client conversations (direct fields)
    const agentClientConvos = await prisma.conversation.findMany({
      where: {
        OR: [
          { agentUserId: userId },
          { clientUserId: userId },
        ],
        isGroup: false,
      },
      orderBy: { lastMessageAt: "desc" },
    });

    // 2. Team/group conversations (via ConversationParticipant)
    const participantRecords = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    const participantConvoIds = participantRecords.map((p) => p.conversationId);

    const teamConvos = participantConvoIds.length > 0
      ? await prisma.conversation.findMany({
          where: { id: { in: participantConvoIds }, isGroup: true },
          include: { team: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { lastMessageAt: "desc" },
        })
      : [];

    // Build response with unread counts
    const agentClientDetails = await Promise.all(
      agentClientConvos.map(async (convo) => {
        const unreadCount = await prisma.message.count({
          where: { conversationId: convo.id, senderUserId: { not: userId }, readAt: null },
        });

        const otherUserId = convo.agentUserId === userId ? convo.clientUserId : convo.agentUserId;
        const otherUser = otherUserId
          ? await prisma.user.findUnique({
              where: { id: otherUserId },
              select: { id: true, name: true, avatarUrl: true },
            })
          : null;

        return {
          id: convo.id,
          type: "agent-client" as const,
          agentClientId: convo.agentClientId,
          lastMessageAt: convo.lastMessageAt,
          lastMessageText: convo.lastMessageText,
          unreadCount,
          otherParticipant: otherUser
            ? { id: otherUser.id, name: otherUser.name, avatarUrl: otherUser.avatarUrl }
            : null,
        };
      })
    );

    const teamConvoDetails = await Promise.all(
      teamConvos.map(async (convo) => {
        const unreadCount = await prisma.message.count({
          where: { conversationId: convo.id, senderUserId: { not: userId }, readAt: null },
        });

        return {
          id: convo.id,
          type: "team" as const,
          teamId: convo.teamId,
          teamName: convo.team?.name || "Team",
          teamAvatarUrl: convo.team?.avatarUrl || null,
          lastMessageAt: convo.lastMessageAt,
          lastMessageText: convo.lastMessageText,
          unreadCount,
        };
      })
    );

    // Merge and sort by lastMessageAt
    const conversationsWithDetails = [
      ...agentClientDetails,
      ...teamConvoDetails,
    ].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
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
