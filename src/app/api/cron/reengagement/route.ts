import { NextRequest, NextResponse } from "next/server";
import { sendReengagementEmails } from "@/lib/subscriptions";

/**
 * GET /api/cron/reengagement
 * Weekly cron job: send re-engagement emails to inactive users (30+ days without login).
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "flowsmartly-cron-2026";

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Starting re-engagement check...");

    const result = await sendReengagementEmails();
    console.log(`[Cron] Re-engagement: ${result.sent}/${result.checked} emails sent`);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Cron] Re-engagement error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
