import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { runStoreAgentV3 } from "@/lib/store-builder/store-agent";

/**
 * POST /api/admin/migrate-stores-v3
 *
 * Admin endpoint to migrate all non-V3 stores (V1, V2) to V3 SSR.
 * Triggers the V3 AI agent for each eligible store in sequence.
 *
 * Query params:
 *   ?dry=true  — just list stores that would be migrated (no action)
 *   ?storeId=xxx — migrate a single specific store
 *
 * Auth: admin cookie OR x-admin-secret header matching ADMIN_INTERNAL_SECRET env var
 */
export async function POST(request: NextRequest) {
  try {
    const internalSecret = request.headers.get("x-admin-secret");
    const validSecret = process.env.ADMIN_INTERNAL_SECRET;
    const hasSecret = validSecret && internalSecret === validSecret;

    if (!hasSecret) {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dry") === "true";
    const specificStoreId = searchParams.get("storeId");

    const where: Record<string, unknown> = {
      deletedAt: null,
      generatorVersion: { not: "v3" },
    };
    if (specificStoreId) {
      where.id = specificStoreId;
    }

    const stores = await prisma.store.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        industry: true,
        region: true,
        currency: true,
        generatorVersion: true,
        buildStatus: true,
        userId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        count: stores.length,
        stores: stores.map(s => ({ id: s.id, name: s.name, slug: s.slug, version: s.generatorVersion, status: s.buildStatus })),
      });
    }

    if (stores.length === 0) {
      return NextResponse.json({ message: "All stores are already V3", migrated: 0 });
    }

    console.log(`[AdminMigrate] Starting V3 migration for ${stores.length} stores`);

    // Fire migrations in background (sequential to avoid overwhelming the server)
    const migrate = async () => {
      let success = 0;
      let failed = 0;
      for (const store of stores) {
        console.log(`[AdminMigrate] Migrating store ${store.id} (${store.name}) — was ${store.generatorVersion || "v1"}`);
        try {
          const products = await prisma.product.findMany({
            where: { storeId: store.id, status: { not: "ARCHIVED" } },
            include: { productCategory: true },
          });

          const productInputs = products.map((p) => {
            let images: string[] = [];
            try { const parsed = JSON.parse(p.images || "[]"); images = Array.isArray(parsed) ? parsed.map((img: { url?: string } | string) => typeof img === "string" ? img : img.url ?? "").filter(Boolean) : []; } catch {}
            let tags: string[] = [];
            try { tags = JSON.parse(p.tags || "[]"); } catch {}
            return {
              name: p.name,
              description: p.description || p.shortDescription || "",
              priceCents: p.priceCents,
              comparePriceCents: p.comparePriceCents || undefined,
              category: p.productCategory?.name || "",
              images,
              tags,
            };
          });

          const categories = await prisma.productCategory.findMany({
            where: { storeId: store.id },
            select: { name: true },
          });

          const result = await runStoreAgentV3(
            store.id,
            store.slug,
            store.userId,
            { name: store.name, industry: store.industry || undefined, region: store.region || undefined, currency: store.currency },
            productInputs,
            categories.map(c => c.name),
            (p) => console.log(`[AdminMigrate] ${store.slug}: ${p.step} (${p.toolCalls} calls)`)
          );

          if (result.success) {
            success++;
            console.log(`[AdminMigrate] Store ${store.id} migrated successfully`);
          } else {
            failed++;
            console.error(`[AdminMigrate] Store ${store.id} migration failed: ${result.error}`);
          }
        } catch (err) {
          failed++;
          console.error(`[AdminMigrate] Store ${store.id} fatal error:`, (err as Error).message);
        }
      }
      console.log(`[AdminMigrate] Done: ${success} succeeded, ${failed} failed`);
    };

    migrate().catch(err => console.error("[AdminMigrate] Fatal:", err));

    return NextResponse.json({
      message: `Migration started for ${stores.length} stores`,
      stores: stores.map(s => ({ id: s.id, name: s.name, slug: s.slug, version: s.generatorVersion || "v1" })),
    });
  } catch (err) {
    console.error("POST /api/admin/migrate-stores-v3 error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * GET /api/admin/migrate-stores-v3 — See which stores still need migration
 */
export async function GET(request: NextRequest) {
  try {
    const internalSecret = request.headers.get("x-admin-secret");
    const validSecret = process.env.ADMIN_INTERNAL_SECRET;
    const hasSecret = validSecret && internalSecret === validSecret;

    if (!hasSecret) {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const [nonV3, v3] = await Promise.all([
      prisma.store.count({ where: { deletedAt: null, generatorVersion: { not: "v3" } } }),
      prisma.store.count({ where: { deletedAt: null, generatorVersion: "v3" } }),
    ]);

    const pendingStores = await prisma.store.findMany({
      where: { deletedAt: null, generatorVersion: { not: "v3" } },
      select: { id: true, name: true, slug: true, generatorVersion: true, buildStatus: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ v3Count: v3, pendingMigration: nonV3, stores: pendingStores });
  } catch (err) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
