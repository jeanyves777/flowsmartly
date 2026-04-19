/**
 * Debounced auto-rebuild for V3 stores.
 *
 * Rebuilding a Next.js SSR app takes 30-90 seconds. If a user edits 10
 * products back-to-back, triggering a rebuild on every edit burns server
 * resources and can cause PM2 port collisions or file-write races.
 *
 * Strategy: per-store debounce timer. Every call resets the timer to
 * DEBOUNCE_MS in the future. Only when the user stops editing for that
 * duration does the rebuild actually fire. End-user effect: save the
 * products, pause, and the live store auto-updates without manual publish.
 *
 * Fire-and-forget: CRUD handlers call this and return immediately. The
 * rebuild runs in the background, catching its own errors. `triggerStore-
 * RebuildIfV2` already skips if a rebuild is in progress, so re-entrant
 * calls are safe.
 *
 * Note: timers are in-process. A `pm2 reload` drops pending timers, but
 * the `hasPendingChanges` flag on Store is still set, so the manual
 * publish button in the UI remains a safety net.
 */

import { triggerStoreRebuildIfV2 } from "./product-sync";

const DEBOUNCE_MS = 30_000;
const debounceTimers = new Map<string, NodeJS.Timeout>();

export function scheduleStoreRebuild(storeId: string): void {
  const existing = debounceTimers.get(storeId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    debounceTimers.delete(storeId);
    try {
      await triggerStoreRebuildIfV2(storeId);
    } catch (err) {
      console.error(`[auto-rebuild] ${storeId} failed:`, err);
    }
  }, DEBOUNCE_MS);

  timer.unref?.();
  debounceTimers.set(storeId, timer);
}
