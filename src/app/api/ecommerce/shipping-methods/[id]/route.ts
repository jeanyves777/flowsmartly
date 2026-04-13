import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(200).optional().nullable(),
  priceCents: z.number().int().min(0).optional(),
  estimatedDays: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** PATCH — update a shipping method */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findUnique({ where: { userId: session.userId }, select: { id: true } });
    if (!store) return NextResponse.json({ success: false, error: "No store" }, { status: 404 });

    const method = await prisma.storeShippingMethod.findFirst({ where: { id, storeId: store.id } });
    if (!method) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });

    const updated = await prisma.storeShippingMethod.update({ where: { id }, data: parsed.data });

    const { triggerStoreRebuildIfV2 } = await import("@/lib/store-builder/product-sync");
    triggerStoreRebuildIfV2(store.id).catch(e => console.error("Shipping sync error:", e));

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("PATCH shipping method error:", err);
    return NextResponse.json({ success: false, error: "Failed to update" }, { status: 500 });
  }
}

/** DELETE — remove a shipping method */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findUnique({ where: { userId: session.userId }, select: { id: true } });
    if (!store) return NextResponse.json({ success: false, error: "No store" }, { status: 404 });

    const method = await prisma.storeShippingMethod.findFirst({ where: { id, storeId: store.id } });
    if (!method) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    await prisma.storeShippingMethod.delete({ where: { id } });

    const { triggerStoreRebuildIfV2 } = await import("@/lib/store-builder/product-sync");
    triggerStoreRebuildIfV2(store.id).catch(e => console.error("Shipping sync error:", e));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE shipping method error:", err);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
