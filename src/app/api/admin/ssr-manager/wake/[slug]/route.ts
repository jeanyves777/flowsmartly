/**
 * On-Demand Wake — restart a stopped SSR app.
 *
 * Called when nginx gets 502 (stopped app) and falls back to this endpoint.
 * Starts the PM2 process, waits for health, then redirects back.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { startApp, waitForHealthy } from "@/lib/ssr-manager/pm2-manager";
import { regenerateAndReload } from "@/lib/ssr-manager/nginx-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const returnUrl = request.nextUrl.searchParams.get("return") || "/";

  try {
    // Try store first, then website
    let app = await prisma.store.findFirst({
      where: { slug, storeVersion: "independent" },
      select: { id: true, ssrPort: true, ssrProcessName: true, ssrStatus: true, generatedPath: true },
    });

    let type: "store" | "website" = "store";

    if (!app) {
      const website = await prisma.website.findFirst({
        where: { slug, ssrPort: { not: null } },
        select: { id: true, ssrPort: true, ssrProcessName: true, ssrStatus: true, generatedPath: true },
      });
      if (website) {
        app = website;
        type = "website";
      }
    }

    if (!app || !app.ssrPort || !app.ssrProcessName || !app.generatedPath) {
      return NextResponse.json({ error: "App not found or not configured" }, { status: 404 });
    }

    // Already running?
    if (app.ssrStatus === "running") {
      return NextResponse.redirect(new URL(returnUrl, request.url));
    }

    // Start the process
    console.log(`[Wake] Starting ${app.ssrProcessName} on port ${app.ssrPort}...`);

    if (type === "store") {
      await prisma.store.update({ where: { id: app.id }, data: { ssrStatus: "starting" } });
    } else {
      await prisma.website.update({ where: { id: app.id }, data: { ssrStatus: "starting" } });
    }

    await startApp({
      name: app.ssrProcessName,
      cwd: app.generatedPath,
      port: app.ssrPort,
      slug,
    });

    // Wait for healthy (max 15s for wake)
    const healthy = await waitForHealthy(app.ssrPort, 15_000);

    if (type === "store") {
      await prisma.store.update({ where: { id: app.id }, data: { ssrStatus: healthy ? "running" : "error" } });
    } else {
      await prisma.website.update({ where: { id: app.id }, data: { ssrStatus: healthy ? "running" : "error" } });
    }

    await regenerateAndReload();

    if (healthy) {
      // Redirect back to the original URL
      return NextResponse.redirect(new URL(returnUrl, request.url));
    } else {
      return NextResponse.json({ error: "App failed to start" }, { status: 503 });
    }
  } catch (err: any) {
    console.error(`[Wake] Failed to wake ${slug}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
