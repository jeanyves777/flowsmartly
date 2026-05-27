import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { processQueuedBatchCampaigns } from "@/lib/story-ad-campaign";

/**
 * Cron: process any Story Ad campaigns that were submitted with `batchMode: true`.
 *
 * Schedule: every 5 minutes. The cron worker:
 *   1. Finds campaigns in status "BATCH_QUEUED"
 *   2. Picks the oldest one (FIFO)
 *   3. Runs it through the normal render pipeline at the per-call price
 *
 * Since the user already paid the batch (50% off) price upfront via the cost
 * calculator, we absorb the difference until Vertex Batch Prediction is wired up
 * with a service-account credential. Once that swap happens, this worker submits
 * the queued requests to Vertex Batch and polls for completion instead.
 *
 * Capping concurrency to 1 campaign per tick (5 min) prevents the cron from
 * stampeding the video providers during peak hours.
 */
async function run(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }

  try {
    const result = await processQueuedBatchCampaigns({ maxPerTick: 1 });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[Cron] story-ad-batch-poll error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to process batch queue" } },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}
export async function POST(request: NextRequest) {
  return run(request);
}
