import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

/**
 * GET /api/admin/ai-spend — real Claude API dollar spend, from the AIUsage table.
 *
 * Groups by feature + model over a window (default 30 days) and returns summed
 * costCents / tokens / call-count so admins can see actual spend per feature and
 * reconcile it against the credits charged (see the credit-pricing audit).
 *
 * `?days=N` sets the window (default 30, max 365).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30")));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const grouped = await prisma.aIUsage.groupBy({
      by: ["feature", "model"],
      where: { createdAt: { gte: since } },
      _sum: { costCents: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    });

    const rows = grouped
      .map((g) => ({
        feature: g.feature,
        model: g.model,
        costCents: g._sum.costCents ?? 0,
        inputTokens: g._sum.inputTokens ?? 0,
        outputTokens: g._sum.outputTokens ?? 0,
        calls: g._count._all,
      }))
      .sort((a, b) => b.costCents - a.costCents);

    const totals = rows.reduce(
      (acc, r) => {
        acc.costCents += r.costCents;
        acc.inputTokens += r.inputTokens;
        acc.outputTokens += r.outputTokens;
        acc.calls += r.calls;
        return acc;
      },
      { costCents: 0, inputTokens: 0, outputTokens: 0, calls: 0 },
    );

    return NextResponse.json({
      success: true,
      data: {
        windowDays: days,
        since: since.toISOString(),
        totals,
        rows,
      },
    });
  } catch (error) {
    console.error("Admin AI spend error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch AI spend" } },
      { status: 500 },
    );
  }
}
