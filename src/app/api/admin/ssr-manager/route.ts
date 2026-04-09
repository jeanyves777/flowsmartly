/**
 * SSR Manager Admin API — monitor and manage independent SSR apps.
 *
 * GET  — list all SSR apps with status, port, memory
 * POST — actions: stop-idle, regenerate-nginx
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { listApps } from "@/lib/ssr-manager/pm2-manager";
import { stopIdleApps } from "@/lib/ssr-manager/idle-manager";
import { regenerateAndReload } from "@/lib/ssr-manager/nginx-config";
import { getActiveAppCount, MAX_CONCURRENT_APPS } from "@/lib/ssr-manager/port-manager";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.adminId) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Fetch all SSR apps from DB
    const [stores, websites, pm2Apps, activeCount] = await Promise.all([
      prisma.store.findMany({
        where: { storeVersion: "independent" },
        select: {
          id: true,
          name: true,
          slug: true,
          ssrPort: true,
          ssrProcessName: true,
          ssrStatus: true,
          updatedAt: true,
          customDomain: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.website.findMany({
        where: { ssrPort: { not: null } },
        select: {
          id: true,
          name: true,
          slug: true,
          ssrPort: true,
          ssrProcessName: true,
          ssrStatus: true,
          updatedAt: true,
          customDomain: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      listApps(),
      getActiveAppCount(),
    ]);

    // Merge PM2 process info with DB records
    const pm2Map = new Map(pm2Apps.map((a) => [a.name, a]));

    const allApps = [
      ...stores.map((s) => ({
        type: "store" as const,
        id: s.id,
        name: s.name,
        slug: s.slug,
        port: s.ssrPort,
        processName: s.ssrProcessName,
        dbStatus: s.ssrStatus,
        pm2Status: pm2Map.get(s.ssrProcessName || "")?.status || "unknown",
        memory: pm2Map.get(s.ssrProcessName || "")?.memory,
        customDomain: s.customDomain,
        lastActivity: s.updatedAt,
      })),
      ...websites.map((w) => ({
        type: "website" as const,
        id: w.id,
        name: w.name,
        slug: w.slug,
        port: w.ssrPort,
        processName: w.ssrProcessName,
        dbStatus: w.ssrStatus,
        pm2Status: pm2Map.get(w.ssrProcessName || "")?.status || "unknown",
        memory: pm2Map.get(w.ssrProcessName || "")?.memory,
        customDomain: w.customDomain,
        lastActivity: w.updatedAt,
      })),
    ];

    return NextResponse.json({
      apps: allApps,
      stats: {
        activeCount,
        maxConcurrent: MAX_CONCURRENT_APPS,
        totalStores: stores.length,
        totalWebsites: websites.length,
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/ssr-manager error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.adminId) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { action } = await request.json();

    switch (action) {
      case "stop-idle": {
        const stopped = await stopIdleApps();
        return NextResponse.json({ success: true, stopped });
      }

      case "regenerate-nginx": {
        await regenerateAndReload();
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("POST /api/admin/ssr-manager error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
