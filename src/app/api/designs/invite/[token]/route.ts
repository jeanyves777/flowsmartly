import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { recordDesignActivity } from "@/lib/designs/access";

// GET /api/designs/invite/:token - Get invitation details (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const collaborator = await prisma.designCollaborator.findUnique({
      where: { inviteToken: token },
      select: {
        role: true,
        status: true,
        design: {
          select: { name: true },
        },
        inviter: {
          select: { name: true },
        },
      },
    });

    if (!collaborator) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid invitation link" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        designName: collaborator.design.name,
        inviterName: collaborator.inviter.name,
        role: collaborator.role,
        status: collaborator.status,
      },
    });
  } catch (error) {
    console.error("Get invitation details error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch invitation" } },
      { status: 500 }
    );
  }
}

// POST /api/designs/invite/:token - Accept invitation (auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { token } = await params;

    const collaborator = await prisma.designCollaborator.findUnique({
      where: { inviteToken: token },
      select: {
        id: true,
        designId: true,
        userId: true,
        status: true,
      },
    });

    if (!collaborator) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid invitation link" } },
        { status: 404 }
      );
    }

    // Validate: must be PENDING
    if (collaborator.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: { message: "This invitation has already been responded to" } },
        { status: 400 }
      );
    }

    // Validate: invitation must be for this user
    if (collaborator.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "This invitation is not for your account" } },
        { status: 403 }
      );
    }

    // Accept: update status, set acceptedAt, clear inviteToken
    await prisma.designCollaborator.update({
      where: { id: collaborator.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        inviteToken: null,
      },
    });

    // Record JOINED activity
    await recordDesignActivity(
      collaborator.designId,
      session.userId,
      "JOINED",
      { method: "invite" }
    );

    return NextResponse.json({
      success: true,
      data: { designId: collaborator.designId },
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to accept invitation" } },
      { status: 500 }
    );
  }
}
