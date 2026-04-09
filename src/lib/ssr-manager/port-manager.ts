/**
 * Port Manager — allocates and releases ports for independent SSR apps.
 *
 * Stores use ports 4001-4500, websites use 4501-4999.
 * Ports are tracked in the database (ssrPort field on Store/Website models).
 */

import { prisma } from "@/lib/db/client";

const STORE_PORT_MIN = 4001;
const STORE_PORT_MAX = 4500;
const WEBSITE_PORT_MIN = 4501;
const WEBSITE_PORT_MAX = 4999;

/**
 * Get all ports currently in use across stores and websites.
 */
async function getUsedPorts(): Promise<Set<number>> {
  const [stores, websites] = await Promise.all([
    prisma.store.findMany({
      where: { ssrPort: { not: null } },
      select: { ssrPort: true },
    }),
    prisma.website.findMany({
      where: { ssrPort: { not: null } },
      select: { ssrPort: true },
    }),
  ]);

  const ports = new Set<number>();
  for (const s of stores) if (s.ssrPort) ports.add(s.ssrPort);
  for (const w of websites) if (w.ssrPort) ports.add(w.ssrPort);
  return ports;
}

/**
 * Find the lowest available port in a range.
 */
function findAvailablePort(
  usedPorts: Set<number>,
  min: number,
  max: number
): number | null {
  for (let port = min; port <= max; port++) {
    if (!usedPorts.has(port)) return port;
  }
  return null;
}

/**
 * Allocate a port for a store or website.
 * Returns the allocated port number.
 * Throws if no ports are available.
 */
export async function allocatePort(
  type: "store" | "website"
): Promise<number> {
  const usedPorts = await getUsedPorts();
  const [min, max] =
    type === "store"
      ? [STORE_PORT_MIN, STORE_PORT_MAX]
      : [WEBSITE_PORT_MIN, WEBSITE_PORT_MAX];

  const port = findAvailablePort(usedPorts, min, max);
  if (!port) {
    throw new Error(
      `No available ports for ${type} (range ${min}-${max}, all ${max - min + 1} slots in use)`
    );
  }
  return port;
}

/**
 * Release a port by clearing the ssrPort field on the owning record.
 */
export async function releaseStorePort(storeId: string): Promise<void> {
  await prisma.store.update({
    where: { id: storeId },
    data: { ssrPort: null, ssrProcessName: null, ssrStatus: "stopped" },
  });
}

export async function releaseWebsitePort(websiteId: string): Promise<void> {
  await prisma.website.update({
    where: { id: websiteId },
    data: { ssrPort: null, ssrProcessName: null, ssrStatus: "stopped" },
  });
}

/**
 * Get count of active SSR apps (running or starting).
 */
export async function getActiveAppCount(): Promise<number> {
  const [stores, websites] = await Promise.all([
    prisma.store.count({
      where: { ssrStatus: { in: ["running", "starting"] } },
    }),
    prisma.website.count({
      where: { ssrStatus: { in: ["running", "starting"] } },
    }),
  ]);
  return stores + websites;
}

/** Max concurrent SSR processes (configurable based on server RAM) */
export const MAX_CONCURRENT_APPS = 60;
