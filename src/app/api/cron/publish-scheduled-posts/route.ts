import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { publishDueScheduledPosts } from "@/lib/content/scheduled-post-publisher";
import { runTaskRecovery } from "@/lib/ai/flow-agent/reconcile-tasks";

async function run(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  // Piggyback Flow-AI task recovery on this every-5-min tick: resume any
  // background video job orphaned by a restart (pull it from the provider)
  // and clear unrecoverable stuck tasks. Fire-and-forget — never blocks or
  // fails the post-publishing path.
  void runTaskRecovery().catch((e) => console.error("[cron] task recovery error:", e));

  try {
    const result = await publishDueScheduledPosts();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Publish scheduled posts cron error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to publish scheduled posts" } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
