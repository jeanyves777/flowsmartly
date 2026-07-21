import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { regionSupportsCOD } from "@/lib/constants/ecommerce";

/**
 * Store-owner control over the payment methods buyers see at checkout.
 *
 * The storefront's /checkout/options endpoint reads these live, so changes take
 * effect immediately — no store rebuild. Card & wallets are governed by the
 * store's Stripe payouts (enabled automatically once onboarding is complete);
 * the one offline method we honor end-to-end is Cash on delivery, which maps to
 * a StorePaymentMethod row (methodType "cod", provider null). Toggling COD off is
 * non-destructive — we deactivate the row rather than delete it.
 */

async function ownedStore(userId: string) {
  return prisma.store.findFirst({
    where: { userId },
    select: { id: true, region: true, country: true, stripeConnectAccountId: true, stripeOnboardingComplete: true },
  });
}

// GET — current accepted-method state for the owner's store.
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const store = await ownedStore(session.userId);
    if (!store) {
      return NextResponse.json({ success: false, error: { code: "NO_STORE", message: "No store found" } }, { status: 404 });
    }

    const cod = await prisma.storePaymentMethod.findFirst({
      where: { storeId: store.id, methodType: "cod" },
      select: { isActive: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        cardActive: !!store.stripeOnboardingComplete,
        cardConnected: !!store.stripeConnectAccountId,
        codEnabled: !!cod?.isActive,
        codRecommended: regionSupportsCOD(store.region),
        region: store.region,
        country: store.country,
      },
    });
  } catch (error) {
    console.error("Get payment methods error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load payment methods" } }, { status: 500 });
  }
}

const patchSchema = z.object({ cod: z.boolean() });

// PATCH — enable/disable Cash on delivery for the store.
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const store = await ownedStore(session.userId);
    if (!store) {
      return NextResponse.json({ success: false, error: { code: "NO_STORE", message: "No store found" } }, { status: 404 });
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
    }
    const { cod } = parsed.data;

    const existing = await prisma.storePaymentMethod.findFirst({
      where: { storeId: store.id, methodType: "cod" },
      select: { id: true, isActive: true },
    });

    if (cod) {
      if (existing) {
        if (!existing.isActive) await prisma.storePaymentMethod.update({ where: { id: existing.id }, data: { isActive: true } });
      } else {
        await prisma.storePaymentMethod.create({ data: { storeId: store.id, methodType: "cod", provider: null, isActive: true } });
      }
    } else if (existing?.isActive) {
      await prisma.storePaymentMethod.update({ where: { id: existing.id }, data: { isActive: false } });
    }

    return NextResponse.json({ success: true, data: { codEnabled: cod } });
  } catch (error) {
    console.error("Update payment methods error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update payment methods" } }, { status: 500 });
  }
}
