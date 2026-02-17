/**
 * Credit Management Service
 *
 * Centralized service for managing AI credits including:
 * - Credit balance queries
 * - Credit transactions
 * - Admin credit adjustments
 * - Transaction history
 */

import { prisma } from "@/lib/db/client";

// Transaction types
export const TRANSACTION_TYPES = {
  PURCHASE: "PURCHASE",
  USAGE: "USAGE",
  BONUS: "BONUS",
  REFUND: "REFUND",
  ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT",
  SUBSCRIPTION: "SUBSCRIPTION",
  REFERRAL: "REFERRAL",
  WELCOME: "WELCOME",
} as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

// Credit service interface
interface CreditTransactionInput {
  userId: string;
  type: TransactionType;
  amount: number;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  adminId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

interface TransactionResult {
  success: boolean;
  transaction?: {
    id: string;
    amount: number;
    balanceAfter: number;
    type: string;
    createdAt: Date;
  };
  error?: string;
}

interface UserCreditsInfo {
  userId: string;
  currentBalance: number;
  totalEarned: number;
  totalSpent: number;
  transactionCount: number;
}

/**
 * Credit Service Class
 * Singleton for centralized credit management
 */
class CreditService {
  private static instance: CreditService;

  private constructor() {}

  static getInstance(): CreditService {
    if (!CreditService.instance) {
      CreditService.instance = new CreditService();
    }
    return CreditService.instance;
  }

  /**
   * Get user's current credit balance
   */
  async getBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiCredits: true },
    });
    return user?.aiCredits ?? 0;
  }

  /**
   * Get detailed credit info for a user
   */
  async getUserCreditsInfo(userId: string): Promise<UserCreditsInfo | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiCredits: true },
    });

    if (!user) return null;

    const transactions = await prisma.creditTransaction.aggregate({
      where: { userId },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    const earned = await prisma.creditTransaction.aggregate({
      where: { userId, amount: { gt: 0 } },
      _sum: { amount: true },
    });

    const spent = await prisma.creditTransaction.aggregate({
      where: { userId, amount: { lt: 0 } },
      _sum: { amount: true },
    });

    return {
      userId,
      currentBalance: user.aiCredits,
      totalEarned: earned._sum.amount ?? 0,
      totalSpent: Math.abs(spent._sum.amount ?? 0),
      transactionCount: transactions._count,
    };
  }

  /**
   * Add credits to user account
   */
  async addCredits(input: CreditTransactionInput): Promise<TransactionResult> {
    const { userId, type, amount, description, referenceType, referenceId, adminId, reason, metadata } = input;

    if (amount <= 0) {
      return { success: false, error: "Amount must be positive for adding credits" };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Update user balance
        const user = await tx.user.update({
          where: { id: userId },
          data: { aiCredits: { increment: amount } },
          select: { aiCredits: true },
        });

        // Create transaction record
        const transaction = await tx.creditTransaction.create({
          data: {
            userId,
            type,
            amount,
            balanceAfter: user.aiCredits,
            description,
            referenceType,
            referenceId,
            adminId,
            reason,
            metadata: JSON.stringify(metadata ?? {}),
          },
        });

        return { user, transaction };
      });

      return {
        success: true,
        transaction: {
          id: result.transaction.id,
          amount: result.transaction.amount,
          balanceAfter: result.transaction.balanceAfter,
          type: result.transaction.type,
          createdAt: result.transaction.createdAt,
        },
      };
    } catch (error) {
      console.error("Add credits error:", error);
      return { success: false, error: "Failed to add credits" };
    }
  }

  /**
   * Deduct credits from user account
   */
  async deductCredits(input: CreditTransactionInput & { deductFreeCredits?: boolean }): Promise<TransactionResult> {
    const { userId, type, amount, description, referenceType, referenceId, metadata, deductFreeCredits } = input;

    if (amount <= 0) {
      return { success: false, error: "Amount must be positive for deducting credits" };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Check current balance
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { aiCredits: true, freeCredits: true },
        });

        if (!user || user.aiCredits < amount) {
          throw new Error("Insufficient credits");
        }

        // Update user balance
        const updateData: Record<string, unknown> = { aiCredits: { decrement: amount } };

        // For email/SMS features, also consume free credits
        if (deductFreeCredits && (user.freeCredits || 0) > 0) {
          const freeDeduction = Math.min(amount, user.freeCredits || 0);
          updateData.freeCredits = { decrement: freeDeduction };
        }

        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: updateData,
          select: { aiCredits: true },
        });

        // Create transaction record
        const transaction = await tx.creditTransaction.create({
          data: {
            userId,
            type,
            amount: -amount, // Negative for deduction
            balanceAfter: updatedUser.aiCredits,
            description,
            referenceType,
            referenceId,
            metadata: JSON.stringify(metadata ?? {}),
          },
        });

        return { user: updatedUser, transaction };
      });

      return {
        success: true,
        transaction: {
          id: result.transaction.id,
          amount: result.transaction.amount,
          balanceAfter: result.transaction.balanceAfter,
          type: result.transaction.type,
          createdAt: result.transaction.createdAt,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Insufficient credits") {
        return { success: false, error: "Insufficient credits" };
      }
      console.error("Deduct credits error:", error);
      return { success: false, error: "Failed to deduct credits" };
    }
  }

  /**
   * Admin adjustment - can add or deduct
   */
  async adminAdjustment(
    adminId: string,
    userId: string,
    amount: number,
    reason: string
  ): Promise<TransactionResult> {
    if (amount === 0) {
      return { success: false, error: "Amount cannot be zero" };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Check if user exists
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { aiCredits: true },
        });

        if (!user) {
          throw new Error("User not found");
        }

        // For negative adjustments, check if balance would go negative
        if (amount < 0 && user.aiCredits + amount < 0) {
          throw new Error("Adjustment would result in negative balance");
        }

        // Update user balance
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { aiCredits: { increment: amount } },
          select: { aiCredits: true },
        });

        // Create transaction record
        const transaction = await tx.creditTransaction.create({
          data: {
            userId,
            type: TRANSACTION_TYPES.ADMIN_ADJUSTMENT,
            amount,
            balanceAfter: updatedUser.aiCredits,
            adminId,
            reason,
            description: `Admin adjustment: ${amount > 0 ? "+" : ""}${amount} credits`,
          },
        });

        return { user: updatedUser, transaction };
      });

      return {
        success: true,
        transaction: {
          id: result.transaction.id,
          amount: result.transaction.amount,
          balanceAfter: result.transaction.balanceAfter,
          type: result.transaction.type,
          createdAt: result.transaction.createdAt,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      console.error("Admin adjustment error:", error);
      return { success: false, error: "Failed to adjust credits" };
    }
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      type?: TransactionType;
    }
  ) {
    const { limit = 50, offset = 0, type } = options ?? {};

    const where = {
      userId,
      ...(type ? { type } : {}),
    };

    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.creditTransaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      hasMore: offset + transactions.length < total,
    };
  }

  /**
   * Get all users with credit info (for admin)
   */
  async getAllUsersCredits(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: "credits" | "email" | "name" | "createdAt";
    sortOrder?: "asc" | "desc";
  }) {
    const { limit = 50, offset = 0, search, sortBy = "createdAt", sortOrder = "desc" } = options ?? {};

    const where = search
      ? {
          OR: [
            { email: { contains: search } },
            { name: { contains: search } },
            { username: { contains: search } },
          ],
          deletedAt: null,
        }
      : { deletedAt: null };

    const orderBy = {
      [sortBy === "credits" ? "aiCredits" : sortBy]: sortOrder,
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          avatarUrl: true,
          plan: true,
          aiCredits: true,
          createdAt: true,
          _count: {
            select: { creditTransactions: true },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        ...u,
        transactionCount: u._count.creditTransactions,
        _count: undefined,
      })),
      total,
      hasMore: offset + users.length < total,
    };
  }

  /**
   * Get credit statistics (for admin dashboard)
   */
  async getCreditStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalCreditsInSystem,
      totalUsersWithCredits,
      thisMonthTransactions,
      lastMonthTransactions,
      topUsers,
    ] = await Promise.all([
      prisma.user.aggregate({
        _sum: { aiCredits: true },
        where: { deletedAt: null },
      }),
      prisma.user.count({
        where: { aiCredits: { gt: 0 }, deletedAt: null },
      }),
      prisma.creditTransaction.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.creditTransaction.aggregate({
        where: {
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { aiCredits: "desc" },
        take: 10,
        select: {
          id: true,
          email: true,
          name: true,
          aiCredits: true,
        },
      }),
    ]);

    return {
      totalCreditsInSystem: totalCreditsInSystem._sum.aiCredits ?? 0,
      totalUsersWithCredits,
      thisMonth: {
        netChange: thisMonthTransactions._sum.amount ?? 0,
        transactionCount: thisMonthTransactions._count,
      },
      lastMonth: {
        netChange: lastMonthTransactions._sum.amount ?? 0,
        transactionCount: lastMonthTransactions._count,
      },
      topUsers,
    };
  }
}

// Export singleton instance
export const creditService = CreditService.getInstance();

// Export class for testing
export { CreditService };

// Re-export centralized costs
export {
  CREDIT_COSTS,
  CREDIT_COST_LABELS,
  AI_FEATURE_COST_MAP,
  CREDIT_TO_CENTS,
  getCreditCost,
  getCreditCostLabel,
  checkCreditsForFeature,
  canUseFreeCredits,
} from "./costs";
export type { CreditCostKey } from "./costs";
