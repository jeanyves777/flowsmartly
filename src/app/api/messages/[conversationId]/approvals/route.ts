import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/messages/[conversationId]/approvals — List approvals in a conversation
export async function GET(
  request: NextRequest,
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // e.g. "PENDING"
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = { conversationId };
    if (status) {
      where.status = status;
    }

    // Query approvals
    const [approvals, total] = await Promise.all([
      prisma.contentApproval.findMany({
        where,
        include: {
          message: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.contentApproval.count({ where }),
    ]);

    // Parse JSON fields and presign URLs
    const parsed = approvals.map((a) => ({
      ...a,
      mediaUrls: JSON.parse(a.mediaUrls),
      platforms: JSON.parse(a.platforms),
      message: {
        ...a.message,
        attachments: JSON.parse(a.message.attachments),
      },
    }));

    const presigned = await presignAllUrls(parsed);

    return NextResponse.json({
      success: true,
      data: {
        approvals: presigned,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("List approvals error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
