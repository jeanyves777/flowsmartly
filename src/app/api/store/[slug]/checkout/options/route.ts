import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";
import {
  STRIPE_METHOD_CATALOG,
  type StripeMethodId,
} from "@/lib/constants/stripe-methods";

const PAYMENT_LABELS: Record<string, string> = {
  card: "Credit / Debit Card",
  mobile_money: "Mobile Money",
  cod: "Cash on Delivery",
  bank_transfer: "Bank Transfer",
};

const PROVIDER_SUFFIXES: Record<string, string> = {
  mpesa: "M-Pesa",
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  wave: "Wave",
  flutterwave: "Flutterwave",
  paystack: "Paystack",
};

// GET /api/store/[slug]/checkout/options
// Public — called at checkout time by generated stores.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const store = await prisma.store.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        currency: true,
        isActive: true,
        settings: true,
        stripeConnectAccountId: true,
        stripeOnboardingComplete: true,
      },
    });

    if (!store || !store.isActive) {
      return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
    }

    const settings = parseSettings(store.settings);

    // Allowlist the owner picked in Settings → Payments. When absent, fall back
    // to the Stripe Connect account's active capabilities so we still surface
    // everything the account actually supports.
    const rawAllowlist: StripeMethodId[] = Array.isArray(settings.stripeMethods)
      ? (settings.stripeMethods as StripeMethodId[])
      : [];

    let stripeMethodsForUI: typeof STRIPE_METHOD_CATALOG = [];

    if (store.stripeConnectAccountId && stripe) {
      try {
        const account = await stripe.accounts.retrieve(store.stripeConnectAccountId);
        const caps = (account.capabilities || {}) as Record<string, string>;

        const active = STRIPE_METHOD_CATALOG.filter((m) => {
          const cap = m.capability ?? "card_payments";
          return caps[cap] === "active";
        });

        stripeMethodsForUI = rawAllowlist.length > 0
          ? active.filter((m) => rawAllowlist.includes(m.id))
          : active;
      } catch (err) {
        console.warn("checkout/options: could not retrieve Connect account", err);
      }
    }

    // Non-Stripe providers saved in StorePaymentMethod (mobile money, COD, bank transfer)
    const nonStripeRows = await prisma.storePaymentMethod.findMany({
      where: {
        storeId: store.id,
        isActive: true,
        methodType: { in: ["mobile_money", "cod", "bank_transfer"] },
        provider: { notIn: ["stripe"] },
      },
      select: { methodType: true, provider: true },
    });

    // Build the flat list served to the store UI.
    // Stripe is presented as a SINGLE option whose `stripeMethods` array lists
    // every eligible method — the store renders them as sub-icons / tabs so
    // customers see upfront what they can pay with.
    const paymentMethods: Array<{
      method: string;
      label: string;
      detail: string | null;
      provider: string | null;
      stripeMethodId?: string;
      stripeMethods?: Array<{ id: string; label: string; description: string }>;
    }> = [];

    if (stripeMethodsForUI.length > 0) {
      // Wallets ride on card_payments — group them as chips under the Card row
      // instead of duplicating the rail.
      const WALLET_IDS = new Set(["card", "apple_pay", "google_pay", "link"]);
      const cardBundle = stripeMethodsForUI.filter((m) => WALLET_IDS.has(m.id));
      const standaloneMethods = stripeMethodsForUI.filter((m) => !WALLET_IDS.has(m.id));

      if (cardBundle.length > 0) {
        const walletChips = cardBundle
          .filter((m) => m.id !== "card")
          .map((m) => ({ id: m.id, label: m.label, description: m.description }));
        paymentMethods.push({
          method: "card",  // backend enum — card rail covers card + wallets
          label: "Credit / Debit Card",
          detail: "Visa, Mastercard, Amex, Discover",
          provider: "stripe",
          stripeMethodId: "card",
          stripeMethods: walletChips.length > 0 ? walletChips : undefined,
        });
      }

      // Every non-wallet Stripe method gets its OWN radio row with a unique
      // method key (e.g. `stripe_klarna`) so deployed store UIs don't collide
      // them on React keys or selection state. The backend checkout route
      // treats any `stripe_*` value as the card/PaymentIntent path.
      for (const m of standaloneMethods) {
        paymentMethods.push({
          method: `stripe_${m.id}`,
          label: m.label,
          detail: m.description,
          provider: "stripe",
          stripeMethodId: m.id,
        });
      }
    }

    for (const row of nonStripeRows) {
      const label = PAYMENT_LABELS[row.methodType] || row.methodType;
      const providerSuffix = row.provider ? PROVIDER_SUFFIXES[row.provider] : null;
      paymentMethods.push({
        method: row.methodType,
        label,
        detail: providerSuffix || null,
        provider: row.provider || null,
      });
    }

    // Safety fallback so checkout is never empty.
    if (paymentMethods.length === 0) {
      paymentMethods.push({
        method: "card",
        label: "Credit / Debit Card",
        detail: "Visa, Mastercard, Amex",
        provider: "stripe",
      });
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

function parseSettings(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}
