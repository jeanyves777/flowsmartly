import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";
import { notifyPaymentMethodRemoved } from "@/lib/notifications";

// GET /api/payments/methods - List user's payment methods
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { success: false, error: { message: "Stripe is not configured" } },
        { status: 500 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json({
        success: true,
        data: { paymentMethods: [], hasCustomer: false },
      });
    }

    // Fetch payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    // Fetch customer to get default payment method
    const customer = await stripe.customers.retrieve(user.stripeCustomerId);
    const defaultPaymentMethodId =
      typeof customer !== "string" && !customer.deleted
        ? customer.invoice_settings?.default_payment_method
        : null;

    const methods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || "unknown",
      last4: pm.card?.last4 || "****",
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
      isDefault: pm.id === defaultPaymentMethodId,
    }));

    return NextResponse.json({
      success: true,
      data: { paymentMethods: methods, hasCustomer: true },
    });
  } catch (error) {
    console.error("Get payment methods error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get payment methods" } },
      { status: 500 }
    );
  }
}

// POST /api/payments/methods - Create a SetupIntent for adding payment method inline
export async function POST(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Block agent impersonation from financial actions
    if (session.agentId) {
      return NextResponse.json(
        { success: false, error: { message: "This action is restricted in agent mode" } },
        { status: 403 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { success: false, error: { message: "Stripe is not configured" } },
        { status: 500 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, stripeCustomerId: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "User not found" } },
        { status: 404 }
      );
    }

    let customerId = user.stripeCustomerId;

    // Create a Stripe customer if one doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: session.userId },
      });

      customerId = customer.id;

      await prisma.user.update({
        where: { id: session.userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create a SetupIntent (inline card form, no redirect)
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: { userId: session.userId },
    });

    return NextResponse.json({
      success: true,
      data: { clientSecret: setupIntent.client_secret },
    });
  } catch (error) {
    console.error("Create setup intent error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create setup intent" } },
      { status: 500 }
    );
  }
}

// DELETE /api/payments/methods - Remove a payment method
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Block agent impersonation from financial actions
    if (session.agentId) {
      return NextResponse.json(
        { success: false, error: { message: "This action is restricted in agent mode" } },
        { status: 403 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { success: false, error: { message: "Stripe is not configured" } },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get("id");

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: { message: "Payment method ID is required" } },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: { message: "No customer found" } },
        { status: 400 }
      );
    }

    // Verify the payment method belongs to this customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== user.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: { message: "Payment method not found" } },
        { status: 404 }
      );
    }

    // Capture card details before detaching
    const cardBrand = paymentMethod.card?.brand || "card";
    const last4 = paymentMethod.card?.last4 || "****";

    // Detach the payment method
    await stripe.paymentMethods.detach(paymentMethodId);

    // Send notification (fire-and-forget)
    const deleteUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true },
    });

    if (deleteUser) {
      notifyPaymentMethodRemoved({
        userId: session.userId,
        email: deleteUser.email,
        name: deleteUser.name,
        cardBrand,
        last4,
      }).catch((err) => console.error("Failed to send payment method removed notification:", err));
    }

    return NextResponse.json({
      success: true,
      data: { message: "Payment method removed" },
    });
  } catch (error) {
    console.error("Delete payment method error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to remove payment method" } },
      { status: 500 }
    );
  }
}

// PATCH /api/payments/methods - Set default payment method
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { success: false, error: { message: "Stripe is not configured" } },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { paymentMethodId } = body;

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: { message: "Payment method ID is required" } },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: { message: "No customer found" } },
        { status: 400 }
      );
    }

    // Verify the payment method belongs to this customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== user.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: { message: "Payment method not found" } },
        { status: 404 }
      );
    }

    // Set as default payment method
    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Default payment method updated" },
    });
  } catch (error) {
    console.error("Update default payment method error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update default payment method" } },
      { status: 500 }
    );
  }
}
