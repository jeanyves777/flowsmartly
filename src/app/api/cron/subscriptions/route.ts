import { NextRequest, NextResponse } from "next/server";
import {
  checkExpiredSubscriptions,
  sendSubscriptionReminders,
  checkFailedPayments,
  processPhoneNumberRenewals,
  processAgentClientMaintenance,
} from "@/lib/subscriptions";

/**
 * GET /api/cron/subscriptions
 * Daily cron job: check expired subscriptions, send renewal reminders,
 * dunning for failed payments, phone number renewals, agent client cleanup.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "flowsmartly-cron-2026";

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Starting subscription checks...");

    // 1. Reset expired subscriptions to STARTER
    const expired = await checkExpiredSubscriptions();
    console.log(`[Cron] Expired subscriptions: ${expired.reset}/${expired.total} reset`);

    // 2. Send renewal reminders (7-day and 2-day)
    const reminders = await sendSubscriptionReminders();
    console.log(`[Cron] Subscription reminders: 7d=${reminders.sevenDay}, 2d=${reminders.twoDay}`);

    // 3. Check for failed payments and send dunning emails
    const dunning = await checkFailedPayments();
    console.log(`[Cron] Dunning: ${dunning.notified}/${dunning.pastDue} notified`);

    // 4. Process phone number monthly renewals
    const phones = await processPhoneNumberRenewals();
    console.log(`[Cron] Phone renewals: ${phones.charged}/${phones.total} charged, ${phones.failed} failed`);

    // 5. Agent client maintenance (auto-expire stale PENDING requests)
    const agents = await processAgentClientMaintenance();
    console.log(`[Cron] Agent clients: ${agents.expired} expired, ${agents.activeClients} active, ${agents.pendingClients} pending`);

    return NextResponse.json({
      success: true,
      expired,
      reminders,
      dunning,
      phones,
      agents,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Cron] Subscription check error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
