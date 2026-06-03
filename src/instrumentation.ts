/**
 * Next.js instrumentation hook — runs once per server process at startup.
 *
 * We use it to reconcile Flow-AI background tasks (AgentTask) that were
 * orphaned by the restart that just happened (in-process workers don't survive
 * a `pm2 reload`), then run a periodic watchdog for genuinely hung tasks. See
 * src/lib/ai/flow-agent/reconcile-tasks.ts.
 */
export async function register() {
  // Only on the Node.js server runtime (not edge / browser).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { reconcileInterruptedTasks, failStaleTasks } = await import(
      "@/lib/ai/flow-agent/reconcile-tasks"
    );

    // Fail anything stranded by the restart so users aren't stuck on
    // "still generating…" forever.
    await reconcileInterruptedTasks();

    // Watchdog every 5 minutes for hangs that aren't caused by a restart.
    const interval = setInterval(() => {
      void failStaleTasks();
    }, 5 * 60_000);
    // Don't keep the event loop alive solely for this timer.
    if (typeof interval.unref === "function") interval.unref();
  } catch (e) {
    console.error("[instrumentation] task reconciliation setup failed:", e);
  }
}
