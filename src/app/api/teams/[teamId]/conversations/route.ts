import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/teams/[teamId]/conversations — Create or get the team group chat
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

    // Verify the user is a member of the team
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Not a team member" } },
        { status: 403 }
      );
    }

    // Check if a team conversation already exists
    let conversation = await prisma.conversation.findFirst({
      where: { teamId, isGroup: true },
    });

    if (!conversation) {
      // Get all team members
      const members = await prisma.teamMember.findMany({
        where: { teamId },
        select: { userId: true },
      });

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { name: true },
      });

      // Create conversation + participants in a transaction
      conversation = await prisma.$transaction(async (tx) => {
        const convo = await tx.conversation.create({
          data: {
            teamId,
            isGroup: true,
            lastMessageText: `${team?.name || "Team"} group chat created`,
          },
        });

        await tx.conversationParticipant.createMany({
          data: members.map((m) => ({
            conversationId: convo.id,
            userId: m.userId,
          })),
        });

        return convo;
      });
    } else {
      // Ensure the current user is a participant (they may have joined after creation)
      await prisma.conversationParticipant.upsert({
        where: {
          conversationId_userId: {
            conversationId: conversation.id,
            userId: session.userId,
          },
        },
        create: {
          conversationId: conversation.id,
          userId: session.userId,
        },
        update: {},
      });
    }

    return NextResponse.json({
      success: true,
      data: { conversationId: conversation.id },
    });
  } catch (error) {
    console.error("Team conversation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create team conversation" } },
      { status: 500 }
    );
  }
}
