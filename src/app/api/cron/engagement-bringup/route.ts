import { NextRequest, NextResponse } from "next/server";
import { setSyntheticConfig } from "@/lib/synthetic/config";
import { createPersonas, personaStats, seedSyntheticFollowGraph } from "@/lib/synthetic/generator";
import { backfillAvatars } from "@/lib/synthetic/avatars";
import { seedMediaPool, mediaPoolCounts } from "@/lib/synthetic/media-pool";
import { NICHES } from "@/lib/synthetic/niches";

/**
 * GET /api/cron/engagement-bringup
 * Secret-protected ops endpoint to bring the synthetic engagement system online.
 * All heavy work (avatar fetching, media seeding) runs fire-and-forget in the
 * background — the request returns immediately. Poll progress via /api/admin/engagement.
 *
 * Query params:
 *   secret     CRON_SECRET (required)
 *   seed       images per niche to seed into the post-image pool (0 = skip)
 *   generate   number of personas to create (0 = skip)
 *   activate   "1" to enable the engine, "0" to pause
 *   intensity  0–100 global activity multiplier
 */
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "flowsmartly-cron-2026";
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;

  // ── Diagnostic (?diag=1): how much engagement is actually reaching REAL users
  // today, vs the synthetic ecosystem. Answers "is it working / why don't I see it". ──
  if (sp.get("diag") === "1") {
    const { prisma } = await import("@/lib/db/client");
    const ds = new Date();
    ds.setUTCHours(0, 0, 0, 0);
    const [realUsers, realPosts21d, syntheticPosts, socialRows] = await Promise.all([
      prisma.user.count({ where: { isSynthetic: false, deletedAt: null } }),
      prisma.post.count({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          user: { isSynthetic: false },
          createdAt: { gte: new Date(Date.now() - 21 * 864e5) },
        },
      }),
      prisma.post.count({ where: { status: "PUBLISHED", deletedAt: null, user: { isSynthetic: true } } }),
      prisma.syntheticActivityLog.groupBy({
        by: ["targetUserId"],
        where: {
          createdAt: { gte: ds },
          targetUserId: { not: null },
          action: { in: ["like", "comment", "reply", "share", "follow"] },
        },
        _count: { _all: true },
      }),
    ]);
    const ids = socialRows.map((r) => r.targetUserId).filter(Boolean) as string[];
    const realTargets = await prisma.user.findMany({
      where: { id: { in: ids }, isSynthetic: false },
      select: { id: true, username: true, name: true, plan: true },
    });
    const realMap = new Map(realTargets.map((u) => [u.id, u]));
    let realActions = 0;
    let synthActions = 0;
    const perReal: Array<{ username: string; name: string; plan: string; count: number }> = [];
    for (const r of socialRows) {
      const u = r.targetUserId ? realMap.get(r.targetUserId) : undefined;
      if (u) {
        realActions += r._count._all;
        perReal.push({ username: u.username, name: u.name, plan: u.plan, count: r._count._all });
      } else {
        synthActions += r._count._all;
      }
    }
    perReal.sort((a, b) => b.count - a.count);
    const todayTotal = await prisma.syntheticActivityLog.count({ where: { createdAt: { gte: ds } } });
    return NextResponse.json({
      success: true,
      diag: {
        realUsers,
        realPosts21d,
        syntheticPosts,
        todayTotalActions: todayTotal,
        todaySocialReal: realActions,
        todaySocialSynthetic: synthActions,
        realRecipientsEngagedToday: perReal.length,
        topRealRecipients: perReal.slice(0, 12),
      },
    });
  }
  const seed = Math.max(0, Math.min(40, parseInt(sp.get("seed") || "0", 10)));
  const generate = Math.max(0, Math.min(1000, parseInt(sp.get("generate") || "0", 10)));
  const activateParam = sp.get("activate");
  const intensityParam = sp.get("intensity");

  const actions: Record<string, unknown> = {};

  // Config changes are fast — apply synchronously.
  if (activateParam !== null || intensityParam !== null) {
    const patch: { enabled?: boolean; intensity?: number } = {};
    if (activateParam !== null) patch.enabled = activateParam === "1";
    if (intensityParam !== null) patch.intensity = parseInt(intensityParam, 10);
    actions.config = await setSyntheticConfig(patch);
  }

  // Media seeding — background.
  if (seed > 0) {
    (async () => {
      for (const niche of NICHES.map((n) => n.key)) {
        try {
          const added = await seedMediaPool(niche, seed);
          console.log(`[Bringup] seeded ${added} media for ${niche}`);
        } catch (e) {
          console.error(`[Bringup] seed failed for ${niche}:`, e);
        }
      }
      console.log("[Bringup] media seeding complete");
    })().catch(() => {});
    actions.seedingStarted = { perNiche: seed };
  }

  // Persona generation — background. Fast (no avatar fetch), then trickle faces.
  if (generate > 0) {
    (async () => {
      try {
        const res = await createPersonas(generate);
        console.log(`[Bringup] generated ${res.created} personas`);
        const bf = await backfillAvatars();
        console.log(`[Bringup] backfilled ${bf.filled}/${bf.attempted} avatars`);
      } catch (e) {
        console.error("[Bringup] generation failed:", e);
      }
    })().catch(() => {});
    actions.generationStarted = { count: generate };
  }

  // Follower graph (?follows=1) — make synthetic accounts follow each other so
  // none show "0 followers". Fast (DB-only) but run in background to be safe.
  if (sp.get("follows") === "1") {
    (async () => {
      try {
        const fg = await seedSyntheticFollowGraph();
        console.log(`[Bringup] follow graph: ${fg.created} follows across ${fg.personas} personas`);
      } catch (e) {
        console.error("[Bringup] follow graph failed:", e);
      }
    })().catch(() => {});
    actions.followGraphStarted = true;
  }

  // Standalone avatar backfill (?backfill=1) — fill faces for any faceless personas.
  if (sp.get("backfill") === "1") {
    (async () => {
      try {
        const bf = await backfillAvatars();
        console.log(`[Bringup] backfilled ${bf.filled}/${bf.attempted} avatars`);
      } catch (e) {
        console.error("[Bringup] backfill failed:", e);
      }
    })().catch(() => {});
    actions.backfillStarted = true;
  }

  const [personas, media] = await Promise.all([personaStats(), mediaPoolCounts()]);

  return NextResponse.json({
    success: true,
    actions,
    snapshot: {
      personas,
      mediaTotal: Object.values(media).reduce((a, b) => a + b, 0),
    },
    timestamp: new Date().toISOString(),
  });
}
