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
    // Support single email or bulk emails array
    const emails: string[] = body.emails
      ? body.emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean)
      : body.email ? [body.email.trim().toLowerCase()] : [];
    const role = body.role || "MEMBER";

    if (emails.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "At least one email is required" } },
        { status: 400 }
      );
    }

    const assignedRole = role;
    if (!VALID_ROLES.includes(assignedRole)) {
      return NextResponse.json(
        { success: false, error: { message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` } },
        { status: 400 }
      );
    }

    if (assignedRole === "OWNER" && membership.role !== "OWNER") {
      return NextResponse.json(
        { success: false, error: { message: "Only the team owner can assign the OWNER role" } },
        { status: 403 }
      );
    }

    // Get team name once
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
    const teamName = team?.name || "Team";
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // If single email, return detailed error for UI feedback
    const isBulk = emails.length > 1;
    const results: { email: string; status: "sent" | "skipped"; reason?: string }[] = [];

    for (const normalizedEmail of emails) {
      // Check if already a member
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, name: true },
      });

      if (existingUser) {
        const existingMember = await prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId, userId: existingUser.id } },
        });
        if (existingMember) {
          if (!isBulk) {
            return NextResponse.json(
              { success: false, error: { message: "User is already a member of this team" } },
              { status: 409 }
            );
          }
          results.push({ email: normalizedEmail, status: "skipped", reason: "already a member" });
          continue;
        }
      }

      // Check existing invite
      const existingInvite = await prisma.teamInvitation.findUnique({
        where: { teamId_email: { teamId, email: normalizedEmail } },
      });

      if (existingInvite && existingInvite.status === "PENDING" && existingInvite.expiresAt > new Date()) {
        if (!isBulk) {
          return NextResponse.json(
            { success: false, error: { message: "An invitation has already been sent to this email" } },
            { status: 409 }
          );
        }
        results.push({ email: normalizedEmail, status: "skipped", reason: "already invited" });
        continue;
      }

      // Create or update invitation
      const token = crypto.randomBytes(32).toString("hex");
      const invitation = existingInvite
        ? await prisma.teamInvitation.update({
            where: { id: existingInvite.id },
            data: { token, role: assignedRole, status: "PENDING", invitedBy: session.userId, expiresAt, acceptedAt: null },
          })
        : await prisma.teamInvitation.create({
            data: { teamId, email: normalizedEmail, role: assignedRole, token, invitedBy: session.userId, expiresAt },
          });

      // Send email (fire-and-forget)
      sendTeamInvitationEmail({
        to: normalizedEmail,
        inviterName: session.user.name,
        teamName,
        role: assignedRole,
        inviteUrl: `${APP_URL}/teams/invite/${token}`,
        expiresInDays: 7,
      }).catch((err) => console.error("Team invitation email error:", err));

      // In-app notification for existing users
      if (existingUser) {
        notifyTeamInvitation({
          userId: existingUser.id,
          teamName,
          inviterName: session.user.name,
          inviteToken: token,
        }).catch((err) => console.error("Team invitation notification error:", err));
      }

      if (!isBulk) {
        return NextResponse.json({
          success: true,
          data: { id: invitation.id, email: normalizedEmail, role: assignedRole, status: "PENDING", expiresAt: expiresAt.toISOString() },
        });
      }

      results.push({ email: normalizedEmail, status: "sent" });
    }

    // Bulk response
    const sent = results.filter((r) => r.status === "sent").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    return NextResponse.json({
      success: true,
      data: { sent, skipped, results },
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
