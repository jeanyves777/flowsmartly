import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";

const completeSchema = z.object({
  dob: z.object({
    day: z.number().min(1).max(31),
    month: z.number().min(1).max(12),
    year: z.number().min(1900).max(2010),
  }),
  ssnLast4: z.string().length(4).regex(/^\d{4}$/),
  bankRouting: z.string().min(9).max(9).regex(/^\d{9}$/),
  bankAccount: z.string().min(4).max(17).regex(/^\d+$/),
  accountHolderName: z.string().min(1),
});

/**
 * POST - Complete payout setup with missing fields (DOB, SSN, bank account)
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
    }

    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.store.findFirst({
      where: { userId: session.userId },
      select: { stripeConnectAccountId: true, id: true },
    });

    if (!store?.stripeConnectAccountId) {
      return NextResponse.json(
        { error: "No payout account found. Start setup first." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = completeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { dob, ssnLast4, bankRouting, bankAccount, accountHolderName } = validation.data;

    // Get client IP for TOS acceptance
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "0.0.0.0";

    // Update individual details (DOB, SSN, TOS)
    await stripe.accounts.update(store.stripeConnectAccountId, {
      individual: {
        dob: { day: dob.day, month: dob.month, year: dob.year },
        ssn_last_4: ssnLast4,
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip,
      },
    });

    // Add bank account as external account
    await stripe.accounts.createExternalAccount(store.stripeConnectAccountId, {
      external_account: {
        object: "bank_account",
        country: "US",
        currency: "usd",
        routing_number: bankRouting,
        account_number: bankAccount,
        account_holder_name: accountHolderName,
        account_holder_type: "individual",
      },
    });

    // Check updated status
    const account = await stripe.accounts.retrieve(store.stripeConnectAccountId);
    const isComplete = !!(account.charges_enabled && account.payouts_enabled);

    await prisma.store.update({
      where: { id: store.id },
      data: { stripeOnboardingComplete: isComplete },
    });

    return NextResponse.json({
      success: true,
      onboardingComplete: isComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements: account.requirements?.currently_due || [],
    });
  } catch (error: any) {
    console.error("Stripe Connect completion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to complete payout setup" },
      { status: 500 }
    );
  }
}
