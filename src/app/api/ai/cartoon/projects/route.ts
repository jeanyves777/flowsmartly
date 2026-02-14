import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/ai/cartoon/projects - List user's cartoon projects
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const projects = await prisma.cartoonProject.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        characters: true,
        style: true,
        defaultDuration: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { videos: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        projects: projects.map((p) => ({
          ...p,
          characters: JSON.parse(p.characters || "[]"),
          videosCount: p._count.videos,
        })),
      },
    });
  } catch (error) {
    console.error("List projects error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch projects" } },
      { status: 500 }
    );
  }
}

// POST /api/ai/cartoon/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, characters, style, defaultDuration } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Project name is required" } },
        { status: 400 }
      );
    }

    const project = await prisma.cartoonProject.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        description: description || null,
        characters: JSON.stringify(characters || []),
        style: style || "pixar",
        defaultDuration: defaultDuration || 60,
      },
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
    console.error("Create project error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create project" } },
      { status: 500 }
    );
  }
}
