import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { createNotification } from "@/lib/notifications";

// PATCH /api/messages/[conversationId]/approval/[approvalId] — Client approves or rejects content
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string; approvalId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { conversationId, approvalId } = await params;

    // Find conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
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

    // Validate user is the client
    if (session.userId !== conversation.clientUserId) {
      return NextResponse.json(
        { success: false, error: { message: "Only the client can approve or reject content" } },
        { status: 403 }
      );
    }

    // Find the approval
    const approval = await prisma.contentApproval.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      return NextResponse.json(
        { success: false, error: { message: "Approval not found" } },
        { status: 404 }
      );
    }

    // Validate it belongs to this conversation
    if (approval.conversationId !== conversationId) {
      return NextResponse.json(
        { success: false, error: { message: "Approval does not belong to this conversation" } },
        { status: 403 }
      );
    }

    // Validate status is PENDING
    if (approval.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: { message: `Approval has already been ${approval.status.toLowerCase()}` } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, comment } = body;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: { message: "action must be 'approve' or 'reject'" } },
        { status: 400 }
      );
    }

    // Update the approval
    const updatedApproval = await prisma.contentApproval.update({
      where: { id: approvalId },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        reviewComment: comment || null,
        reviewedAt: new Date(),
      },
    });

    // Fire-and-forget notification for agent
    createNotification({
      userId: conversation.agentUserId,
      type: action === "approve" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
      title: `Content ${action === "approve" ? "approved" : "rejected"}`,
      message: `Your client ${action === "approve" ? "approved" : "rejected"} your content${comment ? ": " + comment.substring(0, 80) : ""}`,
      actionUrl: "/messages/" + conversationId,
    }).catch((err) => console.error("Approval decision notification error:", err));

    return NextResponse.json({
      success: true,
      data: {
        approval: {
          ...updatedApproval,
          mediaUrls: JSON.parse(updatedApproval.mediaUrls),
          platforms: JSON.parse(updatedApproval.platforms),
        },
      },
    });
  } catch (error) {
    console.error("Update approval error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
