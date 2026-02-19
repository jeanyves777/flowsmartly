import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { createNotification } from "@/lib/notifications";

/** Check if the user is a participant in the conversation (agent-client or group) */
async function isParticipant(conversationId: string, userId: string, conversation: {
  agentUserId: string | null;
  clientUserId: string | null;
  isGroup: boolean;
}): Promise<boolean> {
  // Direct agent-client participant
  if (conversation.agentUserId === userId || conversation.clientUserId === userId) {
    return true;
  }
  // Group conversation participant
  if (conversation.isGroup) {
    const p = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return !!p;
  }
  return false;
}

// GET /api/messages/[conversationId] — Get messages in a conversation
export async function GET(
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

    // Validate the user is a participant and get conversation metadata
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        agentClient: {
          select: { id: true, status: true },
        },
        team: {
          select: { id: true, name: true, avatarUrl: true },
        },
        participants: {
          include: {
            // We need user info for group chats
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { message: "Conversation not found" } },
        { status: 404 }
      );
    }

    if (!(await isParticipant(conversationId, userId, conversation))) {
      return NextResponse.json(
        { success: false, error: { message: "Not a participant in this conversation" } },
        { status: 403 }
      );
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const before = searchParams.get("before");

    // Build cursor-based query
    const whereClause: Record<string, unknown> = { conversationId };

    if (before) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (cursorMessage) {
        whereClause.createdAt = { lt: cursorMessage.createdAt };
      }
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        approvalRequest: true,
      },
    });

    // For group chats, fetch sender info for all unique senders
    let senderMap: Record<string, { id: string; name: string; avatarUrl: string | null }> = {};
    if (conversation.isGroup) {
      const senderIds = [...new Set(messages.map((m) => m.senderUserId))];
      if (senderIds.length > 0) {
        const senders = await prisma.user.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, name: true, avatarUrl: true },
        });
        senderMap = Object.fromEntries(senders.map((s) => [s.id, s]));
      }
    }

    // Parse JSON fields and format messages
    const formattedMessages = messages.map((msg) => {
      const parsed: Record<string, unknown> = {
        id: msg.id,
        conversationId: msg.conversationId,
        senderUserId: msg.senderUserId,
        type: msg.type,
        text: msg.text,
        attachments: JSON.parse(msg.attachments),
        readAt: msg.readAt,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      };

      // Include sender info for group chats
      if (conversation.isGroup && senderMap[msg.senderUserId]) {
        parsed.sender = senderMap[msg.senderUserId];
      }

      if (msg.approvalRequest) {
        parsed.approvalRequest = {
          id: msg.approvalRequest.id,
          messageId: msg.approvalRequest.messageId,
          conversationId: msg.approvalRequest.conversationId,
          postContent: msg.approvalRequest.postContent,
          mediaUrls: JSON.parse(msg.approvalRequest.mediaUrls),
          platforms: JSON.parse(msg.approvalRequest.platforms),
          scheduledAt: msg.approvalRequest.scheduledAt,
          status: msg.approvalRequest.status,
          reviewComment: msg.approvalRequest.reviewComment,
          reviewedAt: msg.approvalRequest.reviewedAt,
          createdAt: msg.approvalRequest.createdAt,
          updatedAt: msg.approvalRequest.updatedAt,
        };
      }

      return parsed;
    });

    // Build conversation metadata based on type
    let conversationMeta: Record<string, unknown>;

    if (conversation.isGroup) {
      // Team conversation
      conversationMeta = {
        id: conversation.id,
        type: "team",
        teamId: conversation.teamId,
        teamName: conversation.team?.name || "Team",
        teamAvatarUrl: conversation.team?.avatarUrl || null,
        isGroup: true,
      };
    } else {
      // Agent-client conversation
      const otherUserId =
        conversation.agentUserId === userId
          ? conversation.clientUserId
          : conversation.agentUserId;

      const otherUser = otherUserId
        ? await prisma.user.findUnique({
            where: { id: otherUserId },
            select: { id: true, name: true, avatarUrl: true },
          })
        : null;

      conversationMeta = {
        id: conversation.id,
        type: "agent-client",
        agentClientId: conversation.agentClientId,
        agentUserId: conversation.agentUserId,
        clientUserId: conversation.clientUserId,
        agentClient: conversation.agentClient
          ? { status: conversation.agentClient.status }
          : null,
        otherParticipant: otherUser
          ? { id: otherUser.id, name: otherUser.name, avatarUrl: otherUser.avatarUrl }
          : null,
        isGroup: false,
      };
    }

    const data = await presignAllUrls({
      messages: formattedMessages,
      conversation: conversationMeta,
      hasMore: messages.length === limit,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get messages" } },
      { status: 500 }
    );
  }
}

// POST /api/messages/[conversationId] — Send a message
export async function POST(
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
      include: {
        agentClient: {
          select: { id: true, status: true },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { message: "Conversation not found" } },
        { status: 404 }
      );
    }

    if (!(await isParticipant(conversationId, userId, conversation))) {
      return NextResponse.json(
        { success: false, error: { message: "Not a participant in this conversation" } },
        { status: 403 }
      );
    }

    // For agent-client convos, validate the relationship is ACTIVE
    if (!conversation.isGroup && conversation.agentClient) {
      if (conversation.agentClient.status !== "ACTIVE") {
        return NextResponse.json(
          { success: false, error: { message: "Cannot send messages — relationship is not active" } },
          { status: 403 }
        );
      }
    }

    // Parse request body
    const body = await request.json();
    const { text, attachments, type } = body;
    const messageType = type || "TEXT";

    if (!text && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { success: false, error: { message: "Message must have text or attachments" } },
        { status: 400 }
      );
    }

    // Create message
    const now = new Date();
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderUserId: userId,
        type: messageType,
        text: text || null,
        attachments: attachments ? JSON.stringify(attachments) : "[]",
      },
    });

    // Update conversation with latest message info
    const lastMessageText = text ? text.substring(0, 100) : "Sent an attachment";

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, lastMessageText },
    });

    // Notify recipients
    const senderName = session.user.name;

    if (conversation.isGroup) {
      // Notify all participants except sender
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId, userId: { not: userId } },
        select: { userId: true },
      });

      for (const p of participants) {
        createNotification({
          userId: p.userId,
          type: "NEW_MESSAGE",
          title: `${senderName} in team chat`,
          message: text?.substring(0, 100) || "Sent an attachment",
          actionUrl: `/messages/${conversationId}`,
        }).catch((err) => console.error("Team message notification error:", err));
      }
    } else {
      // Agent-client: notify the other user
      const recipientUserId =
        conversation.agentUserId === userId
          ? conversation.clientUserId
          : conversation.agentUserId;

      if (recipientUserId) {
        createNotification({
          userId: recipientUserId,
          type: "NEW_MESSAGE",
          title: "New message from " + senderName,
          message: text?.substring(0, 100) || "Sent an attachment",
          actionUrl: "/messages/" + conversationId,
        }).catch((err) => console.error("Message notification error:", err));
      }
    }

    // Format response
    const formattedMessage = {
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      type: message.type,
      text: message.text,
      attachments: JSON.parse(message.attachments),
      readAt: message.readAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };

    const data = await presignAllUrls(formattedMessage);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to send message" } },
      { status: 500 }
    );
  }
}
