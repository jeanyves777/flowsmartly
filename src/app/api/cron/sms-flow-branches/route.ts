import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import { processCampaignBranches } from "@/lib/sms/flow-branches";

/**
 * GET /api/cron/sms-flow-branches
 *
 * Fires the if/else branch actions for SMS blasts built as a flow: reads each
 * recipient's recorded delivery outcome and dispatches the matching branch
 * (delivered/clicked → the YES/NO action node). Idempotent — each send is marked
 * `branchProcessedAt` once handled. Runs every few minutes. CRON_SECRET-protected.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET || "flowsmartly-cron-2026";
  if (secret !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const campaigns = await prisma.campaign.findMany({
      where: {
        type: "SMS",
        status: { in: ["SENT", "SENDING"] },
        sectionsJson: { not: null },
        sentAt: { gte: cutoff },
      },
      select: { id: true, userId: true, sectionsJson: true },
      take: 100,
    });

    let processed = 0;
    let dispatched = 0;
    for (const c of campaigns) {
      const r = await processCampaignBranches(c);
      processed += r.processed;
      dispatched += r.dispatched;
    }

    console.log(`[Cron] SMS flow branches: ${campaigns.length} campaigns · ${processed} sends processed · ${dispatched} actions dispatched.`);
    return NextResponse.json({ success: true, campaigns: campaigns.length, processed, dispatched, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[Cron] sms-flow-branches error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
