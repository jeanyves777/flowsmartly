import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const customer = await getStoreCustomer(store.id);
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, variantId } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  await prisma.storeCartItem.updateMany({
    where: { customerId: customer.id, productId, variantId: variantId ?? null },
    data: { savedForLater: true },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const customer = await getStoreCustomer(store.id);
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, variantId } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  await prisma.storeCartItem.updateMany({
    where: { customerId: customer.id, productId, variantId: variantId ?? null },
    data: { savedForLater: false },
  });
  return NextResponse.json({ success: true });
}
