import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { creditService } from "@/lib/credits";

// GET /api/user/credits/history - Get paginated transaction history
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type") || undefined;

    const result = await creditService.getTransactionHistory(
      session.userId,
      { limit, offset, ...(type ? { type: type as "PURCHASE" | "USAGE" | "BONUS" | "REFUND" | "ADMIN_ADJUSTMENT" | "SUBSCRIPTION" | "REFERRAL" | "WELCOME" } : {}) }
    );

    // Also fetch summary stats
    const info = await creditService.getUserCreditsInfo(session.userId);

    return NextResponse.json({
      success: true,
      data: {
        transactions: result.transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          balanceAfter: t.balanceAfter,
          description: t.description,
          referenceType: t.referenceType,
          createdAt: t.createdAt.toISOString(),
        })),
        total: result.total,
        hasMore: result.hasMore,
        summary: info,
      },
    });
  } catch (error) {
    console.error("Get credit history error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch credit history" } },
      { status: 500 }
    );
  }
}
