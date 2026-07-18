import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { applyCoupon } from "@/lib/ecommerce/coupons";

/**
 * Public — validate a discount code against a cart so the storefront can show
 * the discount before checkout. POST { storeSlug, code, subtotalCents }.
 */
export async function POST(request: NextRequest) {
  try {
    const { storeSlug, code, subtotalCents, shippingCents } = await request.json();
    if (!storeSlug || !code) return NextResponse.json({ valid: false, message: "Missing code." }, { status: 400 });

    const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
    if (!store) return NextResponse.json({ valid: false, message: "Store not found." }, { status: 404 });

    const result = await applyCoupon(store.id, code, Number(subtotalCents) || 0, Number(shippingCents) || 0);
    if ("error" in result) return NextResponse.json({ valid: false, message: result.error });

    return NextResponse.json({ valid: true, code: result.coupon.code, type: result.coupon.type, discountCents: result.discountCents });
  } catch {
    return NextResponse.json({ valid: false, message: "Couldn't validate that code." }, { status: 500 });
  }
}
