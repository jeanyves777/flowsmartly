import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * Store discount codes — owner CRUD. GET lists the store's codes; POST creates
 * one (code uppercased, unique per store). Store-scoped via the session's store.
 */

const createSchema = z.object({
  code: z.string().min(2).max(40),
  type: z.enum(["percentage", "fixed", "free_shipping"]).default("percentage"),
  value: z.number().int().min(0).default(0),
  minOrderCents: z.number().int().min(0).optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

async function ownedStore(userId: string) {
  return prisma.store.findUnique({ where: { userId }, select: { id: true } });
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const store = await ownedStore(session.userId);
    if (!store) return NextResponse.json({ success: false, error: "No store" }, { status: 404 });
    const coupons = await prisma.storeCoupon.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: { coupons } });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const store = await ownedStore(session.userId);
    if (!store) return NextResponse.json({ success: false, error: "No store" }, { status: 404 });

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message || "Invalid input" }, { status: 400 });
    const d = parsed.data;

    if (d.type === "percentage" && (d.value < 1 || d.value > 100)) return NextResponse.json({ success: false, error: "Percentage must be 1–100." }, { status: 400 });
    if (d.type === "fixed" && d.value < 1) return NextResponse.json({ success: false, error: "Set a fixed amount greater than 0." }, { status: 400 });

    const code = d.code.trim().toUpperCase();
    const existing = await prisma.storeCoupon.findUnique({ where: { storeId_code: { storeId: store.id, code } } });
    if (existing) return NextResponse.json({ success: false, error: "That code already exists." }, { status: 409 });

    const coupon = await prisma.storeCoupon.create({
      data: {
        storeId: store.id,
        code,
        type: d.type,
        value: d.type === "free_shipping" ? 0 : d.value,
        minOrderCents: d.minOrderCents ?? null,
        usageLimit: d.usageLimit ?? null,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        isActive: d.isActive ?? true,
      },
    });
    return NextResponse.json({ success: true, data: coupon }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to create" }, { status: 500 });
  }
}
