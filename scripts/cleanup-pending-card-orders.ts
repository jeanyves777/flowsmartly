/**
 * One-time cleanup: delete any Order rows with paymentMethod=card + paymentStatus=pending.
 *
 * Pre-migration, stores created an Order row at checkout submit and only
 * updated it when the Stripe webhook confirmed payment. Customers who
 * abandoned card checkout left orphaned pending orders forever, polluting
 * their "My Orders" list and the store's unfulfilled-order alerts.
 *
 * Post-migration (see PendingCheckout model + webhook rewrite) card orders
 * are never written until payment succeeds — so this backlog of stranded
 * pending card orders can be safely deleted.
 *
 * Run: `npx tsx scripts/cleanup-pending-card-orders.ts`
 *   Add `--dry-run` to preview.
 */

import { prisma } from "../src/lib/db/client";
import { restoreInventory } from "../src/lib/store/inventory";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const stranded = await prisma.order.findMany({
    where: {
      paymentMethod: "card",
      paymentStatus: "pending",
      NOT: { status: "CANCELLED" },
    },
    select: {
      id: true,
      orderNumber: true,
      customerEmail: true,
      totalCents: true,
      currency: true,
      createdAt: true,
      storeId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (stranded.length === 0) {
    console.log("No stranded pending card orders.");
    return;
  }

  console.log(`Found ${stranded.length} stranded pending card orders:`);
  for (const o of stranded) {
    console.log(`  #${o.orderNumber} — ${o.customerEmail} — ${o.totalCents / 100} ${o.currency} — ${o.createdAt.toISOString()}`);
  }

  if (dryRun) {
    console.log("\nDry run — nothing deleted. Remove --dry-run to execute.");
    return;
  }

  console.log("\nDeleting...");
  for (const o of stranded) {
    try {
      // Restore any inventory that was deducted for this abandoned order.
      await restoreInventory(o.id).catch((err) => console.warn(`  inventory restore failed for ${o.orderNumber}:`, err));
      await prisma.order.delete({ where: { id: o.id } });
      console.log(`  ✓ deleted #${o.orderNumber}`);
    } catch (err) {
      console.error(`  ✗ failed to delete #${o.orderNumber}:`, err);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
