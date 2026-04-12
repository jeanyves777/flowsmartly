import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";

async function resolveStore(slug: string) {
  return prisma.store.findUnique({ where: { slug }, select: { id: true } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await resolveStore(slug);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const customer = await getStoreCustomer(store.id);
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.storeCartItem.findMany({
    where: { customerId: customer.id, savedForLater: false },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await resolveStore(slug);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const customer = await getStoreCustomer(store.id);
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, variantId, quantity = 1 } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const vid = variantId ?? null;
  const existing = await prisma.storeCartItem.findFirst({
    where: { customerId: customer.id, productId, variantId: vid },
  });
  let item;
  if (existing) {
    await prisma.storeCartItem.updateMany({
      where: { customerId: customer.id, productId, variantId: vid },
      data: { quantity, savedForLater: false },
    });
    item = { ...existing, quantity, savedForLater: false };
  } else {
    item = await prisma.storeCartItem.create({
      data: { customerId: customer.id, storeId: store.id, productId, variantId: vid, quantity, savedForLater: false },
    });
  }
  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await resolveStore(slug);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const customer = await getStoreCustomer(store.id);
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, variantId } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  await prisma.storeCartItem.deleteMany({
    where: { customerId: customer.id, productId, variantId: variantId ?? null },
  });
  return NextResponse.json({ success: true });
}
