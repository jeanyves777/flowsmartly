import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * get_credits_history — current balance + recent transactions for the
 * user. Read-only, free.
 *
 * The agent should reach for this when the user asks "how many credits
 * do I have?", "what did I spend on?", "why are my credits low?", or
 * when planning an expensive action (lets the agent warn proactively).
 *
 * Returns the latest N transactions grouped by `type` so the agent can
 * summarize cleanly without showing 50 raw rows.
 */
export const getCreditsHistory: FlowAgentTool = {
  name: "get_credits_history",
  description:
    "Get the user's current credit balance + recent credit transactions (purchases, usage, refunds, bonuses). Optional filter by transaction type. Use BEFORE quoting an expensive action so you can warn 'you'll be down to 12 credits after this' or suggest topping up. Returns transactions sorted newest first.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max transactions to return (1-100, default 20)." },
      type: {
        type: "string",
        description: "Optional filter: PURCHASE | USAGE | BONUS | REFUND | ADMIN_ADJUSTMENT | SUBSCRIPTION | REFERRAL.",
      },
      sinceIso: { type: "string", description: "Optional ISO datetime — only transactions newer than this." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit =
        typeof input.limit === "number"
          ? Math.min(100, Math.max(1, Math.floor(input.limit)))
          : 20;
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (typeof input.type === "string" && input.type.trim()) {
        where.type = input.type.trim().toUpperCase();
      }
      if (typeof input.sinceIso === "string" && input.sinceIso.trim()) {
        const since = new Date(input.sinceIso);
        if (!Number.isNaN(since.getTime())) {
          where.createdAt = { gte: since };
        }
      }

      const [user, transactions] = await Promise.all([
        prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { aiCredits: true, plan: true },
        }),
        prisma.creditTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            type: true,
            amount: true,
            balanceAfter: true,
            referenceType: true,
            description: true,
            createdAt: true,
          },
        }),
      ]);

      // Roll up totals by type — easy for the agent to summarize.
      const byType: Record<string, { count: number; total: number }> = {};
      for (const t of transactions) {
        const entry = byType[t.type] ?? { count: 0, total: 0 };
        entry.count += 1;
        entry.total += t.amount;
        byType[t.type] = entry;
      }

      return {
        ok: true,
        data: {
          currentBalance: user?.aiCredits ?? 0,
          plan: user?.plan ?? "STARTER",
          rollups: Object.entries(byType).map(([type, v]) => ({
            type,
            count: v.count,
            netCredits: v.total,
          })),
          transactionCount: transactions.length,
          transactions: transactions.map((t) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            balanceAfter: t.balanceAfter,
            referenceType: t.referenceType,
            description: t.description,
            createdAt: t.createdAt.toISOString(),
          })),
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to load credit history",
      };
    }
  },
};
