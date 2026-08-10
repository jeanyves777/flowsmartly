import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe";
import { createDomainPaymentIntent } from "@/lib/stripe/ecommerce";
import { resolveRegistrantContact, describeMissingRegistrant } from "@/lib/domains/registrant";
import { purchaseDomain, RegistrantIncompleteError } from "@/lib/domains/manager";
import { isFreeDomainEligible, getDomainRetailPrice } from "@/lib/domains/pricing";

/**
 * POST /api/domains/purchase
 * Purchase a new domain (any user) or claim a free domain (Pro plan).
 * Domains are standalone — no store or subscription required for paid purchases.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let domain = body.domain as string | undefined;
    const tld = body.tld as string | undefined;
    const isFree = body.isFree === true;
    // Optional saved payment-method ID — mobile passes this so the server
    // confirms the PaymentIntent inline (no Stripe.js or hosted checkout).
    const paymentMethodId = typeof body.paymentMethodId === "string" && body.paymentMethodId
      ? body.paymentMethodId
      : undefined;

    // If domain already includes the TLD (e.g. "example.com"), extract just the SLD
    if (domain && tld && domain.endsWith(`.${tld}`)) {
      domain = domain.slice(0, -(tld.length + 1));
    }

    if (!domain || typeof domain !== "string" || !domain.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_DOMAIN", message: "A domain name is required" } },
        { status: 400 }
      );
    }

    if (!tld || typeof tld !== "string") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TLD", message: "A TLD is required (e.g., com, store, shop)" } },
        { status: 400 }
      );
    }

    // Determine price
    const retailPrice = getDomainRetailPrice(tld);
    if (retailPrice === null) {
      return NextResponse.json(
        { success: false, error: { code: "UNSUPPORTED_TLD", message: `The .${tld} TLD is not supported` } },
        { status: 400 }
      );
    }

    // Optionally look up user's store (for free domain claims and store linking)
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        ecomPlan: true,
        ecomSubscriptionStatus: true,
        freeDomainClaimed: true,
      },
    });

    // Free domain requires Pro plan with active subscription
    if (isFree) {
      if (!store) {
        return NextResponse.json(
          { success: false, error: { code: "PRO_REQUIRED", message: "Free domain requires a FlowShop Pro subscription" } },
          { status: 400 }
        );
      }

      const hasActiveSub = store.ecomSubscriptionStatus === "active" || store.ecomSubscriptionStatus === "trialing";
      if (!hasActiveSub || store.ecomPlan !== "pro") {
        return NextResponse.json(
          { success: false, error: { code: "PRO_REQUIRED", message: "Free domain is only available on the Pro plan" } },
          { status: 400 }
        );
      }

      if (store.freeDomainClaimed) {
        return NextResponse.json(
          { success: false, error: { code: "ALREADY_CLAIMED", message: "You have already claimed your free domain" } },
          { status: 400 }
        );
      }

      if (!isFreeDomainEligible(tld)) {
        return NextResponse.json(
          { success: false, error: { code: "TLD_NOT_FREE", message: `The .${tld} TLD is not eligible for the free domain offer` } },
          { status: 400 }
        );
      }
    }

    const fullDomain = `${domain}.${tld}`;

    // Fetch user's Brand Identity for registrant contact info
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      select: {
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        country: true,
      },
    });

    // The registrant contact, from the one place that assembles one. This
    // route used to build it here — splitting the business name into a first
    // and last name, and turning a bare phone number into `+1.` — which is
    // exactly the pattern the completeness guard in the OpenSRS client cannot
    // catch, because the caller had already supplied the missing facts.
    const resolved = await resolveRegistrantContact(session.userId);
    if (!resolved.ok) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INCOMPLETE_REGISTRANT",
            message: describeMissingRegistrant(resolved.missing),
            missingFields: resolved.missing.map((m) => m.label),
            missing: resolved.missing,
          },
        },
        { status: 400 }
      );
    }
    const contact = resolved.contact;

    // For PAID domains: create PaymentIntent only, don't register yet.
    // Domain will be registered in the Stripe webhook after payment succeeds.
    if (!isFree) {
      const customerId = await getOrCreateStripeCustomer(session.userId);

      const paymentResult = await createDomainPaymentIntent({
        userId: session.userId,
        customerId,
        domainName: fullDomain,
        amountCents: retailPrice,
        storeId: store?.id || "",
        tld,
        paymentMethodId,
      });

      // Server-side confirmation path (mobile flow): the PaymentIntent has
      // already been confirmed with the saved card. Webhook will register
      // the domain on `payment_intent.succeeded`. Surface a concrete status
      // so the mobile client can show success / 3DS-fallback inline.
      if (paymentMethodId) {
        const ok = paymentResult.status === "succeeded" || paymentResult.status === "processing";
        return NextResponse.json({
          success: true,
          data: {
            domainName: fullDomain,
            amountCents: retailPrice,
            status: ok ? "registering" : paymentResult.status,
            paymentIntentId: paymentResult.paymentIntentId,
            requiresAction: paymentResult.requiresAction,
            // Only surface clientSecret when the card needs 3DS — mobile
            // can fall back to its hosted-checkout escape hatch for that
            // single PaymentIntent.
            ...(paymentResult.requiresAction
              ? { clientSecret: paymentResult.clientSecret }
              : {}),
          },
        });
      }

      // Web flow — client confirms via <PaymentElement /> using clientSecret.
      return NextResponse.json({
        success: true,
        data: {
          domainName: fullDomain,
          status: "awaiting_payment",
          clientSecret: paymentResult.clientSecret,
          paymentIntentId: paymentResult.paymentIntentId,
        },
      });
    }

    // For FREE domains (Pro plan): register immediately
    const outcome = await purchaseDomain({
      storeId: store!.id,
      userId: session.userId,
      domainName: domain,
      tld,
      isFree: true,
      contact,
    });

    // A registrar refusal is not a purchase. This route used to answer
    // `{ success: true, status: "registration_failed" }`, which is a sentence
    // that cannot be true, and the caller drew the domain as if it were live.
    if (outcome.status === "registration_failed") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "REGISTRATION_FAILED",
            message: outcome.error,
            // The row exists so the owner can retry without losing the name.
            domainId: outcome.domain.id,
            domainName: outcome.domain.domainName,
          },
        },
        { status: 502 }
      );
    }

    // Mark the store as having pending changes (user will publish when ready)
    const { markStoreAsPending } = await import("@/lib/store-builder/pending-changes");
    markStoreAsPending(store!.id).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        domainId: outcome.domain.id,
        domainName: outcome.domain.domainName,
        // "registered" or "pending_registration" — never a failure, and never
        // a word that implies the registrar said yes when it has not been asked.
        status: outcome.status,
      },
    });
  } catch (error) {
    // An owner who has not finished their details is not a server fault, and
    // telling them "try again" would send them round a loop that cannot end.
    if (error instanceof RegistrantIncompleteError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INCOMPLETE_REGISTRANT",
            message: error.message,
            missingFields: error.missing.map((m) => m.label),
            missing: error.missing,
          },
        },
        { status: 400 }
      );
    }
    console.error("Domain purchase error:", error);
    const message = error instanceof Error ? error.message : "Failed to purchase domain";
    return NextResponse.json(
      { success: false, error: { code: "PURCHASE_FAILED", message } },
      { status: 500 }
    );
  }
}
