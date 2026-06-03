import { prisma } from "@/lib/db/client";
import { notifyAgentTaskComplete } from "./notify-task-complete";

/**
 * AgentTask reconciliation — the safety net for Flow-AI background jobs.
 *
 * Background tasks (image/video gen, builds, imports) run IN-PROCESS via
 * `setImmediate` in the same Node process. A `pm2 reload` (deploy) or a crash
 * kills the worker mid-render, but the `AgentTask` row stays `running` forever
 * — the chat shows "still generating…" indefinitely and the user is never told
 * (this stranded a 15s video on 2026-06-03 across a deploy).
 *
 * Two guards:
 *  - reconcileInterruptedTasks(): runs at SERVER STARTUP. Any task still
 *    `running`/`pending` at boot belongs to a now-dead process → fail it +
 *    notify the user to retry. (in-process tasks can't survive a restart.)
 *  - failStaleTasks(): periodic WATCHDOG for genuine hangs (provider never
 *    returns) even without a restart.
 *
 * No credits are refunded here because tasks charge AFTER success — an
 * interrupted/stale task never deducted anything.
 */

// At boot, ignore tasks created in the last 60s (avoids racing a request that
// is being handed off during a graceful reload). Anything older is orphaned.
const STARTUP_GRACE_MS = 60_000;
// Watchdog ceiling — longest legitimate job (site/store builds, long reels)
// runs well under this; past it, the task is hung.
const STALE_MINUTES = 45;

interface OrphanRow {
  id: string;
  userId: string;
  kind: string;
  conversationId: string | null;
}

async function failTasks(rows: OrphanRow[], error: string, summary: string): Promise<void> {
  if (rows.length === 0) return;
  await prisma.agentTask.updateMany({
    where: { id: { in: rows.map((t) => t.id) }, status: { in: ["running", "pending"] } },
    data: { status: "failed", error, completedAt: new Date() },
  });
  for (const t of rows) {
    notifyAgentTaskComplete({
      userId: t.userId,
      taskId: t.id,
      kind: t.kind,
      ok: false,
      summary,
      deepLink: t.conversationId
        ? `/flow-ai?conversationId=${t.conversationId}&taskId=${t.id}`
        : "/flow-ai",
    }).catch(() => {});
  }
}

/** Startup: fail tasks orphaned by the restart that just happened. */
export async function reconcileInterruptedTasks(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - STARTUP_GRACE_MS);
    const orphaned = await prisma.agentTask.findMany({
      where: { status: { in: ["running", "pending"] }, createdAt: { lt: cutoff } },
      select: { id: true, userId: true, kind: true, conversationId: true },
    });
    await failTasks(
      orphaned,
      "Rendering was interrupted by a server restart. Please try again.",
      "Your request was interrupted — please try again",
    );
    if (orphaned.length) {
      console.log(`[reconcile-tasks] startup: failed ${orphaned.length} interrupted task(s).`);
    }
    return orphaned.length;
  } catch (e) {
    console.error("[reconcile-tasks] startup reconcile failed:", e);
    return 0;
  }
}

/** Watchdog: fail tasks that have been running far longer than any real job. */
export async function failStaleTasks(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000);
    const stale = await prisma.agentTask.findMany({
      where: { status: { in: ["running", "pending"] }, createdAt: { lt: cutoff } },
      select: { id: true, userId: true, kind: true, conversationId: true },
    });
    await failTasks(
      stale,
      "This task took too long and was stopped. Please try again.",
      "Your request timed out — please try again",
    );
    if (stale.length) {
      console.log(`[reconcile-tasks] watchdog: failed ${stale.length} stale task(s).`);
    }
    return stale.length;
  } catch (e) {
    console.error("[reconcile-tasks] watchdog failed:", e);
    return 0;
  }
}
