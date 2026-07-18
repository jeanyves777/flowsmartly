import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/** Update / delete a single store discount code (ownership-scoped). */

const updateSchema = z.object({
  code: z.string().min(2).max(40).optional(),
  type: z.enum(["percentage", "fixed", "free_shipping"]).optional(),
  value: z.number().int().min(0).optional(),
  minOrderCents: z.number().int().min(0).optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

async function owned(userId: string, id: string) {
  const store = await prisma.store.findUnique({ where: { userId }, select: { id: true } });
  if (!store) return null;
  const coupon = await prisma.storeCoupon.findFirst({ where: { id, storeId: store.id } });
  return coupon ? { storeId: store.id, coupon } : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const found = await owned(session.userId, id);
    if (!found) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message || "Invalid input" }, { status: 400 });
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.code !== undefined) {
      const code = d.code.trim().toUpperCase();
      const clash = await prisma.storeCoupon.findUnique({ where: { storeId_code: { storeId: found.storeId, code } } });
      if (clash && clash.id !== id) return NextResponse.json({ success: false, error: "That code already exists." }, { status: 409 });
      data.code = code;
    }
    if (d.type !== undefined) data.type = d.type;
    if (d.value !== undefined) data.value = d.value;
    if (d.minOrderCents !== undefined) data.minOrderCents = d.minOrderCents;
    if (d.usageLimit !== undefined) data.usageLimit = d.usageLimit;
    if (d.expiresAt !== undefined) data.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
    if (d.isActive !== undefined) data.isActive = d.isActive;

    const coupon = await prisma.storeCoupon.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: coupon });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const found = await owned(session.userId, id);
    if (!found) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    await prisma.storeCoupon.delete({ where: { id } });
    return NextResponse.json({ success: true, data: { id } });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
