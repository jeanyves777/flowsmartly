import type Stripe from "stripe";
import { CREDIT_TO_CENTS } from "@/lib/credits/costs";
import { stripe } from "@/lib/stripe";

export type ListSmartlyPaymentBackup = {
  ready: boolean;
  paymentMethodId: string | null;
  label: string | null;
  reason: string | null;
};

function isCardExpired(card?: Stripe.PaymentMethod.Card | null) {
  if (!card?.exp_month || !card.exp_year) return false;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  return card.exp_year < currentYear || (card.exp_year === currentYear && card.exp_month < currentMonth);
}

function formatPaymentMethodLabel(paymentMethod: Stripe.PaymentMethod) {
  const brand = paymentMethod.card?.brand || "card";
  const last4 = paymentMethod.card?.last4 || "????";
  return `${brand} ending in ${last4}`;
}

export async function getListSmartlyPaymentBackup(
  stripeCustomerId?: string | null
): Promise<ListSmartlyPaymentBackup> {
  if (!stripe) {
    return {
      ready: false,
      paymentMethodId: null,
      label: null,
      reason: "Stripe is not configured.",
    };
  }

  if (!stripeCustomerId) {
    return {
      ready: false,
      paymentMethodId: null,
      label: null,
      reason: "A saved payment method is required for credit-only ListSmartly access.",
    };
  }

  let customer: Stripe.Customer | Stripe.DeletedCustomer;
  let paymentMethods: Stripe.ApiList<Stripe.PaymentMethod>;

  try {
    customer = await stripe.customers.retrieve(stripeCustomerId);
    paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
      limit: 20,
    });
  } catch (error) {
    console.error("[ListSmartly] Failed to verify backup payment method:", error);
    return {
      ready: false,
      paymentMethodId: null,
      label: null,
      reason: "The saved payment method could not be verified. Add a new card.",
    };
  }

  if (customer.deleted) {
    return {
      ready: false,
      paymentMethodId: null,
      label: null,
      reason: "The saved billing customer is no longer available.",
    };
  }

  const defaultPaymentMethod =
    typeof customer.invoice_settings?.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings?.default_payment_method?.id || null;

  const validMethods = paymentMethods.data.filter((pm) => pm.card && !isCardExpired(pm.card));
  const selected =
    validMethods.find((pm) => pm.id === defaultPaymentMethod) ||
    validMethods[0] ||
    null;

  if (!selected) {
    return {
      ready: false,
      paymentMethodId: null,
      label: null,
      reason: "Add a valid saved card to use ListSmartly without a FlowSmartly subscription.",
    };
  }

  return {
    ready: true,
    paymentMethodId: selected.id,
    label: formatPaymentMethodLabel(selected),
    reason: null,
  };
}

export async function chargeListSmartlyBackupCredits(params: {
  userId: string;
  profileId: string;
  stripeCustomerId: string;
  paymentMethodId: string;
  credits: number;
  description: string;
}) {
  if (!stripe) {
    throw new Error("STRIPE_NOT_CONFIGURED");
  }

  const amountCents = Math.max(50, params.credits * CREDIT_TO_CENTS);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    customer: params.stripeCustomerId,
    payment_method: params.paymentMethodId,
    confirm: true,
    off_session: true,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
    description: params.description,
    metadata: {
      userId: params.userId,
      profileId: params.profileId,
      credits: String(params.credits),
      type: "listsmartly_backup_credit_charge",
    },
  });

  if (paymentIntent.status !== "succeeded") {
    throw new Error("BACKUP_PAYMENT_FAILED");
  }

  return {
    amountCents,
    paymentIntentId: paymentIntent.id,
  };
}
