import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications";

// PUT /api/teams/[teamId]/join-requests/[requestId] — Approve or reject
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; requestId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId, requestId } = await params;
    const body = await request.json();
    const { action } = body as { action: "approve" | "reject" };

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid action. Use 'approve' or 'reject'" } },
        { status: 400 }
      );
    }

    // Verify user is team owner or admin
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: session.userId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to manage join requests" } },
        { status: 403 }
      );
    }

    const joinRequest = await prisma.teamJoinRequest.findFirst({
      where: { id: requestId, teamId, status: "PENDING" },
      include: { user: { select: { name: true } }, team: { select: { name: true } } },
    });

    if (!joinRequest) {
      return NextResponse.json(
        { success: false, error: { message: "Join request not found or already processed" } },
        { status: 404 }
      );
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

    await prisma.teamJoinRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        reviewedBy: session.userId,
        reviewedAt: new Date(),
      },
    });

    if (action === "approve") {
      // Add user as team member
      await prisma.teamMember.create({
        data: {
          teamId,
          userId: joinRequest.userId,
          role: "MEMBER",
        },
      });

      createNotification({
        userId: joinRequest.userId,
        type: "TEAM_JOIN_APPROVED",
        title: "Join Request Approved",
        message: `Your request to join "${joinRequest.team.name}" has been approved!`,
        actionUrl: `/teams/${teamId}`,
      }).catch((err) => console.error("Notification error:", err));
    } else {
      createNotification({
        userId: joinRequest.userId,
        type: "TEAM_JOIN_REJECTED",
        title: "Join Request Declined",
        message: `Your request to join "${joinRequest.team.name}" was not approved.`,
      }).catch((err) => console.error("Notification error:", err));
    }

    return NextResponse.json({ success: true, data: { status: newStatus } });
  } catch (error) {
    console.error("Review join request error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to process join request" } },
      { status: 500 }
    );
  }
}
