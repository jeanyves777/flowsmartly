import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer, hashPassword, verifyPassword } from "@/lib/store/customer-auth";
import { safeCorsHeaders } from "@/lib/store/cors";
import { z } from "zod";

const corsHeaders = safeCorsHeaders;

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

// GET /api/store/[slug]/account/profile
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404, headers: corsHeaders(request) });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders(request) });

    return NextResponse.json(
      { customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } },
      { headers: corsHeaders(request) },
    );
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500, headers: corsHeaders(request) });
  }
}

// PUT /api/store/[slug]/account/profile
const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
  profileComplete: z.boolean().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404, headers: corsHeaders(request) });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders(request) });

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400, headers: corsHeaders(request) });

    const { name, phone, currentPassword, newPassword, profileComplete } = parsed.data;
    const data: Record<string, unknown> = {};

    if (name) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (profileComplete !== undefined) data.profileComplete = profileComplete;

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password required" }, { status: 400, headers: corsHeaders(request) });
      }
      const valid = await verifyPassword(currentPassword, customer.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400, headers: corsHeaders(request) });
      }
      data.passwordHash = await hashPassword(newPassword);
    }

    await prisma.storeCustomer.update({ where: { id: customer.id }, data });

    return NextResponse.json({ success: true }, { headers: corsHeaders(request) });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500, headers: corsHeaders(request) });
  }
}
