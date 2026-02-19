import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { canCreateProjects } from "@/lib/teams/permissions";

// GET /api/teams/[teamId]/projects - List projects for team
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

    // Optional status filter
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { teamId };
    if (status) {
      where.status = status;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        _count: {
          select: { tasks: true, members: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        deadline: p.deadline?.toISOString() ?? null,
        totalTasks: p.totalTasks,
        completedTasks: p.completedTasks,
        createdBy: p.createdBy,
        memberCount: p._count.members,
        taskCount: p._count.tasks,
        members: p.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          addedAt: m.addedAt.toISOString(),
          user: m.user,
        })),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List projects error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to list projects" } },
      { status: 500 }
    );
  }
}

// POST /api/teams/[teamId]/projects - Create project
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
    if (!canCreateProjects(membership.role)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to create projects" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, brief, deadline } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Project name is required" } },
        { status: 400 }
      );
    }

    // Create project + add creator as ProjectMember in a transaction
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          teamId,
          name: name.trim(),
          description: description?.trim() || null,
          brief: brief?.trim() || null,
          deadline: deadline ? new Date(deadline) : null,
          createdBy: session.userId,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: created.id,
          userId: session.userId,
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      data: {
        id: project.id,
        teamId: project.teamId,
        name: project.name,
        description: project.description,
        brief: project.brief,
        status: project.status,
        deadline: project.deadline?.toISOString() ?? null,
        totalTasks: project.totalTasks,
        completedTasks: project.completedTasks,
        createdBy: project.createdBy,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create project" } },
      { status: 500 }
    );
  }
}
