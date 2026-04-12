import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getStoreCustomer } from "@/lib/store/customer-auth";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

interface Ctx { params: Promise<{ slug: string; pmId: string }> }

/**
 * DELETE /api/store/[slug]/account/payment-methods/[pmId]
 * Detaches a saved payment method from the Stripe Customer.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const { slug, pmId } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404, headers: corsHeaders(request) });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders(request) });
    if (!customer.stripeCustomerId) return NextResponse.json({ error: "No payment methods" }, { status: 400, headers: corsHeaders(request) });

    // Verify PM belongs to this customer
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.customer !== customer.stripeCustomerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders(request) });
    }

    await stripe.paymentMethods.detach(pmId);

    // If this was the default, clear the default
    const sc = await stripe.customers.retrieve(customer.stripeCustomerId) as Stripe.Customer;
    if (sc.invoice_settings?.default_payment_method === pmId) {
      await stripe.customers.update(customer.stripeCustomerId, {
        invoice_settings: { default_payment_method: "" },
      });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders(request) });
  } catch (err) {
    console.error("[payment-methods DELETE]", err);
    return NextResponse.json({ error: "Failed to remove payment method" }, { status: 500, headers: corsHeaders(request) });
  }
}

/**
 * POST /api/store/[slug]/account/payment-methods/[pmId]
 * Sets a payment method as the default.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { slug, pmId } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404, headers: corsHeaders(request) });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders(request) });
    if (!customer.stripeCustomerId) return NextResponse.json({ error: "No payment methods" }, { status: 400, headers: corsHeaders(request) });

    // Verify PM belongs to this customer
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.customer !== customer.stripeCustomerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders(request) });
    }

    await stripe.customers.update(customer.stripeCustomerId, {
      invoice_settings: { default_payment_method: pmId },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders(request) });
  } catch (err) {
    console.error("[payment-methods set-default]", err);
    return NextResponse.json({ error: "Failed to set default" }, { status: 500, headers: corsHeaders(request) });
  }
}
