import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/teams/[teamId] - Get team details with members
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

    // Verify the current user is a member of the team
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: session.userId },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Team not found or you are not a member" } },
        { status: 404 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        members: {
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
          orderBy: { joinedAt: "asc" },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: { message: "Team not found" } },
        { status: 404 }
      );
    }

    const responseData = {
      id: team.id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      avatarUrl: team.avatarUrl,
      ownerId: team.ownerId,
      owner: team.owner,
      memberCount: team._count.members,
      members: team.members.map((m: typeof team.members[number]) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        user: m.user,
      })),
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: await presignAllUrls(responseData),
    });
  } catch (error) {
    console.error("Get team error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch team" } },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[teamId] - Update team name/description
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

    // Verify the current user is OWNER or ADMIN
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: session.userId },
      },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to update this team" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "No fields to update" } },
        { status: 400 }
      );
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: updateData,
      include: {
        _count: { select: { members: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        avatarUrl: team.avatarUrl,
        ownerId: team.ownerId,
        memberCount: team._count.members,
        createdAt: team.createdAt.toISOString(),
        updatedAt: team.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Update team error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update team" } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId] - Delete team
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

    // Verify the current user is OWNER
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: session.userId },
      },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json(
        { success: false, error: { message: "Only the team owner can delete the team" } },
        { status: 403 }
      );
    }

    // Delete the team (cascade will remove all TeamMember records)
    await prisma.team.delete({
      where: { id: teamId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete team error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete team" } },
      { status: 500 }
    );
  }
}
