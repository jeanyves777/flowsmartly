import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  createCreditCheckoutSession,
  createSubscriptionCheckoutSession,
  getOrCreateStripeCustomer,
} from "@/lib/stripe";
import { isAllowedMobileRedirect } from "@/lib/auth/mobile-oauth";

/**
 * Mobile checkout — creates a Stripe-hosted Checkout Session and returns its
 * URL. Mobile opens that URL in expo-web-browser; on completion Stripe
 * redirects to a `flowsmartly://billing/...` deep link and the existing
 * `checkout.session.completed` webhook handler credits the user / activates
 * the subscription server-side. No Stripe SDK required on the device.
 *
 * Why a separate endpoint from /api/payments/checkout (inline) — Stripe's
 * inline PaymentIntent flow needs a stripe.js / stripe-react-native client to
 * confirm 3DS. Hosted Checkout handles that entirely on Stripe's pages, which
 * is the right trade-off for mobile (Expo Go compatible, no SDK linking).
 */

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("credit_purchase"),
    packageId: z.string().min(1),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  }),
  z.object({
    type: z.literal("subscription"),
    planId: z.string().min(1),
    interval: z.enum(["monthly", "yearly"]),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  }),
]);

const DEFAULT_SUCCESS = "flowsmartly://billing/success";
const DEFAULT_CANCEL = "flowsmartly://billing/cancel";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
        { status: 401 },
      );
    }
    if (session.agentId) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Agents cannot make purchases." } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      );
    }
    const data = parsed.data;

    // Whitelist redirect URLs to the same schemes mobile-OAuth allows
    // (flowsmartly:, exp:, exp+flowsmartly:) so a malicious payload can't
    // bounce the user out to an arbitrary host after a successful payment.
    const successUrl =
      data.successUrl && isAllowedMobileRedirect(data.successUrl)
        ? data.successUrl
        : DEFAULT_SUCCESS;
    const cancelUrl =
      data.cancelUrl && isAllowedMobileRedirect(data.cancelUrl)
        ? data.cancelUrl
        : DEFAULT_CANCEL;
    // Stripe substitutes {CHECKOUT_SESSION_ID} server-side so the client knows
    // which session just completed and can poll its status if needed.
    const successWithSession = successUrl.includes("{CHECKOUT_SESSION_ID}")
      ? successUrl
      : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, stripeCustomerId: true },
    });
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "USER_NOT_FOUND", message: "User not found." } },
        { status: 404 },
      );
    }

    const customerId = user.stripeCustomerId || (await getOrCreateStripeCustomer(session.userId));

    const checkoutSession =
      data.type === "credit_purchase"
        ? await createCreditCheckoutSession({
            userId: session.userId,
            userEmail: user.email,
            packageId: data.packageId,
            stripeCustomerId: customerId,
            successUrl: successWithSession,
            cancelUrl,
          })
        : await createSubscriptionCheckoutSession({
            userId: session.userId,
            userEmail: user.email,
            planId: data.planId,
            interval: data.interval,
            stripeCustomerId: customerId,
            successUrl: successWithSession,
            cancelUrl,
          });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { success: false, error: { code: "NO_CHECKOUT_URL", message: "Stripe didn't return a checkout URL." } },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { url: checkoutSession.url, sessionId: checkoutSession.id },
    });
  } catch (err) {
    console.error("Mobile checkout error:", err);
    const message = err instanceof Error ? err.message : "Couldn't start checkout.";
    return NextResponse.json(
      { success: false, error: { code: "CHECKOUT_FAILED", message } },
      { status: 500 },
    );
  }
}
