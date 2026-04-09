/**
 * Idle Manager — stops SSR apps that haven't been accessed recently.
 *
 * Strategy:
 * - Apps that haven't been accessed in 30 minutes are stopped (PM2 stop, not delete)
 * - Apps with custom domains stay running longer (2 hours)
 * - Max concurrent apps enforced via MAX_CONCURRENT_APPS
 * - Called by a cron job every 5 minutes
 */

import { prisma } from "@/lib/db/client";
import { stopApp } from "./pm2-manager";
import { regenerateAndReload } from "./nginx-config";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;         // 30 minutes
const CUSTOM_DOMAIN_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Check all running SSR apps and stop idle ones.
 * Returns count of apps stopped.
 */
export async function stopIdleApps(): Promise<number> {
  const now = new Date();
  let stopped = 0;

  // Find all running stores
  const runningStores = await prisma.store.findMany({
    where: { ssrStatus: "running", ssrProcessName: { not: null } },
    select: {
      id: true,
      slug: true,
      ssrProcessName: true,
      customDomain: true,
      updatedAt: true,
    },
  });

  for (const store of runningStores) {
    if (!store.ssrProcessName) continue;

    const timeout = store.customDomain ? CUSTOM_DOMAIN_TIMEOUT_MS : IDLE_TIMEOUT_MS;
    const idleSince = now.getTime() - store.updatedAt.getTime();

    if (idleSince > timeout) {
      console.log(`[IdleManager] Stopping idle store ${store.slug} (idle ${Math.round(idleSince / 60000)}min)`);
      try {
        await stopApp(store.ssrProcessName);
        await prisma.store.update({
          where: { id: store.id },
          data: { ssrStatus: "stopped" },
        });
        stopped++;
      } catch (err: any) {
        console.error(`[IdleManager] Failed to stop store ${store.slug}:`, err.message);
      }
    }
  }

  // Find all running websites
  const runningWebsites = await prisma.website.findMany({
    where: { ssrStatus: "running", ssrProcessName: { not: null } },
    select: {
      id: true,
      slug: true,
      ssrProcessName: true,
      customDomain: true,
      updatedAt: true,
    },
  });

  for (const website of runningWebsites) {
    if (!website.ssrProcessName) continue;

    const timeout = website.customDomain ? CUSTOM_DOMAIN_TIMEOUT_MS : IDLE_TIMEOUT_MS;
    const idleSince = now.getTime() - website.updatedAt.getTime();

    if (idleSince > timeout) {
      console.log(`[IdleManager] Stopping idle website ${website.slug} (idle ${Math.round(idleSince / 60000)}min)`);
      try {
        await stopApp(website.ssrProcessName);
        await prisma.website.update({
          where: { id: website.id },
          data: { ssrStatus: "stopped" },
        });
        stopped++;
      } catch (err: any) {
        console.error(`[IdleManager] Failed to stop website ${website.slug}:`, err.message);
      }
    }
  }

  // Regenerate nginx config if any apps were stopped
  if (stopped > 0) {
    try {
      await regenerateAndReload();
    } catch {}
    console.log(`[IdleManager] Stopped ${stopped} idle apps`);
  }

  return stopped;
}
