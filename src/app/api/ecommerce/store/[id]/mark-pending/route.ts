import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { markStoreAsPending } from "@/lib/store-builder/pending-changes";

/**
 * POST /api/ecommerce/store/[id]/mark-pending
 *
 * Mark a store as having pending changes without triggering a rebuild.
 * Called after any dashboard action that modifies store files/data (e.g.
 * the design editor "Save" button). User publishes later via the banner.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await markStoreAsPending(store.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST mark-pending error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
