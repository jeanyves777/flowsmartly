import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";
import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import {
  notifyCreditPurchase,
  notifyPaymentMethodAdded,
  notifySubscriptionActivated,
  notifySubscriptionRenewed,
  notifySubscriptionCancelled,
} from "@/lib/notifications";
import type Stripe from "stripe";
import { calculateAndAwardCommission } from "@/lib/referrals";

export const runtime = "nodejs";

// Process the webhook event (shared between verified and dev mode)
async function processWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata ?? {};

      const { userId, type, packageId, credits, bonus, planId } = metadata;

      if (!userId) {
        console.error("[Stripe Webhook] Missing userId in session metadata");
        break;
      }

      if (type === "credit_purchase") {
        const totalCredits =
          parseInt(credits || "0", 10) + parseInt(bonus || "0", 10);

        await creditService.addCredits({
          userId,
          type: TRANSACTION_TYPES.PURCHASE,
          amount: totalCredits,
          description: `Purchased ${credits} credits${bonus && parseInt(bonus, 10) > 0 ? ` + ${bonus} bonus` : ""} (Package: ${packageId})`,
          referenceType: "stripe_purchase",
          referenceId: session.id,
        });

        // Update stripeCustomerId if not already set
        if (session.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer as string },
          });
        }

        // Get user details for notification
        const purchaseUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true, aiCredits: true },
        });

        // Send credit purchase notification
        if (purchaseUser) {
          notifyCreditPurchase({
            userId,
            email: purchaseUser.email,
            name: purchaseUser.name,
            credits: totalCredits,
            amountCents: session.amount_total || 0,
            newBalance: purchaseUser.aiCredits,
          }).catch((err) => console.error("Failed to send credit purchase notification:", err));
        }

        // Process referral commission (fire-and-forget)
        calculateAndAwardCommission({
          payerUserId: userId,
          paymentAmountCents: session.amount_total || 0,
          sourceType: "CREDIT_PURCHASE",
          sourcePaymentId: session.id,
        }).catch((err) => console.error("[Stripe Webhook] Referral commission error:", err));

        console.log(
          `[Stripe Webhook] Credit purchase completed: ${totalCredits} credits for user ${userId}`
        );
      } else if (type === "event_ticket") {
        // Handle event ticket purchase
        const { eventId, ticketOrderId } = metadata;
        if (!eventId || !ticketOrderId) {
          console.error("[Stripe Webhook] Missing eventId or ticketOrderId in event_ticket metadata");
          break;
        }

        // Idempotency: check if order already completed
        const ticketOrder = await prisma.ticketOrder.findUnique({ where: { id: ticketOrderId } });
        if (!ticketOrder || ticketOrder.status === "COMPLETED") {
          console.log(`[Stripe Webhook] TicketOrder ${ticketOrderId} already processed or not found, skipping`);
          break;
        }

        // Update TicketOrder to COMPLETED
        await prisma.ticketOrder.update({
          where: { id: ticketOrderId },
          data: {
            status: "COMPLETED",
            stripePaymentIntentId: session.payment_intent as string || null,
          },
        });

        // Generate unique ticket code
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let ticketCode = "";
        for (let i = 0; i < 8; i++) ticketCode += chars[Math.floor(Math.random() * chars.length)];
        // Ensure uniqueness
        while (await prisma.eventRegistration.findUnique({ where: { ticketCode } })) {
          ticketCode = "";
          for (let i = 0; i < 8; i++) ticketCode += chars[Math.floor(Math.random() * chars.length)];
        }

        // Create EventRegistration
        await prisma.eventRegistration.create({
          data: {
            eventId,
            name: ticketOrder.buyerName,
            email: ticketOrder.buyerEmail,
            status: "registered",
            ticketCode,
            ticketOrderId,
          },
        });

        // Update event counts and revenue
        await prisma.event.update({
          where: { id: eventId },
          data: {
            registrationCount: { increment: 1 },
            totalRevenueCents: { increment: ticketOrder.amountCents },
          },
        });

        // Find event owner for earnings
        const ticketEvent = await prisma.event.findUnique({
          where: { id: eventId },
          select: { userId: true },
        });

        if (ticketEvent) {
          // Create earning for organizer
          await prisma.earning.create({
            data: {
              userId: ticketEvent.userId,
              amountCents: ticketOrder.organizerAmountCents,
              source: "TICKET_SALE",
              sourceId: ticketOrderId,
            },
          });

          // Add to organizer balance
          await prisma.user.update({
            where: { id: ticketEvent.userId },
            data: { balanceCents: { increment: ticketOrder.organizerAmountCents } },
          });

          // Create platform fee earning (for FlowSmartly admin tracking)
          await prisma.earning.create({
            data: {
              userId: ticketEvent.userId,
              amountCents: ticketOrder.platformFeeCents,
              source: "PLATFORM_FEE",
              sourceId: ticketOrderId,
            },
          });
        }

        // Auto-create contact
        if (ticketOrder.buyerEmail && ticketEvent) {
          const existingContact = await prisma.contact.findFirst({
            where: { userId: ticketEvent.userId, email: ticketOrder.buyerEmail },
          });
          if (!existingContact) {
            await prisma.contact.create({
              data: {
                userId: ticketEvent.userId,
                email: ticketOrder.buyerEmail,
                firstName: ticketOrder.buyerName.split(" ")[0] || null,
                lastName: ticketOrder.buyerName.split(" ").slice(1).join(" ") || null,
                emailOptedIn: true,
                emailOptedInAt: new Date(),
              },
            });
          }
        }

        console.log(
          `[Stripe Webhook] Event ticket purchased: ${ticketCode} for event ${eventId} ($${(ticketOrder.amountCents / 100).toFixed(2)})`
        );
      } else if (type === "store_order") {
        // Handle store order payment
        const { orderId, storeId, storeSlug } = metadata;
        if (!orderId) {
          console.error("[Stripe Webhook] Missing orderId in store_order metadata");
          break;
        }

        // Idempotency: check if order already paid
        const storeOrder = await prisma.order.findUnique({ where: { id: orderId } });
        if (!storeOrder || storeOrder.paymentStatus === "paid") {
          console.log(`[Stripe Webhook] Store order ${orderId} already paid or not found, skipping`);
          break;
        }

        // Update order: mark paid and confirmed
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "paid",
            paymentId: session.id,
            status: "CONFIRMED",
          },
        });

        // Increment store stats
        if (storeId) {
          await prisma.store.update({
            where: { id: storeId },
            data: {
              orderCount: { increment: 1 },
              totalRevenueCents: { increment: storeOrder.totalCents },
            },
          }).catch(() => {});
        }

        console.log(
          `[Stripe Webhook] Store order ${orderId} payment confirmed (${storeSlug})`
        );
      } else if (type === "ecommerce_subscription") {
        // E-commerce FlowShop subscription activated
        await prisma.store.updateMany({
          where: { userId },
          data: {
            ecomSubscriptionId: session.subscription as string || null,
            ecomSubscriptionStatus: "active",
            isActive: true,
          },
        });

        // Update stripeCustomerId if not already set
        if (session.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer as string },
          });
        }

        console.log(
          `[Stripe Webhook] FlowShop e-commerce subscription activated for user ${userId}`
        );
      } else if (type === "subscription") {
        // Fetch plan from database (dynamic credits, admin-configurable)
        const dbPlan = await prisma.plan.findUnique({
          where: { planId: planId || "" },
        });
        // Fallback to hardcoded config for safety
        const configPlan = PLANS[planId as keyof typeof PLANS];
        const plan = dbPlan || configPlan;

        if (!plan) {
          console.error(
            `[Stripe Webhook] Invalid planId in metadata: ${planId}`
          );
          break;
        }

        // Update user plan and expiration
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: planId!,
            planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            stripeCustomerId: session.customer as string,
          },
        });

        // Add monthly credits based on plan
        await creditService.addCredits({
          userId,
          type: TRANSACTION_TYPES.SUBSCRIPTION,
          amount: plan.monthlyCredits,
          description: `${plan.name} plan monthly credits`,
          referenceType: "stripe_subscription",
          referenceId: session.id,
        });

        // Send subscription activated notification
        const subUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });

        if (subUser) {
          notifySubscriptionActivated({
            userId,
            email: subUser.email,
            name: subUser.name,
            planName: plan.name,
            monthlyCredits: plan.monthlyCredits,
            amountCents: session.amount_total || 0,
            interval: "monthly",
          }).catch((err) => console.error("Failed to send subscription activated notification:", err));
        }

        // Process referral commission (fire-and-forget)
        calculateAndAwardCommission({
          payerUserId: userId,
          paymentAmountCents: session.amount_total || 0,
          sourceType: "SUBSCRIPTION",
          sourcePaymentId: session.id,
        }).catch((err) => console.error("[Stripe Webhook] Referral commission error:", err));

        console.log(
          `[Stripe Webhook] Subscription activated: ${planId} plan for user ${userId} (+${plan.monthlyCredits} credits)`
        );
      }

      break;
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const piMetadata = paymentIntent.metadata ?? {};

      // Handle store order payments
      if (piMetadata.type === "store_order" && piMetadata.orderId) {
        await prisma.order.updateMany({
          where: { id: piMetadata.orderId },
          data: {
            paymentStatus: "paid",
            status: "CONFIRMED",
          },
        });
        console.log(
          `[Stripe Webhook] Store order ${piMetadata.orderId} payment confirmed (${piMetadata.storeSlug})`
        );
        break;
      }

      if (piMetadata.type !== "credit_purchase" || !piMetadata.userId) {
        break;
      }

      // Idempotency: check if we already processed this payment
      const existingPiTx = await prisma.creditTransaction.findFirst({
        where: {
          referenceId: paymentIntent.id,
          referenceType: "stripe_payment",
        },
      });

      if (existingPiTx) {
        console.log(`[Stripe Webhook] PaymentIntent ${paymentIntent.id} already processed, skipping`);
        break;
      }

      const piCredits = parseInt(piMetadata.credits || "0", 10);
      const piBonus = parseInt(piMetadata.bonus || "0", 10);
      const piTotalCredits = piCredits + piBonus;

      await creditService.addCredits({
        userId: piMetadata.userId,
        type: TRANSACTION_TYPES.PURCHASE,
        amount: piTotalCredits,
        description: `Purchased ${piCredits} credits${piBonus > 0 ? ` + ${piBonus} bonus` : ""} (Package: ${piMetadata.packageId})`,
        referenceType: "stripe_payment",
        referenceId: paymentIntent.id,
      });

      // Get user details for notification
      const piUser = await prisma.user.findUnique({
        where: { id: piMetadata.userId },
        select: { email: true, name: true, aiCredits: true },
      });

      if (piUser) {
        notifyCreditPurchase({
          userId: piMetadata.userId,
          email: piUser.email,
          name: piUser.name,
          credits: piTotalCredits,
          amountCents: paymentIntent.amount,
          newBalance: piUser.aiCredits,
        }).catch((err) => console.error("Failed to send credit purchase notification:", err));
      }

      // Process referral commission (fire-and-forget)
      calculateAndAwardCommission({
        payerUserId: piMetadata.userId,
        paymentAmountCents: paymentIntent.amount,
        sourceType: "CREDIT_PURCHASE",
        sourcePaymentId: paymentIntent.id,
      }).catch((err) => console.error("[Stripe Webhook] Referral commission error:", err));

      console.log(
        `[Stripe Webhook] PaymentIntent credit purchase: ${piTotalCredits} credits for user ${piMetadata.userId}`
      );
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;

      // v2026 API: subscription info is under invoice.parent.subscription_details
      const subDetails = invoice.parent?.subscription_details;
      if (!subDetails || !stripe) break;

      const subscriptionId = typeof subDetails.subscription === "string"
        ? subDetails.subscription
        : subDetails.subscription?.id;
      if (!subscriptionId) break;

      // Use metadata from invoice snapshot, fall back to fetching subscription
      let subMetadata = subDetails.metadata ?? {};
      if (!subMetadata.type) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        subMetadata = sub.metadata ?? {};
      }

      if (subMetadata.type !== "subscription" || !subMetadata.userId) {
        break;
      }

      // Idempotency: check if we already processed this invoice
      const existingInvTx = await prisma.creditTransaction.findFirst({
        where: {
          referenceId: invoice.id,
          referenceType: "stripe_subscription",
        },
      });

      if (existingInvTx) {
        console.log(`[Stripe Webhook] Invoice ${invoice.id} already processed, skipping`);
        break;
      }

      const subPlanId = subMetadata.planId;
      // Fetch from DB first, fallback to hardcoded config
      const dbSubPlan = await prisma.plan.findUnique({
        where: { planId: subPlanId || "" },
      });
      const configSubPlan = PLANS[subPlanId as keyof typeof PLANS];
      const subPlan = dbSubPlan || configSubPlan;

      if (!subPlan) {
        console.error(`[Stripe Webhook] Invalid planId in subscription metadata: ${subMetadata.planId}`);
        break;
      }

      // Update user plan
      await prisma.user.update({
        where: { id: subMetadata.userId },
        data: {
          plan: subPlanId!,
          planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Add monthly credits
      const subMonthlyCredits = parseInt(subMetadata.monthlyCredits || String(subPlan.monthlyCredits), 10);
      await creditService.addCredits({
        userId: subMetadata.userId,
        type: TRANSACTION_TYPES.SUBSCRIPTION,
        amount: subMonthlyCredits,
        description: `${subPlan.name} plan monthly credits`,
        referenceType: "stripe_subscription",
        referenceId: invoice.id,
      });

      // Send subscription renewed notification
      const renewUser = await prisma.user.findUnique({
        where: { id: subMetadata.userId },
        select: { email: true, name: true },
      });

      if (renewUser) {
        notifySubscriptionRenewed({
          userId: subMetadata.userId,
          email: renewUser.email,
          name: renewUser.name,
          planName: subPlan.name,
          monthlyCredits: subMonthlyCredits,
          amountCents: invoice.amount_paid || 0,
        }).catch((err) => console.error("Failed to send subscription renewed notification:", err));
      }

      // Process referral commission (fire-and-forget)
      calculateAndAwardCommission({
        payerUserId: subMetadata.userId,
        paymentAmountCents: invoice.amount_paid || 0,
        sourceType: "SUBSCRIPTION",
        sourcePaymentId: invoice.id,
      }).catch((err) => console.error("[Stripe Webhook] Referral commission error:", err));

      console.log(
        `[Stripe Webhook] Subscription invoice paid: ${subPlanId} plan for user ${subMetadata.userId} (+${subMonthlyCredits} credits)`
      );
      break;
    }

    case "customer.subscription.updated": {
      // Handle trial-to-active conversion for FlowShop
      const updatedSub = event.data.object as Stripe.Subscription;
      const updatedSubType = updatedSub.metadata?.type;

      if (updatedSubType === "ecommerce_subscription") {
        const ecomUserId = updatedSub.metadata?.userId;
        if (ecomUserId) {
          const newStatus = updatedSub.status === "active"
            ? "active"
            : updatedSub.status === "trialing"
              ? "trialing"
              : updatedSub.status === "past_due"
                ? "past_due"
                : "inactive";
          const isStoreActive = updatedSub.status === "active" || updatedSub.status === "trialing";

          await prisma.store.updateMany({
            where: { userId: ecomUserId },
            data: {
              ecomSubscriptionStatus: newStatus,
              isActive: isStoreActive,
            },
          });
          console.log(
            `[Stripe Webhook] FlowShop subscription updated: ${newStatus} for user ${ecomUserId}`
          );
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const subMetaType = subscription.metadata?.type;

      // Check if this is an ecommerce subscription
      if (subMetaType === "ecommerce_subscription") {
        const ecomUserId = subscription.metadata?.userId;
        if (ecomUserId) {
          await prisma.store.updateMany({
            where: { userId: ecomUserId },
            data: {
              ecomSubscriptionStatus: "cancelled",
              isActive: false,
            },
          });
          console.log(
            `[Stripe Webhook] FlowShop e-commerce subscription cancelled for user ${ecomUserId}`
          );
        }
        break;
      }

      // Find user by stripeCustomerId and reset plan to STARTER
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        // Capture previous plan before resetting
        const previousPlan = user.plan || "Unknown";

        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: "STARTER",
            planExpiresAt: null,
          },
        });

        // Send subscription cancelled notification
        notifySubscriptionCancelled({
          userId: user.id,
          email: user.email,
          name: user.name,
          planName: previousPlan,
        }).catch((err) => console.error("Failed to send subscription cancelled notification:", err));

        console.log(
          `[Stripe Webhook] Subscription cancelled: user ${user.id} reset to STARTER plan`
        );
      } else {
        console.warn(
          `[Stripe Webhook] No user found for stripeCustomerId: ${customerId}`
        );
      }

      break;
    }

    case "setup_intent.succeeded": {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      const siMetadata = setupIntent.metadata ?? {};
      const siUserId = siMetadata.userId;

      if (!siUserId) break;

      // Get the payment method details
      const pmId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

      if (!pmId || !stripe) break;

      const pm = await stripe.paymentMethods.retrieve(pmId);
      const cardBrand = pm.card?.brand || "card";
      const last4 = pm.card?.last4 || "****";

      // Get user details
      const siUser = await prisma.user.findUnique({
        where: { id: siUserId },
        select: { email: true, name: true },
      });

      if (siUser) {
        notifyPaymentMethodAdded({
          userId: siUserId,
          email: siUser.email,
          name: siUser.name,
          cardBrand,
          last4,
        }).catch((err) => console.error("Failed to send payment method added notification:", err));
      }

      console.log(
        `[Stripe Webhook] Payment method added: ${cardBrand} ****${last4} for user ${siUserId}`
      );
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  // Dev mode: process without signature verification
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn(
      "[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set — processing without signature verification (dev mode)"
    );

    try {
      const event = JSON.parse(body) as Stripe.Event;
      await processWebhookEvent(event);
      return NextResponse.json({ received: true, mode: "dev" }, { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Stripe Webhook] Dev mode error: ${message}`);
      return NextResponse.json(
        { error: `Dev mode webhook failed: ${message}` },
        { status: 500 }
      );
    }
  }

  // Production mode: verify signature
  if (!sig) {
    console.error("[Stripe Webhook] Missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  if (!stripe) {
    console.error("[Stripe Webhook] Stripe is not configured");
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Stripe Webhook] Signature verification failed: ${message}`);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  try {
    await processWebhookEvent(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Stripe Webhook] Error processing event: ${message}`);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
