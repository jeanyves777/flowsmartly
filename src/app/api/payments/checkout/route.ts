import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { notifyCreditPurchase } from "@/lib/notifications";
import { createInvoice } from "@/lib/invoices";
import { stripe as stripeClient } from "@/lib/stripe";
import {
  getOrCreateStripeCustomer,
  createCreditPaymentIntent,
  createInlineSubscription,
} from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { type, packageId, planId, interval, paymentMethodId } = body as {
      type: "credits" | "credit_purchase" | "subscription";
      packageId?: string;
      planId?: string;
      interval?: "monthly" | "yearly";
      paymentMethodId?: string;
    };

    // Normalize type - accept both "credits" and "credit_purchase"
    const normalizedType = type === "credit_purchase" ? "credits" : type;

    if (!normalizedType || (normalizedType !== "credits" && normalizedType !== "subscription")) {
      return NextResponse.json(
        { success: false, error: "Invalid type. Must be 'credits' or 'subscription'." },
        { status: 400 }
      );
    }

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: "paymentMethodId is required" },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(session.userId);

    if (normalizedType === "credits") {
      if (!packageId) {
        return NextResponse.json(
          { success: false, error: "packageId is required for credit purchases" },
          { status: 400 }
        );
      }

      const result = await createCreditPaymentIntent({
        userId: session.userId,
        packageId,
        customerId,
        paymentMethodId,
      });

      let creditsAdded = 0;
      let newBalance = 0;

      // If payment succeeded immediately, add credits now (don't wait for webhook)
      if (result.status === "succeeded") {
        // Idempotency: check if webhook already processed this
        const existingTx = await prisma.creditTransaction.findFirst({
          where: { referenceId: result.paymentIntentId, referenceType: "stripe_payment" },
        });

        if (!existingTx) {
          // Fetch package details for credit amounts
          const pkg = await prisma.creditPackage.findUnique({
            where: { packageId },
          });

          if (pkg) {
            creditsAdded = pkg.credits + pkg.bonusCredits;

            await creditService.addCredits({
              userId: session.userId,
              type: TRANSACTION_TYPES.PURCHASE,
              amount: creditsAdded,
              description: `Purchased ${pkg.credits} credits${pkg.bonusCredits > 0 ? ` + ${pkg.bonusCredits} bonus` : ""} (Package: ${packageId})`,
              referenceType: "stripe_payment",
              referenceId: result.paymentIntentId,
            });

            // Get updated balance
            const user = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { email: true, name: true, aiCredits: true },
            });

            if (user) {
              newBalance = user.aiCredits;

              // Get payment method details for invoice
              let pmLabel = "Card";
              if (stripeClient && paymentMethodId) {
                try {
                  const pm = await stripeClient.paymentMethods.retrieve(paymentMethodId);
                  pmLabel = `${pm.card?.brand || "card"} ****${pm.card?.last4 || "????"}`;
                } catch { /* fallback */ }
              }

              // Create invoice
              createInvoice({
                userId: session.userId,
                type: "credit_purchase",
                items: [
                  {
                    description: `${pkg.name} — ${pkg.credits} credits${pkg.bonusCredits > 0 ? ` + ${pkg.bonusCredits} bonus` : ""}`,
                    quantity: 1,
                    unitPriceCents: pkg.priceCents,
                    totalCents: pkg.priceCents,
                  },
                ],
                totalCents: pkg.priceCents,
                paymentMethod: pmLabel,
                paymentId: result.paymentIntentId,
                customerName: user.name,
                customerEmail: user.email,
              }).catch((err) => console.error("Failed to create invoice:", err));

              // Fire-and-forget: send email receipt + in-app notification
              notifyCreditPurchase({
                userId: session.userId,
                email: user.email,
                name: user.name,
                credits: creditsAdded,
                amountCents: pkg.priceCents,
                newBalance,
              }).catch((err) => console.error("Failed to send credit purchase notification:", err));
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          clientSecret: result.clientSecret,
          status: result.status,
          requiresAction: result.status === "requires_action",
          creditsAdded,
          newBalance,
        },
      });
    }

    if (normalizedType === "subscription") {
      if (!planId) {
        return NextResponse.json(
          { success: false, error: "planId is required for subscriptions" },
          { status: 400 }
        );
      }

      if (!interval || (interval !== "monthly" && interval !== "yearly")) {
        return NextResponse.json(
          { success: false, error: "interval must be 'monthly' or 'yearly'" },
          { status: 400 }
        );
      }

      const result = await createInlineSubscription({
        userId: session.userId,
        planId,
        interval,
        customerId,
        paymentMethodId,
      });

      return NextResponse.json({
        success: true,
        data: {
          clientSecret: result.clientSecret,
          status: result.status,
          subscriptionId: result.subscriptionId,
          requiresAction: result.status === "incomplete",
        },
      });
    }
  } catch (error) {
    console.error("Checkout error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process payment";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
