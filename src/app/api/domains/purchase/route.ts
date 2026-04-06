import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe";
import { createDomainPaymentIntent } from "@/lib/stripe/ecommerce";
import { purchaseDomain } from "@/lib/domains/manager";
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
      });

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
    const result = await purchaseDomain({
      storeId: store!.id,
      userId: session.userId,
      domainName: domain,
      tld,
      isFree: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        domainId: result.id,
        domainName: result.domainName,
        status: result.registrarStatus,
      },
    });
  } catch (error) {
    console.error("Domain purchase error:", error);
    const message = error instanceof Error ? error.message : "Failed to purchase domain";
    return NextResponse.json(
      { success: false, error: { code: "PURCHASE_FAILED", message } },
      { status: 500 }
    );
  }
}
