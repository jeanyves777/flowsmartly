import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import crypto from "crypto";
import { sendTeamInvitationEmail } from "@/lib/email";
import { notifyTeamInvitation } from "@/lib/notifications";

const VALID_ROLES = ["OWNER", "ADMIN", "EDITOR", "MEMBER"];

// POST /api/teams/[teamId]/members - Invite a member by email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId } = await params;

    // Verify the current user is OWNER or ADMIN
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: session.userId },
      },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to invite members" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Email is required" } },
        { status: 400 }
      );
    }

    const assignedRole = role || "MEMBER";
    if (!VALID_ROLES.includes(assignedRole)) {
      return NextResponse.json(
        { success: false, error: { message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` } },
        { status: 400 }
      );
    }

    // Prevent non-owners from assigning OWNER role
    if (assignedRole === "OWNER" && membership.role !== "OWNER") {
      return NextResponse.json(
        { success: false, error: { message: "Only the team owner can assign the OWNER role" } },
        { status: 403 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true },
    });

    if (existingUser) {
      const existingMember = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: existingUser.id } },
      });
      if (existingMember) {
        return NextResponse.json(
          { success: false, error: { message: "User is already a member of this team" } },
          { status: 409 }
        );
      }
    }

    // Check if there's already a pending invitation
    const existingInvite = await prisma.teamInvitation.findUnique({
      where: { teamId_email: { teamId, email: normalizedEmail } },
    });

    if (existingInvite && existingInvite.status === "PENDING" && existingInvite.expiresAt > new Date()) {
      return NextResponse.json(
        { success: false, error: { message: "An invitation has already been sent to this email" } },
        { status: 409 }
      );
    }

    // Generate token and create invitation (upsert to handle expired/cancelled)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = existingInvite
      ? await prisma.teamInvitation.update({
          where: { id: existingInvite.id },
          data: {
            token,
            role: assignedRole,
            status: "PENDING",
            invitedBy: session.userId,
            expiresAt,
            acceptedAt: null,
          },
        })
      : await prisma.teamInvitation.create({
          data: {
            teamId,
            email: normalizedEmail,
            role: assignedRole,
            token,
            invitedBy: session.userId,
            expiresAt,
          },
        });

    // Get team name for email
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });

    // Send invitation email (fire-and-forget)
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    sendTeamInvitationEmail({
      to: normalizedEmail,
      inviterName: session.user.name,
      teamName: team?.name || "Team",
      role: assignedRole,
      inviteUrl: `${APP_URL}/teams/invite/${token}`,
      expiresInDays: 7,
    }).catch((err) => console.error("Team invitation email error:", err));

    // If user exists on platform, also send in-app notification
    if (existingUser) {
      notifyTeamInvitation({
        userId: existingUser.id,
        teamName: team?.name || "Team",
        inviterName: session.user.name,
        inviteToken: token,
      }).catch((err) => console.error("Team invitation notification error:", err));
    }

    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        email: normalizedEmail,
        role: assignedRole,
        status: "PENDING",
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Invite member error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to send invitation" } },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[teamId]/members - Update a member's role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId } = await params;

    // Verify the current user is OWNER
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: session.userId },
      },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json(
        { success: false, error: { message: "Only the team owner can update member roles" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { message: "userId is required" } },
        { status: 400 }
      );
    }

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: { message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` } },
        { status: 400 }
      );
    }

    // Cannot change own role
    if (userId === session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "You cannot change your own role" } },
        { status: 400 }
      );
    }

    // Find the target member
    const targetMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!targetMember) {
      return NextResponse.json(
        { success: false, error: { message: "Member not found in this team" } },
        { status: 404 }
      );
    }

    // Update the role
    const member = await prisma.teamMember.update({
      where: { id: targetMember.id },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: member.id,
        teamId: member.teamId,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
        user: member.user,
      },
    });
  } catch (error) {
    console.error("Update member role error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update member role" } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/members - Remove a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId } = await params;

    // Verify the current user is OWNER or ADMIN
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: session.userId },
      },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to remove members" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { message: "userId is required" } },
        { status: 400 }
      );
    }

    // Find the target member
    const targetMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!targetMember) {
      return NextResponse.json(
        { success: false, error: { message: "Member not found in this team" } },
        { status: 404 }
      );
    }

    // Cannot remove an OWNER
    if (targetMember.role === "OWNER") {
      return NextResponse.json(
        { success: false, error: { message: "Cannot remove the team owner" } },
        { status: 403 }
      );
    }

    // Delete the team member
    await prisma.teamMember.delete({
      where: { id: targetMember.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to remove member" } },
      { status: 500 }
    );
  }
}
