import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { canInviteMembers } from "@/lib/teams/permissions";

// GET /api/teams/[teamId]/invitations - List pending invitations
export async function GET(
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

    // Verify membership and permissions
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: session.userId },
      },
    });

    if (!membership || !canInviteMembers(membership.role)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to view invitations" } },
        { status: 403 }
      );
    }

    const invitations = await prisma.teamInvitation.findMany({
      where: {
        teamId,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch inviter names
    const inviterIds = [...new Set(invitations.map((inv) => inv.invitedBy))];
    const inviters = await prisma.user.findMany({
      where: { id: { in: inviterIds } },
      select: { id: true, name: true },
    });
    const inviterMap = new Map(inviters.map((u) => [u.id, u.name]));

    return NextResponse.json({
      success: true,
      data: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        invitedBy: inv.invitedBy,
        inviterName: inviterMap.get(inv.invitedBy) || "Unknown",
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List invitations error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to list invitations" } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/invitations - Cancel a pending invitation
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

    // Verify membership and permissions (ADMIN+)
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: session.userId },
      },
    });

    if (!membership || !canInviteMembers(membership.role)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to cancel invitations" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: { message: "invitationId is required" } },
        { status: 400 }
      );
    }

    // Find the invitation
    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        id: invitationId,
        teamId,
        status: "PENDING",
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: { message: "Invitation not found or already processed" } },
        { status: 404 }
      );
    }

    // Cancel the invitation
    await prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel invitation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to cancel invitation" } },
      { status: 500 }
    );
  }
}
