import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { canManageProject } from "@/lib/teams/permissions";

// POST /api/teams/[teamId]/projects/[projectId]/members - Assign team members to project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId, projectId } = await params;

    // Verify team membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Not a team member" } },
        { status: 403 }
      );
    }

    // Check permission
    if (!canManageProject(membership.role)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to manage project members" } },
        { status: 403 }
      );
    }

    // Verify project belongs to team
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { userIds } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "userIds array is required" } },
        { status: 400 }
      );
    }

    // Verify each userId is a team member
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        userId: { in: userIds },
      },
      select: { userId: true },
    });

    const validUserIds = teamMembers.map((m) => m.userId);
    const invalidUserIds = userIds.filter((id: string) => !validUserIds.includes(id));

    if (invalidUserIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `The following users are not team members: ${invalidUserIds.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    // Filter out existing members
    const existingMembers = await prisma.projectMember.findMany({
      where: { projectId, userId: { in: validUserIds } },
      select: { userId: true },
    });
    const existingIds = new Set(existingMembers.map((m) => m.userId));
    const newUserIds = validUserIds.filter((uid: string) => !existingIds.has(uid));

    // Add new members
    const result = newUserIds.length > 0
      ? await prisma.projectMember.createMany({
          data: newUserIds.map((userId: string) => ({
            projectId,
            userId,
          })),
        })
      : { count: 0 };

    return NextResponse.json({
      success: true,
      data: {
        addedCount: result.count,
      },
    });
  } catch (error) {
    console.error("Add project members error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to add project members" } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/projects/[projectId]/members - Remove member from project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId, projectId } = await params;

    // Verify team membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership) {
      return NextResponse.json(
        { success: false, error: { message: "Not a team member" } },
        { status: 403 }
      );
    }

    // Check permission
    if (!canManageProject(membership.role)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to manage project members" } },
        { status: 403 }
      );
    }

    // Verify project belongs to team
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
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

    // Find the project member record
    const projectMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!projectMember) {
      return NextResponse.json(
        { success: false, error: { message: "User is not a member of this project" } },
        { status: 404 }
      );
    }

    await prisma.projectMember.delete({
      where: { id: projectMember.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove project member error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to remove project member" } },
      { status: 500 }
    );
  }
}
