import { NextRequest, NextResponse } from "next/server";
import { runEngagementTick } from "@/lib/synthetic/engine";

/**
 * GET /api/cron/engagement
 * Runs one tick of the synthetic feed-engagement engine (every ~20 min).
 * Picks personas currently inside their active window and performs a smoothed
 * slice of their daily likes/comments/follows/views/posts. Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "flowsmartly-cron-2026";

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runEngagementTick();
    console.log(
      `[Cron] Engagement tick: ${result.processed}/${result.activePersonas} acted`,
      result.actions
    );
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[Cron] Engagement tick error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
