import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin/auth";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { auditAdmin, AuditAction } from "@/lib/audit/logger";
import { prisma } from "@/lib/db/client";

// Validation schemas
const adjustCreditsSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().refine((val) => val !== 0, "Amount cannot be zero"),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(500),
});

const bulkAdjustSchema = z.object({
  userIds: z.array(z.string()).min(1),
  amount: z.number().int().refine((val) => val !== 0, "Amount cannot be zero"),
  reason: z.string().min(3).max(500),
});

/**
 * GET /api/admin/credits
 * Get credit statistics and user credits list
 */
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
    const view = searchParams.get("view") || "overview";
    const userId = searchParams.get("userId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "credits";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

    // Single user details
    if (userId) {
      const userInfo = await creditService.getUserCreditsInfo(userId);
      if (!userInfo) {
        return NextResponse.json(
          { success: false, error: { message: "User not found" } },
          { status: 404 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          avatarUrl: true,
          plan: true,
          aiCredits: true,
          createdAt: true,
        },
      });

      const history = await creditService.getTransactionHistory(userId, {
        limit: 50,
      });

      return NextResponse.json({
        success: true,
        data: {
          user,
          creditsInfo: userInfo,
          transactions: history.transactions,
        },
      });
    }

    // Overview stats
    if (view === "overview") {
      const stats = await creditService.getCreditStats();

      // Get recent transactions
      const recentTransactions = await prisma.creditTransaction.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      // Get transaction type distribution
      const typeDistribution = await prisma.creditTransaction.groupBy({
        by: ["type"],
        _count: true,
        _sum: { amount: true },
      });

      return NextResponse.json({
        success: true,
        data: {
          stats,
          recentTransactions: recentTransactions.map((t) => ({
            id: t.id,
            userId: t.userId,
            userEmail: t.user.email,
            userName: t.user.name,
            type: t.type,
            amount: t.amount,
            balanceAfter: t.balanceAfter,
            description: t.description,
            reason: t.reason,
            createdAt: t.createdAt,
          })),
          typeDistribution: typeDistribution.map((t) => ({
            type: t.type,
            count: t._count,
            totalAmount: t._sum.amount,
          })),
        },
      });
    }

    // Users list with credits
    if (view === "users") {
      const result = await creditService.getAllUsersCredits({
        limit,
        offset: (page - 1) * limit,
        search: search || undefined,
        sortBy: sortBy as "credits" | "email" | "name" | "createdAt",
        sortOrder,
      });

      return NextResponse.json({
        success: true,
        data: {
          users: result.users,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
            hasMore: result.hasMore,
          },
        },
      });
    }

    // Transactions list
    if (view === "transactions") {
      const type = searchParams.get("type");

      const where = type ? { type } : {};

      const [transactions, total] = await Promise.all([
        prisma.creditTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        }),
        prisma.creditTransaction.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          transactions: transactions.map((t) => ({
            id: t.id,
            userId: t.userId,
            userEmail: t.user.email,
            userName: t.user.name,
            type: t.type,
            amount: t.amount,
            balanceAfter: t.balanceAfter,
            description: t.description,
            reason: t.reason,
            adminId: t.adminId,
            createdAt: t.createdAt,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
          transactionTypes: Object.values(TRANSACTION_TYPES),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: { message: "Invalid view parameter" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Admin credits GET error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch credit data" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/credits
 * Adjust credits for a user (add or deduct)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    // Single user adjustment
    if (action === "adjust") {
      const validation = adjustCreditsSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: "Validation failed",
              details: validation.error.flatten().fieldErrors,
            },
          },
          { status: 400 }
        );
      }

      const { userId, amount, reason } = validation.data;

      const result = await creditService.adminAdjustment(
        session.adminId,
        userId,
        amount,
        reason
      );

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: { message: result.error } },
          { status: 400 }
        );
      }

      // Audit log
      await auditAdmin(
        AuditAction.ADMIN_ACTION,
        session.adminId,
        "CreditTransaction",
        result.transaction?.id,
        {
          action: "credit_adjustment",
          userId,
          amount,
          reason,
          balanceAfter: result.transaction?.balanceAfter,
        }
      );

      // Get updated user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, aiCredits: true },
      });

      return NextResponse.json({
        success: true,
        data: {
          transaction: result.transaction,
          user,
        },
      });
    }

    // Bulk adjustment
    if (action === "bulk_adjust") {
      const validation = bulkAdjustSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: "Validation failed",
              details: validation.error.flatten().fieldErrors,
            },
          },
          { status: 400 }
        );
      }

      const { userIds, amount, reason } = validation.data;
      const results: { userId: string; success: boolean; error?: string }[] = [];

      for (const userId of userIds) {
        const result = await creditService.adminAdjustment(
          session.adminId,
          userId,
          amount,
          reason
        );
        results.push({
          userId,
          success: result.success,
          error: result.error,
        });
      }

      // Audit log
      await auditAdmin(
        AuditAction.ADMIN_ACTION,
        session.adminId,
        "CreditTransaction",
        undefined,
        {
          action: "bulk_credit_adjustment",
          userCount: userIds.length,
          amount,
          reason,
          results,
        }
      );

      const successCount = results.filter((r) => r.success).length;

      return NextResponse.json({
        success: true,
        data: {
          results,
          summary: {
            total: userIds.length,
            successful: successCount,
            failed: userIds.length - successCount,
          },
        },
      });
    }

    return NextResponse.json(
      { success: false, error: { message: "Invalid action" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Admin credits POST error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to adjust credits" } },
      { status: 500 }
    );
  }
}
