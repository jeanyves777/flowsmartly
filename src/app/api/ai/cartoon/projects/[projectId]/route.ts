import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/ai/cartoon/projects/[projectId] - Get project details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { projectId } = await params;

    const project = await prisma.cartoonProject.findFirst({
      where: { id: projectId, userId: session.userId },
      include: {
        videos: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            storyPrompt: true,
            status: true,
            videoUrl: true,
            thumbnailUrl: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        project: {
          ...project,
          characters: JSON.parse(project.characters || "[]"),
        },
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

// PATCH /api/ai/cartoon/projects/[projectId] - Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { projectId } = await params;
    const body = await request.json();
    const { name, description, characters, style, defaultDuration } = body;

    // Verify ownership
    const existing = await prisma.cartoonProject.findFirst({
      where: { id: projectId, userId: session.userId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (characters !== undefined) updateData.characters = JSON.stringify(characters);
    if (style !== undefined) updateData.style = style;
    if (defaultDuration !== undefined) updateData.defaultDuration = defaultDuration;

    const project = await prisma.cartoonProject.update({
      where: { id: projectId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        project: {
          ...project,
          characters: JSON.parse(project.characters),
        },
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

// DELETE /api/ai/cartoon/projects/[projectId] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { projectId } = await params;

    // Verify ownership
    const existing = await prisma.cartoonProject.findFirst({
      where: { id: projectId, userId: session.userId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Project not found" } },
        { status: 404 }
      );
    }

    // Delete the project (videos will have projectId set to null due to onDelete: SetNull)
    await prisma.cartoonProject.delete({
      where: { id: projectId },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Project deleted" },
    });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete project" } },
      { status: 500 }
    );
  }
}
