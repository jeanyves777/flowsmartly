import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe";
import { createDomainPaymentIntent } from "@/lib/stripe/ecommerce";
import { purchaseDomain } from "@/lib/domains/manager";
import { isFreeDomainEligible, getDomainRetailPrice } from "@/lib/domains/pricing";

/**
 * POST /api/domains/purchase
 * Purchase a new domain or claim a free domain (Pro plan).
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

    // Validate user has a store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        ecomPlan: true,
        ecomSubscriptionId: true,
        ecomSubscriptionStatus: true,
        freeDomainClaimed: true,
      },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You need an active FlowShop store to purchase a domain" } },
        { status: 400 }
      );
    }

    // Check for active subscription
    const hasActiveSub = store.ecomSubscriptionStatus === "active" || store.ecomSubscriptionStatus === "trialing";
    if (!hasActiveSub) {
      return NextResponse.json(
        { success: false, error: { code: "INACTIVE_SUBSCRIPTION", message: "An active FlowShop subscription is required" } },
        { status: 400 }
      );
    }

    // Free domain validation
    if (isFree) {
      if (store.ecomPlan !== "pro") {
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

    // Determine price
    const retailPrice = getDomainRetailPrice(tld);
    if (retailPrice === null) {
      return NextResponse.json(
        { success: false, error: { code: "UNSUPPORTED_TLD", message: `The .${tld} TLD is not supported` } },
        { status: 400 }
      );
    }

    let clientSecret: string | undefined;
    let paymentIntentId: string | undefined;

    // For paid domains, create a Stripe PaymentIntent
    if (!isFree) {
      const customerId = await getOrCreateStripeCustomer(session.userId);
      const fullDomain = `${domain}.${tld}`;

      const paymentResult = await createDomainPaymentIntent({
        userId: session.userId,
        customerId,
        domainName: fullDomain,
        amountCents: retailPrice,
      });

      clientSecret = paymentResult.clientSecret;
      paymentIntentId = paymentResult.paymentIntentId;
    }

    // Register and provision the domain
    const result = await purchaseDomain({
      storeId: store.id,
      userId: session.userId,
      domainName: domain,
      tld,
      isFree,
    });

    // If free domain, update store.freeDomainClaimed
    if (isFree) {
      await prisma.store.update({
        where: { id: store.id },
        data: { freeDomainClaimed: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        domainId: result.id,
        domainName: result.domainName,
        status: result.registrarStatus,
        ...(clientSecret ? { clientSecret } : {}),
        ...(paymentIntentId ? { paymentIntentId } : {}),
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
