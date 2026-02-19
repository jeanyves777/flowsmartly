import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { createNotification } from "@/lib/notifications";

// POST /api/messages/[conversationId]/approval — Agent creates content approval request
export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { conversationId } = await params;

    // Find conversation and validate participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        agentClient: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { message: "Conversation not found" } },
        { status: 404 }
      );
    }

    // Validate user is a participant
    if (
      session.userId !== conversation.agentUserId &&
      session.userId !== conversation.clientUserId
    ) {
      return NextResponse.json(
        { success: false, error: { message: "Not a participant in this conversation" } },
        { status: 403 }
      );
    }

    // Validate user is the agent
    if (session.userId !== conversation.agentUserId) {
      return NextResponse.json(
        { success: false, error: { message: "Only the agent can create approval requests" } },
        { status: 403 }
      );
    }

    // Validate relationship is ACTIVE
    if (conversation.agentClient?.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: { message: "Agent-client relationship is not active" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { postContent, mediaUrls, platforms, scheduledAt } = body;

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "platforms is required and must be a non-empty array" } },
        { status: 400 }
      );
    }

    // Create the message and approval in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the message
      const message = await tx.message.create({
        data: {
          conversationId,
          senderUserId: session.userId,
          type: "APPROVAL_REQUEST",
          text: postContent
            ? `Content for review: ${postContent.substring(0, 100)}${postContent.length > 100 ? "..." : ""}`
            : "Content sent for review",
        },
      });

      // Create the content approval
      const approval = await tx.contentApproval.create({
        data: {
          messageId: message.id,
          conversationId,
          postContent: postContent || null,
          mediaUrls: JSON.stringify(mediaUrls || []),
          platforms: JSON.stringify(platforms),
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        },
      });

      // Update conversation
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessageText: message.text,
        },
      });

      return { message, approval };
    });

    // Fire-and-forget notification for client
    if (conversation.clientUserId) createNotification({
      userId: conversation.clientUserId,
      type: "APPROVAL_REQUEST",
      title: "Content approval requested",
      message: `Your agent sent content for review: ${postContent?.substring(0, 80) || "View details"}`,
      actionUrl: "/messages/" + conversationId,
    }).catch((err) => console.error("Approval notification error:", err));

    return NextResponse.json({
      success: true,
      data: {
        message: {
          ...result.message,
          approvalRequest: {
            ...result.approval,
            mediaUrls: JSON.parse(result.approval.mediaUrls),
            platforms: JSON.parse(result.approval.platforms),
          },
        },
      },
    });
  } catch (error) {
    console.error("Create approval request error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
