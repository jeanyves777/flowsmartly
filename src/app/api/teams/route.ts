import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";

// GET /api/teams - List teams the current user is a member of
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: { userId: session.userId },
        },
      },
      include: {
        _count: {
          select: { members: true },
        },
        members: {
          where: { userId: session.userId },
          select: { role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = teams.map((team: typeof teams[number]) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      avatarUrl: team.avatarUrl,
      ownerId: team.ownerId,
      memberCount: team._count.members,
      myRole: team.members[0]?.role ?? null,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: data });
  } catch (error) {
    console.error("List teams error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch teams" } },
      { status: 500 }
    );
  }
}

// POST /api/teams - Create a new team
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Plan gate — team creation requires PRO+
    const gate = await checkPlanAccess(session.user.plan, "Team collaboration", session.userId);
    if (gate) return gate;

    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Team name is required" } },
        { status: 400 }
      );
    }

    // Generate slug from name: lowercase, replace spaces with dashes, append random 4 chars
    const baseSlug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${randomSuffix}`;

    // Create team and add creator as OWNER in a transaction
    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          name: name.trim(),
          slug,
          description: description?.trim() || null,
          ownerId: session.userId,
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: newTeam.id,
          userId: session.userId,
          role: "OWNER",
        },
      });

      return tx.team.findUnique({
        where: { id: newTeam.id },
        include: {
          _count: { select: { members: true } },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: team,
    });
  } catch (error) {
    console.error("Create team error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create team" } },
      { status: 500 }
    );
  }
}
