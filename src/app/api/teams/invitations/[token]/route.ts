import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { notifyTeamMemberJoined } from "@/lib/notifications";

// GET /api/teams/invitations/[token] - Get invitation details (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: {
        team: {
          select: { name: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: { message: "Invitation not found" } },
        { status: 404 }
      );
    }

    // Fetch inviter name
    const inviter = await prisma.user.findUnique({
      where: { id: invitation.invitedBy },
      select: { name: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        teamName: invitation.team.name,
        inviterName: inviter?.name || "Unknown",
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
        status: invitation.status,
      },
    });
  } catch (error) {
    console.error("Get invitation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load invitation" } },
      { status: 500 }
    );
  }
}

// POST /api/teams/invitations/[token] - Accept invitation (requires session)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Please log in to accept this invitation" } },
        { status: 401 }
      );
    }

    const { token } = await params;

    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: {
        team: {
          select: { id: true, name: true, ownerId: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: { message: "Invitation not found" } },
        { status: 404 }
      );
    }

    // Check status
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: { message: "This invitation is no longer available" } },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { success: false, error: { message: "This invitation has expired" } },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: invitation.teamId,
          userId: session.userId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: { message: "You are already a member of this team" } },
        { status: 409 }
      );
    }

    // Create TeamMember record
    await prisma.teamMember.create({
      data: {
        teamId: invitation.teamId,
        userId: session.userId,
        role: invitation.role,
      },
    });

    // Update invitation status
    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    // Fire notification to team owner
    notifyTeamMemberJoined({
      ownerUserId: invitation.team.ownerId,
      memberName: session.user.name,
      teamName: invitation.team.name,
      teamId: invitation.teamId,
    }).catch((err) => console.error("Notify team member joined error:", err));

    return NextResponse.json({
      success: true,
      data: { teamId: invitation.teamId },
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to accept invitation" } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/invitations/[token] - Decline invitation (requires session)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Please log in to decline this invitation" } },
        { status: 401 }
      );
    }

    const { token } = await params;

    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: { message: "Invitation not found" } },
        { status: 404 }
      );
    }

    // Check that the logged-in user's email matches the invitation
    if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: { message: "This invitation was not sent to your email address" } },
        { status: 403 }
      );
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: { message: "This invitation is no longer available" } },
        { status: 400 }
      );
    }

    // Mark as expired (declined)
    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Decline invitation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to decline invitation" } },
      { status: 500 }
    );
  }
}
