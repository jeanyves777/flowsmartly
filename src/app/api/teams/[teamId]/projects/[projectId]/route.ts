import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { canManageProject } from "@/lib/teams/permissions";

// GET /api/teams/[teamId]/projects/[projectId] - Get project detail
export async function GET(
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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            comments: true,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { tasks: true, members: true },
        },
      },
    });

    if (!project || project.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    // Look up assignee user data for tasks
    const assigneeIds = [
      ...new Set(
        project.tasks
          .map((t) => t.assigneeId)
          .filter((id): id is string => id !== null)
      ),
    ];

    const assigneeUsers =
      assigneeIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, name: true, avatarUrl: true },
          })
        : [];

    const assigneeMap = new Map(assigneeUsers.map((u) => [u.id, u]));

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
        taskCount: project._count.tasks,
        memberCount: project._count.members,
        tasks: project.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          assigneeId: t.assigneeId,
          assignee: t.assigneeId ? assigneeMap.get(t.assigneeId) ?? null : null,
          createdById: t.createdById,
          startDate: t.startDate?.toISOString() ?? null,
          dueDate: t.dueDate?.toISOString() ?? null,
          completedAt: t.completedAt?.toISOString() ?? null,
          sortOrder: t.sortOrder,
          progress: t.progress,
          attachments: t.attachments,
          commentCount: t.comments.length,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        members: project.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          addedAt: m.addedAt.toISOString(),
          user: m.user,
        })),
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Get project error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch project" } },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[teamId]/projects/[projectId] - Update project
export async function PATCH(
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
        { success: false, error: { message: "You do not have permission to update this project" } },
        { status: 403 }
      );
    }

    // Verify project belongs to team
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!existingProject || existingProject.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, brief, status, deadline } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (brief !== undefined) updateData.brief = brief?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "No fields to update" } },
        { status: 400 }
      );
    }

    // If status changes to COMPLETED, set all incomplete tasks to DONE
    if (status === "COMPLETED" && existingProject.status !== "COMPLETED") {
      await prisma.projectTask.updateMany({
        where: {
          projectId,
          status: { not: "DONE" },
        },
        data: {
          status: "DONE",
          completedAt: new Date(),
        },
      });

      // Update completedTasks count to match totalTasks
      updateData.completedTasks = existingProject.totalTasks;
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: updateData,
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
    console.error("Update project error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update project" } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/projects/[projectId] - Delete project
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
        { success: false, error: { message: "You do not have permission to delete this project" } },
        { status: 403 }
      );
    }

    // Verify project belongs to team
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!existingProject || existingProject.teamId !== teamId) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    // Delete project (cascade handles tasks, members)
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete project" } },
      { status: 500 }
    );
  }
}
