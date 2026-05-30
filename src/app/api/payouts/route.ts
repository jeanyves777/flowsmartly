import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/payouts
 *
 * Paginated payout history for the signed-in creator. The earnings
 * dashboard already returns the latest 5 inline; this endpoint is what
 * mobile pages call when the user taps "View all" or scrolls past the
 * first chunk.
 *
 * Query: status=PENDING|COMPLETED|FAILED  (optional)
 *        page=1                            (default 1)
 *        limit=20                          (default 20, capped at 50)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const statusRaw = searchParams.get("status");
    const status = statusRaw ? statusRaw.toUpperCase() : null;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = { userId: session.userId };
    if (status && ["PENDING", "COMPLETED", "FAILED"].includes(status)) {
      where.status = status;
    }

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payout.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        payouts: payouts.map((p) => ({
          id: p.id,
          amount: p.amountCents / 100,
          method: p.method,
          status: p.status.toLowerCase(),
          requestedAt: p.requestedAt.toISOString(),
          processedAt: p.processedAt?.toISOString() ?? null,
          failedReason: p.failedReason ?? null,
        })),
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error("List payouts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load payouts" } },
      { status: 500 },
    );
  }
}
