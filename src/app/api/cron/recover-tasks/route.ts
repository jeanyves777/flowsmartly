import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { runTaskRecovery } from "@/lib/ai/flow-agent/reconcile-tasks";

/**
 * GET /api/cron/recover-tasks
 *
 * Recovers Flow-AI background tasks (AgentTask) whose in-process worker died
 * (deploy reload / crash). For video jobs we persisted the provider's job id,
 * so we RESUME — poll the provider and pull the finished render (charging only
 * on real success) instead of falsely failing a job the provider completed and
 * billed us for. Tasks with no resumable handle that are stuck too long are
 * failed so the user isn't stranded.
 *
 * Run every ~3-5 minutes. Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTaskRecovery();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron/recover-tasks] error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "recovery failed" },
      { status: 500 },
    );
  }
}
