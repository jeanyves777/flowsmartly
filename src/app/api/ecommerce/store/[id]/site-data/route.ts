import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readStoreData } from "@/lib/store-builder/store-editor";

/**
 * GET /api/ecommerce/store/[id]/site-data — parse data.ts + products.ts for the
 * editor. Parsing lives in the shared store-editor engine so the flow-agent's
 * get_store_content tool returns the exact same shape. `?refresh=true` bypasses
 * the cache.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true, siteData: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
    const data = await readStoreData(store, { forceRefresh });
    if (data === null) return NextResponse.json({ error: "Store data files not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/ecommerce/store/[id]/site-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
