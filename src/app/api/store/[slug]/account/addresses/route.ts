import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";

// GET /api/store/[slug]/account/addresses
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    return NextResponse.json({ addresses: JSON.parse(customer.addresses || "[]") });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch addresses" }, { status: 500 });
  }
}

// PUT /api/store/[slug]/account/addresses
export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { addresses } = await request.json();
    if (!Array.isArray(addresses)) return NextResponse.json({ error: "Invalid addresses" }, { status: 400 });

    await prisma.storeCustomer.update({
      where: { id: customer.id },
      data: { addresses: JSON.stringify(addresses) },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update addresses" }, { status: 500 });
  }
}
