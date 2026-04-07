import { NextRequest, NextResponse } from "next/server";
import {
  checkLowCreditBalances,
  checkMonthlyCreditAllocations,
} from "@/lib/subscriptions";

/**
 * GET /api/cron/credits
 * Daily cron job: check low credit balances, ensure monthly credit allocations.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "flowsmartly-cron-2026";

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Starting credit checks...");

    // 1. Check for low credit balances and send warnings
    const lowCredits = await checkLowCreditBalances();
    console.log(`[Cron] Low credit warnings: ${lowCredits.warned} warned, ${lowCredits.depleted} depleted`);

    // 2. Safety-net monthly credit allocation (for missed webhooks)
    const allocations = await checkMonthlyCreditAllocations();
    console.log(`[Cron] Monthly credit allocations: ${allocations.allocated}/${allocations.total} allocated (${allocations.skipped} skipped)`);

    return NextResponse.json({
      success: true,
      lowCredits,
      allocations,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Cron] Credit check error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
