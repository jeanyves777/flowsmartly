/**
 * Pending changes tracker — replaces the old "trigger rebuild on every edit"
 * pattern. Individual CRUD operations now mark the store as having pending
 * changes, and the user can publish them all at once from the top banner.
 *
 * Why: rebuilding a Next.js SSR app takes 30-90 seconds. Rebuilding after
 * every product edit, category rename, or shipping-method change burns
 * server resources and makes the admin feel sluggish. With this pattern,
 * users can make 20 edits and publish once.
 */

import { prisma } from "@/lib/db/client";

/**
 * Mark a store as having pending changes that need to be published.
 * Fire-and-forget — do not await at call sites unless you need the count.
 */
export async function markStoreAsPending(storeId: string): Promise<void> {
  await prisma.store.update({
    where: { id: storeId },
    data: {
      hasPendingChanges: true,
      pendingChangeCount: { increment: 1 },
    },
  }).catch((err) => {
    // Don't block the user's save on a bookkeeping failure.
    console.error("[pending-changes] Failed to mark store as pending:", err);
  });
}

/**
 * Clear pending-change state after a successful publish.
 */
export async function clearPendingChanges(storeId: string): Promise<void> {
  await prisma.store.update({
    where: { id: storeId },
    data: {
      hasPendingChanges: false,
      pendingChangeCount: 0,
    },
  }).catch((err) => {
    console.error("[pending-changes] Failed to clear pending state:", err);
  });
}
