import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkDesignAccess, recordDesignActivity } from "@/lib/designs/access";
import crypto from "crypto";

// GET /api/designs/:id/collaborators - List collaborators for a design
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id: designId } = await params;

    const { allowed } = await checkDesignAccess(designId, session.userId);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { message: "Access denied" } },
        { status: 403 }
      );
    }

    // Fetch the design with owner info
    const design = await prisma.design.findUnique({
      where: { id: designId },
      select: {
        userId: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!design) {
      return NextResponse.json(
        { success: false, error: { message: "Design not found" } },
        { status: 404 }
      );
    }

    // Fetch all collaborators
    const collaborators = await prisma.designCollaborator.findMany({
      where: { designId },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        acceptedAt: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Include the owner as a virtual "OWNER" entry at the top
    const ownerEntry = {
      id: `owner-${design.userId}`,
      userId: design.userId,
      role: "OWNER" as const,
      status: "ACCEPTED" as const,
      acceptedAt: null,
      createdAt: null,
      user: design.user,
    };

    return NextResponse.json({
      success: true,
      data: [ownerEntry, ...collaborators],
    });
  } catch (error) {
    console.error("List collaborators error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to list collaborators" } },
      { status: 500 }
    );
  }
}

// POST /api/designs/:id/collaborators - Invite a collaborator
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id: designId } = await params;

    // Only owner or editor can invite
    const { allowed, role } = await checkDesignAccess(designId, session.userId);
    if (!allowed || (role !== "OWNER" && role !== "EDITOR")) {
      return NextResponse.json(
        { success: false, error: { message: "Only owners and editors can invite collaborators" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role: inviteRole } = body as {
      email: string;
      role: "VIEWER" | "EDITOR";
    };

    if (!email || !inviteRole) {
      return NextResponse.json(
        { success: false, error: { message: "Email and role are required" } },
        { status: 400 }
      );
    }

    if (!["VIEWER", "EDITOR"].includes(inviteRole)) {
      return NextResponse.json(
        { success: false, error: { message: "Role must be VIEWER or EDITOR" } },
        { status: 400 }
      );
    }

    // Look up user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true },
    });

    if (!invitedUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message:
              "User not found on FlowSmartly. They need to create an account first.",
          },
        },
        { status: 404 }
      );
    }

    // Can't invite yourself
    if (invitedUser.id === session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "You cannot invite yourself" } },
        { status: 400 }
      );
    }

    // Check if the user is the design owner
    const design = await prisma.design.findUnique({
      where: { id: designId },
      select: { userId: true },
    });

    if (design && design.userId === invitedUser.id) {
      return NextResponse.json(
        { success: false, error: { message: "This user is already the owner of this design" } },
        { status: 400 }
      );
    }

    // Prevent duplicate invites (@@unique([designId, userId]))
    const existing = await prisma.designCollaborator.findUnique({
      where: { designId_userId: { designId, userId: invitedUser.id } },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { message: "This user has already been invited" } },
        { status: 409 }
      );
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString("hex");

    const collaborator = await prisma.designCollaborator.create({
      data: {
        designId,
        userId: invitedUser.id,
        role: inviteRole,
        invitedBy: session.userId,
        inviteEmail: invitedUser.email,
        inviteToken,
        status: "PENDING",
      },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        inviteToken: true,
        acceptedAt: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Record activity
    await recordDesignActivity(designId, session.userId, "INVITED", {
      collaboratorId: collaborator.id,
      invitedUserId: invitedUser.id,
      invitedEmail: invitedUser.email,
      role: inviteRole,
    });

    return NextResponse.json({ success: true, data: collaborator });
  } catch (error) {
    console.error("Invite collaborator error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to invite collaborator" } },
      { status: 500 }
    );
  }
}

// PATCH /api/designs/:id/collaborators - Update collaborator role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id: designId } = await params;

    // Only owner or editor can update roles
    const { allowed, role } = await checkDesignAccess(designId, session.userId);
    if (!allowed || (role !== "OWNER" && role !== "EDITOR")) {
      return NextResponse.json(
        { success: false, error: { message: "Only owners and editors can update collaborator roles" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { collaboratorId, role: newRole } = body as {
      collaboratorId: string;
      role: "VIEWER" | "EDITOR";
    };

    if (!collaboratorId || !newRole) {
      return NextResponse.json(
        { success: false, error: { message: "collaboratorId and role are required" } },
        { status: 400 }
      );
    }

    if (!["VIEWER", "EDITOR"].includes(newRole)) {
      return NextResponse.json(
        { success: false, error: { message: "Role must be VIEWER or EDITOR" } },
        { status: 400 }
      );
    }

    // Fetch the collaborator and verify it belongs to this design
    const collaborator = await prisma.designCollaborator.findFirst({
      where: { id: collaboratorId, designId },
    });

    if (!collaborator) {
      return NextResponse.json(
        { success: false, error: { message: "Collaborator not found" } },
        { status: 404 }
      );
    }

    // Can't change the design owner's role
    const design = await prisma.design.findUnique({
      where: { id: designId },
      select: { userId: true },
    });

    if (design && collaborator.userId === design.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Cannot change the owner's role" } },
        { status: 400 }
      );
    }

    const updated = await prisma.designCollaborator.update({
      where: { id: collaboratorId },
      data: { role: newRole },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        acceptedAt: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    await recordDesignActivity(designId, session.userId, "ROLE_UPDATED", {
      collaboratorId,
      userId: collaborator.userId,
      oldRole: collaborator.role,
      newRole,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update collaborator role error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update collaborator role" } },
      { status: 500 }
    );
  }
}

// DELETE /api/designs/:id/collaborators - Remove a collaborator
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id: designId } = await params;

    // Only owner or editor can remove collaborators
    const { allowed, role } = await checkDesignAccess(designId, session.userId);
    if (!allowed || (role !== "OWNER" && role !== "EDITOR")) {
      return NextResponse.json(
        { success: false, error: { message: "Only owners and editors can remove collaborators" } },
        { status: 403 }
      );
    }

    // Support collaboratorId from query params or request body
    const { searchParams } = new URL(request.url);
    let collaboratorId = searchParams.get("collaboratorId");

    if (!collaboratorId) {
      try {
        const body = await request.json();
        collaboratorId = body.collaboratorId;
      } catch {
        // No body provided
      }
    }

    if (!collaboratorId) {
      return NextResponse.json(
        { success: false, error: { message: "collaboratorId is required" } },
        { status: 400 }
      );
    }

    // Verify the collaborator belongs to this design
    const collaborator = await prisma.designCollaborator.findFirst({
      where: { id: collaboratorId, designId },
    });

    if (!collaborator) {
      return NextResponse.json(
        { success: false, error: { message: "Collaborator not found" } },
        { status: 404 }
      );
    }

    await prisma.designCollaborator.delete({
      where: { id: collaboratorId },
    });

    await recordDesignActivity(designId, session.userId, "COLLABORATOR_REMOVED", {
      collaboratorId,
      removedUserId: collaborator.userId,
      role: collaborator.role,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove collaborator error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to remove collaborator" } },
      { status: 500 }
    );
  }
}
