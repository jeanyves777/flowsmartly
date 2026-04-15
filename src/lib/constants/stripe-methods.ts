/**
 * Canonical catalog of Stripe payment methods we surface in store checkouts.
 *
 * `capability` is the Stripe Connect capability key that gates availability
 * (see https://docs.stripe.com/connect/account-capabilities). When null, the
 * method rides on `card_payments` (e.g. Link is effectively always-on once
 * card is active; Apple/Google Pay are wallet overlays on card).
 *
 * `payment_method_types` is the identifier passed to PaymentIntent's
 * `payment_method_types` when building an allowlist.
 */

export type StripeMethodId =
  | "card"
  | "apple_pay"
  | "google_pay"
  | "link"
  | "cashapp"
  | "klarna"
  | "affirm"
  | "afterpay_clearpay"
  | "ideal"
  | "bancontact"
  | "sepa_debit"
  | "sofort"
  | "eps"
  | "p24"
  | "blik"
  | "giropay"
  | "alipay"
  | "wechat_pay";

export interface StripeMethodDef {
  id: StripeMethodId;
  label: string;
  description: string;
  capability: string | null;
  paymentMethodType: string;
  redirectBased: boolean;
}

export const STRIPE_METHOD_CATALOG: StripeMethodDef[] = [
  { id: "card", label: "Credit / Debit Card", description: "Visa, Mastercard, Amex, Discover", capability: "card_payments", paymentMethodType: "card", redirectBased: false },
  { id: "apple_pay", label: "Apple Pay", description: "Wallet overlay on Card (Safari/iOS)", capability: "card_payments", paymentMethodType: "card", redirectBased: false },
  { id: "google_pay", label: "Google Pay", description: "Wallet overlay on Card (Chrome/Android)", capability: "card_payments", paymentMethodType: "card", redirectBased: false },
  { id: "link", label: "Link", description: "One-click Stripe Link checkout", capability: null, paymentMethodType: "link", redirectBased: false },
  { id: "cashapp", label: "Cash App Pay", description: "US mobile wallet", capability: "cashapp_payments", paymentMethodType: "cashapp", redirectBased: true },
  { id: "klarna", label: "Klarna", description: "Pay later / instalments", capability: "klarna_payments", paymentMethodType: "klarna", redirectBased: true },
  { id: "affirm", label: "Affirm", description: "US buy-now-pay-later", capability: "affirm_payments", paymentMethodType: "affirm", redirectBased: true },
  { id: "afterpay_clearpay", label: "Afterpay / Clearpay", description: "Pay in 4 (US, UK, AU, CA)", capability: "afterpay_clearpay_payments", paymentMethodType: "afterpay_clearpay", redirectBased: true },
  { id: "ideal", label: "iDEAL", description: "Netherlands bank transfer", capability: "ideal_payments", paymentMethodType: "ideal", redirectBased: true },
  { id: "bancontact", label: "Bancontact", description: "Belgium bank transfer", capability: "bancontact_payments", paymentMethodType: "bancontact", redirectBased: true },
  { id: "sepa_debit", label: "SEPA Direct Debit", description: "Eurozone bank debit", capability: "sepa_debit_payments", paymentMethodType: "sepa_debit", redirectBased: false },
  { id: "sofort", label: "Sofort", description: "Germany / Austria bank transfer", capability: "sofort_payments", paymentMethodType: "sofort", redirectBased: true },
  { id: "eps", label: "EPS", description: "Austria bank transfer", capability: "eps_payments", paymentMethodType: "eps", redirectBased: true },
  { id: "p24", label: "Przelewy24", description: "Poland bank transfer", capability: "p24_payments", paymentMethodType: "p24", redirectBased: true },
  { id: "blik", label: "BLIK", description: "Poland mobile payment", capability: "blik_payments", paymentMethodType: "blik", redirectBased: true },
  { id: "giropay", label: "giropay", description: "Germany bank transfer", capability: "giropay_payments", paymentMethodType: "giropay", redirectBased: true },
  { id: "alipay", label: "Alipay", description: "China wallet", capability: "alipay_payments", paymentMethodType: "alipay", redirectBased: true },
  { id: "wechat_pay", label: "WeChat Pay", description: "China wallet", capability: "wechat_pay_payments", paymentMethodType: "wechat_pay", redirectBased: true },
];

/** Map a list of enabled IDs → unique Stripe payment_method_types for PaymentIntent. */
export function toPaymentMethodTypes(ids: StripeMethodId[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const def = STRIPE_METHOD_CATALOG.find((m) => m.id === id);
    if (def) out.add(def.paymentMethodType);
  }
  return Array.from(out);
}
