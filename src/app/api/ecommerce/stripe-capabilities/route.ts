import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";
import {
  STRIPE_METHOD_CATALOG,
  type StripeMethodId,
} from "@/lib/constants/stripe-methods";

/**
 * GET — returns the Stripe payment methods that are actually usable by this
 * store's connected account, plus the owner's current allowlist.
 *
 * A method is "available" when the account capability (e.g. `klarna_payments`)
 * is `active`. Card/Apple/Google Pay are surfaced as soon as `card_payments`
 * is active. Methods with no capability gate (e.g. Link) fall through on card.
 *
 * PATCH — persists `store.settings.stripeMethods` as the owner's allowlist.
 *   Body: { enabled: StripeMethodId[] }
 */

export async function GET() {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await prisma.store.findFirst({
    where: { userId: session.userId },
    select: {
      id: true,
      currency: true,
      stripeConnectAccountId: true,
      stripeOnboardingComplete: true,
      settings: true,
    },
  });

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  // Existing allowlist (if any)
  const settings = (() => {
    try {
      return typeof store.settings === "string"
        ? JSON.parse(store.settings || "{}")
        : (store.settings as Record<string, unknown>) || {};
    } catch {
      return {};
    }
  })();
  const savedAllowlist: StripeMethodId[] = Array.isArray(settings.stripeMethods)
    ? (settings.stripeMethods as StripeMethodId[])
    : [];

  // Default to nothing-connected: report the catalog as unavailable
  if (!store.stripeConnectAccountId) {
    return NextResponse.json({
      connected: false,
      allowlist: savedAllowlist,
      methods: STRIPE_METHOD_CATALOG.map((m) => ({
        ...m,
        available: false,
        reason: "Connect your bank account to enable payments.",
      })),
    });
  }

  let account: Awaited<ReturnType<typeof stripe.accounts.retrieve>>;
  try {
    account = await stripe.accounts.retrieve(store.stripeConnectAccountId);
  } catch (err) {
    console.error("stripe-capabilities retrieve failed:", err);
    return NextResponse.json({ error: "Stripe account not reachable" }, { status: 502 });
  }

  const caps = (account.capabilities || {}) as Record<string, string>;

  const methods = STRIPE_METHOD_CATALOG.map((m) => {
    // If the catalog pins this method to a capability, check it.
    // Otherwise (e.g. `link`), it piggybacks on card_payments.
    const cap = m.capability ?? "card_payments";
    const capStatus = caps[cap];
    const available = capStatus === "active";
    return {
      ...m,
      available,
      capabilityStatus: capStatus || "unavailable",
    };
  });

  return NextResponse.json({
    connected: true,
    chargesEnabled: !!account.charges_enabled,
    country: account.country,
    defaultCurrency: account.default_currency,
    allowlist: savedAllowlist,
    methods,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.enabled)) {
    return NextResponse.json({ error: "enabled must be an array" }, { status: 400 });
  }

  const validIds = new Set(STRIPE_METHOD_CATALOG.map((m) => m.id));
  const enabled: StripeMethodId[] = (body.enabled as unknown[])
    .filter((x): x is string => typeof x === "string")
    .filter((x) => validIds.has(x as StripeMethodId)) as StripeMethodId[];

  const store = await prisma.store.findFirst({
    where: { userId: session.userId },
    select: { id: true, settings: true },
  });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const prev = (() => {
    try {
      return typeof store.settings === "string"
        ? JSON.parse(store.settings || "{}")
        : (store.settings as Record<string, unknown>) || {};
    } catch {
      return {};
    }
  })();

  const nextSettings = { ...prev, stripeMethods: enabled };

  await prisma.store.update({
    where: { id: store.id },
    data: { settings: JSON.stringify(nextSettings) },
  });

  return NextResponse.json({ success: true, allowlist: enabled });
}
