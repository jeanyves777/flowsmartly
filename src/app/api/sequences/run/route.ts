import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { runDueEnrollments } from "@/lib/crm/sequence";

/**
 * POST /api/sequences/run — the scheduler. Fires every due enrollment step
 * (logs the touch on the timeline, advances + reschedules). Two ways in:
 *  - cron: header `x-cron-secret: $CRON_SECRET` (or ?secret=) runs ALL users.
 *  - session: a signed-in user runs their OWN due enrollments (used by the UI).
 * `simulate` treats channels as connected + logs the send so a flow can be tested
 * before email/SMS/WhatsApp are wired — allowed for the cron secret or in dev.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET || process.env.AUTOMATION_TRIGGER_SECRET;
    const provided = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
    const isCron = !!secret && provided === secret;
    const body = await request.json().catch(() => ({}));

    if (isCron) {
      const counts = await runDueEnrollments({ simulate: !!body?.simulate });
      return NextResponse.json({ success: true, data: { scope: "all", counts } });
    }

    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const simulate = !!body?.simulate && process.env.NODE_ENV !== "production";
    const counts = await runDueEnrollments({ userId: session.userId, simulate });
    return NextResponse.json({ success: true, data: { scope: "user", counts } });
  } catch (error) {
    console.error("Run sequences error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to run sequences" } }, { status: 500 });
  }
}
