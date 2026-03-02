import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

/**
 * POST /api/teams/fix-invites
 * One-time fix: finds all PENDING team invitations where the invited email
 * matches an existing registered user, adds them as team members, and marks
 * the invitation as ACCEPTED.
 *
 * Only callable by the logged-in user (fixes invites for all teams).
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    // Find all PENDING invitations that haven't expired
    const pendingInvites = await prisma.teamInvitation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: { id: true, teamId: true, email: true, role: true },
    });

    let joined = 0;
    let alreadyMember = 0;
    let noUser = 0;

    for (const invite of pendingInvites) {
      // Check if this email belongs to a registered user
      const user = await prisma.user.findUnique({
        where: { email: invite.email },
        select: { id: true },
      });

      if (!user) { noUser++; continue; }

      // Check if already a team member
      const existing = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: invite.teamId, userId: user.id } },
      });

      if (existing) {
        // Just mark invite accepted since they're already in
        await prisma.teamInvitation.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
        alreadyMember++;
        continue;
      }

      // Add as team member
      await prisma.teamMember.create({
        data: { teamId: invite.teamId, userId: user.id, role: invite.role },
      });

      // Mark invitation accepted
      await prisma.teamInvitation.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });

      joined++;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalPending: pendingInvites.length,
        joined,
        alreadyMember,
        noMatchingUser: noUser,
      },
    });
  } catch (error) {
    console.error("Fix invites error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fix invites" } },
      { status: 500 }
    );
  }
}
