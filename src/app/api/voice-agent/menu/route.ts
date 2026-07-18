/**
 * Voice Agent — the menu behind the ordering preset.
 *
 * GET → the user's store products, so a restaurant/retailer that already sells
 *       with us doesn't retype their menu. Returns [] (not an error) if there's
 *       no store, so the brief just falls back to manual entry.
 *
 * Only ACTIVE products are offered — an agent must never take an order for
 * something DRAFT or archived.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const store = await prisma.store.findUnique({
    where: { userId: session.userId },
    select: { id: true, name: true },
  });
  if (!store) return NextResponse.json({ success: true, hasStore: false, storeId: null, items: [] });

  const products = await prisma.product.findMany({
    where: { storeId: store.id, status: "ACTIVE" },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { name: true, priceCents: true, category: true, description: true },
    take: 300,
  });

  return NextResponse.json({
    success: true,
    hasStore: true,
    storeId: store.id,
    storeName: store.name,
    items: products.map((p) => ({
      name: p.name,
      priceCents: p.priceCents,
      category: p.category || null,
      note: p.description?.slice(0, 120) || null,
    })),
  });
}
