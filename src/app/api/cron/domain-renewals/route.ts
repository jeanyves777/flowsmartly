import { NextRequest, NextResponse } from "next/server";
import { checkExpiringDomains, processAutoRenewals, retryFailedRegistrations } from "@/lib/domains/renewal";

/**
 * GET /api/cron/domain-renewals
 * Daily cron job: check expiring domains, send reminders, process auto-renewals, retry failed registrations.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "flowsmartly-cron-2026";

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Starting domain renewal check...");

    // 1. Send expiration reminders
    const reminders = await checkExpiringDomains();
    console.log(`[Cron] Reminders: 30d=${reminders.thirtyDay}, 7d=${reminders.sevenDay}, 1d=${reminders.oneDay}`);

    // 2. Process auto-renewals
    const renewals = await processAutoRenewals();
    console.log(`[Cron] Auto-renewals: ${renewals.renewed}/${renewals.total} succeeded, ${renewals.failed} failed`);

    // 3. Retry failed registrations
    const retries = await retryFailedRegistrations();
    console.log(`[Cron] Retries: ${retries.retried}/${retries.total} succeeded`);

    return NextResponse.json({
      success: true,
      reminders,
      renewals,
      retries,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Cron] Domain renewal error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
