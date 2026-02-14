import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { auditAdmin, AuditAction } from "@/lib/audit/logger";
import { creditService } from "@/lib/credits";
import { presignAllUrls } from "@/lib/utils/s3-client";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const plan = searchParams.get("plan") || "all";
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status === "active") {
      where.deletedAt = null;
    } else if (status === "deleted") {
      where.deletedAt = { not: null };
    }

    if (plan && plan !== "all") {
      where.plan = plan;
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
        { username: { contains: search } },
      ];
    }

    // Fetch users with pagination
    const [users, total, stats] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          avatarUrl: true,
          plan: true,
          planExpiresAt: true,
          aiCredits: true,
          balanceCents: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          deletedAt: true,
          _count: {
            select: {
              posts: true,
              campaigns: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
      // Get stats
      Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({
          where: {
            deletedAt: null,
            lastLoginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.user.count({
          where: {
            deletedAt: null,
            plan: { not: "STARTER" },
          },
        }),
        prisma.user.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            deletedAt: null,
          },
        }),
      ]),
    ]);

    // Format users
    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      aiCredits: user.aiCredits,
      balanceCents: user.balanceCents,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isDeleted: !!user.deletedAt,
      postsCount: user._count.posts,
      campaignsCount: user._count.campaigns,
    }));

    // Get plan distribution
    const planDistribution = await prisma.user.groupBy({
      by: ["plan"],
      _count: { id: true },
      where: { deletedAt: null },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        users: formattedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          totalUsers: stats[0],
          activeUsers: stats[1],
          paidUsers: stats[2],
          newThisMonth: stats[3],
        },
        planDistribution: planDistribution.map((p) => ({
          plan: p.plan,
          count: p._count.id,
        })),
      }),
    });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch users" } },
      { status: 500 }
    );
  }
}

// Update user (ban/unban, change plan, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, action, data } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: { message: "Missing userId or action" } },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "User not found" } },
        { status: 404 }
      );
    }

    let updatedUser;
    let auditAction: (typeof AuditAction)[keyof typeof AuditAction] = AuditAction.ADMIN_ACTION;

    switch (action) {
      case "ban":
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { deletedAt: new Date() },
        });
        auditAction = AuditAction.USER_BANNED;
        break;

      case "unban":
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { deletedAt: null },
        });
        auditAction = AuditAction.USER_UNBANNED;
        break;

      case "updatePlan":
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            plan: data.plan,
            planExpiresAt: data.planExpiresAt ? new Date(data.planExpiresAt) : null,
          },
        });
        break;

      case "addCredits": {
        const creditsToAdd = data.credits || 0;
        if (creditsToAdd > 0) {
          await creditService.adminAdjustment(
            session.adminId,
            userId,
            creditsToAdd,
            data.reason || "Admin credit addition"
          );
        }
        updatedUser = await prisma.user.findUnique({ where: { id: userId } });
        break;
      }

      case "updateBalance":
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { balanceCents: data.balanceCents },
        });
        break;

      default:
        return NextResponse.json(
          { success: false, error: { message: "Invalid action" } },
          { status: 400 }
        );
    }

    // Log the action
    await auditAdmin(
      auditAction,
      session.adminId,
      "User",
      userId,
      { action, data, userEmail: user.email }
    );

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({ user: updatedUser }),
    });
  } catch (error) {
    console.error("Admin user update error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update user" } },
      { status: 500 }
    );
  }
}
