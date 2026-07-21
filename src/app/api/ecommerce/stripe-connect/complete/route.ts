import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";
import {
  getPayoutConfig,
  bankFieldsFor,
  personalIdFieldFor,
  cleanFieldValue,
  humanizeRequirements,
} from "@/lib/store/payout-countries";
import type Stripe from "stripe";

/**
 * POST — Finish payout setup for an individual Custom account, country-aware.
 *
 * The bank + personal-ID fields required vary by country (US SSN + routing, UK
 * sort-code, IBAN, …). We validate against the shared field spec for the store's
 * country, then build the right Stripe `external_account` + `individual` payload.
 * Countries whose bank format we collect via Stripe-hosted onboarding ("hosted"
 * family) or that Stripe doesn't support are rejected here with a clear message.
 */

const completeSchema = z.object({
  accountHolderName: z.string().trim().min(1),
  dob: z.object({
    day: z.number().int().min(1).max(31),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(1900).max(2010),
  }),
  personalId: z.string().optional(),
  bank: z.record(z.string()),
});

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
      select: { stripeConnectAccountId: true, id: true, country: true },
    });

    if (!store?.stripeConnectAccountId) {
      return NextResponse.json(
        { error: "No payout account found. Start setup first." },
        { status: 400 }
      );
    }

    const cfg = getPayoutConfig(store.country);
    if (!cfg) {
      return NextResponse.json(
        { error: "Stripe payouts aren't available in your country yet. You can still accept Cash on delivery." },
        { status: 400 }
      );
    }
    if (cfg.family === "hosted") {
      return NextResponse.json(
        { error: "Finish setup on Stripe's secure page for your country.", useHostedOnboarding: true },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { accountHolderName, dob, personalId, bank } = parsed.data;

    // Validate each bank field against the shared spec for this country.
    const cleaned: Record<string, string> = {};
    for (const spec of bankFieldsFor(store.country)) {
      const value = cleanFieldValue(spec, bank[spec.key] || "");
      if (!new RegExp(spec.pattern).test(value)) {
        return NextResponse.json(
          { error: `Check your ${spec.label.toLowerCase()}.` },
          { status: 400 }
        );
      }
      cleaned[spec.key] = value;
    }

    // Personal ID (e.g. US SSN last-4), if this country collects it up-front.
    const idSpec = personalIdFieldFor(store.country);
    let personalIdClean = "";
    if (idSpec) {
      personalIdClean = cleanFieldValue(idSpec, personalId || "");
      if (!new RegExp(idSpec.pattern).test(personalIdClean)) {
        return NextResponse.json(
          { error: `Check your ${idSpec.label.toLowerCase()}.` },
          { status: 400 }
        );
      }
    }

    // Build the country-correct external bank account.
    const external: Stripe.AccountCreateExternalAccountParams.BankAccount = (() => {
      const base = {
        object: "bank_account" as const,
        country: cfg.code,
        currency: cfg.currency,
        account_holder_name: accountHolderName,
        account_holder_type: "individual" as const,
      };
      switch (cfg.family) {
        case "us":
          return { ...base, routing_number: cleaned.routingNumber, account_number: cleaned.accountNumber };
        case "gb":
          return { ...base, routing_number: cleaned.sortCode, account_number: cleaned.accountNumber };
        case "ca":
          return { ...base, routing_number: `${cleaned.transitNumber}-${cleaned.institutionNumber}`, account_number: cleaned.accountNumber };
        case "au":
          return { ...base, routing_number: cleaned.bsb, account_number: cleaned.accountNumber };
        case "iban":
          return { ...base, account_number: cleaned.iban };
        default:
          throw new Error("Unsupported payout country");
      }
    })();

    // Client IP for the TOS acceptance record.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "0.0.0.0";

    // Update the individual (DOB, personal ID, TOS).
    const individual: Stripe.AccountUpdateParams.Individual = {
      dob: { day: dob.day, month: dob.month, year: dob.year },
    };
    if (idSpec?.key === "ssnLast4") individual.ssn_last_4 = personalIdClean;

    await stripe.accounts.update(store.stripeConnectAccountId, {
      individual,
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip },
    });

    // Attach the bank account.
    await stripe.accounts.createExternalAccount(store.stripeConnectAccountId, {
      external_account: external,
    });

    // Re-check status + surface anything Stripe still needs.
    const account = await stripe.accounts.retrieve(store.stripeConnectAccountId);
    const isComplete = !!(account.charges_enabled && account.payouts_enabled);
    const currentlyDue = account.requirements?.currently_due || [];

    await prisma.store.update({
      where: { id: store.id },
      data: { stripeOnboardingComplete: isComplete },
    });

    return NextResponse.json({
      success: true,
      onboardingComplete: isComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements: currentlyDue,
      requirementLabels: humanizeRequirements(currentlyDue),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to complete payout setup";
    console.error("Stripe Connect completion error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
