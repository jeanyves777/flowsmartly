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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

/**
 * POST /api/store/[slug]/account/payment-methods/setup-intent
 * Creates a Stripe SetupIntent so the client can securely save a card.
 * Also ensures a Stripe Customer exists for this store customer.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404, headers: corsHeaders(request) });

    const customer = await getStoreCustomer(store.id);
    if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders(request) });

    // Get or create Stripe Customer
    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const sc = await stripe.customers.create({
        email: customer.email,
        name: customer.name,
        metadata: { customerId: customer.id },
      });
      stripeCustomerId = sc.id;
      await prisma.storeCustomer.update({ where: { id: customer.id }, data: { stripeCustomerId } });
    } else {
      // Verify still exists
      try {
        const sc = await stripe.customers.retrieve(stripeCustomerId);
        if ((sc as Stripe.DeletedCustomer).deleted) {
          const newSc = await stripe.customers.create({ email: customer.email, name: customer.name });
          stripeCustomerId = newSc.id;
          await prisma.storeCustomer.update({ where: { id: customer.id }, data: { stripeCustomerId } });
        }
      } catch {
        const newSc = await stripe.customers.create({ email: customer.email, name: customer.name });
        stripeCustomerId = newSc.id;
        await prisma.storeCustomer.update({ where: { id: customer.id }, data: { stripeCustomerId } });
      }
    }

    // Create SetupIntent attached to this Stripe Customer
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret }, { headers: corsHeaders(request) });
  } catch (err) {
    console.error("[payment-methods/setup-intent POST]", err);
    return NextResponse.json({ error: "Failed to create setup intent" }, { status: 500, headers: corsHeaders(request) });
  }
}
