import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const customer = await getStoreCustomer(store.id);
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Add to cart
  await prisma.storeCartItem.upsert({
    where: { customerId_productId_variantId: { customerId: customer.id, productId, variantId: null } },
    update: { savedForLater: false, quantity: 1 },
    create: { customerId: customer.id, storeId: store.id, productId, variantId: null, quantity: 1, savedForLater: false },
  });

  // Remove from wishlist
  await prisma.storeWishlistItem.deleteMany({
    where: { customerId: customer.id, productId },
  });

  return NextResponse.json({ success: true });
}
