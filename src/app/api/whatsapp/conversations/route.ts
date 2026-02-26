import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * WhatsApp Conversations API
 * Get list of conversations, mark as read
 */

// GET: List all conversations
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const socialAccountId = request.nextUrl.searchParams.get("socialAccountId");
    const status = request.nextUrl.searchParams.get("status");
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

    const where: any = {
      userId: session.userId,
    };

    if (socialAccountId) {
      where.socialAccountId = socialAccountId;
    }

    if (status) {
      where.status = status;
    }

    const [conversations, total] = await Promise.all([
      prisma.whatsAppConversation.findMany({
        where,
        include: {
          socialAccount: {
            select: {
              id: true,
              platformUsername: true,
              platformDisplayName: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { timestamp: "desc" },
            select: {
              content: true,
              messageType: true,
              direction: true,
              timestamp: true,
            },
          },
        },
        orderBy: {
          lastMessageAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.whatsAppConversation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      conversations: conversations.map((conv) => ({
        ...conv,
        lastMessage: conv.messages[0] || null,
        messages: undefined, // Remove messages array, we only need lastMessage
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// PATCH: Update conversation (mark as read, archive, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, unreadCount, status } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (unreadCount !== undefined) {
      updateData.unreadCount = unreadCount;
    }

    if (status) {
      updateData.status = status;
    }

    const conversation = await prisma.whatsAppConversation.updateMany({
      where: {
        id: conversationId,
        userId: session.userId,
      },
      data: updateData,
    });

    if (conversation.count === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Conversation updated",
    });
  } catch (error) {
    console.error("Update conversation error:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}

// DELETE: Delete conversation
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversationId = request.nextUrl.searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    // Delete all messages first
    await prisma.whatsAppMessage.deleteMany({
      where: {
        conversation: {
          id: conversationId,
          userId: session.userId,
        },
      },
    });

    // Delete conversation
    const result = await prisma.whatsAppConversation.deleteMany({
      where: {
        id: conversationId,
        userId: session.userId,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Conversation deleted",
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
