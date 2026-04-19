import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { triggerStoreRebuildIfV2 } from "@/lib/store-builder/product-sync";
import { clearPendingChanges } from "@/lib/store-builder/pending-changes";

/**
 * POST /api/ecommerce/store/[id]/publish-changes
 *
 * Publish all pending changes: syncs DB → products.ts/data.ts, runs the
 * Next.js build, and redeploys. Clears the hasPendingChanges flag.
 *
 * Individual CRUD operations (product/category/shipping edits) no longer
 * trigger a rebuild — they just mark the store as pending. This endpoint
 * is the single place where an actual rebuild gets initiated, letting
 * users batch many edits into one build.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, buildStatus: true, hasPendingChanges: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Clear the pending flag FIRST so the banner disappears immediately.
    // If the rebuild fails, we'll reset it via the error path below.
    await clearPendingChanges(store.id);

    // Fire the rebuild — product sync writes DB → files, then buildStoreV3 + deploy.
    // This is async / fire-and-forget; the client polls buildStatus to follow progress.
    triggerStoreRebuildIfV2(store.id).catch((err) => {
      console.error("[PublishChanges] Rebuild failed:", err);
      // If the rebuild fails entirely, restore the pending flag so the user
      // sees the publish CTA again (they'll need to retry).
      prisma.store.update({
        where: { id: store.id },
        data: { hasPendingChanges: true },
      }).catch(() => {});
    });

    return NextResponse.json({
      success: true,
      message: "Publishing your changes — your store will update in 30-90 seconds.",
    });
  } catch (err) {
    console.error("POST /api/ecommerce/store/[id]/publish-changes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
