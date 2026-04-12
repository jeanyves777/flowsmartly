import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";

interface LocalCartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  name?: string;
  variantName?: string;
  priceCents?: number;
  imageUrl?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const customer = await getStoreCustomer(store.id);
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items }: { items: LocalCartItem[] } = await req.json();

  // Merge: upsert each local item, taking max(server qty, local qty)
  if (Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      if (!item.productId) continue;
      const existing = await prisma.storeCartItem.findUnique({
        where: { customerId_productId_variantId: { customerId: customer.id, productId: item.productId, variantId: item.variantId ?? null } },
      });
      const finalQty = existing ? Math.max(existing.quantity, item.quantity) : item.quantity;
      await prisma.storeCartItem.upsert({
        where: { customerId_productId_variantId: { customerId: customer.id, productId: item.productId, variantId: item.variantId ?? null } },
        update: { quantity: finalQty, savedForLater: false },
        create: { customerId: customer.id, storeId: store.id, productId: item.productId, variantId: item.variantId ?? null, quantity: finalQty, savedForLater: false },
      });
    }
  }

  // Return merged cart
  const mergedItems = await prisma.storeCartItem.findMany({
    where: { customerId: customer.id, savedForLater: false },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items: mergedItems });
}
