import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { applyStoreDataUpdate } from "@/lib/store-builder/store-editor";

/**
 * POST /api/ecommerce/store/[id]/update-data — save editor changes to
 * data.ts/products.ts. The write pipeline lives in the shared store-editor
 * engine so the flow-agent's edit_store tool runs the exact same code.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true, siteData: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const patch = await request.json();
    const r = await applyStoreDataUpdate({ store, patch });
    if (!r.ok) return NextResponse.json({ error: r.error || "Save failed" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/ecommerce/store/[id]/update-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
