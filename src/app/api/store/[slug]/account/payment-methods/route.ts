import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";
import { safeCorsHeaders } from "@/lib/store/cors";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const corsHeaders = safeCorsHeaders;

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

/** Returns or creates a Stripe Customer for this store customer. */
async function ensureStripeCustomer(
  customerId: string,
  email: string,
  name: string,
  existingStripeId: string | null
): Promise<string> {
  if (existingStripeId) {
    // Verify it still exists on Stripe
    try {
      const sc = await stripe.customers.retrieve(existingStripeId);
      if (!(sc as Stripe.DeletedCustomer).deleted) return existingStripeId;
    } catch {
      // falls through to create a new one
    }
  }
  const sc = await stripe.customers.create({ email, name, metadata: { customerId } });
  await prisma.storeCustomer.update({ where: { id: customerId }, data: { stripeCustomerId: sc.id } });
  return sc.id;
}

// GET /api/store/[slug]/account/payment-methods
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404, headers: corsHeaders(request) });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders(request) });

    if (!customer.stripeCustomerId) {
      return NextResponse.json({ paymentMethods: [], defaultId: null }, { headers: corsHeaders(request) });
    }

    const [pmList, sc] = await Promise.all([
      stripe.paymentMethods.list({ customer: customer.stripeCustomerId, type: "card", limit: 20 }),
      stripe.customers.retrieve(customer.stripeCustomerId),
    ]);

    const stripeCustomer = sc as Stripe.Customer;
    const defaultId = (stripeCustomer.invoice_settings?.default_payment_method as string | null) ?? null;

    const paymentMethods = pmList.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "****",
      expMonth: pm.card?.exp_month ?? 0,
      expYear: pm.card?.exp_year ?? 0,
      isDefault: pm.id === defaultId,
    }));

    return NextResponse.json({ paymentMethods, defaultId }, { headers: corsHeaders(request) });
  } catch (err) {
    console.error("[payment-methods GET]", err);
    return NextResponse.json({ error: "Failed to list payment methods" }, { status: 500, headers: corsHeaders(request) });
  }
}
