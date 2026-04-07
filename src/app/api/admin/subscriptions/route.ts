import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// Non-subscriber roles — these get free access, not counted as "paid"
const FREE_ROLES = ["STARTER", "ADMIN", "SUPER_ADMIN", "AGENT"];

/**
 * GET /api/admin/subscriptions
 * Admin endpoint for unified subscription management across all products.
 * Views: stats, users, flowshop, listsmartly, domains, referrals
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const view = request.nextUrl.searchParams.get("view") || "stats";

  try {
    if (view === "stats") {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        freeUsers,
        paidPlanUsers,
        expiringIn7Days,
        expiredNotReset,
        // FlowShop
        flowshopActive,
        flowshopTrialing,
        flowshopPastDue,
        // ListSmartly
        listsmartlyActive,
        listsmartlyTrialing,
        // Domains
        activeDomains,
        // Referrals
        activeReferrals,
        pendingCommissions,
      ] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { plan: { in: FREE_ROLES }, deletedAt: null } }),
        // Real paid subscribers: non-free plan + Stripe customer + valid expiry
        prisma.user.count({
          where: {
            plan: { notIn: FREE_ROLES },
            stripeCustomerId: { not: null },
            deletedAt: null,
          },
        }),
        prisma.user.count({
          where: {
            plan: { notIn: FREE_ROLES },
            stripeCustomerId: { not: null },
            planExpiresAt: { gte: now, lte: sevenDaysFromNow },
            deletedAt: null,
          },
        }),
        prisma.user.count({
          where: {
            plan: { notIn: FREE_ROLES },
            stripeCustomerId: { not: null },
            planExpiresAt: { lt: now },
            deletedAt: null,
          },
        }),
        // FlowShop stats
        prisma.store.count({ where: { ecomSubscriptionStatus: "active", deletedAt: null } }),
        prisma.store.count({ where: { ecomSubscriptionStatus: "trialing", deletedAt: null } }),
        prisma.store.count({ where: { ecomSubscriptionStatus: "past_due", deletedAt: null } }),
        // ListSmartly stats
        prisma.listSmartlyProfile.count({ where: { lsSubscriptionStatus: "active" } }),
        prisma.listSmartlyProfile.count({ where: { lsSubscriptionStatus: "trialing" } }),
        // Domains
        prisma.storeDomain.count({ where: { registrarStatus: "active" } }),
        // Referrals
        prisma.userReferral.count({ where: { status: "ACTIVE" } }),
        prisma.referralCommission.count({ where: { status: "PENDING" } }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          totalUsers,
          freeUsers,
          paidPlanUsers,
          expiringIn7Days,
          expiredNotReset,
          flowshop: { active: flowshopActive, trialing: flowshopTrialing, pastDue: flowshopPastDue },
          listsmartly: { active: listsmartlyActive, trialing: listsmartlyTrialing },
          domains: { active: activeDomains },
          referrals: { active: activeReferrals, pendingCommissions },
        },
      });
    }

    // ── Platform plan subscribers ──
    if (view === "users") {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
      const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);
      const search = request.nextUrl.searchParams.get("search") || "";
      const planFilter = request.nextUrl.searchParams.get("plan") || "";

      const where: Record<string, unknown> = { deletedAt: null };

      if (search) {
        where.OR = [
          { email: { contains: search } },
          { name: { contains: search } },
        ];
      }

      if (planFilter === "paid") {
        where.plan = { notIn: FREE_ROLES };
      } else if (planFilter && planFilter !== "all") {
        where.plan = planFilter;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
            aiCredits: true,
            planExpiresAt: true,
            stripeCustomerId: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      return NextResponse.json({ success: true, data: { users, total } });
    }

    // ── FlowShop subscriptions ──
    if (view === "flowshop") {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
      const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);
      const status = request.nextUrl.searchParams.get("status") || "";

      const where: Record<string, unknown> = { deletedAt: null };
      if (status && status !== "all") {
        where.ecomSubscriptionStatus = status;
      }

      const [stores, total] = await Promise.all([
        prisma.store.findMany({
          where,
          select: {
            id: true,
            name: true,
            slug: true,
            ecomPlan: true,
            ecomSubscriptionId: true,
            ecomSubscriptionStatus: true,
            freeTrialEndsAt: true,
            freeDomainClaimed: true,
            isActive: true,
            productCount: true,
            orderCount: true,
            totalRevenueCents: true,
            createdAt: true,
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.store.count({ where }),
      ]);

      return NextResponse.json({ success: true, data: { stores, total } });
    }

    // ── ListSmartly subscriptions ──
    if (view === "listsmartly") {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
      const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);
      const status = request.nextUrl.searchParams.get("status") || "";

      const where: Record<string, unknown> = {};
      if (status && status !== "all") {
        where.lsSubscriptionStatus = status;
      }

      const [profiles, total] = await Promise.all([
        prisma.listSmartlyProfile.findMany({
          where,
          select: {
            id: true,
            businessName: true,
            lsPlan: true,
            lsSubscriptionId: true,
            lsSubscriptionStatus: true,
            freeTrialStartedAt: true,
            freeTrialEndsAt: true,
            totalListings: true,
            liveListings: true,
            citationScore: true,
            createdAt: true,
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.listSmartlyProfile.count({ where }),
      ]);

      return NextResponse.json({ success: true, data: { profiles, total } });
    }

    // ── Domains ──
    if (view === "domains") {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
      const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);

      const [domains, total] = await Promise.all([
        prisma.storeDomain.findMany({
          select: {
            id: true,
            domainName: true,
            tld: true,
            registrarStatus: true,
            isFree: true,
            purchasePriceCents: true,
            renewalPriceCents: true,
            autoRenew: true,
            expiresAt: true,
            createdAt: true,
            userId: true,
            user: { select: { email: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.storeDomain.count(),
      ]);

      return NextResponse.json({ success: true, data: { domains, total } });
    }

    // ── Referrals & Commissions ──
    if (view === "referrals") {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
      const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);

      const [referrals, commissions, totalReferrals, totalCommissions] = await Promise.all([
        prisma.userReferral.findMany({
          select: {
            id: true,
            referralCode: true,
            referralType: true,
            status: true,
            commissionRate: true,
            commissionType: true,
            expiresAt: true,
            createdAt: true,
            referrer: { select: { id: true, email: true, name: true } },
            referred: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.referralCommission.findMany({
          where: { status: "PENDING" },
          select: {
            id: true,
            amountCents: true,
            sourceType: true,
            status: true,
            createdAt: true,
            referrer: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.userReferral.count(),
        prisma.referralCommission.count({ where: { status: "PENDING" } }),
      ]);

      return NextResponse.json({
        success: true,
        data: { referrals, commissions, totalReferrals, totalCommissions },
      });
    }

    // ── Agent subscriptions (users who hired agents) ──
    if (view === "agents") {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
      const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);

      const [clients, total] = await Promise.all([
        prisma.agentClient.findMany({
          select: {
            id: true, status: true, monthlyPriceCents: true, startDate: true, endDate: true,
            clientUser: { select: { id: true, email: true, name: true } },
            agentProfile: { select: { displayName: true, user: { select: { email: true } } } },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.agentClient.count(),
      ]);

      return NextResponse.json({ success: true, data: { clients, total } });
    }

    // ── Payment history from Stripe ──
    if (view === "payments") {
      const userId = request.nextUrl.searchParams.get("userId");
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (!user?.stripeCustomerId) {
        return NextResponse.json({ success: true, data: { payments: [], message: "No Stripe customer ID" } });
      }

      try {
        const { stripe } = await import("@/lib/stripe");
        if (!stripe) return NextResponse.json({ success: true, data: { payments: [] } });

        // Pull charges and invoices from Stripe
        const [charges, invoices] = await Promise.all([
          stripe.charges.list({ customer: user.stripeCustomerId, limit: 50 }),
          stripe.invoices.list({ customer: user.stripeCustomerId, limit: 50 }),
        ]);

        const payments = charges.data.map((c) => ({
          id: c.id,
          type: "charge" as const,
          amount: c.amount,
          currency: c.currency,
          status: c.status,
          description: c.description || c.metadata?.type || "Payment",
          refunded: c.refunded,
          refundedAmount: c.amount_refunded,
          created: new Date(c.created * 1000).toISOString(),
          receiptUrl: c.receipt_url,
          metadata: c.metadata || {},
        }));

        const invoiceList = invoices.data.map((inv) => ({
          id: inv.id,
          type: "invoice" as const,
          amount: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          description: inv.lines?.data?.[0]?.description || "Invoice",
          refunded: false,
          refundedAmount: 0,
          created: new Date(inv.created * 1000).toISOString(),
          receiptUrl: inv.hosted_invoice_url,
          metadata: inv.metadata || {},
        }));

        // Merge and sort by date
        const allPayments = [...payments, ...invoiceList].sort(
          (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
        );

        return NextResponse.json({ success: true, data: { payments: allPayments } });
      } catch (err) {
        console.error("[Admin Payments] Stripe error:", err);
        return NextResponse.json({ success: true, data: { payments: [], error: "Failed to fetch from Stripe" } });
      }
    }

    // ── User detail (all subscriptions for one user) ──
    if (view === "user-detail") {
      const userId = request.nextUrl.searchParams.get("userId");
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

      const [user, store, listsmartly, domains, agentClients, referralsMade, referredBy, commissions, recentTransactions] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true, email: true, name: true, plan: true, aiCredits: true, freeCredits: true,
            balanceCents: true, planExpiresAt: true, stripeCustomerId: true, lastLoginAt: true,
            createdAt: true, referralCode: true,
          },
        }),
        prisma.store.findUnique({
          where: { userId },
          select: {
            id: true, name: true, ecomPlan: true, ecomSubscriptionId: true,
            ecomSubscriptionStatus: true, freeTrialEndsAt: true, freeDomainClaimed: true,
            isActive: true, productCount: true, orderCount: true, totalRevenueCents: true,
          },
        }),
        prisma.listSmartlyProfile.findFirst({
          where: { userId },
          select: {
            id: true, businessName: true, lsPlan: true, lsSubscriptionId: true,
            lsSubscriptionStatus: true, freeTrialEndsAt: true, totalListings: true,
            liveListings: true, citationScore: true,
          },
        }),
        prisma.storeDomain.findMany({
          where: { userId },
          select: {
            id: true, domainName: true, tld: true, registrarStatus: true, isFree: true,
            purchasePriceCents: true, autoRenew: true, expiresAt: true,
          },
        }),
        // Agent subscriptions (user as client of agents)
        prisma.agentClient.findMany({
          where: { clientUserId: userId },
          select: {
            id: true, status: true, monthlyPriceCents: true, startDate: true, endDate: true,
            agentProfile: { select: { displayName: true, userId: true, user: { select: { email: true } } } },
          },
        }),
        prisma.userReferral.findMany({
          where: { referrerUserId: userId },
          select: {
            id: true, referralCode: true, status: true, commissionRate: true,
            referred: { select: { email: true, name: true } },
            createdAt: true,
          },
        }),
        prisma.userReferral.findFirst({
          where: { referredUserId: userId },
          select: {
            referralCode: true,
            referrer: { select: { email: true, name: true } },
          },
        }),
        prisma.referralCommission.findMany({
          where: { referrerUserId: userId },
          select: { id: true, amountCents: true, sourceType: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.creditTransaction.findMany({
          where: { userId },
          select: { id: true, type: true, amount: true, balanceAfter: true, description: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 15,
        }),
      ]);

      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      return NextResponse.json({
        success: true,
        data: { user, store, listsmartly, domains, agentClients, referralsMade, referredBy, commissions, recentTransactions },
      });
    }

    return NextResponse.json({ error: "Invalid view" }, { status: 400 });
  } catch (err) {
    console.error("[Admin Subscriptions] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/subscriptions
 * Admin actions: cancel, reactivate, change plan, extend, refund
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, userId, ...params } = body;

    if (!action || !userId) {
      return NextResponse.json({ error: "action and userId required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, plan: true, stripeCustomerId: true, planExpiresAt: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // ── Change platform plan ──
    if (action === "change_plan") {
      const { plan } = params;
      if (!plan) return NextResponse.json({ error: "plan required" }, { status: 400 });

      const planExpiresAt = FREE_ROLES.includes(plan)
        ? null
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: { plan, planExpiresAt },
      });

      return NextResponse.json({ success: true, message: `Plan changed to ${plan}` });
    }

    // ── Extend plan expiration ──
    if (action === "extend_plan") {
      const { days } = params;
      if (!days || days <= 0) return NextResponse.json({ error: "days required (positive)" }, { status: 400 });

      const currentExpiry = user.planExpiresAt || new Date();
      const base = currentExpiry > new Date() ? currentExpiry : new Date();
      const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: { planExpiresAt: newExpiry },
      });

      return NextResponse.json({ success: true, message: `Plan extended by ${days} days to ${newExpiry.toISOString()}` });
    }

    // ── Cancel Stripe subscription ──
    if (action === "cancel_subscription") {
      const { product } = params; // "platform", "flowshop", "listsmartly"

      const { stripe } = await import("@/lib/stripe");
      if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

      if (product === "platform") {
        if (!user.stripeCustomerId) return NextResponse.json({ error: "No Stripe customer" }, { status: 400 });

        const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: "active", limit: 5 });
        const platformSub = subs.data.find((s) => s.metadata?.type === "subscription" || s.metadata?.planId);

        if (platformSub) {
          await stripe.subscriptions.cancel(platformSub.id);
        }

        await prisma.user.update({
          where: { id: userId },
          data: { plan: "STARTER", planExpiresAt: null },
        });

        return NextResponse.json({ success: true, message: "Platform subscription cancelled" });
      }

      if (product === "flowshop") {
        const store = await prisma.store.findUnique({ where: { userId }, select: { ecomSubscriptionId: true } });
        if (store?.ecomSubscriptionId) {
          await stripe.subscriptions.cancel(store.ecomSubscriptionId);
        }
        await prisma.store.updateMany({
          where: { userId },
          data: { ecomSubscriptionStatus: "cancelled", isActive: false },
        });
        return NextResponse.json({ success: true, message: "FlowShop subscription cancelled" });
      }

      if (product === "listsmartly") {
        const profile = await prisma.listSmartlyProfile.findFirst({ where: { userId }, select: { lsSubscriptionId: true } });
        if (profile?.lsSubscriptionId) {
          await stripe.subscriptions.cancel(profile.lsSubscriptionId);
        }
        await prisma.listSmartlyProfile.updateMany({
          where: { userId },
          data: { lsSubscriptionStatus: "cancelled" },
        });
        return NextResponse.json({ success: true, message: "ListSmartly subscription cancelled" });
      }

      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }

    // ── Reactivate subscription ──
    if (action === "reactivate") {
      const { product } = params;

      if (product === "flowshop") {
        await prisma.store.updateMany({
          where: { userId },
          data: { ecomSubscriptionStatus: "active", isActive: true },
        });
        return NextResponse.json({ success: true, message: "FlowShop reactivated" });
      }

      if (product === "listsmartly") {
        await prisma.listSmartlyProfile.updateMany({
          where: { userId },
          data: { lsSubscriptionStatus: "active" },
        });
        return NextResponse.json({ success: true, message: "ListSmartly reactivated" });
      }

      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }

    // ── Issue refund via Stripe ──
    if (action === "refund") {
      const { amountCents, paymentIntentId, reason } = params;

      const { stripe } = await import("@/lib/stripe");
      if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

      if (!paymentIntentId) {
        // Refund last payment for this customer
        if (!user.stripeCustomerId) return NextResponse.json({ error: "No Stripe customer" }, { status: 400 });

        const charges = await stripe.charges.list({ customer: user.stripeCustomerId, limit: 1 });
        if (charges.data.length === 0) return NextResponse.json({ error: "No charges found" }, { status: 400 });

        const refund = await stripe.refunds.create({
          charge: charges.data[0].id,
          amount: amountCents || undefined, // undefined = full refund
          reason: reason === "duplicate" ? "duplicate" : reason === "fraudulent" ? "fraudulent" : "requested_by_customer",
        });

        return NextResponse.json({ success: true, message: `Refund issued: $${((refund.amount || 0) / 100).toFixed(2)}`, refundId: refund.id });
      }

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountCents || undefined,
        reason: "requested_by_customer",
      });

      return NextResponse.json({ success: true, message: `Refund issued: $${((refund.amount || 0) / 100).toFixed(2)}`, refundId: refund.id });
    }

    // ── Update FlowShop plan ──
    if (action === "change_flowshop_plan") {
      const { plan } = params;
      if (plan !== "basic" && plan !== "pro") return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

      await prisma.store.updateMany({
        where: { userId },
        data: { ecomPlan: plan },
      });

      return NextResponse.json({ success: true, message: `FlowShop plan changed to ${plan}` });
    }

    // ── Update ListSmartly plan ──
    if (action === "change_listsmartly_plan") {
      const { plan } = params;
      if (plan !== "basic" && plan !== "pro") return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

      await prisma.listSmartlyProfile.updateMany({
        where: { userId },
        data: { lsPlan: plan },
      });

      return NextResponse.json({ success: true, message: `ListSmartly plan changed to ${plan}` });
    }

    // ── Pay/approve referral commission ──
    if (action === "approve_commission") {
      const { commissionId } = params;
      if (!commissionId) return NextResponse.json({ error: "commissionId required" }, { status: 400 });

      const commission = await prisma.referralCommission.findUnique({ where: { id: commissionId } });
      if (!commission) return NextResponse.json({ error: "Commission not found" }, { status: 404 });

      await prisma.referralCommission.update({
        where: { id: commissionId },
        data: { status: "PAID", paidAt: new Date() },
      });

      // Add to user's balance
      await prisma.user.update({
        where: { id: commission.referrerUserId },
        data: { balanceCents: { increment: commission.amountCents } },
      });

      return NextResponse.json({ success: true, message: `Commission of $${(commission.amountCents / 100).toFixed(2)} paid` });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[Admin Subscriptions] Action error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
