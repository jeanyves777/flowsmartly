import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/admin/stripe-sync
 * Pull ALL subscriptions from Stripe and compare side-by-side with local DB.
 * Shows: what Stripe has, what DB has, discrepancies, orphaned records.
 */
export async function GET(request: NextRequest) {
  // Auth: admin session or cron secret
  const cronSecret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "flowsmartly-cron-2026";

  if (cronSecret !== expectedSecret) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { stripe } = await import("@/lib/stripe");
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

    // ── 1. Pull ALL subscriptions from Stripe ──
    const stripeSubscriptions: Array<{
      id: string;
      customerId: string;
      customerEmail: string | null;
      status: string;
      type: string; // "platform", "flowshop", "listsmartly", "unknown"
      plan: string | null;
      amount: number;
      interval: string | null;
      currentPeriodEnd: string | null;
      canceledAt: string | null;
      created: string;
      metadata: Record<string, string>;
    }> = [];

    // Paginate through all Stripe subscriptions
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: Record<string, unknown> = { limit: 100, expand: ["data.customer"] };
      if (startingAfter) params.starting_after = startingAfter;

      const batch = await stripe.subscriptions.list(params as any);

      for (const sub of batch.data) {
        const customer = sub.customer as any;
        const metaType = sub.metadata?.type || "";
        let type = "unknown";
        if (metaType === "ecommerce_subscription") type = "flowshop";
        else if (metaType === "listsmartly_subscription") type = "listsmartly";
        else if (metaType === "subscription" || sub.metadata?.planId) type = "platform";

        // Get amount from items
        let amount = 0;
        let interval: string | null = null;
        if (sub.items?.data?.[0]) {
          const price = sub.items.data[0].price;
          amount = price?.unit_amount || 0;
          interval = price?.recurring?.interval || null;
        }

        stripeSubscriptions.push({
          id: sub.id,
          customerId: typeof sub.customer === "string" ? sub.customer : customer?.id || "",
          customerEmail: customer?.email || null,
          status: sub.status,
          type,
          plan: sub.metadata?.planId || sub.metadata?.plan || null,
          amount,
          interval,
          currentPeriodEnd: null, // Not directly available in v2025+ API
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          created: new Date(sub.created * 1000).toISOString(),
          metadata: sub.metadata || {},
        });
      }

      hasMore = batch.has_more;
      if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id;
    }

    // ── 2. Pull ALL Stripe customers with charges (for one-time purchases) ──
    // Skip for now — focus on subscriptions

    // ── 3. Get local DB data ──
    const [localUsers, localStores, localListSmartly] = await Promise.all([
      prisma.user.findMany({
        where: { stripeCustomerId: { not: null }, deletedAt: null },
        select: {
          id: true, email: true, name: true, plan: true,
          stripeCustomerId: true, planExpiresAt: true, aiCredits: true,
        },
      }),
      prisma.store.findMany({
        where: { ecomSubscriptionId: { not: null }, deletedAt: null },
        select: {
          id: true, userId: true, name: true, ecomPlan: true,
          ecomSubscriptionId: true, ecomSubscriptionStatus: true,
          user: { select: { email: true, name: true } },
        },
      }),
      prisma.listSmartlyProfile.findMany({
        where: { lsSubscriptionId: { not: null } },
        select: {
          id: true, userId: true, businessName: true, lsPlan: true,
          lsSubscriptionId: true, lsSubscriptionStatus: true,
          user: { select: { email: true, name: true } },
        },
      }),
    ]);

    // Also get ALL users who have a non-STARTER plan (to catch mismatches)
    const allNonStarterUsers = await prisma.user.findMany({
      where: { plan: { notIn: ["STARTER"] }, deletedAt: null },
      select: {
        id: true, email: true, name: true, plan: true,
        stripeCustomerId: true, planExpiresAt: true,
      },
    });

    // ── 4. Build comparison ──
    const comparison: Array<{
      stripeId: string | null;
      stripeStatus: string | null;
      stripeType: string;
      stripePlan: string | null;
      stripeAmount: number;
      stripeInterval: string | null;
      stripeEmail: string | null;
      stripeCreated: string | null;
      localUserId: string | null;
      localEmail: string | null;
      localName: string | null;
      localPlan: string | null;
      localStatus: string | null;
      localExpiresAt: string | null;
      match: "synced" | "mismatch" | "stripe_only" | "db_only";
      issue: string | null;
    }> = [];

    // Map Stripe customer IDs to local users
    const customerToUser = new Map<string, typeof localUsers[0]>();
    for (const u of localUsers) {
      if (u.stripeCustomerId) customerToUser.set(u.stripeCustomerId, u);
    }

    // Map subscription IDs to local stores/listsmartly
    const subToStore = new Map<string, typeof localStores[0]>();
    for (const s of localStores) {
      if (s.ecomSubscriptionId) subToStore.set(s.ecomSubscriptionId, s);
    }
    const subToLS = new Map<string, typeof localListSmartly[0]>();
    for (const l of localListSmartly) {
      if (l.lsSubscriptionId) subToLS.set(l.lsSubscriptionId, l);
    }

    // Track which Stripe sub IDs we've matched
    const matchedStripeIds = new Set<string>();
    const matchedCustomerIds = new Set<string>();

    for (const stripeSub of stripeSubscriptions) {
      const localUser = customerToUser.get(stripeSub.customerId);
      const localStore = subToStore.get(stripeSub.id);
      const localLS = subToLS.get(stripeSub.id);

      if (stripeSub.type === "platform") {
        if (localUser) {
          matchedCustomerIds.add(stripeSub.customerId);
          const planMatch = localUser.plan === stripeSub.plan;
          const isActive = stripeSub.status === "active" || stripeSub.status === "trialing";
          const localIsActive = localUser.plan !== "STARTER";

          let issue: string | null = null;
          let match: "synced" | "mismatch" = "synced";

          if (isActive && !localIsActive) {
            issue = "Active in Stripe but STARTER locally — needs sync";
            match = "mismatch";
          } else if (!isActive && localIsActive) {
            issue = `Cancelled/unpaid in Stripe (${stripeSub.status}) but ${localUser.plan} locally — needs reset`;
            match = "mismatch";
          } else if (isActive && !planMatch && stripeSub.plan) {
            issue = `Plan mismatch: Stripe=${stripeSub.plan}, DB=${localUser.plan}`;
            match = "mismatch";
          }

          comparison.push({
            stripeId: stripeSub.id, stripeStatus: stripeSub.status, stripeType: "platform",
            stripePlan: stripeSub.plan, stripeAmount: stripeSub.amount, stripeInterval: stripeSub.interval,
            stripeEmail: stripeSub.customerEmail, stripeCreated: stripeSub.created,
            localUserId: localUser.id, localEmail: localUser.email, localName: localUser.name,
            localPlan: localUser.plan, localStatus: localUser.plan !== "STARTER" ? "active" : "inactive",
            localExpiresAt: localUser.planExpiresAt?.toISOString() || null,
            match, issue,
          });
        } else {
          // Stripe subscription exists but no matching local user
          comparison.push({
            stripeId: stripeSub.id, stripeStatus: stripeSub.status, stripeType: "platform",
            stripePlan: stripeSub.plan, stripeAmount: stripeSub.amount, stripeInterval: stripeSub.interval,
            stripeEmail: stripeSub.customerEmail, stripeCreated: stripeSub.created,
            localUserId: null, localEmail: null, localName: null,
            localPlan: null, localStatus: null, localExpiresAt: null,
            match: "stripe_only",
            issue: `Subscription in Stripe (${stripeSub.status}) but no matching user in DB`,
          });
        }
        matchedStripeIds.add(stripeSub.id);
      } else if (stripeSub.type === "flowshop") {
        const isActive = stripeSub.status === "active" || stripeSub.status === "trialing";
        if (localStore) {
          let issue: string | null = null;
          let match: "synced" | "mismatch" = "synced";
          if (isActive && localStore.ecomSubscriptionStatus !== "active" && localStore.ecomSubscriptionStatus !== "trialing") {
            issue = `Active in Stripe but ${localStore.ecomSubscriptionStatus} locally`;
            match = "mismatch";
          } else if (!isActive && (localStore.ecomSubscriptionStatus === "active" || localStore.ecomSubscriptionStatus === "trialing")) {
            issue = `${stripeSub.status} in Stripe but ${localStore.ecomSubscriptionStatus} locally`;
            match = "mismatch";
          }
          comparison.push({
            stripeId: stripeSub.id, stripeStatus: stripeSub.status, stripeType: "flowshop",
            stripePlan: stripeSub.plan, stripeAmount: stripeSub.amount, stripeInterval: stripeSub.interval,
            stripeEmail: stripeSub.customerEmail, stripeCreated: stripeSub.created,
            localUserId: localStore.userId, localEmail: localStore.user?.email || null, localName: localStore.name,
            localPlan: localStore.ecomPlan, localStatus: localStore.ecomSubscriptionStatus,
            localExpiresAt: null, match, issue,
          });
        } else {
          comparison.push({
            stripeId: stripeSub.id, stripeStatus: stripeSub.status, stripeType: "flowshop",
            stripePlan: stripeSub.plan, stripeAmount: stripeSub.amount, stripeInterval: stripeSub.interval,
            stripeEmail: stripeSub.customerEmail, stripeCreated: stripeSub.created,
            localUserId: null, localEmail: null, localName: null,
            localPlan: null, localStatus: null, localExpiresAt: null,
            match: "stripe_only", issue: "FlowShop subscription in Stripe but no matching store in DB",
          });
        }
        matchedStripeIds.add(stripeSub.id);
      } else if (stripeSub.type === "listsmartly") {
        const isActive = stripeSub.status === "active" || stripeSub.status === "trialing";
        if (localLS) {
          let issue: string | null = null;
          let match: "synced" | "mismatch" = "synced";
          if (isActive && localLS.lsSubscriptionStatus !== "active" && localLS.lsSubscriptionStatus !== "trialing") {
            issue = `Active in Stripe but ${localLS.lsSubscriptionStatus} locally`;
            match = "mismatch";
          }
          comparison.push({
            stripeId: stripeSub.id, stripeStatus: stripeSub.status, stripeType: "listsmartly",
            stripePlan: stripeSub.plan, stripeAmount: stripeSub.amount, stripeInterval: stripeSub.interval,
            stripeEmail: stripeSub.customerEmail, stripeCreated: stripeSub.created,
            localUserId: localLS.userId, localEmail: localLS.user?.email || null, localName: localLS.businessName,
            localPlan: localLS.lsPlan, localStatus: localLS.lsSubscriptionStatus,
            localExpiresAt: null, match, issue,
          });
        } else {
          comparison.push({
            stripeId: stripeSub.id, stripeStatus: stripeSub.status, stripeType: "listsmartly",
            stripePlan: stripeSub.plan, stripeAmount: stripeSub.amount, stripeInterval: stripeSub.interval,
            stripeEmail: stripeSub.customerEmail, stripeCreated: stripeSub.created,
            localUserId: null, localEmail: null, localName: null,
            localPlan: null, localStatus: null, localExpiresAt: null,
            match: "stripe_only", issue: "ListSmartly subscription in Stripe but no matching profile in DB",
          });
        }
        matchedStripeIds.add(stripeSub.id);
      } else {
        // Unknown subscription type
        comparison.push({
          stripeId: stripeSub.id, stripeStatus: stripeSub.status, stripeType: "unknown",
          stripePlan: stripeSub.plan, stripeAmount: stripeSub.amount, stripeInterval: stripeSub.interval,
          stripeEmail: stripeSub.customerEmail, stripeCreated: stripeSub.created,
          localUserId: localUser?.id || null, localEmail: localUser?.email || stripeSub.customerEmail,
          localName: localUser?.name || null,
          localPlan: localUser?.plan || null, localStatus: null, localExpiresAt: null,
          match: "mismatch", issue: "Unknown subscription type in Stripe — metadata.type not set",
        });
        matchedStripeIds.add(stripeSub.id);
      }
    }

    // ── 5. Find DB-only records (plan set locally but no Stripe subscription) ──
    for (const user of allNonStarterUsers) {
      if (!user.stripeCustomerId || matchedCustomerIds.has(user.stripeCustomerId)) continue;
      // This user has a non-STARTER plan but no matching Stripe subscription found
      comparison.push({
        stripeId: null, stripeStatus: null, stripeType: "platform",
        stripePlan: null, stripeAmount: 0, stripeInterval: null,
        stripeEmail: null, stripeCreated: null,
        localUserId: user.id, localEmail: user.email, localName: user.name,
        localPlan: user.plan, localStatus: "active",
        localExpiresAt: user.planExpiresAt?.toISOString() || null,
        match: "db_only",
        issue: `${user.plan} plan in DB but no active Stripe subscription found`,
      });
    }

    // Also flag users with non-STARTER plan and NO stripeCustomerId at all
    for (const user of allNonStarterUsers) {
      if (user.stripeCustomerId) continue;
      // Skip known free-access roles
      if (["ADMIN", "SUPER_ADMIN", "AGENT"].includes(user.plan)) continue;

      comparison.push({
        stripeId: null, stripeStatus: null, stripeType: "platform",
        stripePlan: null, stripeAmount: 0, stripeInterval: null,
        stripeEmail: null, stripeCreated: null,
        localUserId: user.id, localEmail: user.email, localName: user.name,
        localPlan: user.plan, localStatus: "no_stripe",
        localExpiresAt: user.planExpiresAt?.toISOString() || null,
        match: "db_only",
        issue: `${user.plan} plan in DB but NO Stripe customer ID — manually assigned or data issue`,
      });
    }

    // Sort: mismatches first, then stripe_only, then db_only, then synced
    const sortOrder = { mismatch: 0, stripe_only: 1, db_only: 2, synced: 3 };
    comparison.sort((a, b) => sortOrder[a.match] - sortOrder[b.match]);

    const stats = {
      totalStripe: stripeSubscriptions.length,
      activeStripe: stripeSubscriptions.filter((s) => s.status === "active").length,
      totalComparisons: comparison.length,
      synced: comparison.filter((c) => c.match === "synced").length,
      mismatches: comparison.filter((c) => c.match === "mismatch").length,
      stripeOnly: comparison.filter((c) => c.match === "stripe_only").length,
      dbOnly: comparison.filter((c) => c.match === "db_only").length,
    };

    return NextResponse.json({
      success: true,
      stats,
      comparison,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Stripe Sync] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/stripe-sync
 * Fix a specific discrepancy.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { action, userId, stripeSubscriptionId, email } = body;

    const { stripe } = await import("@/lib/stripe");
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

    // ── Sync from Stripe to DB ──
    if (action === "sync_from_stripe" && stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, { expand: ["customer"] });
      const customer = sub.customer as any;
      const metaType = sub.metadata?.type || "";
      const metaPlan = sub.metadata?.planId || sub.metadata?.plan;
      const metaUserId = sub.metadata?.userId;

      // Find user by Stripe customer ID or metadata userId or email
      let user = metaUserId
        ? await prisma.user.findUnique({ where: { id: metaUserId }, select: { id: true, email: true } })
        : null;

      if (!user && customer?.id) {
        user = await prisma.user.findFirst({
          where: { stripeCustomerId: customer.id },
          select: { id: true, email: true },
        });
      }

      if (!user && customer?.email) {
        user = await prisma.user.findFirst({
          where: { email: customer.email },
          select: { id: true, email: true },
        });
      }

      if (!user) {
        return NextResponse.json({ error: `Cannot find local user for Stripe customer ${customer?.email || customer?.id}` }, { status: 404 });
      }

      const isActive = sub.status === "active" || sub.status === "trialing";

      if (metaType === "ecommerce_subscription" || metaType === "flowshop") {
        await prisma.store.updateMany({
          where: { userId: user.id },
          data: {
            ecomSubscriptionId: sub.id,
            ecomSubscriptionStatus: isActive ? "active" : sub.status === "past_due" ? "past_due" : "cancelled",
            ecomPlan: metaPlan === "pro" ? "pro" : "basic",
            isActive,
          },
        });
        return NextResponse.json({ success: true, message: `FlowShop synced for ${user.email}: ${sub.status}` });
      }

      if (metaType === "listsmartly_subscription") {
        await prisma.listSmartlyProfile.updateMany({
          where: { userId: user.id },
          data: {
            lsSubscriptionId: sub.id,
            lsSubscriptionStatus: isActive ? "active" : "cancelled",
            lsPlan: metaPlan === "pro" ? "pro" : "basic",
          },
        });
        return NextResponse.json({ success: true, message: `ListSmartly synced for ${user.email}: ${sub.status}` });
      }

      // Platform subscription
      const plan = metaPlan || "PRO";
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: isActive ? plan : "STARTER",
          planExpiresAt: isActive ? periodEnd : null,
          stripeCustomerId: customer?.id || undefined,
        },
      });

      return NextResponse.json({ success: true, message: `Platform synced for ${user.email}: plan=${isActive ? plan : "STARTER"}` });
    }

    // ── Reset to free ──
    if (action === "reset_to_starter" && userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { plan: "STARTER", planExpiresAt: null },
      });
      return NextResponse.json({ success: true, message: "User reset to STARTER" });
    }

    // ── Link Stripe customer to user by email ──
    if (action === "link_customer" && userId && email) {
      // Find Stripe customer by email
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length === 0) {
        return NextResponse.json({ error: `No Stripe customer found for ${email}` }, { status: 404 });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customers.data[0].id },
      });

      return NextResponse.json({ success: true, message: `Linked Stripe customer ${customers.data[0].id} to user` });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[Stripe Sync] Fix error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
