import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";

    // Verify user is team owner or admin
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: session.userId,
        },
      },
    });

    if (!teamMember || (teamMember.role !== "OWNER" && teamMember.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get join requests
    const requests = await prisma.teamJoinRequest.findMany({
      where: {
        teamId,
        status: status as any,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching join requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch join requests" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const body = await request.json();
    const { message } = body;

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { role: "OWNER" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check user is NOT already a team member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: session.userId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "Already a team member" },
        { status: 400 }
      );
    }

    // Check no existing PENDING request
    const existingRequest = await prisma.teamJoinRequest.findFirst({
      where: {
        userId: session.userId,
        teamId,
        status: "PENDING",
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "Join request already pending" },
        { status: 400 }
      );
    }

    // Create TeamJoinRequest
    const joinRequest = await prisma.teamJoinRequest.create({
      data: {
        userId: session.userId,
        teamId,
        message: message || undefined,
        status: "PENDING",
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

    // Get current user info for notification
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    });

    // Send notification to team owner
    const teamOwner = team.members.find((m) => m.role === "OWNER");
    if (teamOwner) {
      await createNotification({
        userId: teamOwner.userId,
        type: "TEAM_JOIN_REQUEST",
        title: "Team Join Request",
        message: `${currentUser?.name || "A user"} requested to join your team "${team.name}"`,
        actionUrl: `/teams/${teamId}`,
      });
    }

    return NextResponse.json(joinRequest);
  } catch (error) {
    console.error("Error creating join request:", error);
    return NextResponse.json(
      { error: "Failed to create join request" },
      { status: 500 }
    );
  }
}
