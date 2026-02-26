import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * WhatsApp Messages API
 * Get messages for a specific conversation
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = params;
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "100");

    // Verify conversation belongs to user
    const conversation = await prisma.whatsAppConversation.findFirst({
      where: {
        id: conversationId,
        userId: session.userId,
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            platformUsername: true,
            platformDisplayName: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Get messages
    const [messages, total] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        where: {
          conversationId,
        },
        orderBy: {
          timestamp: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.whatsAppMessage.count({
        where: {
          conversationId,
        },
      }),
    ]);

    // Mark conversation as read
    if (conversation.unreadCount > 0) {
      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: { unreadCount: 0 },
      });
    }

    return NextResponse.json({
      success: true,
      conversation,
      messages: messages.reverse(), // Return in chronological order (oldest first)
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
