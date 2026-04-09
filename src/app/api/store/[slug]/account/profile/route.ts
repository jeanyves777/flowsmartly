import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer, hashPassword, verifyPassword } from "@/lib/store/customer-auth";
import { z } from "zod";

// GET /api/store/[slug]/account/profile
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    return NextResponse.json({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// PUT /api/store/[slug]/account/profile
const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const { name, phone, currentPassword, newPassword } = parsed.data;
    const data: Record<string, string> = {};

    if (name) data.name = name;
    if (phone !== undefined) data.phone = phone;

    // Password change requires current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password required" }, { status: 400 });
      }
      const valid = await verifyPassword(currentPassword, customer.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      data.passwordHash = await hashPassword(newPassword);
    }

    await prisma.storeCustomer.update({ where: { id: customer.id }, data });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
