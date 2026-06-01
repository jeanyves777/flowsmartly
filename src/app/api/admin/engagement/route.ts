import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession, hasPermission } from "@/lib/admin/auth";
import { getSyntheticConfig, setSyntheticConfig } from "@/lib/synthetic/config";
import { createPersonas, personaStats, seedSyntheticFollowGraph } from "@/lib/synthetic/generator";
import { backfillAvatars } from "@/lib/synthetic/avatars";
import { seedMediaPool, mediaPoolCounts } from "@/lib/synthetic/media-pool";
import { engagementStats, runEngagementTick } from "@/lib/synthetic/engine";
import { NICHES } from "@/lib/synthetic/niches";

/**
 * Admin control surface for the synthetic feed-engagement system.
 * GET  → full dashboard snapshot (config, persona/media/activity stats, recent log).
 * POST → actions: set_config | generate | seed_media | toggle_persona | run_tick.
 */

function unauthorized() {
  return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json(
    { success: false, error: { message: "Insufficient permissions" } },
    { status: 403 }
  );
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "EDIT_SETTINGS")) return forbidden();

  const [config, personas, media, activity, recent] = await Promise.all([
    getSyntheticConfig(),
    personaStats(),
    mediaPoolCounts(),
    engagementStats(),
    prisma.syntheticActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  // Resolve actor names for the recent activity feed.
  const actorIds = [...new Set(recent.map((r) => r.actorId))];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, username: true, avatarUrl: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a]));
  const recentFeed = recent.map((r) => ({
    id: r.id,
    action: r.action,
    actor: actorMap.get(r.actorId) ?? null,
    targetPostId: r.targetPostId,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({
    success: true,
    data: {
      config,
      niches: NICHES.map((n) => ({ key: n.key, label: n.label })),
      personas,
      media,
      activity,
      recent: recentFeed,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "EDIT_SETTINGS")) return forbidden();

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  try {
    switch (action) {
      case "set_config": {
        const patch: {
          enabled?: boolean;
          intensity?: number;
          niches?: string[];
          planCaps?: { free: number; paid: number; overrides: Record<string, number> };
        } = {};
        if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
        if (typeof body.intensity === "number") patch.intensity = body.intensity;
        if (Array.isArray(body.niches)) patch.niches = body.niches.map(String);
        if (body.planCaps && typeof body.planCaps === "object") {
          patch.planCaps = {
            free: Number(body.planCaps.free) || 0,
            paid: Number(body.planCaps.paid) || 0,
            overrides:
              body.planCaps.overrides && typeof body.planCaps.overrides === "object"
                ? body.planCaps.overrides
                : {},
          };
        }
        const config = await setSyntheticConfig(patch);
        return NextResponse.json({ success: true, data: { config } });
      }

      case "generate": {
        const count = Math.max(1, Math.min(250, parseInt(body.count, 10) || 50));
        const niches = Array.isArray(body.niches) && body.niches.length
          ? body.niches.map(String)
          : undefined;
        // Fire-and-forget: create personas fast, then trickle faces in.
        (async () => {
          await createPersonas(count, niches);
          await backfillAvatars();
        })().catch((e) => console.error("[Synthetic] generate failed:", e));
        return NextResponse.json({
          success: true,
          data: { started: true, count },
          message: `Generating ${count} personas (faces fill in shortly)…`,
        });
      }

      case "seed_media": {
        const perNiche = Math.max(1, Math.min(40, parseInt(body.perNiche, 10) || 12));
        const niches: string[] = Array.isArray(body.niches) && body.niches.length
          ? body.niches.map(String)
          : NICHES.map((n) => n.key);
        // Fire-and-forget background seeding.
        (async () => {
          for (const niche of niches) {
            try {
              const added = await seedMediaPool(niche, perNiche);
              console.log(`[Synthetic] seeded ${added} media for ${niche}`);
            } catch (e) {
              console.error(`[Synthetic] seed failed for ${niche}:`, e);
            }
          }
        })().catch(() => {});
        return NextResponse.json({
          success: true,
          data: { started: true, perNiche, niches },
          message: `Seeding up to ${perNiche} images per niche in the background…`,
        });
      }

      case "toggle_persona": {
        const personaId = String(body.personaId || "");
        const enabled = !!body.enabled;
        if (!personaId)
          return NextResponse.json(
            { success: false, error: { message: "personaId required" } },
            { status: 400 }
          );
        await prisma.syntheticPersona.update({ where: { id: personaId }, data: { enabled } });
        return NextResponse.json({ success: true });
      }

      case "seed_follows": {
        seedSyntheticFollowGraph().catch((e) =>
          console.error("[Synthetic] follow graph failed:", e)
        );
        return NextResponse.json({
          success: true,
          message: "Building the follower graph among personas in the background…",
        });
      }

      case "backfill_avatars": {
        backfillAvatars().catch((e) =>
          console.error("[Synthetic] backfill failed:", e)
        );
        return NextResponse.json({
          success: true,
          message: "Backfilling AI faces for faceless personas in the background…",
        });
      }

      case "run_tick": {
        const result = await runEngagementTick();
        return NextResponse.json({ success: true, data: { result } });
      }

      default:
        return NextResponse.json(
          { success: false, error: { message: "Unknown action" } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Synthetic] admin action error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Action failed" } },
      { status: 500 }
    );
  }
}
