import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { canManageProject } from "@/lib/teams/permissions";
import { notifyTaskCommentAdded } from "@/lib/notifications";

// GET /api/teams/[teamId]/projects/[projectId]/tasks/[taskId]/comments - List comments
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ teamId: string; projectId: string; taskId: string }>;
  }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId, projectId, taskId } = await params;

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

    // Verify task belongs to project
    const task = await prisma.projectTask.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: { message: "Task not found" } },
        { status: 404 }
      );
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });

    // Fetch user data for all comment authors
    const userIds = [...new Set(comments.map((c) => c.userId))];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, avatarUrl: true },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      success: true,
      data: comments.map((c) => ({
        id: c.id,
        taskId: c.taskId,
        userId: c.userId,
        user: userMap.get(c.userId) ?? null,
        content: c.content,
        attachments: c.attachments,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List comments error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to list comments" } },
      { status: 500 }
    );
  }
}

// POST /api/teams/[teamId]/projects/[projectId]/tasks/[taskId]/comments - Add comment
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ teamId: string; projectId: string; taskId: string }>;
  }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId, projectId, taskId } = await params;

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

    // Verify task belongs to project
    const task = await prisma.projectTask.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: { message: "Task not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { content, attachments } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Comment content is required" } },
        { status: 400 }
      );
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId: session.userId,
        content: content.trim(),
        attachments: attachments || "[]",
      },
    });

    // Fetch user data for response
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, avatarUrl: true },
    });

    // Notify task assignee if different from commenter (fire-and-forget)
    if (task.assigneeId && task.assigneeId !== session.userId) {
      notifyTaskCommentAdded({
        userId: task.assigneeId,
        taskTitle: task.title,
        projectName: project.name,
        commenterName: user?.name || "Someone",
        commentPreview: content.trim().substring(0, 100),
        taskId: task.id,
        projectId: project.id,
        teamId,
      }).catch((err: unknown) => {
        console.error("Failed to send task comment notification:", err);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: comment.id,
        taskId: comment.taskId,
        userId: comment.userId,
        user: user ?? null,
        content: comment.content,
        attachments: comment.attachments,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Add comment error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to add comment" } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/projects/[projectId]/tasks/[taskId]/comments - Delete comment
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ teamId: string; projectId: string; taskId: string }>;
  }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { teamId, projectId, taskId } = await params;

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

    // Verify task belongs to project
    const task = await prisma.projectTask.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: { message: "Task not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Comment id is required" } },
        { status: 400 }
      );
    }

    // Find the comment
    const comment = await prisma.taskComment.findUnique({
      where: { id },
    });
    if (!comment || comment.taskId !== taskId) {
      return NextResponse.json(
        { success: false, error: { message: "Comment not found" } },
        { status: 404 }
      );
    }

    // Verify ownership or admin override
    const isOwner = comment.userId === session.userId;
    const isAdmin = canManageProject(membership.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: { message: "You can only delete your own comments" } },
        { status: 403 }
      );
    }

    await prisma.taskComment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete comment" } },
      { status: 500 }
    );
  }
}
