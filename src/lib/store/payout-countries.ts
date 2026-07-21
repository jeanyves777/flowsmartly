/**
 * Stripe Connect (Custom) payout support, by country.
 *
 * Stripe Connect is only available in a fixed set of countries — most of the
 * markets FlowSmartly serves in Africa / the Caribbean are NOT among them, so
 * for those the honest path is Cash-on-delivery (see store "Accepted methods").
 *
 * For the supported countries we group the bank-detail requirements into a few
 * well-understood "families" we can collect in-app (US, UK, Canada, Australia,
 * IBAN/SEPA). Anything supported by Stripe but with an idiosyncratic bank format
 * we can't safely hand-roll is sent through Stripe's own hosted onboarding
 * (Account Links) — still a Custom account, just with Stripe collecting the
 * country-specific fields correctly.
 *
 * This module is shared by the client form and the server completion route so
 * the field set + validation never drift apart.
 */

export type BankFamily = "us" | "gb" | "ca" | "au" | "iban" | "hosted";

export interface BankFieldSpec {
  key: string;
  label: string;
  placeholder: string;
  /** RegExp source, tested against the digit/upper-cased value. */
  pattern: string;
  maxLength?: number;
  /** true → strip spaces and upper-case before validate/submit (IBAN). */
  upper?: boolean;
  hint?: string;
}

export interface PayoutCountry {
  code: string;
  name: string;
  /** Settlement currency for the external bank account (lowercase, Stripe form). */
  currency: string;
  family: BankFamily;
}

// ── Bank-detail field specs per family (individual accounts) ──

export const BANK_FIELDS: Record<BankFamily, BankFieldSpec[]> = {
  us: [
    { key: "routingNumber", label: "Routing number", placeholder: "110000000", pattern: "^\\d{9}$", maxLength: 9, hint: "9 digits" },
    { key: "accountNumber", label: "Account number", placeholder: "000123456789", pattern: "^\\d{4,17}$", maxLength: 17 },
  ],
  gb: [
    { key: "sortCode", label: "Sort code", placeholder: "108800", pattern: "^\\d{6}$", maxLength: 6, hint: "6 digits, no dashes" },
    { key: "accountNumber", label: "Account number", placeholder: "00012345", pattern: "^\\d{8}$", maxLength: 8, hint: "8 digits" },
  ],
  ca: [
    { key: "transitNumber", label: "Transit number", placeholder: "11000", pattern: "^\\d{5}$", maxLength: 5, hint: "5 digits" },
    { key: "institutionNumber", label: "Institution number", placeholder: "000", pattern: "^\\d{3}$", maxLength: 3, hint: "3 digits" },
    { key: "accountNumber", label: "Account number", placeholder: "000123456789", pattern: "^\\d{7,12}$", maxLength: 12 },
  ],
  au: [
    { key: "bsb", label: "BSB", placeholder: "110000", pattern: "^\\d{6}$", maxLength: 6, hint: "6 digits" },
    { key: "accountNumber", label: "Account number", placeholder: "000123456", pattern: "^\\d{4,10}$", maxLength: 10 },
  ],
  iban: [
    { key: "iban", label: "IBAN", placeholder: "DE89 3704 0044 0532 0130 00", pattern: "^[A-Z]{2}\\d{2}[A-Z0-9]{10,30}$", upper: true, hint: "Your full IBAN" },
  ],
  hosted: [],
};

/** Personal ID field, per family, collected up-front (individual accounts). */
export const PERSONAL_ID_FIELD: Partial<Record<BankFamily, BankFieldSpec>> = {
  us: { key: "ssnLast4", label: "SSN (last 4)", placeholder: "1234", pattern: "^\\d{4}$", maxLength: 4 },
};

// ── Supported countries ──
// currency = the account's default settlement currency (lowercase, Stripe form).

export const PAYOUT_COUNTRIES: Record<string, PayoutCountry> = {
  US: { code: "US", name: "United States", currency: "usd", family: "us" },
  CA: { code: "CA", name: "Canada", currency: "cad", family: "ca" },
  GB: { code: "GB", name: "United Kingdom", currency: "gbp", family: "gb" },
  AU: { code: "AU", name: "Australia", currency: "aud", family: "au" },
  // IBAN / SEPA zone (+ UAE)
  FR: { code: "FR", name: "France", currency: "eur", family: "iban" },
  DE: { code: "DE", name: "Germany", currency: "eur", family: "iban" },
  ES: { code: "ES", name: "Spain", currency: "eur", family: "iban" },
  IT: { code: "IT", name: "Italy", currency: "eur", family: "iban" },
  NL: { code: "NL", name: "Netherlands", currency: "eur", family: "iban" },
  IE: { code: "IE", name: "Ireland", currency: "eur", family: "iban" },
  BE: { code: "BE", name: "Belgium", currency: "eur", family: "iban" },
  AT: { code: "AT", name: "Austria", currency: "eur", family: "iban" },
  PT: { code: "PT", name: "Portugal", currency: "eur", family: "iban" },
  FI: { code: "FI", name: "Finland", currency: "eur", family: "iban" },
  LU: { code: "LU", name: "Luxembourg", currency: "eur", family: "iban" },
  GR: { code: "GR", name: "Greece", currency: "eur", family: "iban" },
  AE: { code: "AE", name: "United Arab Emirates", currency: "aed", family: "iban" },
  // Supported by Stripe Connect but with bank formats we defer to hosted onboarding.
  MX: { code: "MX", name: "Mexico", currency: "mxn", family: "hosted" },
  BR: { code: "BR", name: "Brazil", currency: "brl", family: "hosted" },
  JP: { code: "JP", name: "Japan", currency: "jpy", family: "hosted" },
  SG: { code: "SG", name: "Singapore", currency: "sgd", family: "hosted" },
  IN: { code: "IN", name: "India", currency: "inr", family: "hosted" },
  TH: { code: "TH", name: "Thailand", currency: "thb", family: "hosted" },
  MY: { code: "MY", name: "Malaysia", currency: "myr", family: "hosted" },
  ID: { code: "ID", name: "Indonesia", currency: "idr", family: "hosted" },
  PH: { code: "PH", name: "Philippines", currency: "php", family: "hosted" },
};

export function getPayoutConfig(country?: string | null): PayoutCountry | null {
  if (!country) return null;
  return PAYOUT_COUNTRIES[country.toUpperCase()] || null;
}

export function isStripePayoutCountry(country?: string | null): boolean {
  return !!getPayoutConfig(country);
}

/** Fields the in-app form should render for a country (empty → hosted/unsupported). */
export function bankFieldsFor(country?: string | null): BankFieldSpec[] {
  const cfg = getPayoutConfig(country);
  return cfg ? BANK_FIELDS[cfg.family] : [];
}

export function personalIdFieldFor(country?: string | null): BankFieldSpec | null {
  const cfg = getPayoutConfig(country);
  return cfg ? PERSONAL_ID_FIELD[cfg.family] || null : null;
}

/** Clean a raw field value per its spec (strip spaces, upper-case for IBAN). */
export function cleanFieldValue(spec: BankFieldSpec, raw: string): string {
  const v = (raw || "").replace(/\s+/g, "");
  return spec.upper ? v.toUpperCase() : v;
}

// ── Humanize Stripe `requirements.currently_due` keys for the checklist ──

const REQUIREMENT_LABELS: Record<string, string> = {
  "individual.verification.document": "A photo of your ID",
  "individual.verification.additional_document": "A second ID document",
  "individual.id_number": "Your national ID number",
  "individual.ssn_last_4": "The last 4 digits of your SSN",
  "individual.dob.day": "Your date of birth",
  "individual.dob.month": "Your date of birth",
  "individual.dob.year": "Your date of birth",
  "individual.address.line1": "Your address",
  "individual.address.city": "Your city",
  "individual.address.postal_code": "Your postal code",
  "individual.phone": "Your phone number",
  "individual.email": "Your email",
  "company.tax_id": "Your business tax ID",
  "company.verification.document": "A business registration document",
  "external_account": "A bank account for payouts",
  "tos_acceptance.date": "Accepting Stripe's terms",
  "business_profile.url": "Your store URL",
  "business_profile.mcc": "Your business category",
};

export function humanizeRequirement(key: string): string {
  if (REQUIREMENT_LABELS[key]) return REQUIREMENT_LABELS[key];
  // Fall back to a readable version of the raw key.
  const tail = key.split(".").pop() || key;
  return tail.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** De-dupe requirement keys down to friendly, unique labels (order preserved). */
export function humanizeRequirements(keys: string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const label = humanizeRequirement(k);
    if (!out.includes(label)) out.push(label);
  }
  return out;
}
