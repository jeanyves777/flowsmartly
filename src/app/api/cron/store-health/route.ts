import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/index";
import { baseTemplate } from "@/lib/email/index";

/**
 * GET /api/cron/store-health
 * Daily cron job: checks for low stock products and sends alerts to store owners.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ||
    request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "flowsmartly-cron-2026";

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron:StoreHealth] Starting store health checks...");

    // ── 1. Reset stale build locks (stuck in "building" for > 30 min) ──
    const staleBuildsReset = await resetStaleBuildLocks();

    // ── 2. Low stock alerts ──
    const lowStockResult = await checkLowStockAlerts();

    // ── 3. Unfulfilled orders older than 48h ──
    const unfulfilledResult = await checkUnfulfilledOrders();

    console.log(
      `[Cron:StoreHealth] Done — ${staleBuildsReset} stale builds reset, ${lowStockResult.alertsSent} low-stock alerts, ${unfulfilledResult.alertsSent} unfulfilled order alerts`
    );

    return NextResponse.json({
      success: true,
      staleBuildsReset,
      lowStock: lowStockResult,
      unfulfilled: unfulfilledResult,
    });
  } catch (error) {
    console.error("[Cron:StoreHealth] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Reset stores stuck in "building" for more than 30 minutes.
 * This prevents stores from being permanently locked if a build crashes without cleanup.
 */
async function resetStaleBuildLocks(): Promise<number> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  const result = await prisma.store.updateMany({
    where: {
      buildStatus: "building",
      OR: [
        { buildStartedAt: { lt: thirtyMinAgo } },
        // If buildStartedAt is null but status is "building", it's a legacy lock
        { buildStartedAt: null },
      ],
    },
    data: {
      buildStatus: "error",
      lastBuildError: "Build timed out (stuck in building state for >30 minutes). Please try rebuilding.",
      buildStartedAt: null,
    },
  });

  if (result.count > 0) {
    console.log(`[Cron:StoreHealth] Reset ${result.count} stale build lock(s)`);
  }

  return result.count;
}

/**
 * Check for products at or below lowStockThreshold and email store owners.
 * Only sends once per 24 hours per store.
 */
async function checkLowStockAlerts() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find stores that haven't been alerted in the last 24h
  const stores = await prisma.store.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [
        { lastLowStockAlertAt: null },
        { lastLowStockAlertAt: { lt: oneDayAgo } },
      ],
    },
    select: {
      id: true,
      name: true,
      userId: true,
      user: { select: { email: true, name: true } },
    },
  });

  let alertsSent = 0;

  for (const store of stores) {
    // Find low-stock products for this store
    const lowStockProducts = await prisma.product.findMany({
      where: {
        storeId: store.id,
        trackInventory: true,
        status: "ACTIVE",
        deletedAt: null,
        quantity: { lte: 5 }, // Default threshold fallback
      },
      select: {
        name: true,
        quantity: true,
        lowStockThreshold: true,
      },
    });

    // Filter to only products actually at or below their own threshold
    const actualLow = lowStockProducts.filter(
      (p) => p.quantity <= p.lowStockThreshold
    );

    if (actualLow.length === 0) continue;

    const ownerEmail = store.user?.email;
    if (!ownerEmail) continue;

    const productRows = actualLow
      .map(
        (p) =>
          `<tr><td style="padding:6px 12px;">${p.name}</td><td style="padding:6px 12px;text-align:center;color:${p.quantity === 0 ? "#dc2626" : "#f59e0b"};font-weight:bold;">${p.quantity}</td></tr>`
      )
      .join("");

    const outOfStock = actualLow.filter((p) => p.quantity === 0).length;

    await sendEmail({
      to: ownerEmail,
      subject: `Low Stock Alert — ${actualLow.length} product${actualLow.length > 1 ? "s" : ""} need attention | ${store.name}`,
      html: baseTemplate(
        `<h2>Low Stock Alert</h2>
         <p>The following products in <strong>${store.name}</strong> are running low${outOfStock > 0 ? ` (${outOfStock} out of stock)` : ""}:</p>
         <table style="width:100%;border-collapse:collapse;margin:16px 0;">
           <tr style="background:#f9fafb;"><th style="padding:8px 12px;text-align:left;">Product</th><th style="padding:8px 12px;text-align:center;">Qty</th></tr>
           ${productRows}
         </table>
         <a href="${process.env.NEXT_PUBLIC_APP_URL}/ecommerce/products?inventory=out_of_stock" class="button">View Products</a>`,
        `Low stock alert for ${store.name}`
      ),
    }).catch((e) => console.error("Low stock email error:", e));

    await prisma.store.update({
      where: { id: store.id },
      data: { lastLowStockAlertAt: new Date() },
    });

    alertsSent++;
  }

  return { checked: stores.length, alertsSent };
}

/**
 * Check for orders that have been PENDING or CONFIRMED for more than 48 hours.
 */
async function checkUnfulfilledOrders() {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const unfulfilledOrders = await prisma.order.groupBy({
    by: ["storeId"],
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      createdAt: { lt: twoDaysAgo },
    },
    _count: { id: true },
  });

  let alertsSent = 0;

  for (const group of unfulfilledOrders) {
    const store = await prisma.store.findUnique({
      where: { id: group.storeId },
      select: {
        name: true,
        user: { select: { email: true } },
      },
    });

    if (!store?.user?.email) continue;

    await sendEmail({
      to: store.user.email,
      subject: `${group._count.id} unfulfilled order${group._count.id > 1 ? "s" : ""} need attention | ${store.name}`,
      html: baseTemplate(
        `<h2>Unfulfilled Orders</h2>
         <p>You have <strong>${group._count.id}</strong> order${group._count.id > 1 ? "s" : ""} in <strong>${store.name}</strong> that ${group._count.id > 1 ? "have" : "has"} been waiting for more than 48 hours.</p>
         <p>Please review and process these orders to maintain a good store rating.</p>
         <a href="${process.env.NEXT_PUBLIC_APP_URL}/ecommerce/orders" class="button">View Orders</a>`,
        `Unfulfilled orders in ${store.name}`
      ),
    }).catch((e) => console.error("Unfulfilled order email error:", e));

    alertsSent++;
  }

  return { stores: unfulfilledOrders.length, alertsSent };
}
