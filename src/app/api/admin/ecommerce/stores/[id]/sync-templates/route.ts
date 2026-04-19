import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { syncStoreTemplates } from "@/lib/store-builder/sync-templates";
import { triggerStoreRebuildIfV2 } from "@/lib/store-builder/product-sync";

/**
 * POST /api/admin/ecommerce/stores/[id]/sync-templates
 *
 * Retrofit canonical component templates (Hero, ProductDetailClient, etc.)
 * from the reference-store into an existing generated store, then rebuild.
 *
 * Use this to propagate UX fixes (image carousel, share button, compact
 * hero slideshow) without re-running the agent — agent rebuilds are
 * expensive and can wipe product data.
 *
 * Auth: admin session OR x-admin-secret header matching ADMIN_SECRET env.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader === process.env.ADMIN_SECRET) {
    // OK — server-side admin access
  } else {
    const session = await getSession();
    if (!session?.adminId) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
  }

  const { id } = await params;

  const store = await prisma.store.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, generatedPath: true, generatorVersion: true },
  });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  if (!store.generatedPath) {
    return NextResponse.json(
      { error: "Store has no generatedPath — probably not V3 independent" },
      { status: 400 }
    );
  }

  const syncResult = await syncStoreTemplates(store.generatedPath);

  if (!syncResult.refDir) {
    return NextResponse.json(
      { success: false, error: "reference-store directory not found", ...syncResult },
      { status: 500 }
    );
  }

  // Fire-and-forget rebuild so the live store picks up the new templates.
  triggerStoreRebuildIfV2(store.id).catch((err) => {
    console.error(`[sync-templates] Rebuild failed for ${store.id}:`, err);
  });

  return NextResponse.json({
    success: true,
    store: { id: store.id, name: store.name, slug: store.slug },
    syncedCount: syncResult.synced.length,
    skippedCount: syncResult.skipped.length,
    synced: syncResult.synced,
    skipped: syncResult.skipped,
    message: `${syncResult.synced.length} templates synced. Rebuild triggered in background.`,
  });
}
