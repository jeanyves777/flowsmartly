import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

const PAYMENT_LABELS: Record<string, string> = {
  card: "Credit / Debit Card",
  mobile_money: "Mobile Money",
  cod: "Cash on Delivery",
  bank_transfer: "Bank Transfer",
};

const PROVIDER_SUFFIXES: Record<string, string> = {
  stripe: "Visa, Mastercard, Amex",
  mpesa: "M-Pesa",
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  wave: "Wave",
  flutterwave: "Flutterwave",
  paystack: "Paystack",
};

// GET /api/store/[slug]/checkout/options
// Returns active payment methods for a store — called publicly from generated stores
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, name: true, currency: true, isActive: true },
    });

    if (!store || !store.isActive) {
      return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
    }

    const methods = await prisma.storePaymentMethod.findMany({
      where: {
        storeId: store.id,
        isActive: true,
        // Only return methods the checkout API accepts
        methodType: { in: ["card", "mobile_money", "cod", "bank_transfer"] },
      },
      select: { id: true, methodType: true, provider: true },
    });

    const paymentMethods = methods.map((m) => {
      const label = PAYMENT_LABELS[m.methodType] || m.methodType;
      const providerSuffix = m.provider ? PROVIDER_SUFFIXES[m.provider] : null;
      return {
        method: m.methodType,
        label,
        detail: providerSuffix || null,
        provider: m.provider || null,
      };
    });

    // Fallback: if store has no payment methods configured, default to card
    if (paymentMethods.length === 0) {
      paymentMethods.push({ method: "card", label: "Credit / Debit Card", detail: "Visa, Mastercard, Amex", provider: "stripe" });
    }

    return NextResponse.json({
      success: true,
      data: { paymentMethods, currency: store.currency, storeName: store.name },
    });
  } catch (err) {
    console.error("Checkout options error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
