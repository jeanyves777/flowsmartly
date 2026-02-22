import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { canManageProject } from "@/lib/teams/permissions";

type Params = { params: Promise<{ teamId: string; projectId: string }> };

// GET /api/teams/[teamId]/projects/[projectId]/permissions?userId=xxx
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { teamId, projectId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // Verify caller is team member
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership) {
      return NextResponse.json({ success: false, error: { message: "Not a team member" } }, { status: 403 });
    }

    // If specific user requested, return their permissions
    if (userId) {
      const pm = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        include: {
          permissions: { orderBy: { featureKey: "asc" } },
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      if (!pm) {
        return NextResponse.json({ success: false, error: { message: "Member not found in project" } }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: pm.id,
          userId: pm.userId,
          user: pm.user,
          creditAllowance: pm.creditAllowance,
          creditsUsed: pm.creditsUsed,
          canActOnBehalf: pm.canActOnBehalf,
          expiresAt: pm.expiresAt?.toISOString() || null,
          isRevoked: pm.isRevoked,
          revokedAt: pm.revokedAt?.toISOString() || null,
          permissions: pm.permissions.map((p) => ({
            id: p.id,
            featureKey: p.featureKey,
            maxUsage: p.maxUsage,
            usedCount: p.usedCount,
          })),
        },
      });
    }

    // Return all project members with their permissions
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        permissions: { orderBy: { featureKey: "asc" } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { addedAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: members.map((pm) => ({
        id: pm.id,
        userId: pm.userId,
        user: pm.user,
        creditAllowance: pm.creditAllowance,
        creditsUsed: pm.creditsUsed,
        canActOnBehalf: pm.canActOnBehalf,
        expiresAt: pm.expiresAt?.toISOString() || null,
        isRevoked: pm.isRevoked,
        permissions: pm.permissions.map((p) => ({
          id: p.id,
          featureKey: p.featureKey,
          maxUsage: p.maxUsage,
          usedCount: p.usedCount,
        })),
      })),
    });
  } catch (error) {
    console.error("Get permissions error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch permissions" } }, { status: 500 });
  }
}

// PUT /api/teams/[teamId]/projects/[projectId]/permissions - Update member permissions
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { teamId, projectId } = await params;

    // Verify caller is ADMIN+
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership || !canManageProject(membership.role)) {
      return NextResponse.json({ success: false, error: { message: "Insufficient permissions" } }, { status: 403 });
    }

    const body = await request.json();
    const { userId, creditAllowance, canActOnBehalf, expiresAt, permissions } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: { message: "userId is required" } }, { status: 400 });
    }

    // Find project member
    const pm = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { permissions: true },
    });

    if (!pm) {
      return NextResponse.json({ success: false, error: { message: "Member not found in project" } }, { status: 404 });
    }

    // Update ProjectMember fields
    await prisma.projectMember.update({
      where: { id: pm.id },
      data: {
        ...(creditAllowance !== undefined ? { creditAllowance } : {}),
        ...(canActOnBehalf !== undefined ? { canActOnBehalf } : {}),
        ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
        // Restore if previously revoked and being updated
        ...(canActOnBehalf ? { isRevoked: false, revokedAt: null } : {}),
      },
    });

    // Sync permissions if provided
    if (Array.isArray(permissions)) {
      const newKeys = new Set(permissions.map((p: { featureKey: string }) => p.featureKey));

      // Delete permissions not in the new list
      const existingKeys = pm.permissions.map((p) => p.featureKey);
      const toDelete = existingKeys.filter((k) => !newKeys.has(k));
      if (toDelete.length > 0) {
        await prisma.memberPermission.deleteMany({
          where: { projectMemberId: pm.id, featureKey: { in: toDelete } },
        });
      }

      // Upsert all permissions in the new list
      for (const perm of permissions as { featureKey: string; maxUsage: number }[]) {
        await prisma.memberPermission.upsert({
          where: {
            projectMemberId_featureKey: {
              projectMemberId: pm.id,
              featureKey: perm.featureKey,
            },
          },
          create: {
            projectMemberId: pm.id,
            featureKey: perm.featureKey,
            maxUsage: perm.maxUsage ?? -1,
          },
          update: {
            maxUsage: perm.maxUsage ?? -1,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update permissions error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update permissions" } }, { status: 500 });
  }
}

// DELETE /api/teams/[teamId]/projects/[projectId]/permissions - Revoke member access
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { teamId, projectId } = await params;

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership || !canManageProject(membership.role)) {
      return NextResponse.json({ success: false, error: { message: "Insufficient permissions" } }, { status: 403 });
    }

    const body = await request.json();
    const { userId, restore } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: { message: "userId is required" } }, { status: 400 });
    }

    const pm = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!pm) {
      return NextResponse.json({ success: false, error: { message: "Member not found" } }, { status: 404 });
    }

    if (restore) {
      // Restore access
      await prisma.projectMember.update({
        where: { id: pm.id },
        data: { isRevoked: false, revokedAt: null },
      });
    } else {
      // Revoke access
      await prisma.projectMember.update({
        where: { id: pm.id },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke access error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update access" } }, { status: 500 });
  }
}
