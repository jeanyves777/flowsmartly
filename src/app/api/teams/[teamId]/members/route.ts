import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

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

    // Find the user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    if (!invitedUser) {
      return NextResponse.json(
        { success: false, error: { message: "User not found with that email address" } },
        { status: 404 }
      );
    }

    // Check if the user is already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: invitedUser.id },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: { message: "User is already a member of this team" } },
        { status: 409 }
      );
    }

    // Create the team member
    const member = await prisma.teamMember.create({
      data: {
        teamId,
        userId: invitedUser.id,
        role: assignedRole,
      },
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
        user: member.user,
      },
    });
  } catch (error) {
    console.error("Invite member error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to invite member" } },
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
